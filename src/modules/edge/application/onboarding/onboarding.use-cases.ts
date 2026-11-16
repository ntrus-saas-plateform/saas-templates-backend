import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import { EDGE_P7_OUTBOX_TENANT } from '../../domain/provisioning/provisioning.events.js';
import type { ActivationRepositoryPort } from '../../domain/readiness-activation/activation-repository.port.js';
import { ActivationRecordStatus } from '../../domain/readiness-activation/activation.types.js';
import {
  canDecideTask,
  canRequestAdvance,
  canRequestClose,
  canRequestStart,
} from '../../domain/onboarding/onboarding-policy.js';
import type { OnboardingRepositoryPort } from '../../domain/onboarding/onboarding-repository.port.js';
import {
  DEFAULT_ONBOARDING_STEP_PLAN,
  OnboardingErrorCode,
  OnboardingJourneyStatus,
  OnboardingTemplateStatus,
} from '../../domain/onboarding/onboarding.types.js';
import type { WorkflowAuthorizationPort } from '../../domain/workflow/workflow-authorization.port.js';
import type { WorkflowRepositoryPort } from '../../domain/workflow/workflow-repository.port.js';
import { WorkflowDefinitionStatus } from '../../domain/workflow/workflow.types.js';
import { validateDefinition } from '../../domain/workflow/workflow-definition.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

async function requireAudit(
  audit: AuditEventRepositoryPort,
  input: {
    eventType: string;
    actorId: string;
    subjectType: string;
    subjectId: string;
    details: Record<string, unknown>;
  },
  client: unknown,
): Promise<void> {
  const details: Record<string, unknown> = { ...input.details };
  const actorId = isUuid(input.actorId) ? input.actorId : null;
  if (actorId === null && input.actorId) details.actorRef = input.actorId;
  const subjectId = isUuid(input.subjectId) ? input.subjectId : null;
  if (subjectId === null && input.subjectId) details.subjectRef = input.subjectId;
  try {
    await audit.create({ ...input, actorId, subjectId, details }, client);
  } catch (err) {
    throw new DomainError(
      ErrorCode.DEPENDENCY_UNAVAILABLE,
      'Durable audit required for onboarding mutation',
      [{ eventType: input.eventType }],
      err instanceof Error ? err : undefined,
    );
  }
}

// ---------------------------------------------------------------------------
// Workflow definitions (P7.12)
// ---------------------------------------------------------------------------

export const ONBOARDING_WORKFLOW_DEFINITIONS = {
  start: {
    code: 'p712.onboarding.start',
    name: 'P7.12 Onboarding Start',
    description:
      'Revalidate auth, require ACTIVE activation, materialize steps, mark started, verify',
    snapshot: {
      steps: [
        {
          key: 'revalidate_auth',
          type: 'HANDLER',
          handlerKey: 'onboarding.revalidate_auth',
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'require_activation_active',
          type: 'HANDLER',
          handlerKey: 'onboarding.require_activation_active',
          dependsOn: ['revalidate_auth'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'materialize_steps',
          type: 'HANDLER',
          handlerKey: 'onboarding.materialize_steps',
          dependsOn: ['require_activation_active'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'mark_started',
          type: 'HANDLER',
          handlerKey: 'onboarding.mark_started',
          dependsOn: ['materialize_steps'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'verify',
          type: 'HANDLER',
          handlerKey: 'onboarding.verify',
          dependsOn: ['mark_started'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
      ],
    },
  },
  advance: {
    code: 'p712.onboarding.advance',
    name: 'P7.12 Onboarding Advance',
    description:
      'Revalidate auth, advance next READY/PENDING required step (HUMAN→task, COORD/VERIFY→signal, HANDOVER→vault ref), verify',
    snapshot: {
      steps: [
        {
          key: 'revalidate_auth',
          type: 'HANDLER',
          handlerKey: 'onboarding.revalidate_auth',
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'advance_step',
          type: 'HANDLER',
          handlerKey: 'onboarding.advance_step',
          dependsOn: ['revalidate_auth'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'verify',
          type: 'HANDLER',
          handlerKey: 'onboarding.verify',
          dependsOn: ['advance_step'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
      ],
    },
  },
  approve: {
    code: 'p712.onboarding.approve',
    name: 'P7.12 Onboarding Approve Task',
    description:
      'Revalidate P7.1 (human approval cannot bypass auth), apply APPROVE decision, verify',
    snapshot: {
      steps: [
        {
          key: 'revalidate_auth',
          type: 'HANDLER',
          handlerKey: 'onboarding.revalidate_auth',
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'apply_task_decision',
          type: 'HANDLER',
          handlerKey: 'onboarding.apply_task_decision',
          dependsOn: ['revalidate_auth'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'verify',
          type: 'HANDLER',
          handlerKey: 'onboarding.verify',
          dependsOn: ['apply_task_decision'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
      ],
    },
  },
  reject: {
    code: 'p712.onboarding.reject',
    name: 'P7.12 Onboarding Reject Task',
    description:
      'Revalidate P7.1 (human reject cannot bypass auth), apply REJECT decision, verify',
    snapshot: {
      steps: [
        {
          key: 'revalidate_auth',
          type: 'HANDLER',
          handlerKey: 'onboarding.revalidate_auth',
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'apply_task_decision',
          type: 'HANDLER',
          handlerKey: 'onboarding.apply_task_decision',
          dependsOn: ['revalidate_auth'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'verify',
          type: 'HANDLER',
          handlerKey: 'onboarding.verify',
          dependsOn: ['apply_task_decision'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
      ],
    },
  },
  close: {
    code: 'p712.onboarding.close',
    name: 'P7.12 Onboarding Close',
    description:
      'Revalidate auth, mark closed only if all required steps PASSED, verify',
    snapshot: {
      steps: [
        {
          key: 'revalidate_auth',
          type: 'HANDLER',
          handlerKey: 'onboarding.revalidate_auth',
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'mark_closed',
          type: 'HANDLER',
          handlerKey: 'onboarding.mark_closed',
          dependsOn: ['revalidate_auth'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'verify',
          type: 'HANDLER',
          handlerKey: 'onboarding.verify',
          dependsOn: ['mark_closed'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
      ],
    },
  },
} as const;

export type OnboardingWorkflowKind = keyof typeof ONBOARDING_WORKFLOW_DEFINITIONS;

const WORKFLOW_RETRY_DEFAULTS = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 15_000,
  multiplier: 2,
  jitterRatio: 0.2,
};

/**
 * Ensure a P7.12 workflow definition exists and is PUBLISHED (idempotent).
 */
export async function ensureOnboardingDefinition(
  repo: WorkflowRepositoryPort,
  outbox: ControlPlaneOutboxTransactionService,
  _audit: AuditEventRepositoryPort,
  actorId: string,
  kind: OnboardingWorkflowKind = 'start',
): Promise<{ id: string }> {
  const def = ONBOARDING_WORKFLOW_DEFINITIONS[kind];
  const code = def.code;
  const existing = await repo.getDefinitionByCode(code);
  if (existing && existing.definitionStatus === WorkflowDefinitionStatus.PUBLISHED) {
    return existing;
  }
  const snapshot = {
    steps: def.snapshot.steps.map((s) => ({
      ...s,
      dependsOn:
        'dependsOn' in s && s.dependsOn ? [...(s.dependsOn as readonly string[])] : undefined,
    })),
    retryDefaults: WORKFLOW_RETRY_DEFAULTS,
    timeoutDefaultsMs: 600_000,
  };
  validateDefinition(snapshot);

  return outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
    const publishExisting = async (d: {
      id: string;
      version: number;
      definitionStatus: string;
    }) => {
      if (d.definitionStatus === WorkflowDefinitionStatus.PUBLISHED) return d;
      const latest = await repo.getLatestDefinitionVersion(d.id);
      if (!latest) {
        throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Workflow definition version missing');
      }
      let currentVersion = d.version;
      if (d.definitionStatus === WorkflowDefinitionStatus.DRAFT) {
        const validated = await repo.setDefinitionStatus(
          d.id,
          WorkflowDefinitionStatus.VALIDATED,
          currentVersion,
          {},
          client,
        );
        currentVersion = validated.version;
      }
      if (d.definitionStatus !== WorkflowDefinitionStatus.VALIDATED) {
        const latestNow = await repo.getLatestDefinitionVersion(d.id);
        await repo.publishDefinitionVersion(
          d.id,
          latestNow?.versionNumber ?? latest.versionNumber,
          latest.snapshot,
          client,
        );
      }
      return repo.setDefinitionStatus(
        d.id,
        WorkflowDefinitionStatus.PUBLISHED,
        currentVersion,
        { approvedBy: actorId, publishedAt: new Date() },
        client,
      );
    };

    const again = await repo.getDefinitionByCode(code);
    if (again) return publishExisting(again);

    const created = await repo.createDefinition(
      {
        code,
        name: def.name,
        description: def.description,
        domain: 'onboarding',
        definitionStatus: WorkflowDefinitionStatus.DRAFT,
        securityClassification: 'INTERNAL',
        createdBy: actorId,
        approvedBy: null,
        publishedAt: null,
        draftSnapshot: snapshot,
      },
      client,
    );
    const version = created.version;
    await repo.publishDefinitionVersion(
      created.definition.id,
      version.versionNumber,
      version.snapshot,
      client,
    );
    await repo.setDefinitionStatus(
      created.definition.id,
      WorkflowDefinitionStatus.VALIDATED,
      created.definition.version,
      {},
      client,
    );
    return repo.setDefinitionStatus(
      created.definition.id,
      WorkflowDefinitionStatus.PUBLISHED,
      created.definition.version + 1,
      { approvedBy: actorId, publishedAt: new Date() },
      client,
    );
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export class ListOnboardingUseCase {
  constructor(private readonly repo: OnboardingRepositoryPort) {}

  templates(filter: {
    status?: string;
    productId?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listTemplates(filter);
  }
  template(id: string) {
    return this.repo.getTemplate(id);
  }
  journeys(filter: {
    tenantId?: string;
    productId?: string;
    status?: string;
    activationRecordId?: string;
    templateId?: string;
    provisioningRequestId?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listJourneys(filter);
  }
  journey(id: string) {
    return this.repo.getJourney(id);
  }
  steps(journeyId: string) {
    return this.repo.listSteps(journeyId);
  }
  tasks(filter: { journeyId?: string; status?: string; limit?: number }) {
    return this.repo.listTasks(filter);
  }
  runs(journeyId: string, limit?: number) {
    return this.repo.listRuns(journeyId, limit);
  }
  evidence(filter: { journeyId?: string; limit?: number }) {
    return this.repo.listEvidence(filter);
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export class CreateOnboardingTemplateUseCase {
  constructor(
    private readonly repo: OnboardingRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    productId?: string | null;
    deploymentProfileCode?: string | null;
    stepPlan?: Array<Record<string, unknown>>;
    slaPolicy?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    const code = input.code.trim().toLowerCase();
    if (!code) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Template code is required', [
        { code: OnboardingErrorCode.VALIDATION },
      ]);
    }
    const existing = await this.repo.getTemplateByCode(code);
    if (existing) {
      throw new DomainError(ErrorCode.CONFLICT, 'Onboarding template code already exists', [
        { code: OnboardingErrorCode.CONFLICT },
      ]);
    }

    const stepPlan =
      input.stepPlan && input.stepPlan.length > 0
        ? input.stepPlan
        : DEFAULT_ONBOARDING_STEP_PLAN.map((p) => ({
            key: p.key,
            kind: p.kind,
            required: p.required,
          }));

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const created = await this.repo.createTemplate(
        {
          code,
          name: input.name.trim(),
          description: input.description ?? null,
          productId: input.productId ?? null,
          deploymentProfileCode: input.deploymentProfileCode ?? null,
          templateStatus: OnboardingTemplateStatus.DRAFT,
          stepPlan,
          slaPolicy: input.slaPolicy ?? {},
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'ONBOARDING_TEMPLATE',
          resourceId: created.id,
          action: 'CREATE',
          actorId: input.actorId,
          toStatus: String(created.templateStatus),
          details: { code: created.code },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.onboarding.template.created',
          actorId: input.actorId,
          subjectType: 'ONBOARDING_TEMPLATE',
          subjectId: created.id,
          details: { code: created.code },
        },
        client,
      );
      return created;
    });
  }
}

export class PublishOnboardingTemplateUseCase {
  constructor(
    private readonly repo: OnboardingRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    templateId: string;
    expectedVersion: number;
  }) {
    const template = await this.repo.getTemplate(input.templateId);
    if (!template) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Onboarding template not found');
    }
    if (
      template.templateStatus !== OnboardingTemplateStatus.DRAFT &&
      template.templateStatus !== OnboardingTemplateStatus.VALIDATED
    ) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Publish requires DRAFT/VALIDATED; current=${template.templateStatus}`,
        [{ code: OnboardingErrorCode.TEMPLATE_NOT_PUBLISHED }],
      );
    }

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      let current = template;
      if (current.templateStatus === OnboardingTemplateStatus.DRAFT) {
        current = await this.repo.updateTemplate(
          current.id,
          { templateStatus: OnboardingTemplateStatus.VALIDATED },
          current.version,
          input.actorId,
          client,
        );
      }
      const published = await this.repo.updateTemplate(
        current.id,
        { templateStatus: OnboardingTemplateStatus.PUBLISHED },
        current.version,
        input.actorId,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'ONBOARDING_TEMPLATE',
          resourceId: published.id,
          action: 'PUBLISH',
          actorId: input.actorId,
          fromStatus: String(template.templateStatus),
          toStatus: String(published.templateStatus),
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.onboarding.template.published',
          actorId: input.actorId,
          subjectType: 'ONBOARDING_TEMPLATE',
          subjectId: published.id,
          details: { code: published.code },
        },
        client,
      );
      return published;
    });
  }
}

// ---------------------------------------------------------------------------
// Create journey from ACTIVE activation
// ---------------------------------------------------------------------------

export class CreateOnboardingJourneyUseCase {
  constructor(
    private readonly repo: OnboardingRepositoryPort,
    private readonly activationRepo: ActivationRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    activationRecordId: string;
    templateId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const activation = await this.activationRepo.getActivationRecord(input.activationRecordId);
    if (!activation) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Activation record not found');
    }
    if (activation.activationStatus !== ActivationRecordStatus.ACTIVE) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Onboarding journey requires Activation Record ACTIVE (P7.10)',
        [{ code: OnboardingErrorCode.ACTIVATION_NOT_ACTIVE }],
      );
    }

    const revalidated = await this.auth.revalidateBoundAuthorization({
      authorizationRowId: activation.authorizationRowId,
      authorizationVersion: activation.authorizationVersion,
      provisioningRequestId: activation.provisioningRequestId,
    });
    if (!revalidated) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'P7.1 bound authorization revalidation failed (fail-closed)',
        [{ code: OnboardingErrorCode.AUTHORIZATION_FAILED }],
      );
    }

    let templateId = input.templateId ?? null;
    if (templateId) {
      const template = await this.repo.getTemplate(templateId);
      if (!template) {
        throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Onboarding template not found');
      }
      if (template.templateStatus !== OnboardingTemplateStatus.PUBLISHED) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Onboarding template must be PUBLISHED',
          [{ code: OnboardingErrorCode.TEMPLATE_NOT_PUBLISHED }],
        );
      }
    }

    const existing = await this.repo.getActiveJourney(activation.tenantId, activation.productId);
    if (existing) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'Active onboarding journey already exists for tenant/product',
        [{ code: OnboardingErrorCode.CONFLICT }],
      );
    }

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const created = await this.repo.createJourney(
        {
          tenantId: activation.tenantId,
          productId: activation.productId,
          subscriptionId: activation.subscriptionId,
          accountId: activation.accountId,
          templateId,
          activationRecordId: activation.id,
          provisioningRequestId: activation.provisioningRequestId,
          authorizationRowId: activation.authorizationRowId,
          authorizationVersion: activation.authorizationVersion,
          journeyStatus: OnboardingJourneyStatus.PENDING,
          currentStepKey: null,
          workflowId: null,
          startedAt: null,
          closedAt: null,
          handoverEvidenceRef: null,
          failureCode: null,
          failureMessage: null,
          metadata: {
            ...(input.metadata ?? {}),
            note: 'Operational onboarding — never CRM / never business invites / never Subscription.ACTIVE',
          },
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'ONBOARDING_JOURNEY',
          resourceId: created.id,
          tenantId: created.tenantId,
          action: 'CREATE',
          actorId: input.actorId,
          toStatus: String(created.journeyStatus),
          details: { activationRecordId: activation.id, templateId },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.onboarding.journey.created',
          actorId: input.actorId,
          subjectType: 'ONBOARDING_JOURNEY',
          subjectId: created.id,
          details: {
            tenantId: created.tenantId,
            productId: created.productId,
            activationRecordId: activation.id,
          },
        },
        client,
      );
      return created;
    });
  }
}

// ---------------------------------------------------------------------------
// Request workflows
// ---------------------------------------------------------------------------

type WorkflowCreateStart = {
  execute(input: {
    actorId: string;
    idempotencyKey: string;
    definitionId: string;
    workflowType: string;
    inputSnapshot?: Record<string, unknown>;
    provisioningRequestId?: string | null;
    businessReference?: string | null;
  }): Promise<{ id: string; state: string }>;
};

type WorkflowStart = {
  execute(input: { actorId: string; workflowId: string }): Promise<{ id: string; state: string }>;
};

async function revalidateOnboardingAuth(
  auth: WorkflowAuthorizationPort,
  record: {
    authorizationRowId: string;
    authorizationVersion: number;
    provisioningRequestId: string;
  },
  provisioningRequestId: string | null,
) {
  if (!record.authorizationRowId || record.authorizationVersion == null) {
    throw new DomainError(
      ErrorCode.FORBIDDEN,
      'Onboarding journey has no bound P7.1 authorization (fail-closed)',
      [{ code: OnboardingErrorCode.AUTHORIZATION_FAILED }],
    );
  }
  const revalidated = await auth.revalidateBoundAuthorization({
    authorizationRowId: record.authorizationRowId,
    authorizationVersion: record.authorizationVersion,
    provisioningRequestId: provisioningRequestId ?? record.provisioningRequestId,
  });
  if (!revalidated) {
    throw new DomainError(
      ErrorCode.FORBIDDEN,
      'P7.1 authorization not valid for onboarding operation',
      [{ code: OnboardingErrorCode.AUTHORIZATION_FAILED }],
    );
  }
  return revalidated;
}

export class RequestOnboardingStartUseCase {
  constructor(
    private readonly repo: OnboardingRepositoryPort,
    private readonly wfRepo: WorkflowRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
    private readonly createInstance: WorkflowCreateStart,
    private readonly startWorkflow: WorkflowStart,
  ) {}

  async execute(input: {
    actorId: string;
    correlationId: string;
    idempotencyKey: string;
    journeyId: string;
    provisioningRequestId?: string | null;
    reason?: string | null;
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) {
      return {
        workflow: wfExisting,
        journey: await this.repo.getJourney(input.journeyId),
      };
    }

    const journey = await this.repo.getJourney(input.journeyId);
    if (!journey) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Onboarding journey not found');
    }

    const guard = canRequestStart(journey.journeyStatus);
    if (!guard.allowed) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, guard.reason, [{ code: guard.code }]);
    }

    const provisioningRequestId =
      input.provisioningRequestId ?? journey.provisioningRequestId ?? null;
    await revalidateOnboardingAuth(this.auth, journey, provisioningRequestId);

    const definition = await ensureOnboardingDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      'start',
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: 'onboarding.start',
      provisioningRequestId,
      businessReference: journey.id,
      inputSnapshot: {
        journeyId: journey.id,
        activationRecordId: journey.activationRecordId,
        tenantId: journey.tenantId,
        productId: journey.productId,
        subscriptionId: journey.subscriptionId,
        authorizationRowId: journey.authorizationRowId,
        authorizationVersion: journey.authorizationVersion,
        provisioningRequestId,
        actorId: input.actorId,
        correlationId: input.correlationId,
        reason: input.reason ?? null,
        operation: 'START',
      },
    });

    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      await this.repo.updateJourney(
        journey.id,
        {
          workflowId: instance.id,
          journeyStatus: OnboardingJourneyStatus.STARTING,
        },
        journey.version,
        input.actorId,
        client,
      );
      await this.repo.createRun(
        {
          journeyId: journey.id,
          tenantId: journey.tenantId,
          productId: journey.productId,
          operation: 'START',
          workflowId: instance.id,
          outcome: 'PENDING',
          errorCode: null,
          errorMessage: null,
          observedState: { fromStatus: journey.journeyStatus },
          evidence: {},
          startedAt: new Date(),
          finishedAt: null,
          performedBy: input.actorId,
          correlationId: input.correlationId,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'ONBOARDING_JOURNEY',
          resourceId: journey.id,
          tenantId: journey.tenantId,
          fromStatus: String(journey.journeyStatus),
          toStatus: OnboardingJourneyStatus.STARTING,
          action: 'LAUNCH_START',
          reason: input.reason ?? null,
          actorId: input.actorId,
          details: { workflowId: instance.id },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.onboarding.start.requested',
          actorId: input.actorId,
          subjectType: 'ONBOARDING_JOURNEY',
          subjectId: journey.id,
          details: { workflowId: instance.id },
        },
        client,
      );
    });

    const started = await this.startWorkflow.execute({
      actorId: input.actorId,
      workflowId: instance.id,
    });
    return {
      workflow: started,
      journey: await this.repo.getJourney(journey.id),
    };
  }
}

export class RequestOnboardingAdvanceUseCase {
  constructor(
    private readonly repo: OnboardingRepositoryPort,
    private readonly wfRepo: WorkflowRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
    private readonly createInstance: WorkflowCreateStart,
    private readonly startWorkflow: WorkflowStart,
  ) {}

  async execute(input: {
    actorId: string;
    correlationId: string;
    idempotencyKey: string;
    journeyId: string;
    provisioningRequestId?: string | null;
    reason?: string | null;
    handoverEvidenceRef?: string | null;
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) {
      return {
        workflow: wfExisting,
        journey: await this.repo.getJourney(input.journeyId),
      };
    }

    const journey = await this.repo.getJourney(input.journeyId);
    if (!journey) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Onboarding journey not found');
    }

    const guard = canRequestAdvance(journey.journeyStatus);
    if (!guard.allowed) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, guard.reason, [{ code: guard.code }]);
    }

    const provisioningRequestId =
      input.provisioningRequestId ?? journey.provisioningRequestId ?? null;
    await revalidateOnboardingAuth(this.auth, journey, provisioningRequestId);

    const definition = await ensureOnboardingDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      'advance',
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: 'onboarding.advance',
      provisioningRequestId,
      businessReference: journey.id,
      inputSnapshot: {
        journeyId: journey.id,
        activationRecordId: journey.activationRecordId,
        tenantId: journey.tenantId,
        productId: journey.productId,
        subscriptionId: journey.subscriptionId,
        authorizationRowId: journey.authorizationRowId,
        authorizationVersion: journey.authorizationVersion,
        provisioningRequestId,
        actorId: input.actorId,
        correlationId: input.correlationId,
        reason: input.reason ?? null,
        handoverEvidenceRef: input.handoverEvidenceRef ?? null,
        operation: 'ADVANCE',
      },
    });

    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      await this.repo.updateJourney(
        journey.id,
        { workflowId: instance.id },
        journey.version,
        input.actorId,
        client,
      );
      await this.repo.createRun(
        {
          journeyId: journey.id,
          tenantId: journey.tenantId,
          productId: journey.productId,
          operation: 'ADVANCE',
          workflowId: instance.id,
          outcome: 'PENDING',
          errorCode: null,
          errorMessage: null,
          observedState: { fromStatus: journey.journeyStatus },
          evidence: {},
          startedAt: new Date(),
          finishedAt: null,
          performedBy: input.actorId,
          correlationId: input.correlationId,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'ONBOARDING_JOURNEY',
          resourceId: journey.id,
          tenantId: journey.tenantId,
          fromStatus: String(journey.journeyStatus),
          toStatus: String(journey.journeyStatus),
          action: 'LAUNCH_ADVANCE',
          reason: input.reason ?? null,
          actorId: input.actorId,
          details: { workflowId: instance.id },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.onboarding.advance.requested',
          actorId: input.actorId,
          subjectType: 'ONBOARDING_JOURNEY',
          subjectId: journey.id,
          details: { workflowId: instance.id },
        },
        client,
      );
    });

    const started = await this.startWorkflow.execute({
      actorId: input.actorId,
      workflowId: instance.id,
    });
    return {
      workflow: started,
      journey: await this.repo.getJourney(journey.id),
    };
  }
}

export class RequestOnboardingCloseUseCase {
  constructor(
    private readonly repo: OnboardingRepositoryPort,
    private readonly wfRepo: WorkflowRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
    private readonly createInstance: WorkflowCreateStart,
    private readonly startWorkflow: WorkflowStart,
  ) {}

  async execute(input: {
    actorId: string;
    correlationId: string;
    idempotencyKey: string;
    journeyId: string;
    provisioningRequestId?: string | null;
    reason?: string | null;
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) {
      return {
        workflow: wfExisting,
        journey: await this.repo.getJourney(input.journeyId),
      };
    }

    const journey = await this.repo.getJourney(input.journeyId);
    if (!journey) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Onboarding journey not found');
    }

    const steps = await this.repo.listSteps(journey.id);
    const guard = canRequestClose({ journeyStatus: journey.journeyStatus, steps });
    if (!guard.allowed) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, guard.reason, [{ code: guard.code }]);
    }

    const provisioningRequestId =
      input.provisioningRequestId ?? journey.provisioningRequestId ?? null;
    await revalidateOnboardingAuth(this.auth, journey, provisioningRequestId);

    const definition = await ensureOnboardingDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      'close',
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: 'onboarding.close',
      provisioningRequestId,
      businessReference: journey.id,
      inputSnapshot: {
        journeyId: journey.id,
        activationRecordId: journey.activationRecordId,
        tenantId: journey.tenantId,
        productId: journey.productId,
        subscriptionId: journey.subscriptionId,
        authorizationRowId: journey.authorizationRowId,
        authorizationVersion: journey.authorizationVersion,
        provisioningRequestId,
        actorId: input.actorId,
        correlationId: input.correlationId,
        reason: input.reason ?? null,
        operation: 'CLOSE',
      },
    });

    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      await this.repo.updateJourney(
        journey.id,
        {
          workflowId: instance.id,
          journeyStatus: OnboardingJourneyStatus.CLOSING,
        },
        journey.version,
        input.actorId,
        client,
      );
      await this.repo.createRun(
        {
          journeyId: journey.id,
          tenantId: journey.tenantId,
          productId: journey.productId,
          operation: 'CLOSE',
          workflowId: instance.id,
          outcome: 'PENDING',
          errorCode: null,
          errorMessage: null,
          observedState: { fromStatus: journey.journeyStatus },
          evidence: {},
          startedAt: new Date(),
          finishedAt: null,
          performedBy: input.actorId,
          correlationId: input.correlationId,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'ONBOARDING_JOURNEY',
          resourceId: journey.id,
          tenantId: journey.tenantId,
          fromStatus: String(journey.journeyStatus),
          toStatus: OnboardingJourneyStatus.CLOSING,
          action: 'LAUNCH_CLOSE',
          reason: input.reason ?? null,
          actorId: input.actorId,
          details: { workflowId: instance.id },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.onboarding.close.requested',
          actorId: input.actorId,
          subjectType: 'ONBOARDING_JOURNEY',
          subjectId: journey.id,
          details: { workflowId: instance.id },
        },
        client,
      );
    });

    const started = await this.startWorkflow.execute({
      actorId: input.actorId,
      workflowId: instance.id,
    });
    return {
      workflow: started,
      journey: await this.repo.getJourney(journey.id),
    };
  }
}

/**
 * Approve or reject an OPEN human task.
 * MUST revalidate P7.1 before accepting — human approval cannot bypass auth.
 */
export class DecideOnboardingTaskUseCase {
  constructor(
    private readonly repo: OnboardingRepositoryPort,
    private readonly wfRepo: WorkflowRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
    private readonly createInstance: WorkflowCreateStart,
    private readonly startWorkflow: WorkflowStart,
  ) {}

  async execute(input: {
    actorId: string;
    correlationId: string;
    idempotencyKey: string;
    journeyId: string;
    taskId: string;
    decision: 'APPROVE' | 'REJECT';
    reason?: string | null;
    provisioningRequestId?: string | null;
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) {
      return {
        workflow: wfExisting,
        journey: await this.repo.getJourney(input.journeyId),
        task: await this.repo.getTask(input.taskId),
      };
    }

    const journey = await this.repo.getJourney(input.journeyId);
    if (!journey) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Onboarding journey not found');
    }
    const task = await this.repo.getTask(input.taskId);
    if (!task || task.journeyId !== journey.id) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Onboarding task not found');
    }

    const provisioningRequestId =
      input.provisioningRequestId ?? journey.provisioningRequestId ?? null;

    // CRITICAL: revalidate P7.1 BEFORE accepting human decision
    let authOk = false;
    try {
      await revalidateOnboardingAuth(this.auth, journey, provisioningRequestId);
      authOk = true;
    } catch {
      authOk = false;
    }

    const guard = canDecideTask({
      taskStatus: task.taskStatus,
      journeyStatus: journey.journeyStatus,
      authorizationRevalidated: authOk,
      decision: input.decision,
    });
    if (!guard.allowed) {
      throw new DomainError(
        guard.code === OnboardingErrorCode.HUMAN_APPROVAL_CANNOT_BYPASS_AUTH
          ? ErrorCode.FORBIDDEN
          : ErrorCode.VALIDATION_ERROR,
        guard.reason,
        [{ code: guard.code }],
      );
    }

    const kind = input.decision === 'APPROVE' ? 'approve' : 'reject';
    const definition = await ensureOnboardingDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      kind,
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: `onboarding.${kind}`,
      provisioningRequestId,
      businessReference: journey.id,
      inputSnapshot: {
        journeyId: journey.id,
        taskId: task.id,
        activationRecordId: journey.activationRecordId,
        tenantId: journey.tenantId,
        productId: journey.productId,
        subscriptionId: journey.subscriptionId,
        authorizationRowId: journey.authorizationRowId,
        authorizationVersion: journey.authorizationVersion,
        provisioningRequestId,
        actorId: input.actorId,
        correlationId: input.correlationId,
        reason: input.reason ?? null,
        decision: input.decision,
        operation: input.decision,
      },
    });

    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      await this.repo.updateJourney(
        journey.id,
        { workflowId: instance.id },
        journey.version,
        input.actorId,
        client,
      );
      await this.repo.createRun(
        {
          journeyId: journey.id,
          tenantId: journey.tenantId,
          productId: journey.productId,
          operation: input.decision,
          workflowId: instance.id,
          outcome: 'PENDING',
          errorCode: null,
          errorMessage: null,
          observedState: { taskId: task.id, fromStatus: journey.journeyStatus },
          evidence: { authorizationRevalidated: true },
          startedAt: new Date(),
          finishedAt: null,
          performedBy: input.actorId,
          correlationId: input.correlationId,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'ONBOARDING_TASK',
          resourceId: task.id,
          tenantId: journey.tenantId,
          action: `LAUNCH_${input.decision}`,
          reason: input.reason ?? null,
          actorId: input.actorId,
          details: { workflowId: instance.id, journeyId: journey.id },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: `p7.onboarding.task.${kind}.requested`,
          actorId: input.actorId,
          subjectType: 'ONBOARDING_TASK',
          subjectId: task.id,
          details: { workflowId: instance.id, journeyId: journey.id },
        },
        client,
      );
    });

    const started = await this.startWorkflow.execute({
      actorId: input.actorId,
      workflowId: instance.id,
    });
    return {
      workflow: started,
      journey: await this.repo.getJourney(journey.id),
      task: await this.repo.getTask(task.id),
    };
  }
}

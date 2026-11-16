import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import { EDGE_P7_OUTBOX_TENANT } from '../../domain/provisioning/provisioning.events.js';
import { mapCheckCodeToPhase } from '../../domain/readiness-activation/activation-policy.js';
import type { ActivationRepositoryPort } from '../../domain/readiness-activation/activation-repository.port.js';
import {
  ActivationErrorCode,
  ActivationRecordStatus,
  READINESS_CHECK_CODES,
  ReadinessCheckStatus,
  ReadinessEvaluationStatus,
} from '../../domain/readiness-activation/activation.types.js';
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
      'Durable audit required for activation mutation',
      [{ eventType: input.eventType }],
      err instanceof Error ? err : undefined,
    );
  }
}

// ---------------------------------------------------------------------------
// Workflow definitions (P7.10)
// ---------------------------------------------------------------------------

export const ACTIVATION_WORKFLOW_DEFINITIONS = {
  evaluate: {
    code: 'p710.readiness.evaluate',
    name: 'P7.10 Technical Readiness Evaluation',
    description:
      'Revalidate P7.1 auth, collect prior-phase readiness checks, aggregate READY/NOT_READY',
    snapshot: {
      steps: [
        {
          key: 'validate_auth',
          type: 'HANDLER',
          handlerKey: 'readiness.validate_auth',
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'check_infra',
          type: 'HANDLER',
          handlerKey: 'readiness.check_infra',
          dependsOn: ['validate_auth'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'check_keycloak',
          type: 'HANDLER',
          handlerKey: 'readiness.check_keycloak',
          dependsOn: ['validate_auth'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'check_configuration',
          type: 'HANDLER',
          handlerKey: 'readiness.check_configuration',
          dependsOn: ['validate_auth'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'check_entitlements',
          type: 'HANDLER',
          handlerKey: 'readiness.check_entitlements',
          dependsOn: ['validate_auth'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'check_experience',
          type: 'HANDLER',
          handlerKey: 'readiness.check_experience',
          dependsOn: ['validate_auth'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'check_product_control',
          type: 'HANDLER',
          handlerKey: 'readiness.check_product_control',
          dependsOn: ['validate_auth'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'aggregate',
          type: 'HANDLER',
          handlerKey: 'readiness.aggregate',
          dependsOn: [
            'check_infra',
            'check_keycloak',
            'check_configuration',
            'check_entitlements',
            'check_experience',
            'check_product_control',
          ],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
      ],
    },
  },
  activate: {
    code: 'p710.activation.activate',
    name: 'P7.10 Technical Activation Gate',
    description:
      'Revalidate auth, require READY evidence, mark ACTIVE, emit P5 provisioning-completed, verify',
    snapshot: {
      steps: [
        {
          key: 'revalidate_auth',
          type: 'HANDLER',
          handlerKey: 'activation.revalidate_auth',
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'require_ready_evidence',
          type: 'HANDLER',
          handlerKey: 'activation.require_ready_evidence',
          dependsOn: ['revalidate_auth'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'mark_active',
          type: 'HANDLER',
          handlerKey: 'activation.mark_active',
          dependsOn: ['require_ready_evidence'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'emit_provisioning_completed',
          type: 'HANDLER',
          handlerKey: 'activation.emit_provisioning_completed',
          dependsOn: ['mark_active'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'verify',
          type: 'HANDLER',
          handlerKey: 'activation.verify',
          dependsOn: ['emit_provisioning_completed'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
      ],
    },
  },
} as const;

export type ActivationWorkflowKind = keyof typeof ACTIVATION_WORKFLOW_DEFINITIONS;

const WORKFLOW_RETRY_DEFAULTS = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 15_000,
  multiplier: 2,
  jitterRatio: 0.2,
};

/**
 * Ensure a P7.10 workflow definition exists and is PUBLISHED (idempotent).
 */
export async function ensureActivationDefinition(
  repo: WorkflowRepositoryPort,
  outbox: ControlPlaneOutboxTransactionService,
  _audit: AuditEventRepositoryPort,
  actorId: string,
  kind: ActivationWorkflowKind = 'evaluate',
): Promise<{ id: string }> {
  const def = ACTIVATION_WORKFLOW_DEFINITIONS[kind];
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
        domain: 'activation',
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

export class ListActivationUseCase {
  constructor(private readonly repo: ActivationRepositoryPort) {}

  evaluations(filter: {
    tenantId?: string;
    productId?: string;
    status?: string;
    provisioningRequestId?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listEvaluations(filter);
  }
  evaluation(id: string) {
    return this.repo.getEvaluation(id);
  }
  checks(evaluationId: string) {
    return this.repo.listChecks(evaluationId);
  }
  records(filter: {
    tenantId?: string;
    productId?: string;
    status?: string;
    provisioningRequestId?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listActivationRecords(filter);
  }
  record(id: string) {
    return this.repo.getActivationRecord(id);
  }
  runs(activationRecordId: string, limit?: number) {
    return this.repo.listRuns(activationRecordId, limit);
  }
  evidence(filter: {
    activationRecordId?: string;
    evaluationId?: string;
    limit?: number;
  }) {
    return this.repo.listEvidence(filter);
  }
}

// ---------------------------------------------------------------------------
// Create evaluation / activation record (bind P7.1)
// ---------------------------------------------------------------------------

export class CreateReadinessEvaluationUseCase {
  constructor(
    private readonly repo: ActivationRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    tenantId: string;
    productId: string;
    provisioningRequestId: string;
    subscriptionId?: string | null;
    accountId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    if (!input.provisioningRequestId?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'provisioningRequestId required', [
        { code: ActivationErrorCode.AUTHORIZATION_FAILED },
      ]);
    }

    const ready = await this.auth.getWorkflowReadyRequest(input.provisioningRequestId);
    if (!ready) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'P7.1 authorization not ready for readiness evaluation',
        [{ code: ActivationErrorCode.AUTHORIZATION_FAILED }],
      );
    }
    const revalidated = await this.auth.revalidateBoundAuthorization({
      authorizationRowId: ready.authorizationRowId,
      authorizationVersion: ready.authorizationVersion,
      provisioningRequestId: input.provisioningRequestId,
    });
    if (!revalidated) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'P7.1 bound authorization revalidation failed (fail-closed)',
        [{ code: ActivationErrorCode.AUTHORIZATION_FAILED }],
      );
    }

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const created = await this.repo.createEvaluation(
        {
          tenantId: input.tenantId,
          productId: input.productId,
          subscriptionId: input.subscriptionId ?? revalidated.subscriptionId ?? null,
          accountId: input.accountId ?? revalidated.accountId ?? null,
          provisioningRequestId: input.provisioningRequestId,
          authorizationRowId: revalidated.authorizationRowId,
          authorizationVersion: revalidated.authorizationVersion,
          evaluationStatus: ReadinessEvaluationStatus.PENDING,
          workflowId: null,
          overallScore: null,
          blockingCodes: [],
          summary: {},
          evaluatedAt: null,
          expiresAt: null,
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
        client,
      );

      for (const code of READINESS_CHECK_CODES) {
        await this.repo.upsertCheck(
          {
            evaluationId: created.id,
            tenantId: created.tenantId,
            checkCode: code,
            checkPhase: mapCheckCodeToPhase(code),
            checkStatus: ReadinessCheckStatus.PENDING,
            required: true,
            message: null,
            evidenceRef: null,
            details: {},
            checkedAt: null,
          },
          client,
        );
      }

      await this.repo.appendHistory(
        {
          resourceType: 'READINESS_EVALUATION',
          resourceId: created.id,
          tenantId: created.tenantId,
          action: 'CREATE',
          actorId: input.actorId,
          toStatus: String(created.evaluationStatus),
          details: { provisioningRequestId: input.provisioningRequestId },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.activation.evaluation.created',
          actorId: input.actorId,
          subjectType: 'READINESS_EVALUATION',
          subjectId: created.id,
          details: { tenantId: created.tenantId, productId: created.productId },
        },
        client,
      );
      return created;
    });
  }
}

export class CreateActivationRecordUseCase {
  constructor(
    private readonly repo: ActivationRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    tenantId: string;
    productId: string;
    provisioningRequestId: string;
    readinessEvaluationId?: string | null;
    subscriptionId?: string | null;
    accountId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    if (!input.provisioningRequestId?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'provisioningRequestId required', [
        { code: ActivationErrorCode.AUTHORIZATION_FAILED },
      ]);
    }

    const ready = await this.auth.getWorkflowReadyRequest(input.provisioningRequestId);
    if (!ready) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'P7.1 authorization not ready for activation record',
        [{ code: ActivationErrorCode.AUTHORIZATION_FAILED }],
      );
    }
    const revalidated = await this.auth.revalidateBoundAuthorization({
      authorizationRowId: ready.authorizationRowId,
      authorizationVersion: ready.authorizationVersion,
      provisioningRequestId: input.provisioningRequestId,
    });
    if (!revalidated) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'P7.1 bound authorization revalidation failed (fail-closed)',
        [{ code: ActivationErrorCode.AUTHORIZATION_FAILED }],
      );
    }

    if (input.readinessEvaluationId) {
      const evaluation = await this.repo.getEvaluation(input.readinessEvaluationId);
      if (!evaluation) {
        throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Readiness evaluation not found');
      }
    }

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const created = await this.repo.createActivationRecord(
        {
          tenantId: input.tenantId,
          productId: input.productId,
          subscriptionId: input.subscriptionId ?? revalidated.subscriptionId ?? null,
          accountId: input.accountId ?? revalidated.accountId ?? null,
          provisioningRequestId: input.provisioningRequestId,
          authorizationRowId: revalidated.authorizationRowId,
          authorizationVersion: revalidated.authorizationVersion,
          readinessEvaluationId: input.readinessEvaluationId ?? null,
          activationStatus: ActivationRecordStatus.PENDING,
          workflowId: null,
          activatedAt: null,
          p5SignalEmittedAt: null,
          p5SignalEventId: null,
          failureCode: null,
          failureMessage: null,
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'ACTIVATION_RECORD',
          resourceId: created.id,
          tenantId: created.tenantId,
          action: 'CREATE',
          actorId: input.actorId,
          toStatus: String(created.activationStatus),
          details: {
            provisioningRequestId: input.provisioningRequestId,
            readinessEvaluationId: created.readinessEvaluationId,
          },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.activation.record.created',
          actorId: input.actorId,
          subjectType: 'ACTIVATION_RECORD',
          subjectId: created.id,
          details: { tenantId: created.tenantId, productId: created.productId },
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

export class RequestReadinessEvaluateUseCase {
  constructor(
    private readonly repo: ActivationRepositoryPort,
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
    evaluationId: string;
    activationRecordId?: string | null;
    provisioningRequestId?: string | null;
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) {
      return {
        workflow: wfExisting,
        evaluation: await this.repo.getEvaluation(input.evaluationId),
      };
    }

    const evaluation = await this.repo.getEvaluation(input.evaluationId);
    if (!evaluation) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Readiness evaluation not found');
    }

    const provisioningRequestId =
      input.provisioningRequestId ?? evaluation.provisioningRequestId ?? null;
    if (!evaluation.authorizationRowId || evaluation.authorizationVersion == null) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'Evaluation has no bound P7.1 authorization (fail-closed)',
        [{ code: ActivationErrorCode.AUTHORIZATION_FAILED }],
      );
    }
    const revalidated = await this.auth.revalidateBoundAuthorization({
      authorizationRowId: evaluation.authorizationRowId,
      authorizationVersion: evaluation.authorizationVersion,
      provisioningRequestId,
    });
    if (!revalidated) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'P7.1 authorization not valid for readiness evaluation',
        [{ code: ActivationErrorCode.AUTHORIZATION_FAILED }],
      );
    }

    const definition = await ensureActivationDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      'evaluate',
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: 'readiness.evaluate',
      provisioningRequestId,
      businessReference: evaluation.id,
      inputSnapshot: {
        evaluationId: evaluation.id,
        activationRecordId: input.activationRecordId ?? null,
        tenantId: evaluation.tenantId,
        productId: evaluation.productId,
        subscriptionId: evaluation.subscriptionId,
        authorizationRowId: evaluation.authorizationRowId,
        authorizationVersion: evaluation.authorizationVersion,
        provisioningRequestId,
        actorId: input.actorId,
        correlationId: input.correlationId,
      },
    });

    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      await this.repo.updateEvaluation(
        evaluation.id,
        {
          workflowId: instance.id,
          evaluationStatus: ReadinessEvaluationStatus.EVALUATING,
        },
        evaluation.version,
        input.actorId,
        client,
      );
      if (input.activationRecordId) {
        const record = await this.repo.getActivationRecord(input.activationRecordId);
        if (record) {
          await this.repo.updateActivationRecord(
            record.id,
            {
              workflowId: instance.id,
              activationStatus: ActivationRecordStatus.EVALUATING,
              readinessEvaluationId: evaluation.id,
            },
            record.version,
            input.actorId,
            client,
          );
        }
      }
      await this.repo.appendHistory(
        {
          resourceType: 'READINESS_EVALUATION',
          resourceId: evaluation.id,
          tenantId: evaluation.tenantId,
          fromStatus: String(evaluation.evaluationStatus),
          toStatus: ReadinessEvaluationStatus.EVALUATING,
          action: 'LAUNCH_EVALUATE',
          actorId: input.actorId,
          details: { workflowId: instance.id },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.activation.evaluate.requested',
          actorId: input.actorId,
          subjectType: 'READINESS_EVALUATION',
          subjectId: evaluation.id,
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
      evaluation: await this.repo.getEvaluation(evaluation.id),
    };
  }
}

/** Technical activation workflow launcher — distinct from subscription RequestActivationUseCase. */
export class RequestTechnicalActivationUseCase {
  constructor(
    private readonly repo: ActivationRepositoryPort,
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
    activationRecordId: string;
    provisioningRequestId?: string | null;
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) {
      return {
        workflow: wfExisting,
        record: await this.repo.getActivationRecord(input.activationRecordId),
      };
    }

    const record = await this.repo.getActivationRecord(input.activationRecordId);
    if (!record) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Activation record not found');
    }

    const provisioningRequestId =
      input.provisioningRequestId ?? record.provisioningRequestId ?? null;
    if (!record.authorizationRowId || record.authorizationVersion == null) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'Activation record has no bound P7.1 authorization (fail-closed)',
        [{ code: ActivationErrorCode.AUTHORIZATION_FAILED }],
      );
    }
    const revalidated = await this.auth.revalidateBoundAuthorization({
      authorizationRowId: record.authorizationRowId,
      authorizationVersion: record.authorizationVersion,
      provisioningRequestId,
    });
    if (!revalidated) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'P7.1 authorization not valid for technical activation',
        [{ code: ActivationErrorCode.AUTHORIZATION_FAILED }],
      );
    }

    if (record.readinessEvaluationId) {
      const evaluation = await this.repo.getEvaluation(record.readinessEvaluationId);
      if (!evaluation || evaluation.evaluationStatus !== ReadinessEvaluationStatus.READY) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Bound readiness evaluation must be READY before activation',
          [{ code: ActivationErrorCode.READINESS_NOT_READY }],
        );
      }
    }

    const definition = await ensureActivationDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      'activate',
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: 'activation.activate',
      provisioningRequestId,
      businessReference: record.id,
      inputSnapshot: {
        activationRecordId: record.id,
        evaluationId: record.readinessEvaluationId,
        tenantId: record.tenantId,
        productId: record.productId,
        subscriptionId: record.subscriptionId,
        authorizationRowId: record.authorizationRowId,
        authorizationVersion: record.authorizationVersion,
        provisioningRequestId,
        actorId: input.actorId,
        correlationId: input.correlationId,
      },
    });

    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      await this.repo.updateActivationRecord(
        record.id,
        {
          workflowId: instance.id,
          activationStatus: ActivationRecordStatus.ACTIVATING,
        },
        record.version,
        input.actorId,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'ACTIVATION_RECORD',
          resourceId: record.id,
          tenantId: record.tenantId,
          fromStatus: String(record.activationStatus),
          toStatus: ActivationRecordStatus.ACTIVATING,
          action: 'LAUNCH_ACTIVATE',
          actorId: input.actorId,
          details: { workflowId: instance.id },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.activation.activate.requested',
          actorId: input.actorId,
          subjectType: 'ACTIVATION_RECORD',
          subjectId: record.id,
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
      record: await this.repo.getActivationRecord(record.id),
    };
  }
}

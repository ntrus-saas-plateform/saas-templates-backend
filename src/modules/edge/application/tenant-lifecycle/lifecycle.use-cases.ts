import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import { EDGE_P7_OUTBOX_TENANT } from '../../domain/provisioning/provisioning.events.js';
import type { ActivationRepositoryPort } from '../../domain/readiness-activation/activation-repository.port.js';
import { ActivationRecordStatus } from '../../domain/readiness-activation/activation.types.js';
import {
  canRequestDeprovision,
  canRequestResume,
  canRequestSuspend,
} from '../../domain/tenant-lifecycle/lifecycle-policy.js';
import type { LifecycleRepositoryPort } from '../../domain/tenant-lifecycle/lifecycle-repository.port.js';
import {
  LifecycleErrorCode,
  LifecycleStatus,
} from '../../domain/tenant-lifecycle/lifecycle.types.js';
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
      'Durable audit required for lifecycle mutation',
      [{ eventType: input.eventType }],
      err instanceof Error ? err : undefined,
    );
  }
}

// ---------------------------------------------------------------------------
// Workflow definitions (P7.11)
// ---------------------------------------------------------------------------

export const LIFECYCLE_WORKFLOW_DEFINITIONS = {
  suspend: {
    code: 'p711.lifecycle.suspend',
    name: 'P7.11 Technical Lifecycle Suspend',
    description:
      'Revalidate auth, require ACTIVE activation, mark suspending, coordinate soft deactivate signals, mark suspended, verify',
    snapshot: {
      steps: [
        {
          key: 'revalidate_auth',
          type: 'HANDLER',
          handlerKey: 'lifecycle.revalidate_auth',
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'require_activation_active',
          type: 'HANDLER',
          handlerKey: 'lifecycle.require_activation_active',
          dependsOn: ['revalidate_auth'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'mark_suspending',
          type: 'HANDLER',
          handlerKey: 'lifecycle.mark_suspending',
          dependsOn: ['require_activation_active'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'coord_experience_deactivate',
          type: 'HANDLER',
          handlerKey: 'lifecycle.coord_experience_deactivate',
          dependsOn: ['mark_suspending'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'coord_infra_quiesce',
          type: 'HANDLER',
          handlerKey: 'lifecycle.coord_infra_quiesce',
          dependsOn: ['mark_suspending'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'coord_product_control_suspend',
          type: 'HANDLER',
          handlerKey: 'lifecycle.coord_product_control_suspend',
          dependsOn: ['mark_suspending'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'mark_suspended',
          type: 'HANDLER',
          handlerKey: 'lifecycle.mark_suspended',
          dependsOn: [
            'coord_experience_deactivate',
            'coord_infra_quiesce',
            'coord_product_control_suspend',
          ],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'verify',
          type: 'HANDLER',
          handlerKey: 'lifecycle.verify',
          dependsOn: ['mark_suspended'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
      ],
    },
  },
  resume: {
    code: 'p711.lifecycle.resume',
    name: 'P7.11 Technical Lifecycle Resume',
    description:
      'Revalidate auth, require suspended, mark resuming, coordinate resume signals, mark active, verify',
    snapshot: {
      steps: [
        {
          key: 'revalidate_auth',
          type: 'HANDLER',
          handlerKey: 'lifecycle.revalidate_auth',
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'require_suspended',
          type: 'HANDLER',
          handlerKey: 'lifecycle.require_suspended',
          dependsOn: ['revalidate_auth'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'mark_resuming',
          type: 'HANDLER',
          handlerKey: 'lifecycle.mark_resuming',
          dependsOn: ['require_suspended'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'coord_experience_resume',
          type: 'HANDLER',
          handlerKey: 'lifecycle.coord_experience_resume',
          dependsOn: ['mark_resuming'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'coord_infra_resume',
          type: 'HANDLER',
          handlerKey: 'lifecycle.coord_infra_resume',
          dependsOn: ['mark_resuming'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'coord_product_control_resume',
          type: 'HANDLER',
          handlerKey: 'lifecycle.coord_product_control_resume',
          dependsOn: ['mark_resuming'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'mark_active',
          type: 'HANDLER',
          handlerKey: 'lifecycle.mark_active',
          dependsOn: [
            'coord_experience_resume',
            'coord_infra_resume',
            'coord_product_control_resume',
          ],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'verify',
          type: 'HANDLER',
          handlerKey: 'lifecycle.verify',
          dependsOn: ['mark_active'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
      ],
    },
  },
  deprovision: {
    code: 'p711.lifecycle.deprovision',
    name: 'P7.11 Technical Lifecycle Deprovision',
    description:
      'Revalidate auth, require flags+export evidence, mark deprovisioning, destructive coords (approval-gated), mark deprovisioned, verify',
    snapshot: {
      steps: [
        {
          key: 'revalidate_auth',
          type: 'HANDLER',
          handlerKey: 'lifecycle.revalidate_auth',
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'require_flags',
          type: 'HANDLER',
          handlerKey: 'lifecycle.require_flags',
          dependsOn: ['revalidate_auth'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'require_export_evidence',
          type: 'HANDLER',
          handlerKey: 'lifecycle.require_export_evidence',
          dependsOn: ['require_flags'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'mark_deprovisioning',
          type: 'HANDLER',
          handlerKey: 'lifecycle.mark_deprovisioning',
          dependsOn: ['require_export_evidence'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'coord_experience_deactivate',
          type: 'HANDLER',
          handlerKey: 'lifecycle.coord_experience_deactivate',
          dependsOn: ['mark_deprovisioning'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'coord_infra_quiesce',
          type: 'HANDLER',
          handlerKey: 'lifecycle.coord_infra_quiesce',
          dependsOn: ['mark_deprovisioning'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'mark_deprovisioned',
          type: 'HANDLER',
          handlerKey: 'lifecycle.mark_deprovisioned',
          dependsOn: ['coord_experience_deactivate', 'coord_infra_quiesce'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'verify',
          type: 'HANDLER',
          handlerKey: 'lifecycle.verify',
          dependsOn: ['mark_deprovisioned'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
      ],
    },
  },
} as const;

export type LifecycleWorkflowKind = keyof typeof LIFECYCLE_WORKFLOW_DEFINITIONS;

const WORKFLOW_RETRY_DEFAULTS = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 15_000,
  multiplier: 2,
  jitterRatio: 0.2,
};

/**
 * Ensure a P7.11 workflow definition exists and is PUBLISHED (idempotent).
 */
export async function ensureLifecycleDefinition(
  repo: WorkflowRepositoryPort,
  outbox: ControlPlaneOutboxTransactionService,
  _audit: AuditEventRepositoryPort,
  actorId: string,
  kind: LifecycleWorkflowKind = 'suspend',
): Promise<{ id: string }> {
  const def = LIFECYCLE_WORKFLOW_DEFINITIONS[kind];
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
        domain: 'lifecycle',
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

export class ListLifecycleUseCase {
  constructor(private readonly repo: LifecycleRepositoryPort) {}

  records(filter: {
    tenantId?: string;
    productId?: string;
    status?: string;
    activationRecordId?: string;
    provisioningRequestId?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listRecords(filter);
  }
  record(id: string) {
    return this.repo.getRecord(id);
  }
  runs(lifecycleRecordId: string, limit?: number) {
    return this.repo.listRuns(lifecycleRecordId, limit);
  }
  evidence(filter: { lifecycleRecordId?: string; limit?: number }) {
    return this.repo.listEvidence(filter);
  }
}

// ---------------------------------------------------------------------------
// Create lifecycle record from ACTIVE activation
// ---------------------------------------------------------------------------

export class CreateLifecycleRecordUseCase {
  constructor(
    private readonly repo: LifecycleRepositoryPort,
    private readonly activationRepo: ActivationRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    activationRecordId: string;
    retentionPolicyRef?: string | null;
    exportEvidenceRef?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const activation = await this.activationRepo.getActivationRecord(input.activationRecordId);
    if (!activation) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Activation record not found');
    }
    if (activation.activationStatus !== ActivationRecordStatus.ACTIVE) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Lifecycle record requires Activation Record ACTIVE (P7.10)',
        [{ code: LifecycleErrorCode.ACTIVATION_NOT_ACTIVE }],
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
        [{ code: LifecycleErrorCode.AUTHORIZATION_FAILED }],
      );
    }

    const existing = await this.repo.getActiveRecord(activation.tenantId, activation.productId);
    if (existing) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'Active lifecycle record already exists for tenant/product',
        [{ code: LifecycleErrorCode.CONFLICT }],
      );
    }

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const created = await this.repo.createRecord(
        {
          tenantId: activation.tenantId,
          productId: activation.productId,
          subscriptionId: activation.subscriptionId,
          accountId: activation.accountId,
          provisioningRequestId: activation.provisioningRequestId,
          authorizationRowId: activation.authorizationRowId,
          authorizationVersion: activation.authorizationVersion,
          activationRecordId: activation.id,
          lifecycleStatus: LifecycleStatus.ACTIVE,
          workflowId: null,
          deletionProtection: true,
          retentionPolicyRef: input.retentionPolicyRef ?? null,
          exportEvidenceRef: input.exportEvidenceRef ?? null,
          lastSuspendedAt: null,
          lastResumedAt: null,
          deprovisionedAt: null,
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
          resourceType: 'LIFECYCLE_RECORD',
          resourceId: created.id,
          tenantId: created.tenantId,
          action: 'CREATE',
          actorId: input.actorId,
          toStatus: String(created.lifecycleStatus),
          details: { activationRecordId: activation.id },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.lifecycle.record.created',
          actorId: input.actorId,
          subjectType: 'LIFECYCLE_RECORD',
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

async function revalidateLifecycleAuth(
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
      'Lifecycle record has no bound P7.1 authorization (fail-closed)',
      [{ code: LifecycleErrorCode.AUTHORIZATION_FAILED }],
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
      'P7.1 authorization not valid for lifecycle operation',
      [{ code: LifecycleErrorCode.AUTHORIZATION_FAILED }],
    );
  }
  return revalidated;
}

export class RequestLifecycleSuspendUseCase {
  constructor(
    private readonly repo: LifecycleRepositoryPort,
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
    lifecycleRecordId: string;
    provisioningRequestId?: string | null;
    reason?: string | null;
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) {
      return {
        workflow: wfExisting,
        record: await this.repo.getRecord(input.lifecycleRecordId),
      };
    }

    const record = await this.repo.getRecord(input.lifecycleRecordId);
    if (!record) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Lifecycle record not found');
    }

    const guard = canRequestSuspend(record.lifecycleStatus);
    if (!guard.allowed) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, guard.reason, [{ code: guard.code }]);
    }

    const provisioningRequestId =
      input.provisioningRequestId ?? record.provisioningRequestId ?? null;
    await revalidateLifecycleAuth(this.auth, record, provisioningRequestId);

    const definition = await ensureLifecycleDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      'suspend',
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: 'lifecycle.suspend',
      provisioningRequestId,
      businessReference: record.id,
      inputSnapshot: {
        lifecycleRecordId: record.id,
        activationRecordId: record.activationRecordId,
        tenantId: record.tenantId,
        productId: record.productId,
        subscriptionId: record.subscriptionId,
        authorizationRowId: record.authorizationRowId,
        authorizationVersion: record.authorizationVersion,
        provisioningRequestId,
        actorId: input.actorId,
        correlationId: input.correlationId,
        reason: input.reason ?? null,
        operation: 'SUSPEND',
      },
    });

    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      await this.repo.updateRecord(
        record.id,
        {
          workflowId: instance.id,
          lifecycleStatus: LifecycleStatus.SUSPENDING,
        },
        record.version,
        input.actorId,
        client,
      );
      await this.repo.createRun(
        {
          lifecycleRecordId: record.id,
          tenantId: record.tenantId,
          productId: record.productId,
          operation: 'SUSPEND',
          workflowId: instance.id,
          outcome: 'PENDING',
          errorCode: null,
          errorMessage: null,
          observedState: { fromStatus: record.lifecycleStatus },
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
          resourceType: 'LIFECYCLE_RECORD',
          resourceId: record.id,
          tenantId: record.tenantId,
          fromStatus: String(record.lifecycleStatus),
          toStatus: LifecycleStatus.SUSPENDING,
          action: 'LAUNCH_SUSPEND',
          reason: input.reason ?? null,
          actorId: input.actorId,
          details: { workflowId: instance.id },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.lifecycle.suspend.requested',
          actorId: input.actorId,
          subjectType: 'LIFECYCLE_RECORD',
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
      record: await this.repo.getRecord(record.id),
    };
  }
}

export class RequestLifecycleResumeUseCase {
  constructor(
    private readonly repo: LifecycleRepositoryPort,
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
    lifecycleRecordId: string;
    provisioningRequestId?: string | null;
    reason?: string | null;
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) {
      return {
        workflow: wfExisting,
        record: await this.repo.getRecord(input.lifecycleRecordId),
      };
    }

    const record = await this.repo.getRecord(input.lifecycleRecordId);
    if (!record) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Lifecycle record not found');
    }

    const guard = canRequestResume(record.lifecycleStatus);
    if (!guard.allowed) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, guard.reason, [{ code: guard.code }]);
    }

    const provisioningRequestId =
      input.provisioningRequestId ?? record.provisioningRequestId ?? null;
    await revalidateLifecycleAuth(this.auth, record, provisioningRequestId);

    const definition = await ensureLifecycleDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      'resume',
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: 'lifecycle.resume',
      provisioningRequestId,
      businessReference: record.id,
      inputSnapshot: {
        lifecycleRecordId: record.id,
        activationRecordId: record.activationRecordId,
        tenantId: record.tenantId,
        productId: record.productId,
        subscriptionId: record.subscriptionId,
        authorizationRowId: record.authorizationRowId,
        authorizationVersion: record.authorizationVersion,
        provisioningRequestId,
        actorId: input.actorId,
        correlationId: input.correlationId,
        reason: input.reason ?? null,
        operation: 'RESUME',
      },
    });

    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      await this.repo.updateRecord(
        record.id,
        {
          workflowId: instance.id,
          lifecycleStatus: LifecycleStatus.RESUMING,
        },
        record.version,
        input.actorId,
        client,
      );
      await this.repo.createRun(
        {
          lifecycleRecordId: record.id,
          tenantId: record.tenantId,
          productId: record.productId,
          operation: 'RESUME',
          workflowId: instance.id,
          outcome: 'PENDING',
          errorCode: null,
          errorMessage: null,
          observedState: { fromStatus: record.lifecycleStatus },
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
          resourceType: 'LIFECYCLE_RECORD',
          resourceId: record.id,
          tenantId: record.tenantId,
          fromStatus: String(record.lifecycleStatus),
          toStatus: LifecycleStatus.RESUMING,
          action: 'LAUNCH_RESUME',
          reason: input.reason ?? null,
          actorId: input.actorId,
          details: { workflowId: instance.id },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.lifecycle.resume.requested',
          actorId: input.actorId,
          subjectType: 'LIFECYCLE_RECORD',
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
      record: await this.repo.getRecord(record.id),
    };
  }
}

export class RequestLifecycleDeprovisionUseCase {
  constructor(
    private readonly repo: LifecycleRepositoryPort,
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
    lifecycleRecordId: string;
    authorized: boolean;
    confirmed: boolean;
    reason: string;
    provisioningRequestId?: string | null;
    exportEvidenceRef?: string | null;
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) {
      return {
        workflow: wfExisting,
        record: await this.repo.getRecord(input.lifecycleRecordId),
      };
    }

    const record = await this.repo.getRecord(input.lifecycleRecordId);
    if (!record) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Lifecycle record not found');
    }

    const exportRef = input.exportEvidenceRef ?? record.exportEvidenceRef;
    const guard = canRequestDeprovision({
      lifecycleStatus: record.lifecycleStatus,
      deletionProtection: record.deletionProtection,
      authorized: input.authorized,
      confirmed: input.confirmed,
      reason: input.reason,
      exportEvidenceRef: exportRef,
    });
    if (!guard.allowed) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, guard.reason, [{ code: guard.code }]);
    }

    const provisioningRequestId =
      input.provisioningRequestId ?? record.provisioningRequestId ?? null;
    await revalidateLifecycleAuth(this.auth, record, provisioningRequestId);

    const definition = await ensureLifecycleDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      'deprovision',
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: 'lifecycle.deprovision',
      provisioningRequestId,
      businessReference: record.id,
      inputSnapshot: {
        lifecycleRecordId: record.id,
        activationRecordId: record.activationRecordId,
        tenantId: record.tenantId,
        productId: record.productId,
        subscriptionId: record.subscriptionId,
        authorizationRowId: record.authorizationRowId,
        authorizationVersion: record.authorizationVersion,
        provisioningRequestId,
        actorId: input.actorId,
        correlationId: input.correlationId,
        reason: input.reason,
        operation: 'DEPROVISION',
        deprovisionAuthorized: true,
        deprovisionConfirmed: true,
        authorized: true,
        confirmed: true,
        exportEvidenceRef: exportRef,
        destructive: true,
      },
    });

    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      await this.repo.updateRecord(
        record.id,
        {
          workflowId: instance.id,
          lifecycleStatus: LifecycleStatus.DEPROVISIONING,
          exportEvidenceRef: exportRef ?? record.exportEvidenceRef,
        },
        record.version,
        input.actorId,
        client,
      );
      await this.repo.createRun(
        {
          lifecycleRecordId: record.id,
          tenantId: record.tenantId,
          productId: record.productId,
          operation: 'DEPROVISION',
          workflowId: instance.id,
          outcome: 'PENDING',
          errorCode: null,
          errorMessage: null,
          observedState: { fromStatus: record.lifecycleStatus },
          evidence: { authorized: true, confirmed: true },
          startedAt: new Date(),
          finishedAt: null,
          performedBy: input.actorId,
          correlationId: input.correlationId,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'LIFECYCLE_RECORD',
          resourceId: record.id,
          tenantId: record.tenantId,
          fromStatus: String(record.lifecycleStatus),
          toStatus: LifecycleStatus.DEPROVISIONING,
          action: 'LAUNCH_DEPROVISION',
          reason: input.reason,
          actorId: input.actorId,
          details: { workflowId: instance.id },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.lifecycle.deprovision.requested',
          actorId: input.actorId,
          subjectType: 'LIFECYCLE_RECORD',
          subjectId: record.id,
          details: { workflowId: instance.id, reason: input.reason },
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
      record: await this.repo.getRecord(record.id),
    };
  }
}

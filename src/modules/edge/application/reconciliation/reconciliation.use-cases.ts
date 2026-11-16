import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import { EDGE_P7_OUTBOX_TENANT } from '../../domain/provisioning/provisioning.events.js';
import {
  assertWaiverUsable,
  canApproveRemediation,
  canQuarantineFinding,
  canRequestObserve,
  canRequestRemediate,
} from '../../domain/reconciliation/reconciliation-policy.js';
import type { ReconciliationRepositoryPort } from '../../domain/reconciliation/reconciliation-repository.port.js';
import {
  FindingStatus,
  ReconciliationErrorCode,
  ReconciliationRunStatus,
  RemediationStatus,
} from '../../domain/reconciliation/reconciliation.types.js';
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
      'Durable audit required for reconciliation mutation',
      [{ eventType: input.eventType }],
      err instanceof Error ? err : undefined,
    );
  }
}

// ---------------------------------------------------------------------------
// Workflow definitions (P7.13)
// ---------------------------------------------------------------------------

export const RECONCILIATION_WORKFLOW_DEFINITIONS = {
  observe: {
    code: 'p713.reconciliation.observe',
    name: 'P7.13 Reconciliation Observe',
    description:
      'Revalidate auth, collect desired/observed, classify findings (UNKNOWN if unreachable), apply waivers, plan remediations, verify',
    snapshot: {
      steps: [
        {
          key: 'revalidate_auth',
          type: 'HANDLER',
          handlerKey: 'reconciliation.revalidate_auth',
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'collect_desired',
          type: 'HANDLER',
          handlerKey: 'reconciliation.collect_desired',
          dependsOn: ['revalidate_auth'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'collect_observed',
          type: 'HANDLER',
          handlerKey: 'reconciliation.collect_observed',
          dependsOn: ['collect_desired'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'classify_findings',
          type: 'HANDLER',
          handlerKey: 'reconciliation.classify_findings',
          dependsOn: ['collect_observed'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'apply_waivers',
          type: 'HANDLER',
          handlerKey: 'reconciliation.apply_waivers',
          dependsOn: ['classify_findings'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'plan_remediation',
          type: 'HANDLER',
          handlerKey: 'reconciliation.plan_remediation',
          dependsOn: ['apply_waivers'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'verify',
          type: 'HANDLER',
          handlerKey: 'reconciliation.verify',
          dependsOn: ['plan_remediation'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
      ],
    },
  },
  remediate: {
    code: 'p713.reconciliation.remediate',
    name: 'P7.13 Reconciliation Remediate',
    description:
      'Revalidate auth, execute approved/auto-eligible remediations as evidence-only local status (no foreign destructors), verify',
    snapshot: {
      steps: [
        {
          key: 'revalidate_auth',
          type: 'HANDLER',
          handlerKey: 'reconciliation.revalidate_auth',
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'execute_remediation',
          type: 'HANDLER',
          handlerKey: 'reconciliation.execute_remediation',
          dependsOn: ['revalidate_auth'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'verify',
          type: 'HANDLER',
          handlerKey: 'reconciliation.verify',
          dependsOn: ['execute_remediation'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
      ],
    },
  },
} as const;

export type ReconciliationWorkflowKind = keyof typeof RECONCILIATION_WORKFLOW_DEFINITIONS;

const WORKFLOW_RETRY_DEFAULTS = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 15_000,
  multiplier: 2,
  jitterRatio: 0.2,
};

export async function ensureReconciliationDefinition(
  repo: WorkflowRepositoryPort,
  outbox: ControlPlaneOutboxTransactionService,
  _audit: AuditEventRepositoryPort,
  actorId: string,
  kind: ReconciliationWorkflowKind = 'observe',
): Promise<{ id: string }> {
  const def = RECONCILIATION_WORKFLOW_DEFINITIONS[kind];
  const code = def.code;
  const existing = await repo.getDefinitionByCode(code);
  if (existing && existing.definitionStatus === WorkflowDefinitionStatus.PUBLISHED) {
    return existing;
  }
  const snapshot = {
    steps: def.snapshot.steps.map((step) => ({
      ...step,
      dependsOn:
        'dependsOn' in step && step.dependsOn
          ? [...(step.dependsOn as readonly string[])]
          : undefined,
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
        domain: 'reconciliation',
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

export class ListReconciliationUseCase {
  constructor(private readonly repo: ReconciliationRepositoryPort) {}

  policies(filter: {
    status?: string;
    scope?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listPolicies(filter);
  }
  policy(id: string) {
    return this.repo.getPolicy(id);
  }
  runs(filter: {
    tenantId?: string;
    productId?: string;
    status?: string;
    policyId?: string;
    providerCode?: string;
    provisioningRequestId?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listRuns(filter);
  }
  run(id: string) {
    return this.repo.getRun(id);
  }
  findings(filter: {
    runId?: string;
    tenantId?: string;
    status?: string;
    observationClass?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listFindings(filter);
  }
  finding(id: string) {
    return this.repo.getFinding(id);
  }
  remediations(filter: {
    runId?: string;
    findingId?: string;
    status?: string;
    limit?: number;
  }) {
    return this.repo.listRemediations(filter);
  }
  waivers(filter: {
    findingId?: string;
    tenantId?: string;
    status?: string;
    limit?: number;
  }) {
    return this.repo.listWaivers(filter);
  }
  evidence(filter: {
    runId?: string;
    findingId?: string;
    remediationId?: string;
    limit?: number;
  }) {
    return this.repo.listEvidence(filter);
  }
}

// ---------------------------------------------------------------------------
// Create policy
// ---------------------------------------------------------------------------

export class CreateReconciliationPolicyUseCase {
  constructor(
    private readonly repo: ReconciliationRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    scope?: string;
    autoRemediate?: boolean;
    requireApproval?: boolean;
    rules?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    const code = input.code.trim().toLowerCase();
    if (!code) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Policy code is required', [
        { code: ReconciliationErrorCode.VALIDATION },
      ]);
    }
    const existing = await this.repo.getPolicyByCode(code);
    if (existing) {
      throw new DomainError(ErrorCode.CONFLICT, 'Reconciliation policy code already exists', [
        { code: ReconciliationErrorCode.CONFLICT },
      ]);
    }

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const created = await this.repo.createPolicy(
        {
          code,
          name: input.name.trim(),
          description: input.description ?? null,
          scope: input.scope ?? 'TENANT_PRODUCT',
          autoRemediate: input.autoRemediate ?? false,
          requireApproval: input.requireApproval ?? true,
          policyStatus: 'ACTIVE',
          rules: input.rules ?? {},
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'RECONCILIATION_POLICY',
          resourceId: created.id,
          action: 'CREATE',
          actorId: input.actorId,
          toStatus: created.policyStatus,
          details: { code: created.code, autoRemediate: created.autoRemediate },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.reconciliation.policy.created',
          actorId: input.actorId,
          subjectType: 'RECONCILIATION_POLICY',
          subjectId: created.id,
          details: { code: created.code },
        },
        client,
      );
      return created;
    });
  }
}

// ---------------------------------------------------------------------------
// Create run + request observe / remediate
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

async function revalidateReconciliationAuth(
  auth: WorkflowAuthorizationPort,
  record: {
    authorizationRowId: string | null;
    authorizationVersion: number | null;
    provisioningRequestId: string | null;
  },
  provisioningRequestId: string | null,
) {
  const boundProv = provisioningRequestId ?? record.provisioningRequestId ?? null;
  // P7.1 fail-closed when provisioningRequestId is bound
  // AUD-P1-07 / AUD-P0-05: unbound reconciliation is fail-closed (no null authOk path).
  if (!boundProv || !record.authorizationRowId || record.authorizationVersion == null) {
    throw new DomainError(
      ErrorCode.FORBIDDEN,
      'Reconciliation requires bound P7.1 authorization (fail-closed)',
      [{ code: ReconciliationErrorCode.AUTHORIZATION_FAILED }],
    );
  }
  const revalidated = await auth.revalidateBoundAuthorization({
    authorizationRowId: record.authorizationRowId,
    authorizationVersion: record.authorizationVersion,
    provisioningRequestId: boundProv,
  });
  if (!revalidated) {
    throw new DomainError(
      ErrorCode.FORBIDDEN,
      'P7.1 authorization not valid for reconciliation operation',
      [{ code: ReconciliationErrorCode.AUTHORIZATION_FAILED }],
    );
  }
  return revalidated;
}

export class CreateReconciliationRunUseCase {
  constructor(
    private readonly repo: ReconciliationRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    tenantId?: string | null;
    productId?: string | null;
    providerCode?: string | null;
    policyId?: string | null;
    triggerKind?: string;
    provisioningRequestId?: string | null;
    authorizationRowId?: string | null;
    authorizationVersion?: number | null;
    desiredSnapshot?: Record<string, unknown>;
    observedSnapshot?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (input.policyId) {
      const policy = await this.repo.getPolicy(input.policyId);
      if (!policy) {
        throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Reconciliation policy not found');
      }
      if (policy.policyStatus !== 'ACTIVE') {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          `Policy must be ACTIVE; current=${policy.policyStatus}`,
          [{ code: ReconciliationErrorCode.VALIDATION }],
        );
      }
    }

    await revalidateReconciliationAuth(
      this.auth,
      {
        authorizationRowId: input.authorizationRowId ?? null,
        authorizationVersion: input.authorizationVersion ?? null,
        provisioningRequestId: input.provisioningRequestId ?? null,
      },
      input.provisioningRequestId ?? null,
    );

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const created = await this.repo.createRun(
        {
          tenantId: input.tenantId ?? null,
          productId: input.productId ?? null,
          providerCode: input.providerCode ?? null,
          policyId: input.policyId ?? null,
          triggerKind: input.triggerKind ?? 'MANUAL',
          runStatus: ReconciliationRunStatus.PENDING,
          provisioningRequestId: input.provisioningRequestId ?? null,
          authorizationRowId: input.authorizationRowId ?? null,
          authorizationVersion: input.authorizationVersion ?? null,
          workflowId: null,
          desiredSnapshot: input.desiredSnapshot ?? { resources: [] },
          observedSnapshot: input.observedSnapshot ?? {},
          summary: {},
          driftCount: 0,
          startedAt: new Date(),
          finishedAt: null,
          performedBy: input.actorId,
          correlationId: input.correlationId ?? null,
          metadata: {
            ...(input.metadata ?? {}),
            note: 'P7.13 — unreachable⇒UNKNOWN; no blind deletes; remediations via P7.4 only',
          },
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'RECONCILIATION_RUN',
          resourceId: created.id,
          tenantId: created.tenantId,
          action: 'CREATE',
          actorId: input.actorId,
          toStatus: String(created.runStatus),
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.reconciliation.run.created',
          actorId: input.actorId,
          subjectType: 'RECONCILIATION_RUN',
          subjectId: created.id,
          details: {
            tenantId: created.tenantId,
            productId: created.productId,
            policyId: created.policyId,
          },
        },
        client,
      );
      return created;
    });
  }
}

export class RequestReconciliationObserveUseCase {
  constructor(
    private readonly repo: ReconciliationRepositoryPort,
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
    runId: string;
    provisioningRequestId?: string | null;
    desired?: Array<Record<string, unknown>>;
    observed?: Array<Record<string, unknown>>;
    providerUnreachable?: boolean;
    reason?: string | null;
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) {
      return { workflow: wfExisting, run: await this.repo.getRun(input.runId) };
    }

    const run = await this.repo.getRun(input.runId);
    if (!run) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Reconciliation run not found');
    }

    const guard = canRequestObserve(String(run.runStatus));
    if (!guard.allowed) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, guard.reason, [{ code: guard.code }]);
    }

    const provisioningRequestId =
      input.provisioningRequestId ?? run.provisioningRequestId ?? null;
    await revalidateReconciliationAuth(this.auth, run, provisioningRequestId);

    const definition = await ensureReconciliationDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      'observe',
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: 'reconciliation.observe',
      provisioningRequestId,
      businessReference: run.id,
      inputSnapshot: {
        runId: run.id,
        tenantId: run.tenantId,
        productId: run.productId,
        policyId: run.policyId,
        authorizationRowId: run.authorizationRowId,
        authorizationVersion: run.authorizationVersion,
        provisioningRequestId,
        actorId: input.actorId,
        correlationId: input.correlationId,
        reason: input.reason ?? null,
        operation: 'OBSERVE',
        desired: input.desired ?? null,
        observed: input.observed ?? null,
        metadata: {
          ...run.metadata,
          providerUnreachable: input.providerUnreachable === true,
        },
        providerUnreachable: input.providerUnreachable === true,
      },
    });

    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      await this.repo.updateRun(
        run.id,
        {
          workflowId: instance.id,
          runStatus: ReconciliationRunStatus.RUNNING,
          metadata: {
            ...run.metadata,
            providerUnreachable: input.providerUnreachable === true,
          },
          desiredSnapshot: input.desired
            ? { resources: input.desired }
            : run.desiredSnapshot,
          observedSnapshot: input.observed
            ? { resources: input.observed }
            : run.observedSnapshot,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'RECONCILIATION_RUN',
          resourceId: run.id,
          tenantId: run.tenantId,
          fromStatus: String(run.runStatus),
          toStatus: ReconciliationRunStatus.RUNNING,
          action: 'LAUNCH_OBSERVE',
          reason: input.reason ?? null,
          actorId: input.actorId,
          details: { workflowId: instance.id },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.reconciliation.observe.requested',
          actorId: input.actorId,
          subjectType: 'RECONCILIATION_RUN',
          subjectId: run.id,
          details: { workflowId: instance.id },
        },
        client,
      );
    });

    const started = await this.startWorkflow.execute({
      actorId: input.actorId,
      workflowId: instance.id,
    });
    return { workflow: started, run: await this.repo.getRun(run.id) };
  }
}

export class RequestReconciliationRemediateUseCase {
  constructor(
    private readonly repo: ReconciliationRepositoryPort,
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
    runId: string;
    findingId?: string | null;
    remediationId?: string | null;
    provisioningRequestId?: string | null;
    reason?: string | null;
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) {
      return { workflow: wfExisting, run: await this.repo.getRun(input.runId) };
    }

    const run = await this.repo.getRun(input.runId);
    if (!run) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Reconciliation run not found');
    }

    if (input.findingId) {
      const finding = await this.repo.getFinding(input.findingId);
      if (!finding || finding.runId !== run.id) {
        throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Finding not found for run');
      }
      const guard = canRequestRemediate({
        findingStatus: String(finding.findingStatus),
        observationClass: String(finding.observationClass),
      });
      if (!guard.allowed) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, guard.reason, [{ code: guard.code }]);
      }
    }

    const provisioningRequestId =
      input.provisioningRequestId ?? run.provisioningRequestId ?? null;
    await revalidateReconciliationAuth(this.auth, run, provisioningRequestId);

    const definition = await ensureReconciliationDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      'remediate',
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: 'reconciliation.remediate',
      provisioningRequestId,
      businessReference: run.id,
      inputSnapshot: {
        runId: run.id,
        findingId: input.findingId ?? null,
        remediationId: input.remediationId ?? null,
        tenantId: run.tenantId,
        productId: run.productId,
        policyId: run.policyId,
        authorizationRowId: run.authorizationRowId,
        authorizationVersion: run.authorizationVersion,
        provisioningRequestId,
        actorId: input.actorId,
        correlationId: input.correlationId,
        reason: input.reason ?? null,
        operation: 'REMEDIATE',
      },
    });

    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      await this.repo.updateRun(run.id, { workflowId: instance.id }, client);
      if (input.remediationId) {
        await this.repo.updateRemediation(
          input.remediationId,
          { workflowId: instance.id },
          client,
        );
      }
      await this.repo.appendHistory(
        {
          resourceType: 'RECONCILIATION_RUN',
          resourceId: run.id,
          tenantId: run.tenantId,
          action: 'LAUNCH_REMEDIATE',
          reason: input.reason ?? null,
          actorId: input.actorId,
          details: {
            workflowId: instance.id,
            findingId: input.findingId ?? null,
            remediationId: input.remediationId ?? null,
          },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.reconciliation.remediate.requested',
          actorId: input.actorId,
          subjectType: 'RECONCILIATION_RUN',
          subjectId: run.id,
          details: { workflowId: instance.id },
        },
        client,
      );
    });

    const started = await this.startWorkflow.execute({
      actorId: input.actorId,
      workflowId: instance.id,
    });
    return { workflow: started, run: await this.repo.getRun(run.id) };
  }
}

export class ApproveReconciliationRemediationUseCase {
  constructor(
    private readonly repo: ReconciliationRepositoryPort,
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
    runId: string;
    remediationId: string;
    decision: 'APPROVE' | 'REJECT';
    reason?: string | null;
    provisioningRequestId?: string | null;
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) {
      return {
        workflow: wfExisting,
        run: await this.repo.getRun(input.runId),
        remediation: await this.repo.getRemediation(input.remediationId),
      };
    }

    const run = await this.repo.getRun(input.runId);
    if (!run) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Reconciliation run not found');
    }
    const remediation = await this.repo.getRemediation(input.remediationId);
    if (!remediation || remediation.runId !== run.id) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Remediation not found for run');
    }

    const provisioningRequestId =
      input.provisioningRequestId ?? run.provisioningRequestId ?? null;

    let authOk = false;
    try {
      await revalidateReconciliationAuth(this.auth, run, provisioningRequestId);
      authOk = true;
    } catch {
      authOk = false;
    }

    const guard = canApproveRemediation({
      remediationStatus: String(remediation.remediationStatus),
      authorizationRevalidated: authOk,
    });
    if (!guard.allowed) {
      throw new DomainError(
        guard.code === ReconciliationErrorCode.AUTHORIZATION_FAILED
          ? ErrorCode.FORBIDDEN
          : ErrorCode.VALIDATION_ERROR,
        guard.reason,
        [{ code: guard.code }],
      );
    }

    if (input.decision === 'REJECT') {
      return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
        const updated = await this.repo.updateRemediation(
          remediation.id,
          {
            remediationStatus: RemediationStatus.REJECTED,
            approvedBy: input.actorId,
            approvedAt: new Date(),
            errorMessage: input.reason ?? 'Rejected by operator',
          },
          client,
        );
        await requireAudit(
          this.audit,
          {
            eventType: 'p7.reconciliation.remediation.rejected',
            actorId: input.actorId,
            subjectType: 'RECONCILIATION_REMEDIATION',
            subjectId: remediation.id,
            details: { runId: run.id },
          },
          client,
        );
        return { workflow: null, run, remediation: updated };
      });
    }

    await this.repo.updateRemediation(remediation.id, {
      remediationStatus: RemediationStatus.APPROVED,
      approvedBy: input.actorId,
      approvedAt: new Date(),
    });

    const definition = await ensureReconciliationDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      'remediate',
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: 'reconciliation.remediate',
      provisioningRequestId,
      businessReference: run.id,
      inputSnapshot: {
        runId: run.id,
        remediationId: remediation.id,
        findingId: remediation.findingId,
        tenantId: run.tenantId,
        productId: run.productId,
        policyId: run.policyId,
        authorizationRowId: run.authorizationRowId,
        authorizationVersion: run.authorizationVersion,
        provisioningRequestId,
        actorId: input.actorId,
        correlationId: input.correlationId,
        reason: input.reason ?? null,
        operation: 'REMEDIATE',
        approved: true,
        decision: 'APPROVE',
      },
    });

    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      await this.repo.updateRemediation(
        remediation.id,
        { workflowId: instance.id },
        client,
      );
      await this.repo.updateRun(run.id, { workflowId: instance.id }, client);
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.reconciliation.remediation.approved',
          actorId: input.actorId,
          subjectType: 'RECONCILIATION_REMEDIATION',
          subjectId: remediation.id,
          details: { workflowId: instance.id, runId: run.id },
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
      run: await this.repo.getRun(run.id),
      remediation: await this.repo.getRemediation(remediation.id),
    };
  }
}

export class CreateReconciliationWaiverUseCase {
  constructor(
    private readonly repo: ReconciliationRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    findingId?: string | null;
    tenantId?: string | null;
    productId?: string | null;
    waiverCode: string;
    reason: string;
    expiresAt: string | Date;
    metadata?: Record<string, unknown>;
  }) {
    const expiresAt =
      input.expiresAt instanceof Date ? input.expiresAt : new Date(input.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Waiver expiresAt must be a future timestamp',
        [{ code: ReconciliationErrorCode.WAIVER_EXPIRED }],
      );
    }

    if (input.findingId) {
      const finding = await this.repo.getFinding(input.findingId);
      if (!finding) {
        throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Finding not found');
      }
    }

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const created = await this.repo.createWaiver(
        {
          findingId: input.findingId ?? null,
          tenantId: input.tenantId ?? null,
          productId: input.productId ?? null,
          waiverCode: input.waiverCode.trim(),
          reason: input.reason.trim(),
          waiverStatus: 'ACTIVE',
          expiresAt,
          createdBy: input.actorId,
          revokedBy: null,
          revokedAt: null,
          metadata: input.metadata ?? {},
        },
        client,
      );
      // Guard: created waiver must be usable (not already expired)
      const usable = assertWaiverUsable(created);
      if (!usable.allowed) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, usable.reason, [{ code: usable.code }]);
      }
      if (input.findingId) {
        await this.repo.updateFinding(
          input.findingId,
          {
            findingStatus: FindingStatus.WAIVED,
            message: `Waived by ${created.waiverCode}`,
          },
          client,
        );
      }
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.reconciliation.waiver.created',
          actorId: input.actorId,
          subjectType: 'RECONCILIATION_WAIVER',
          subjectId: created.id,
          details: { waiverCode: created.waiverCode, expiresAt: created.expiresAt.toISOString() },
        },
        client,
      );
      return created;
    });
  }
}

export class QuarantineReconciliationFindingUseCase {
  constructor(
    private readonly repo: ReconciliationRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    findingId: string;
    reason?: string | null;
    provisioningRequestId?: string | null;
  }) {
    const finding = await this.repo.getFinding(input.findingId);
    if (!finding) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Finding not found');
    }
    const guard = canQuarantineFinding(String(finding.findingStatus));
    if (!guard.allowed) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, guard.reason, [{ code: guard.code }]);
    }

    const run = await this.repo.getRun(finding.runId);
    if (run) {
      await revalidateReconciliationAuth(
        this.auth,
        run,
        input.provisioningRequestId ?? run.provisioningRequestId ?? null,
      );
    }

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const updated = await this.repo.updateFinding(
        finding.id,
        {
          findingStatus: FindingStatus.QUARANTINED,
          message: input.reason ?? 'Quarantined by operator',
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'RECONCILIATION_FINDING',
          resourceId: finding.id,
          tenantId: finding.tenantId,
          fromStatus: String(finding.findingStatus),
          toStatus: FindingStatus.QUARANTINED,
          action: 'QUARANTINE',
          reason: input.reason ?? null,
          actorId: input.actorId,
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.reconciliation.finding.quarantined',
          actorId: input.actorId,
          subjectType: 'RECONCILIATION_FINDING',
          subjectId: finding.id,
          details: { observationClass: finding.observationClass },
        },
        client,
      );
      return updated;
    });
  }
}

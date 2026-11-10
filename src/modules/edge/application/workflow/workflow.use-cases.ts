import { createHash, randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import { EDGE_P7_OUTBOX_TENANT } from '../../domain/provisioning/provisioning.events.js';
import { compensationOrder, orderSteps } from '../../domain/workflow/saga-coordinator.js';
import { classifyRetryability, scheduleRetryAt } from '../../domain/workflow/retry-policy.js';
import { validateDefinition } from '../../domain/workflow/workflow-definition.js';
import type { WorkflowAuthorizationPort } from '../../domain/workflow/workflow-authorization.port.js';
import type { WorkflowHandlerRegistryPort } from '../../domain/workflow/workflow-handler.port.js';
import {
  assertDefinitionTransition,
  assertInstanceTransition,
  assertStepTransition,
  assertTaskTransition,
} from '../../domain/workflow/workflow-lifecycle.js';
import type { WorkflowPlacementPort } from '../../domain/workflow/workflow-placement.port.js';
import type { WorkflowRepositoryPort } from '../../domain/workflow/workflow-repository.port.js';
import {
  createWorkflowApprovedEvent,
  createWorkflowCancelledEvent,
  createWorkflowCompensationFailedEvent,
  createWorkflowCompensationStartedEvent,
  createWorkflowCompensationSucceededEvent,
  createWorkflowCompletedEvent,
  createWorkflowCreatedEvent,
  createWorkflowFailedEvent,
  createWorkflowRequiresInterventionEvent,
  createWorkflowRetryScheduledEvent,
  createWorkflowStartedEvent,
  createWorkflowStepClaimedEvent,
  createWorkflowStepFailedEvent,
  createWorkflowStepSucceededEvent,
  createWorkflowWaitingApprovalEvent,
} from '../../domain/workflow/workflow.events.js';
import {
  CompensationStatus,
  DeadLetterStatus,
  HumanTaskStatus,
  HumanTaskType,
  WorkflowDefinitionStatus,
  WorkflowErrorClass,
  WorkflowHistoryResourceType,
  WorkflowInstanceState,
  WorkflowStepStatus,
  type WorkflowDefinitionSnapshot,
  type WorkflowInstanceRecord,
  type WorkflowStepRecord,
} from '../../domain/workflow/workflow.types.js';

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
  try {
    await audit.create(input, client);
  } catch (err) {
    throw new DomainError(
      ErrorCode.DEPENDENCY_UNAVAILABLE,
      'Durable audit required for workflow mutation',
      [{ eventType: input.eventType }],
      err instanceof Error ? err : undefined,
    );
  }
}

function requireIdempotencyKey(key: string | undefined | null): string {
  const trimmed = key?.trim();
  if (!trimmed) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Idempotency-Key is required');
  }
  return trimmed;
}

function baseEvt(wf: WorkflowInstanceRecord, actorId: string) {
  return {
    actorId,
    correlationId: wf.correlationId,
    workflowId: wf.id,
    definitionId: wf.definitionId,
    definitionVersion: wf.definitionVersion,
  };
}

function integrityHash(snapshot: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

// ---------------------------------------------------------------------------
// Definition lifecycle
// ---------------------------------------------------------------------------

export class CreateWorkflowDefinitionUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    domain?: string;
    securityClassification?: string | null;
    snapshot: WorkflowDefinitionSnapshot;
  }) {
    validateDefinition(input.snapshot);
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, _enqueue) => {
      const existing = await this.repo.getDefinitionByCode(input.code);
      if (existing) {
        throw new DomainError(ErrorCode.CONFLICT, `Definition code ${input.code} already exists`);
      }
      const created = await this.repo.createDefinition(
        {
          code: input.code,
          name: input.name,
          description: input.description ?? null,
          domain: input.domain ?? 'provisioning',
          definitionStatus: WorkflowDefinitionStatus.DRAFT,
          securityClassification: input.securityClassification ?? null,
          createdBy: input.actorId,
          approvedBy: null,
          publishedAt: null,
          draftSnapshot: input.snapshot,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: WorkflowHistoryResourceType.WORKFLOW_DEFINITION,
          resourceId: created.definition.id,
          workflowId: null,
          fromStatus: null,
          toStatus: WorkflowDefinitionStatus.DRAFT,
          action: 'CREATE',
          reason: null,
          actorId: input.actorId,
          details: { code: input.code },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'workflow.definition.created',
          actorId: input.actorId,
          subjectType: 'WORKFLOW_DEFINITION',
          subjectId: created.definition.id,
          details: { code: input.code },
        },
        client,
      );
      return created;
    });
  }
}

export class ValidateWorkflowDefinitionUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; definitionId: string }) {
    const def = await this.repo.getDefinition(input.definitionId);
    if (!def) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Definition not found');
    const ver = await this.repo.getLatestDefinitionVersion(def.id);
    if (!ver) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Definition version not found');
    validateDefinition(ver.snapshot);
    assertDefinitionTransition(def.definitionStatus, WorkflowDefinitionStatus.VALIDATED);
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const updated = await this.repo.setDefinitionStatus(
        def.id,
        WorkflowDefinitionStatus.VALIDATED,
        def.version,
        {},
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: WorkflowHistoryResourceType.WORKFLOW_DEFINITION,
          resourceId: def.id,
          workflowId: null,
          fromStatus: def.definitionStatus,
          toStatus: WorkflowDefinitionStatus.VALIDATED,
          action: 'VALIDATE',
          reason: null,
          actorId: input.actorId,
          details: {},
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'workflow.definition.validated',
          actorId: input.actorId,
          subjectType: 'WORKFLOW_DEFINITION',
          subjectId: def.id,
          details: {},
        },
        client,
      );
      return updated;
    });
  }
}

export class PublishWorkflowDefinitionUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; definitionId: string }) {
    const def = await this.repo.getDefinition(input.definitionId);
    if (!def) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Definition not found');
    const ver = await this.repo.getLatestDefinitionVersion(def.id);
    if (!ver) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Definition version not found');
    validateDefinition(ver.snapshot);
    assertDefinitionTransition(def.definitionStatus, WorkflowDefinitionStatus.PUBLISHED);
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const published = await this.repo.publishDefinitionVersion(
        def.id,
        ver.versionNumber,
        ver.snapshot,
        client,
      );
      const updated = await this.repo.setDefinitionStatus(
        def.id,
        WorkflowDefinitionStatus.PUBLISHED,
        def.version,
        { approvedBy: input.actorId, publishedAt: new Date() },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: WorkflowHistoryResourceType.WORKFLOW_DEFINITION,
          resourceId: def.id,
          workflowId: null,
          fromStatus: def.definitionStatus,
          toStatus: WorkflowDefinitionStatus.PUBLISHED,
          action: 'PUBLISH',
          reason: null,
          actorId: input.actorId,
          details: { versionNumber: published.versionNumber },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'workflow.definition.published',
          actorId: input.actorId,
          subjectType: 'WORKFLOW_DEFINITION',
          subjectId: def.id,
          details: { versionNumber: published.versionNumber },
        },
        client,
      );
      return { definition: updated, version: published };
    });
  }
}

export class DeprecateWorkflowDefinitionUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; definitionId: string; reason?: string }) {
    const def = await this.repo.getDefinition(input.definitionId);
    if (!def) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Definition not found');
    assertDefinitionTransition(def.definitionStatus, WorkflowDefinitionStatus.DEPRECATED);
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const updated = await this.repo.setDefinitionStatus(
        def.id,
        WorkflowDefinitionStatus.DEPRECATED,
        def.version,
        {},
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: WorkflowHistoryResourceType.WORKFLOW_DEFINITION,
          resourceId: def.id,
          workflowId: null,
          fromStatus: def.definitionStatus,
          toStatus: WorkflowDefinitionStatus.DEPRECATED,
          action: 'DEPRECATE',
          reason: input.reason ?? null,
          actorId: input.actorId,
          details: {},
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'workflow.definition.deprecated',
          actorId: input.actorId,
          subjectType: 'WORKFLOW_DEFINITION',
          subjectId: def.id,
          details: { reason: input.reason ?? null },
        },
        client,
      );
      return updated;
    });
  }
}

// ---------------------------------------------------------------------------
// Instance create / start / control
// ---------------------------------------------------------------------------

export class CreateWorkflowInstanceUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly placement: WorkflowPlacementPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    idempotencyKey: string;
    definitionId: string;
    workflowType: string;
    inputSnapshot?: Record<string, unknown>;
    provisioningRequestId?: string | null;
    placementDecisionId?: string | null;
    businessReference?: string | null;
    causationId?: string | null;
    deadlineAt?: Date | null;
  }) {
    const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
    const existing = await this.repo.getInstanceByIdempotencyKey(idempotencyKey);
    if (existing) return existing;

    const def = await this.repo.getDefinition(input.definitionId);
    if (!def || def.definitionStatus !== WorkflowDefinitionStatus.PUBLISHED) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Published definition required');
    }
    const ver = await this.repo.getLatestDefinitionVersion(def.id);
    if (!ver || ver.status !== WorkflowDefinitionStatus.PUBLISHED) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Published definition version required');
    }
    validateDefinition(ver.snapshot);

    let authView = null as Awaited<ReturnType<WorkflowAuthorizationPort['getWorkflowReadyRequest']>>;
    if (input.provisioningRequestId) {
      authView = await this.auth.getWorkflowReadyRequest(input.provisioningRequestId);
      if (!authView) {
        throw new DomainError(
          ErrorCode.FORBIDDEN,
          'Provisioning request is not workflow-ready (fail-closed)',
        );
      }
    }
    if (input.placementDecisionId) {
      const place = await this.placement.getWorkflowReadyPlacement(input.placementDecisionId);
      if (!place) {
        throw new DomainError(
          ErrorCode.FORBIDDEN,
          'Placement decision is not workflow-ready (PLACED + HELD/COMMITTED required)',
        );
      }
    }

    const ordered = orderSteps(ver.snapshot.steps);
    const correlationId = authView?.correlationId ?? randomUUID();

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      const again = await this.repo.getInstanceByIdempotencyKey(idempotencyKey);
      if (again) return again;

      const instance = await this.repo.createInstance(
        {
          definitionId: def.id,
          definitionVersion: ver.versionNumber,
          definitionSnapshot: ver.snapshot,
          workflowType: input.workflowType,
          businessReference: input.businessReference ?? null,
          provisioningRequestId: authView?.requestId ?? input.provisioningRequestId ?? null,
          placementDecisionId: input.placementDecisionId ?? null,
          authorizationRowId: authView?.authorizationRowId ?? null,
          authorizationId: authView?.authorizationId ?? null,
          authorizationVersion: authView?.authorizationVersion ?? null,
          accountId: authView?.accountId ?? null,
          productId: authView?.productId ?? null,
          subscriptionId: authView?.subscriptionId ?? null,
          correlationId,
          causationId: input.causationId ?? null,
          idempotencyKey,
          inputSnapshot: input.inputSnapshot ?? {},
          state: WorkflowInstanceState.CREATED,
          currentStepKey: ordered[0] ?? null,
          startedAt: null,
          completedAt: null,
          deadlineAt: input.deadlineAt ?? null,
          cancellationReason: null,
          failureDetails: {},
          initiatingActor: input.actorId,
          executionContext: {},
        },
        client,
      );

      const steps = ver.snapshot.steps.map((s, idx) => ({
        workflowId: instance.id,
        stepKey: s.key,
        stepType: s.type,
        handlerKey: s.handlerKey,
        dependsOn: s.dependsOn ?? [],
        inputSnapshot: {},
        outputSnapshot: {},
        status:
          (s.dependsOn ?? []).length === 0 ? WorkflowStepStatus.READY : WorkflowStepStatus.PENDING,
        attemptCount: 0,
        maxAttempts: s.maxAttempts ?? ver.snapshot.retryDefaults?.maxAttempts ?? 3,
        idempotencyKey: `${idempotencyKey}:${s.key}`,
        ownerWorkerId: null,
        leaseExpiresAt: null,
        fencingToken: 0,
        startedAt: null,
        finishedAt: null,
        timeoutAt: null,
        errorClass: null,
        nextRetryAt: null,
        compensationHandlerKey: s.compensationHandlerKey ?? null,
        executionOrder: idx,
      }));
      await this.repo.createSteps(steps, client);

      await this.repo.appendHistory(
        {
          resourceType: WorkflowHistoryResourceType.WORKFLOW_INSTANCE,
          resourceId: instance.id,
          workflowId: instance.id,
          fromStatus: null,
          toStatus: WorkflowInstanceState.CREATED,
          action: 'CREATE',
          reason: null,
          actorId: input.actorId,
          details: { definitionId: def.id, definitionVersion: ver.versionNumber },
        },
        client,
      );
      await enqueue(
        createWorkflowCreatedEvent({
          ...baseEvt(instance, input.actorId),
          idempotencyKey,
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'workflow.instance.created',
          actorId: input.actorId,
          subjectType: 'WORKFLOW_INSTANCE',
          subjectId: instance.id,
          details: { idempotencyKey },
        },
        client,
      );
      return instance;
    });
  }
}

export class StartWorkflowUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly placement: WorkflowPlacementPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; workflowId: string }) {
    const wf = await this.repo.getInstance(input.workflowId);
    if (!wf) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Workflow not found');
    assertInstanceTransition(wf.state, WorkflowInstanceState.READY);

    if (wf.authorizationRowId) {
      const ok = await this.auth.isAuthorizationStillValid({
        authorizationRowId: wf.authorizationRowId,
        expectedVersion: wf.authorizationVersion,
      });
      if (!ok) {
        throw new DomainError(ErrorCode.FORBIDDEN, 'Authorization no longer valid (fail-closed)');
      }
    }
    if (wf.placementDecisionId) {
      const place = await this.placement.getWorkflowReadyPlacement(wf.placementDecisionId);
      if (!place || place.reservationStatus !== 'COMMITTED') {
        throw new DomainError(
          ErrorCode.FORBIDDEN,
          'Placement must be PLACED with COMMITTED reservation to start',
        );
      }
    }

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      const ready = await this.repo.updateInstanceState(
        wf.id,
        { state: WorkflowInstanceState.READY },
        wf.version,
        client,
      );
      const started = await this.repo.updateInstanceState(
        ready.id,
        { state: WorkflowInstanceState.RUNNING, startedAt: new Date() },
        ready.version,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: WorkflowHistoryResourceType.WORKFLOW_INSTANCE,
          resourceId: wf.id,
          workflowId: wf.id,
          fromStatus: wf.state,
          toStatus: WorkflowInstanceState.RUNNING,
          action: 'START',
          reason: null,
          actorId: input.actorId,
          details: {},
        },
        client,
      );
      await enqueue(createWorkflowStartedEvent(baseEvt(started, input.actorId)));
      await requireAudit(
        this.audit,
        {
          eventType: 'workflow.instance.started',
          actorId: input.actorId,
          subjectType: 'WORKFLOW_INSTANCE',
          subjectId: wf.id,
          details: {},
        },
        client,
      );
      return started;
    });
  }
}

async function transitionInstance(
  repo: WorkflowRepositoryPort,
  outbox: ControlPlaneOutboxTransactionService,
  audit: AuditEventRepositoryPort,
  input: {
    actorId: string;
    workflowId: string;
    to: WorkflowInstanceState;
    action: string;
    reason?: string | null;
    eventFactory?: (wf: WorkflowInstanceRecord) => ReturnType<typeof createWorkflowCancelledEvent>;
  },
) {
  const wf = await repo.getInstance(input.workflowId);
  if (!wf) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Workflow not found');
  assertInstanceTransition(wf.state, input.to);
  return outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
    const updated = await repo.updateInstanceState(
      wf.id,
      {
        state: input.to,
        cancellationReason: input.reason ?? wf.cancellationReason,
        completedAt:
          input.to === WorkflowInstanceState.CANCELLED ||
          input.to === WorkflowInstanceState.FAILED ||
          input.to === WorkflowInstanceState.SUCCEEDED
            ? new Date()
            : wf.completedAt,
      },
      wf.version,
      client,
    );
    await repo.appendHistory(
      {
        resourceType: WorkflowHistoryResourceType.WORKFLOW_INSTANCE,
        resourceId: wf.id,
        workflowId: wf.id,
        fromStatus: wf.state,
        toStatus: input.to,
        action: input.action,
        reason: input.reason ?? null,
        actorId: input.actorId,
        details: {},
      },
      client,
    );
    if (input.eventFactory) await enqueue(input.eventFactory(updated));
    await requireAudit(
      audit,
      {
        eventType: `workflow.instance.${input.action.toLowerCase()}`,
        actorId: input.actorId,
        subjectType: 'WORKFLOW_INSTANCE',
        subjectId: wf.id,
        details: { reason: input.reason ?? null },
      },
      client,
    );
    return updated;
  });
}

export class PauseWorkflowUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}
  execute(input: { actorId: string; workflowId: string; reason?: string }) {
    return transitionInstance(this.repo, this.outbox, this.audit, {
      ...input,
      to: WorkflowInstanceState.PAUSED,
      action: 'PAUSE',
      reason: input.reason,
    });
  }
}

export class ResumeWorkflowUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}
  async execute(input: { actorId: string; workflowId: string }) {
    const wf = await this.repo.getInstance(input.workflowId);
    if (!wf) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Workflow not found');
    if (wf.authorizationRowId) {
      const ok = await this.auth.isAuthorizationStillValid({
        authorizationRowId: wf.authorizationRowId,
        expectedVersion: wf.authorizationVersion,
      });
      if (!ok) {
        throw new DomainError(ErrorCode.FORBIDDEN, 'Cannot resume: authorization revoked/invalid');
      }
    }
    return transitionInstance(this.repo, this.outbox, this.audit, {
      actorId: input.actorId,
      workflowId: input.workflowId,
      to: WorkflowInstanceState.RUNNING,
      action: 'RESUME',
    });
  }
}

export class CancelWorkflowUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}
  execute(input: { actorId: string; workflowId: string; reason?: string }) {
    return transitionInstance(this.repo, this.outbox, this.audit, {
      actorId: input.actorId,
      workflowId: input.workflowId,
      to: WorkflowInstanceState.CANCEL_REQUESTED,
      action: 'CANCEL_REQUEST',
      reason: input.reason,
    }).then(async (wf) =>
      transitionInstance(this.repo, this.outbox, this.audit, {
        actorId: input.actorId,
        workflowId: wf.id,
        to: WorkflowInstanceState.CANCELLED,
        action: 'CANCEL',
        reason: input.reason,
        eventFactory: (w) =>
          createWorkflowCancelledEvent({ ...baseEvt(w, input.actorId), reason: input.reason }),
      }),
    );
  }
}

export class RetryWorkflowUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; workflowId: string; stepId?: string }) {
    const wf = await this.repo.getInstance(input.workflowId);
    if (!wf) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Workflow not found');
    if (wf.authorizationRowId) {
      const ok = await this.auth.isAuthorizationStillValid({
        authorizationRowId: wf.authorizationRowId,
        expectedVersion: wf.authorizationVersion,
      });
      if (!ok) {
        throw new DomainError(ErrorCode.FORBIDDEN, 'Cannot retry: authorization revoked/invalid');
      }
    }
    const steps = await this.repo.listSteps(wf.id);
    const target =
      (input.stepId ? steps.find((s) => s.id === input.stepId) : null) ??
      steps.find((s) => s.status === WorkflowStepStatus.FAILED) ??
      steps.find((s) => s.status === WorkflowStepStatus.RETRY_PENDING);
    if (!target) throw new DomainError(ErrorCode.VALIDATION_ERROR, 'No retryable step');

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      assertStepTransition(target.status, WorkflowStepStatus.READY);
      const step = await this.repo.updateStep(
        target.id,
        { status: WorkflowStepStatus.READY, nextRetryAt: null, errorClass: null },
        target.version,
        client,
      );
      let instance = wf;
      if (wf.state !== WorkflowInstanceState.RUNNING) {
        assertInstanceTransition(wf.state, WorkflowInstanceState.RUNNING);
        instance = await this.repo.updateInstanceState(
          wf.id,
          { state: WorkflowInstanceState.RUNNING },
          wf.version,
          client,
        );
      }
      await this.repo.appendHistory(
        {
          resourceType: WorkflowHistoryResourceType.WORKFLOW_STEP,
          resourceId: step.id,
          workflowId: wf.id,
          fromStatus: target.status,
          toStatus: WorkflowStepStatus.READY,
          action: 'RETRY',
          reason: null,
          actorId: input.actorId,
          details: {},
        },
        client,
      );
      await enqueue(
        createWorkflowRetryScheduledEvent({
          ...baseEvt(instance, input.actorId),
          stepId: step.id,
          nextRetryAt: new Date().toISOString(),
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'workflow.step.retry',
          actorId: input.actorId,
          subjectType: 'WORKFLOW_STEP',
          subjectId: step.id,
          details: {},
        },
        client,
      );
      return { workflow: instance, step };
    });
  }
}

export class ReconcileWorkflowUseCase {
  constructor(private readonly reconcileAll: ReconcileWorkflowsUseCase) {}
  execute(input: { actorId: string; workflowId: string }) {
    return this.reconcileAll.execute({ actorId: input.actorId, workflowId: input.workflowId });
  }
}

// ---------------------------------------------------------------------------
// Worker step ops
// ---------------------------------------------------------------------------

export class ClaimStepUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { workerId: string; leaseMs?: number; handlerKeys?: string[] }) {
    const claimed = await this.repo.claimStepForUpdateSkipLocked({
      workerId: input.workerId,
      leaseMs: input.leaseMs ?? 30_000,
      handlerKeys: input.handlerKeys,
    });
    if (!claimed) return null;
    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      await this.repo.appendHistory(
        {
          resourceType: WorkflowHistoryResourceType.WORKFLOW_STEP,
          resourceId: claimed.step.id,
          workflowId: claimed.workflow.id,
          fromStatus: WorkflowStepStatus.READY,
          toStatus: WorkflowStepStatus.CLAIMED,
          action: 'CLAIM',
          reason: null,
          actorId: input.workerId,
          details: { fencingToken: claimed.step.fencingToken },
        },
        client,
      );
      await enqueue(
        createWorkflowStepClaimedEvent({
          ...baseEvt(claimed.workflow, input.workerId),
          stepId: claimed.step.id,
          fencingToken: claimed.step.fencingToken,
          workerId: input.workerId,
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'workflow.step.claimed',
          actorId: input.workerId,
          subjectType: 'WORKFLOW_STEP',
          subjectId: claimed.step.id,
          details: { fencingToken: claimed.step.fencingToken },
        },
        client,
      );
    });
    return claimed;
  }
}

export class RenewLeaseUseCase {
  constructor(private readonly repo: WorkflowRepositoryPort) {}
  execute(input: {
    stepId: string;
    workerId: string;
    fencingToken: number;
    expectedVersion: number;
    leaseMs?: number;
  }) {
    return this.repo.renewLease({
      ...input,
      leaseMs: input.leaseMs ?? 30_000,
    });
  }
}

export class CompleteStepUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    stepId: string;
    workerId: string;
    fencingToken: number;
    expectedVersion: number;
    outputSnapshot?: Record<string, unknown>;
    checkpoint?: Record<string, unknown>;
  }) {
    const step = await this.repo.getStep(input.stepId);
    if (!step) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Step not found');
    const wf = await this.repo.getInstance(step.workflowId);
    if (!wf) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Workflow not found');

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      const completed = await this.repo.completeStep({
        stepId: input.stepId,
        workerId: input.workerId,
        fencingToken: input.fencingToken,
        expectedVersion: input.expectedVersion,
        outputSnapshot: input.outputSnapshot ?? {},
        client,
      });
      if (input.checkpoint) {
        const seq =
          (await this.repo.listSteps(wf.id)).filter((s) => s.status === WorkflowStepStatus.SUCCEEDED)
            .length || 1;
        await this.repo.createCheckpoint(
          {
            workflowId: wf.id,
            stepId: completed.id,
            sequence: seq,
            definitionVersion: wf.definitionVersion,
            stateSnapshot: input.checkpoint,
            outputRef: null,
            integrityHash: integrityHash(input.checkpoint),
          },
          client,
        );
      }
      await this.advanceDependents(wf, client);
      await this.repo.appendHistory(
        {
          resourceType: WorkflowHistoryResourceType.WORKFLOW_STEP,
          resourceId: completed.id,
          workflowId: wf.id,
          fromStatus: step.status,
          toStatus: WorkflowStepStatus.SUCCEEDED,
          action: 'COMPLETE',
          reason: null,
          actorId: input.actorId,
          details: { fencingToken: input.fencingToken },
        },
        client,
      );
      await enqueue(
        createWorkflowStepSucceededEvent({
          ...baseEvt(wf, input.actorId),
          stepId: completed.id,
        }),
      );
      const maybeDone = await this.maybeCompleteWorkflow(wf, input.actorId, client, enqueue);
      await requireAudit(
        this.audit,
        {
          eventType: 'workflow.step.completed',
          actorId: input.actorId,
          subjectType: 'WORKFLOW_STEP',
          subjectId: completed.id,
          details: { fencingToken: input.fencingToken },
        },
        client,
      );
      return { step: completed, workflow: maybeDone ?? wf };
    });
  }

  private async advanceDependents(wf: WorkflowInstanceRecord, client: unknown) {
    const steps = await this.repo.listSteps(wf.id);
    const byKey = new Map(steps.map((s) => [s.stepKey, s]));
    for (const s of steps) {
      if (s.status !== WorkflowStepStatus.PENDING) continue;
      const depsOk = s.dependsOn.every((d) => {
        const dep = byKey.get(d);
        return dep && (dep.status === WorkflowStepStatus.SUCCEEDED || dep.status === WorkflowStepStatus.SKIPPED);
      });
      if (depsOk) {
        await this.repo.updateStep(s.id, { status: WorkflowStepStatus.READY }, s.version, client);
      }
    }
  }

  private async maybeCompleteWorkflow(
    wf: WorkflowInstanceRecord,
    actorId: string,
    client: unknown,
    enqueue: (event: IntegrationEvent<unknown>) => Promise<string>,
  ) {
    const steps = await this.repo.listSteps(wf.id);
    const allDone = steps.every(
      (s) =>
        s.status === WorkflowStepStatus.SUCCEEDED ||
        s.status === WorkflowStepStatus.SKIPPED ||
        s.status === WorkflowStepStatus.CANCELLED,
    );
    if (!allDone) return null;
    assertInstanceTransition(wf.state, WorkflowInstanceState.SUCCEEDED);
    const updated = await this.repo.updateInstanceState(
      wf.id,
      { state: WorkflowInstanceState.SUCCEEDED, completedAt: new Date() },
      wf.version,
      client,
    );
    await enqueue(createWorkflowCompletedEvent(baseEvt(updated, actorId)));
    return updated;
  }
}

export class FailStepUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    stepId: string;
    workerId: string;
    fencingToken: number;
    expectedVersion: number;
    errorClass: string;
    diagnostics?: Record<string, unknown>;
  }) {
    const step = await this.repo.getStep(input.stepId);
    if (!step) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Step not found');
    const wf = await this.repo.getInstance(step.workflowId);
    if (!wf) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Workflow not found');

    const retryable =
      classifyRetryability(input.errorClass) && step.attemptCount < step.maxAttempts;
    const nextStatus = retryable ? WorkflowStepStatus.RETRY_PENDING : WorkflowStepStatus.FAILED;
    const nextRetryAt = retryable
      ? scheduleRetryAt(new Date(), step.attemptCount, wf.definitionSnapshot.retryDefaults, step.fencingToken)
      : null;

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      const failed = await this.repo.failStep({
        stepId: input.stepId,
        workerId: input.workerId,
        fencingToken: input.fencingToken,
        expectedVersion: input.expectedVersion,
        errorClass: input.errorClass,
        diagnostics: input.diagnostics,
        nextStatus,
        nextRetryAt,
        client,
      });
      await this.repo.appendHistory(
        {
          resourceType: WorkflowHistoryResourceType.WORKFLOW_STEP,
          resourceId: failed.id,
          workflowId: wf.id,
          fromStatus: step.status,
          toStatus: nextStatus,
          action: 'FAIL',
          reason: input.errorClass,
          actorId: input.actorId,
          details: input.diagnostics ?? {},
        },
        client,
      );
      await enqueue(
        createWorkflowStepFailedEvent({
          ...baseEvt(wf, input.actorId),
          stepId: failed.id,
          errorClass: input.errorClass,
        }),
      );
      if (retryable && nextRetryAt) {
        await enqueue(
          createWorkflowRetryScheduledEvent({
            ...baseEvt(wf, input.actorId),
            stepId: failed.id,
            nextRetryAt: nextRetryAt.toISOString(),
          }),
        );
        await this.repo.updateInstanceState(
          wf.id,
          { state: WorkflowInstanceState.RETRY_PENDING },
          wf.version,
          client,
        );
      } else if (input.errorClass === WorkflowErrorClass.AUTHORIZATION_REVOKED) {
        await this.repo.updateInstanceState(
          wf.id,
          {
            state: WorkflowInstanceState.REQUIRES_INTERVENTION,
            failureDetails: { errorClass: input.errorClass },
          },
          wf.version,
          client,
        );
        await enqueue(
          createWorkflowRequiresInterventionEvent({
            ...baseEvt(wf, input.actorId),
            reason: 'AUTHORIZATION_REVOKED',
          }),
        );
      } else if (!retryable) {
        await this.repo.createDeadLetter(
          {
            workflowId: wf.id,
            stepId: failed.id,
            reason: `Exhausted or permanent failure: ${input.errorClass}`,
            payload: input.diagnostics ?? {},
            status: DeadLetterStatus.OPEN,
          },
          client,
        );
        await this.repo.updateInstanceState(
          wf.id,
          {
            state: WorkflowInstanceState.FAILED,
            completedAt: new Date(),
            failureDetails: { errorClass: input.errorClass },
          },
          wf.version,
          client,
        );
        await enqueue(
          createWorkflowFailedEvent({
            ...baseEvt(wf, input.actorId),
            reason: input.errorClass,
          }),
        );
      }
      await requireAudit(
        this.audit,
        {
          eventType: 'workflow.step.failed',
          actorId: input.actorId,
          subjectType: 'WORKFLOW_STEP',
          subjectId: failed.id,
          details: { errorClass: input.errorClass, nextStatus },
        },
        client,
      );
      return failed;
    });
  }
}

export class ScheduleRetryUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; stepId: string; nextRetryAt?: Date }) {
    const step = await this.repo.getStep(input.stepId);
    if (!step) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Step not found');
    const wf = await this.repo.getInstance(step.workflowId);
    if (!wf) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Workflow not found');
    const nextRetryAt =
      input.nextRetryAt ??
      scheduleRetryAt(new Date(), step.attemptCount + 1, wf.definitionSnapshot.retryDefaults);
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      const updated = await this.repo.updateStep(
        step.id,
        { status: WorkflowStepStatus.RETRY_PENDING, nextRetryAt },
        step.version,
        client,
      );
      await enqueue(
        createWorkflowRetryScheduledEvent({
          ...baseEvt(wf, input.actorId),
          stepId: step.id,
          nextRetryAt: nextRetryAt.toISOString(),
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'workflow.retry.scheduled',
          actorId: input.actorId,
          subjectType: 'WORKFLOW_STEP',
          subjectId: step.id,
          details: { nextRetryAt: nextRetryAt.toISOString() },
        },
        client,
      );
      return updated;
    });
  }
}

export class StartCompensationUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; workflowId: string }) {
    const wf = await this.repo.getInstance(input.workflowId);
    if (!wf) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Workflow not found');
    const steps = await this.repo.listSteps(wf.id);
    const succeeded = steps
      .filter((s) => s.status === WorkflowStepStatus.SUCCEEDED)
      .map((s) => s.stepKey);
    const order = compensationOrder(wf.definitionSnapshot.steps, succeeded);
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      assertInstanceTransition(wf.state, WorkflowInstanceState.COMPENSATING);
      const updated = await this.repo.updateInstanceState(
        wf.id,
        { state: WorkflowInstanceState.COMPENSATING },
        wf.version,
        client,
      );
      const byKey = new Map(steps.map((s) => [s.stepKey, s]));
      let ord = 0;
      for (const key of order) {
        const step = byKey.get(key)!;
        const def = wf.definitionSnapshot.steps.find((s) => s.key === key);
        await this.repo.createCompensation(
          {
            stepId: step.id,
            workflowId: wf.id,
            handlerKey: def?.compensationHandlerKey ?? 'noop:checkpoint',
            input: step.outputSnapshot,
            status: CompensationStatus.PENDING,
            attempts: 0,
            timeoutAt: null,
            result: {},
            failureDetails: {},
            executionOrder: ord++,
          },
          client,
        );
        await this.repo.updateStep(
          step.id,
          { status: WorkflowStepStatus.COMPENSATION_PENDING },
          step.version,
          client,
        );
      }
      await enqueue(createWorkflowCompensationStartedEvent(baseEvt(updated, input.actorId)));
      await requireAudit(
        this.audit,
        {
          eventType: 'workflow.compensation.started',
          actorId: input.actorId,
          subjectType: 'WORKFLOW_INSTANCE',
          subjectId: wf.id,
          details: { order },
        },
        client,
      );
      return { workflow: updated, order };
    });
  }
}

export class CompleteCompensationUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    workflowId: string;
    stepId: string;
    success: boolean;
    result?: Record<string, unknown>;
  }) {
    const wf = await this.repo.getInstance(input.workflowId);
    if (!wf) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Workflow not found');
    const compensations = await this.repo.listCompensations(wf.id);
    const comp = compensations.find((c) => c.stepId === input.stepId);
    if (!comp) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Compensation not found');
    const step = await this.repo.getStep(input.stepId);
    if (!step) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Step not found');

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      if (input.success) {
        await this.repo.updateCompensation(
          comp.id,
          {
            status: CompensationStatus.SUCCEEDED,
            attempts: comp.attempts + 1,
            result: input.result ?? {},
          },
          comp.version,
          client,
        );
        await this.repo.updateStep(
          step.id,
          { status: WorkflowStepStatus.COMPENSATED },
          step.version,
          client,
        );
        await enqueue(
          createWorkflowCompensationSucceededEvent({
            ...baseEvt(wf, input.actorId),
            stepId: step.id,
          }),
        );
      } else {
        await this.repo.updateCompensation(
          comp.id,
          {
            status: CompensationStatus.FAILED,
            attempts: comp.attempts + 1,
            failureDetails: input.result ?? {},
          },
          comp.version,
          client,
        );
        await this.repo.updateInstanceState(
          wf.id,
          { state: WorkflowInstanceState.COMPENSATION_FAILED },
          wf.version,
          client,
        );
        await enqueue(
          createWorkflowCompensationFailedEvent({
            ...baseEvt(wf, input.actorId),
            stepId: step.id,
          }),
        );
      }
      await requireAudit(
        this.audit,
        {
          eventType: input.success
            ? 'workflow.compensation.succeeded'
            : 'workflow.compensation.failed',
          actorId: input.actorId,
          subjectType: 'WORKFLOW_COMPENSATION',
          subjectId: comp.id,
          details: {},
        },
        client,
      );
      return comp;
    });
  }
}

// ---------------------------------------------------------------------------
// Human tasks
// ---------------------------------------------------------------------------

export class AssignHumanTaskUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; taskId: string; assignee: string }) {
    const task = await this.repo.getHumanTask(input.taskId);
    if (!task) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Task not found');
    assertTaskTransition(task.status, HumanTaskStatus.ASSIGNED);
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const updated = await this.repo.updateHumanTask(
        task.id,
        { status: HumanTaskStatus.ASSIGNED, assignee: input.assignee, actorId: input.actorId },
        task.version,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: WorkflowHistoryResourceType.WORKFLOW_TASK,
          resourceId: task.id,
          workflowId: task.workflowId,
          fromStatus: task.status,
          toStatus: HumanTaskStatus.ASSIGNED,
          action: 'ASSIGN',
          reason: null,
          actorId: input.actorId,
          details: { assignee: input.assignee },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'workflow.task.assigned',
          actorId: input.actorId,
          subjectType: 'WORKFLOW_TASK',
          subjectId: task.id,
          details: { assignee: input.assignee },
        },
        client,
      );
      return updated;
    });
  }
}

export class ApproveHumanTaskUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; taskId: string; reason?: string }) {
    return decideHumanTask(this.repo, this.outbox, this.audit, input, HumanTaskStatus.APPROVED, 'APPROVE');
  }
}

async function decideHumanTask(
  repo: WorkflowRepositoryPort,
  outbox: ControlPlaneOutboxTransactionService,
  audit: AuditEventRepositoryPort,
  input: { actorId: string; taskId: string; reason?: string },
  status: HumanTaskStatus,
  action: string,
) {
  const task = await repo.getHumanTask(input.taskId);
  if (!task) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Task not found');
  if (task.status === status || task.status === HumanTaskStatus.COMPLETED) {
    return task;
  }
  assertTaskTransition(task.status, status);
  const wf = await repo.getInstance(task.workflowId);
  if (!wf) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Workflow not found');

  return outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
    const updated = await repo.updateHumanTask(
      task.id,
      {
        status,
        decision: status,
        decisionReason: input.reason ?? null,
        actorId: input.actorId,
      },
      task.version,
      client,
    );
    if (task.stepId && status === HumanTaskStatus.APPROVED) {
      const step = await repo.getStep(task.stepId);
      if (step && step.status === WorkflowStepStatus.WAITING_APPROVAL) {
        await repo.updateStep(step.id, { status: WorkflowStepStatus.READY }, step.version, client);
      }
      await repo.updateInstanceState(
        wf.id,
        { state: WorkflowInstanceState.RUNNING },
        wf.version,
        client,
      );
      await enqueue(createWorkflowApprovedEvent({ ...baseEvt(wf, input.actorId), taskId: task.id }));
    }
    if (task.stepId && status === HumanTaskStatus.REJECTED) {
      const step = await repo.getStep(task.stepId);
      if (step) {
        await repo.updateStep(
          step.id,
          { status: WorkflowStepStatus.FAILED, errorClass: WorkflowErrorClass.VALIDATION },
          step.version,
          client,
        );
      }
    }
    await repo.appendHistory(
      {
        resourceType: WorkflowHistoryResourceType.WORKFLOW_TASK,
        resourceId: task.id,
        workflowId: task.workflowId,
        fromStatus: task.status,
        toStatus: status,
        action,
        reason: input.reason ?? null,
        actorId: input.actorId,
        details: {},
      },
      client,
    );
    await requireAudit(
      audit,
      {
        eventType: `workflow.task.${action.toLowerCase()}`,
        actorId: input.actorId,
        subjectType: 'WORKFLOW_TASK',
        subjectId: task.id,
        details: { reason: input.reason ?? null },
      },
      client,
    );
    return updated;
  });
}

export class RejectHumanTaskUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}
  execute(input: { actorId: string; taskId: string; reason: string }) {
    if (!input.reason?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Reject reason is required');
    }
    return decideHumanTask(
      this.repo,
      this.outbox,
      this.audit,
      input,
      HumanTaskStatus.REJECTED,
      'REJECT',
    );
  }
}

export class CompleteHumanTaskUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; taskId: string }) {
    const task = await this.repo.getHumanTask(input.taskId);
    if (!task) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Task not found');
    if (task.status === HumanTaskStatus.COMPLETED) return task;
    assertTaskTransition(task.status, HumanTaskStatus.COMPLETED);
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const updated = await this.repo.updateHumanTask(
        task.id,
        { status: HumanTaskStatus.COMPLETED, actorId: input.actorId },
        task.version,
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'workflow.task.completed',
          actorId: input.actorId,
          subjectType: 'WORKFLOW_TASK',
          subjectId: task.id,
          details: {},
        },
        client,
      );
      return updated;
    });
  }
}

export class WorkerHeartbeatUseCase {
  constructor(private readonly repo: WorkflowRepositoryPort) {}
  async execute(input: {
    workerId: string;
    identity: string;
    workerVersion?: string;
    metadata?: Record<string, unknown>;
  }) {
    const existing = await this.repo.getWorker(input.workerId);
    if (!existing) {
      return this.repo.upsertWorker({
        workerId: input.workerId,
        identity: input.identity,
        workerVersion: input.workerVersion ?? '1.0.0',
        metadata: input.metadata,
      });
    }
    return this.repo.heartbeatWorker(input.workerId, input.metadata);
  }
}

export class ReconcileWorkflowsUseCase {
  constructor(
    private readonly repo: WorkflowRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; limit?: number; workflowId?: string }) {
    const now = new Date();
    const limit = input.limit ?? 50;
    const actions: string[] = [];

    const expiredLeases = await this.repo.listExpiredLeases(now, limit);
    for (const step of expiredLeases) {
      if (input.workflowId && step.workflowId !== input.workflowId) continue;
      await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
        await this.repo.updateStep(
          step.id,
          {
            status: WorkflowStepStatus.READY,
            ownerWorkerId: null,
            leaseExpiresAt: null,
          },
          step.version,
          client,
        );
        actions.push(`requeue-expired-lease:${step.id}`);
        await requireAudit(
          this.audit,
          {
            eventType: 'workflow.reconcile.lease_expired',
            actorId: input.actorId,
            subjectType: 'WORKFLOW_STEP',
            subjectId: step.id,
            details: {},
          },
          client,
        );
      });
    }

    const due = await this.repo.listDueRetries(now, limit);
    for (const step of due) {
      if (input.workflowId && step.workflowId !== input.workflowId) continue;
      await this.repo.updateStep(step.id, { status: WorkflowStepStatus.READY, nextRetryAt: null }, step.version);
      actions.push(`due-retry:${step.id}`);
    }

    const expiredTasks = await this.repo.listExpiredHumanTasks(now, limit);
    for (const task of expiredTasks) {
      if (input.workflowId && task.workflowId !== input.workflowId) continue;
      await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
        await this.repo.updateHumanTask(
          task.id,
          { status: HumanTaskStatus.EXPIRED },
          task.version,
          client,
        );
        actions.push(`expire-task:${task.id}`);
      });
    }

    const instances = input.workflowId
      ? [await this.repo.getInstance(input.workflowId)].filter(Boolean)
      : await this.repo.listInstancesForReconcile(limit);
    for (const wf of instances as WorkflowInstanceRecord[]) {
      if (wf.authorizationRowId) {
        const ok = await this.auth.isAuthorizationStillValid({
          authorizationRowId: wf.authorizationRowId,
          expectedVersion: wf.authorizationVersion,
        });
        if (!ok && wf.state !== WorkflowInstanceState.REQUIRES_INTERVENTION) {
          await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
            await this.repo.updateInstanceState(
              wf.id,
              { state: WorkflowInstanceState.REQUIRES_INTERVENTION },
              wf.version,
              client,
            );
            await enqueue(
              createWorkflowRequiresInterventionEvent({
                ...baseEvt(wf, input.actorId),
                reason: 'AUTHORIZATION_REVOKED',
              }),
            );
            actions.push(`auth-hold:${wf.id}`);
          });
        }
      }
      if (wf.deadlineAt && wf.deadlineAt.getTime() < now.getTime()) {
        await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
          await this.repo.updateInstanceState(
            wf.id,
            { state: WorkflowInstanceState.TIMED_OUT, completedAt: now },
            wf.version,
            client,
          );
          actions.push(`deadline:${wf.id}`);
        });
      }
    }

    return { actions, count: actions.length };
  }
}

export class ListWorkflowResourcesUseCase {
  constructor(private readonly repo: WorkflowRepositoryPort) {}
  listDefinitions(filter: { limit?: number; offset?: number; status?: string; q?: string }) {
    return this.repo.listDefinitions(filter);
  }
  getDefinition(id: string) {
    return this.repo.getDefinition(id);
  }
  listInstances(filter: {
    limit?: number;
    offset?: number;
    status?: string;
    q?: string;
    workflowType?: string;
  }) {
    return this.repo.listInstances(filter);
  }
  getInstance(id: string) {
    return this.repo.getInstance(id);
  }
  listSteps(workflowId: string) {
    return this.repo.listSteps(workflowId);
  }
  listAttempts(workflowId: string) {
    return this.repo.listAttempts(workflowId);
  }
  listHistory(filter: {
    workflowId?: string;
    limit?: number;
    offset?: number;
    resourceType?: string;
    resourceId?: string;
  }) {
    return this.repo.listHistory(filter);
  }
  listTasks(filter: { limit?: number; offset?: number; status?: string; workflowId?: string }) {
    return this.repo.listHumanTasks(filter);
  }
  getTask(id: string) {
    return this.repo.getHumanTask(id);
  }
  listCheckpoints(workflowId: string) {
    return this.repo.listCheckpoints(workflowId);
  }
  listCompensations(workflowId: string) {
    return this.repo.listCompensations(workflowId);
  }
  listDeadLetters(filter: { limit?: number; offset?: number; status?: string; q?: string }) {
    return this.repo.listDeadLetters(filter);
  }
  listWorkers(filter: { limit?: number; offset?: number; status?: string; q?: string }) {
    return this.repo.listWorkers(filter);
  }
}

/** Worker executes handler OUTSIDE TX then persists outcome. */
export class ExecuteClaimedStepUseCase {
  constructor(
    private readonly handlers: WorkflowHandlerRegistryPort,
    private readonly complete: CompleteStepUseCase,
    private readonly fail: FailStepUseCase,
    private readonly repo: WorkflowRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(claimed: {
    step: WorkflowStepRecord;
    workflow: WorkflowInstanceRecord;
    workerId: string;
  }) {
    const handler = this.handlers.get(claimed.step.handlerKey);
    if (!handler) {
      return this.fail.execute({
        actorId: claimed.workerId,
        stepId: claimed.step.id,
        workerId: claimed.workerId,
        fencingToken: claimed.step.fencingToken,
        expectedVersion: claimed.step.version,
        errorClass: WorkflowErrorClass.DEPENDENCY_UNAVAILABLE,
        diagnostics: { reason: 'handler_not_registered' },
      });
    }

    // Mark RUNNING in a short TX (no handler I/O inside).
    await this.repo.updateStep(
      claimed.step.id,
      { status: WorkflowStepStatus.RUNNING },
      claimed.step.version,
    );
    const fresh = await this.repo.getStep(claimed.step.id);
    if (!fresh) return null;

    const outcome = await handler.execute({
      workflowId: claimed.workflow.id,
      stepId: fresh.id,
      stepKey: fresh.stepKey,
      handlerKey: fresh.handlerKey,
      fencingToken: fresh.fencingToken,
      attemptNumber: fresh.attemptCount,
      inputSnapshot: fresh.inputSnapshot,
      workflowInput: claimed.workflow.inputSnapshot,
      correlationId: claimed.workflow.correlationId,
      workerId: claimed.workerId,
    });

    if (outcome.status === 'SUCCEEDED') {
      return this.complete.execute({
        actorId: claimed.workerId,
        stepId: fresh.id,
        workerId: claimed.workerId,
        fencingToken: fresh.fencingToken,
        expectedVersion: fresh.version,
        outputSnapshot: outcome.outputSnapshot,
        checkpoint: outcome.checkpoint,
      });
    }
    if (outcome.status === 'WAITING_APPROVAL') {
      return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
        const step = await this.repo.updateStep(
          fresh.id,
          { status: WorkflowStepStatus.WAITING_APPROVAL },
          fresh.version,
          client,
        );
        const task = await this.repo.createHumanTask(
          {
            workflowId: claimed.workflow.id,
            stepId: fresh.id,
            taskType: HumanTaskType.APPROVAL,
            requiredPermission: outcome.requiredPermission ?? 'platform:workflow_task:approve',
            assignee: null,
            dueAt: null,
            contextSnapshot: { stepKey: fresh.stepKey },
            instructions: outcome.instructions ?? null,
            decision: null,
            decisionReason: null,
            actorId: null,
            status: HumanTaskStatus.OPEN,
          },
          client,
        );
        await this.repo.updateInstanceState(
          claimed.workflow.id,
          { state: WorkflowInstanceState.WAITING_APPROVAL },
          claimed.workflow.version,
          client,
        );
        await enqueue(
          createWorkflowWaitingApprovalEvent({
            ...baseEvt(claimed.workflow, claimed.workerId),
            stepId: fresh.id,
            taskId: task.id,
          }),
        );
        await requireAudit(
          this.audit,
          {
            eventType: 'workflow.waiting_approval',
            actorId: claimed.workerId,
            subjectType: 'WORKFLOW_TASK',
            subjectId: task.id,
            details: {},
          },
          client,
        );
        return { step, task };
      });
    }
    return this.fail.execute({
      actorId: claimed.workerId,
      stepId: fresh.id,
      workerId: claimed.workerId,
      fencingToken: fresh.fencingToken,
      expectedVersion: fresh.version,
      errorClass: outcome.errorClass,
      diagnostics: outcome.diagnostics,
    });
  }
}

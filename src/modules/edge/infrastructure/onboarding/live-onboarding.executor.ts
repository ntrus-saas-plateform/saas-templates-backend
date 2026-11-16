import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ActivationRepositoryPort } from '../../domain/readiness-activation/activation-repository.port.js';
import { ActivationRecordStatus } from '../../domain/readiness-activation/activation.types.js';
import type { OnboardingLiveExecutor } from '../../domain/onboarding/onboarding-handlers.js';
import {
  assertJourneyTransition,
  canRequestClose,
  pickNextAdvanceableStep,
} from '../../domain/onboarding/onboarding-policy.js';
import type { OnboardingRepositoryPort } from '../../domain/onboarding/onboarding-repository.port.js';
import {
  DEFAULT_ONBOARDING_STEP_PLAN,
  OnboardingErrorCode,
  OnboardingJourneyStatus,
  OnboardingStepKind,
  OnboardingStepStatus,
  OnboardingTaskStatus,
  OnboardingTemplateStatus,
  type OnboardingHandlerKey,
  type OnboardingJourneyRecord,
  type OnboardingStepRecord,
} from '../../domain/onboarding/onboarding.types.js';
import type {
  WorkflowAuthorizationPort,
  WorkflowReadyAuthorizationView,
} from '../../domain/workflow/workflow-authorization.port.js';
import type {
  LeaseValidationResult,
  WorkflowLeasePort,
} from '../../domain/workflow/workflow-lease.port.js';
import type {
  WorkflowHandlerInput,
  WorkflowHandlerOutcome,
} from '../../domain/workflow/workflow-handler.port.js';

const AUTHORIZATION_TIMEOUT_MS = 5_000;

function snap(input: WorkflowHandlerInput): Record<string, unknown> {
  return { ...input.workflowInput, ...input.inputSnapshot, ...(input.executionContext ?? {}) };
}
function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}
function intOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isInteger(Number(value))) {
    return Number(value);
  }
  return null;
}
function ok(output: Record<string, unknown> = {}): WorkflowHandlerOutcome {
  return { status: 'SUCCEEDED', outputSnapshot: output };
}
function fail(
  code: OnboardingErrorCode | string,
  message: string,
  retryable = false,
): WorkflowHandlerOutcome {
  return {
    status: 'FAILED',
    errorClass: code,
    message,
    retryable,
    diagnostics: { handler: 'p7.12', message },
  };
}
function waitingApproval(
  instructions: string,
  requiredPermission = 'platform:onboarding:approve',
): WorkflowHandlerOutcome {
  return { status: 'WAITING_APPROVAL', instructions, requiredPermission };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

type AuthorizationDecision =
  | { allowed: true; view: WorkflowReadyAuthorizationView; rowId: string; version: number }
  | { allowed: false; reason: string; rowId?: string | null; version?: number | null };

function authorizationEvidence(
  decision: AuthorizationDecision,
  context: { tenantId: string; productId: string; provisioningRequestId: string | null },
): Record<string, unknown> {
  return {
    p71AuthorizationDecision: decision.allowed ? 'ALLOW' : 'DENY',
    p71AuthorizationReason: decision.allowed ? 'REVALIDATED' : decision.reason,
    p71AuthorizationRowId: decision.rowId ?? null,
    p71AuthorizationVersion: decision.version ?? null,
    p71ProvisioningRequestId: context.provisioningRequestId,
    tenantId: context.tenantId,
    productId: context.productId,
    decidedAt: new Date().toISOString(),
  };
}

function vaultHandoverRef(journeyId: string): string {
  return `vault://onboarding-handover/${journeyId}/${Date.now()}`;
}

/**
 * Bridges P7.4 workflow handlers → P7.12 onboarding operations.
 *
 * Never CRM; never business invites; never Subscription.ACTIVE.
 * Human approval cannot bypass P7.1 — every mutative handler revalidates.
 */
export function createLiveOnboardingExecutor(deps: {
  repo: OnboardingRepositoryPort;
  activationRepo: ActivationRepositoryPort;
  authorization: WorkflowAuthorizationPort;
  lease?: WorkflowLeasePort | null;
}): OnboardingLiveExecutor {
  const validateLease = async (
    input: WorkflowHandlerInput,
  ): Promise<LeaseValidationResult | null> => {
    if (!deps.lease) return null;
    if (!Number.isInteger(input.fencingToken) || input.fencingToken < 1) {
      return {
        valid: false,
        reason: 'MISSING_TOKEN',
        detail: 'fencingToken must be a positive integer issued by the engine',
      };
    }
    if (!input.workflowId || !input.stepId || !input.workerId) {
      return { valid: false, reason: 'STEP_NOT_FOUND', detail: 'claim identity incomplete' };
    }
    return deps.lease.validateLease({
      workflowId: input.workflowId,
      stepId: input.stepId,
      workerId: input.workerId,
      fencingToken: input.fencingToken,
    });
  };

  const revalidateAuthorization = async (
    s: Record<string, unknown>,
    bound: {
      authorizationRowId: string | null;
      authorizationVersion: number | null;
      provisioningRequestId: string | null;
    },
  ): Promise<AuthorizationDecision> => {
    if (!deps.authorization) {
      return { allowed: false, reason: 'AUTHORIZATION_PORT_MISSING' };
    }
    const rowId =
      str(s.authorizationRowId) ?? str(s.authorizationId) ?? bound.authorizationRowId ?? null;
    const version = intOf(s.authorizationVersion) ?? bound.authorizationVersion ?? null;
    const provisioningRequestId =
      str(s.provisioningRequestId) ?? bound.provisioningRequestId ?? null;

    if (!rowId || version == null) {
      return { allowed: false, reason: 'TRUST_MATERIAL_MISSING', rowId, version };
    }

    let view: WorkflowReadyAuthorizationView | null;
    try {
      view = await withTimeout(
        deps.authorization.revalidateBoundAuthorization({
          authorizationRowId: rowId,
          authorizationVersion: version,
          provisioningRequestId,
        }),
        AUTHORIZATION_TIMEOUT_MS,
        'P7.1 authorization revalidation',
      );
    } catch {
      return { allowed: false, reason: 'AUTHORIZATION_TIMEOUT', rowId, version };
    }
    if (!view) {
      return { allowed: false, reason: 'AUTHORIZATION_INVALID', rowId, version };
    }
    if (view.authorizationRowId !== rowId || view.authorizationVersion !== version) {
      return { allowed: false, reason: 'AUTHORIZATION_IDENTITY_MISMATCH', rowId, version };
    }
    return { allowed: true, view, rowId, version };
  };

  const recordEvidence = async (
    ctx: { journeyId?: string | null; tenantId: string },
    input: WorkflowHandlerInput,
    operation: string,
    outcome: 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'PARTIAL' | 'WAITING_APPROVAL',
    evidence: Record<string, unknown>,
    startedAt: number,
    error?: { code: string; message: string },
  ) => {
    try {
      await deps.repo.createEvidence({
        journeyId: ctx.journeyId ?? null,
        tenantId: ctx.tenantId,
        workflowId: input.workflowId ?? null,
        stepKey: input.stepKey ?? null,
        operation,
        outcome,
        evidence,
        errorCode: error?.code ?? null,
        errorMessage: error?.message ?? null,
        durationMs: Date.now() - startedAt,
        performedBy: input.workerId ?? null,
      });
    } catch (err) {
      throw new DomainError(
        ErrorCode.DEPENDENCY_UNAVAILABLE,
        'Onboarding operation evidence could not be persisted',
        [{ operation }],
        err instanceof Error ? err : undefined,
      );
    }
  };

  const gateMutation = async (
    input: WorkflowHandlerInput,
    bound: {
      tenantId: string;
      productId: string;
      authorizationRowId: string | null;
      authorizationVersion: number | null;
      provisioningRequestId: string | null;
      journeyId?: string | null;
    },
    operation: string,
  ): Promise<{ denied: WorkflowHandlerOutcome | null; decision: AuthorizationDecision }> => {
    const startedAt = Date.now();
    const s = snap(input);

    if (deps.lease) {
      const leaseCheck = await validateLease(input);
      if (leaseCheck && !leaseCheck.valid) {
        await recordEvidence(
          { journeyId: bound.journeyId, tenantId: bound.tenantId },
          input,
          `${operation}:lease_check`,
          'FAILED',
          { leaseReason: leaseCheck.reason, detail: leaseCheck.detail ?? null },
          startedAt,
          { code: OnboardingErrorCode.AUTHORIZATION_FAILED, message: leaseCheck.reason },
        );
        return {
          denied: fail(
            OnboardingErrorCode.AUTHORIZATION_FAILED,
            `Lease validation failed: ${leaseCheck.reason}`,
          ),
          decision: { allowed: false, reason: leaseCheck.reason },
        };
      }
    }

    const decision = await revalidateAuthorization(s, bound);
    const evidence = authorizationEvidence(decision, {
      tenantId: bound.tenantId,
      productId: bound.productId,
      provisioningRequestId: bound.provisioningRequestId,
    });
    await recordEvidence(
      { journeyId: bound.journeyId, tenantId: bound.tenantId },
      input,
      `${operation}:authorization_check`,
      decision.allowed ? 'SUCCEEDED' : 'FAILED',
      evidence,
      startedAt,
      decision.allowed
        ? undefined
        : {
            code: OnboardingErrorCode.AUTHORIZATION_FAILED,
            message: decision.reason,
          },
    );
    if (!decision.allowed) {
      return {
        denied: fail(
          OnboardingErrorCode.AUTHORIZATION_FAILED,
          `P7.1 authorization denied: ${decision.reason}`,
        ),
        decision,
      };
    }
    return { denied: null, decision };
  };

  const loadJourney = async (
    s: Record<string, unknown>,
  ): Promise<OnboardingJourneyRecord | null> => {
    const id = str(s.journeyId) ?? str(s.onboardingJourneyId) ?? str(s.recordId);
    if (!id) return null;
    return deps.repo.getJourney(id);
  };

  const passCoordOrVerify = async (
    step: OnboardingStepRecord,
    journey: OnboardingJourneyRecord,
    input: WorkflowHandlerInput,
    actorId: string,
    startedAt: number,
    signal: string,
  ) => {
    const updated = await deps.repo.updateStep(step.id, {
      stepStatus: OnboardingStepStatus.PASSED,
      message: signal,
      evidenceRef: `signal://${step.stepKey}/${journey.id}`,
      finishedAt: new Date(),
      startedAt: step.startedAt ?? new Date(),
      details: {
        ...step.details,
        coordination: 'SIGNAL',
        note: 'Local coordination/verify signal; never CRM / never Subscription.ACTIVE',
        foreignPortsInvoked: false,
      },
    });
    const fresh = await deps.repo.getJourney(journey.id);
    if (fresh) {
      await deps.repo.updateJourney(
        fresh.id,
        {
          currentStepKey: step.stepKey,
          journeyStatus: OnboardingJourneyStatus.IN_PROGRESS,
        },
        fresh.version,
        actorId,
      );
    }
    await recordEvidence(
      { journeyId: journey.id, tenantId: journey.tenantId },
      input,
      `onboarding.advance:${step.stepKind}`,
      'SUCCEEDED',
      {
        stepKey: step.stepKey,
        stepKind: step.stepKind,
        coordination: 'SIGNAL',
        foreignPortsInvoked: false,
      },
      startedAt,
    );
    return ok({
      stepKey: updated.stepKey,
      stepStatus: OnboardingStepStatus.PASSED,
      coordination: 'SIGNAL',
    });
  };

  return async (input, key: OnboardingHandlerKey): Promise<WorkflowHandlerOutcome> => {
    const s = snap(input);
    const startedAt = Date.now();
    const actorId = str(s.actorId) ?? input.workerId ?? 'workflow-worker';

    try {
      switch (key) {
        case 'onboarding.revalidate_auth': {
          const journey = await loadJourney(s);
          if (!journey) {
            return fail(OnboardingErrorCode.VALIDATION, 'journeyId required');
          }
          const { denied, decision } = await gateMutation(
            input,
            {
              tenantId: journey.tenantId,
              productId: journey.productId,
              authorizationRowId: journey.authorizationRowId,
              authorizationVersion: journey.authorizationVersion,
              provisioningRequestId: journey.provisioningRequestId,
              journeyId: journey.id,
            },
            key,
          );
          if (denied) {
            await deps.repo.updateJourney(
              journey.id,
              {
                failureCode: OnboardingErrorCode.AUTHORIZATION_FAILED,
                failureMessage: decision.allowed ? 'denied' : decision.reason,
              },
              journey.version,
              actorId,
            );
            return denied;
          }
          return ok({ journeyId: journey.id, auth: 'REVALIDATED' });
        }

        case 'onboarding.require_activation_active': {
          const journey = await loadJourney(s);
          if (!journey) {
            return fail(OnboardingErrorCode.VALIDATION, 'journeyId required');
          }
          const { denied } = await gateMutation(
            input,
            {
              tenantId: journey.tenantId,
              productId: journey.productId,
              authorizationRowId: journey.authorizationRowId,
              authorizationVersion: journey.authorizationVersion,
              provisioningRequestId: journey.provisioningRequestId,
              journeyId: journey.id,
            },
            key,
          );
          if (denied) return denied;

          const activationId = str(s.activationRecordId) ?? journey.activationRecordId;
          const activation = await deps.activationRepo.getActivationRecord(activationId);
          if (!activation || activation.activationStatus !== ActivationRecordStatus.ACTIVE) {
            await recordEvidence(
              { journeyId: journey.id, tenantId: journey.tenantId },
              input,
              key,
              'FAILED',
              {
                activationRecordId: activationId,
                activationStatus: activation?.activationStatus ?? null,
              },
              startedAt,
              {
                code: OnboardingErrorCode.ACTIVATION_NOT_ACTIVE,
                message: 'Bound Activation Record must be ACTIVE',
              },
            );
            return fail(
              OnboardingErrorCode.ACTIVATION_NOT_ACTIVE,
              'P7.10 Activation Record is not ACTIVE (fail-closed)',
            );
          }
          await recordEvidence(
            { journeyId: journey.id, tenantId: journey.tenantId },
            input,
            key,
            'SUCCEEDED',
            { activationRecordId: activation.id, activationStatus: activation.activationStatus },
            startedAt,
          );
          return ok({ activationRecordId: activation.id, activationStatus: 'ACTIVE' });
        }

        case 'onboarding.materialize_steps': {
          const journey = await loadJourney(s);
          if (!journey) {
            return fail(OnboardingErrorCode.VALIDATION, 'journeyId required');
          }
          const { denied } = await gateMutation(
            input,
            {
              tenantId: journey.tenantId,
              productId: journey.productId,
              authorizationRowId: journey.authorizationRowId,
              authorizationVersion: journey.authorizationVersion,
              provisioningRequestId: journey.provisioningRequestId,
              journeyId: journey.id,
            },
            key,
          );
          if (denied) return denied;

          const existing = await deps.repo.listSteps(journey.id);
          if (existing.length > 0) {
            return ok({ materialized: existing.length, idempotent: true });
          }

          let plan: Array<{ key: string; kind: string; required?: boolean }> = [];
          if (journey.templateId) {
            const template = await deps.repo.getTemplate(journey.templateId);
            if (
              template &&
              Array.isArray(template.stepPlan) &&
              template.stepPlan.length > 0
            ) {
              plan = template.stepPlan.map((raw) => {
                const r = raw as Record<string, unknown>;
                return {
                  key: String(r.key ?? r.stepKey ?? 'step'),
                  kind: String(r.kind ?? r.stepKind ?? OnboardingStepKind.SYSTEM),
                  required: r.required !== false,
                };
              });
            }
          }
          if (plan.length === 0) {
            plan = DEFAULT_ONBOARDING_STEP_PLAN.map((p) => ({
              key: p.key,
              kind: p.kind,
              required: p.required,
            }));
          }

          const created = await deps.repo.createSteps(
            plan.map((p, idx) => ({
              journeyId: journey.id,
              tenantId: journey.tenantId,
              stepKey: p.key,
              stepOrder: idx + 1,
              stepKind: p.kind,
              stepStatus:
                idx === 0 ? OnboardingStepStatus.READY : OnboardingStepStatus.PENDING,
              required: p.required !== false,
              dependsOn: idx === 0 ? [] : [plan[idx - 1]!.key],
              message: null,
              evidenceRef: null,
              details: {},
              startedAt: null,
              finishedAt: null,
            })),
          );
          await recordEvidence(
            { journeyId: journey.id, tenantId: journey.tenantId },
            input,
            key,
            'SUCCEEDED',
            { stepCount: created.length, source: journey.templateId ? 'template' : 'default' },
            startedAt,
          );
          return ok({ materialized: created.length });
        }

        case 'onboarding.mark_started': {
          const journey = await loadJourney(s);
          if (!journey) {
            return fail(OnboardingErrorCode.VALIDATION, 'journeyId required');
          }
          const { denied } = await gateMutation(
            input,
            {
              tenantId: journey.tenantId,
              productId: journey.productId,
              authorizationRowId: journey.authorizationRowId,
              authorizationVersion: journey.authorizationVersion,
              provisioningRequestId: journey.provisioningRequestId,
              journeyId: journey.id,
            },
            key,
          );
          if (denied) return denied;

          const fresh = await deps.repo.getJourney(journey.id);
          if (!fresh) return fail(OnboardingErrorCode.VALIDATION, 'Journey missing');

          if (String(fresh.journeyStatus) !== OnboardingJourneyStatus.IN_PROGRESS) {
            const softOk =
              String(fresh.journeyStatus) === OnboardingJourneyStatus.STARTING ||
              String(fresh.journeyStatus) === OnboardingJourneyStatus.PENDING;
            if (!softOk) {
              const transition = assertJourneyTransition(
                fresh.journeyStatus,
                OnboardingJourneyStatus.IN_PROGRESS,
              );
              if (!transition.allowed) {
                // Allow idempotent re-entry
                if (String(fresh.journeyStatus) !== OnboardingJourneyStatus.IN_PROGRESS) {
                  return fail(transition.code, transition.reason);
                }
              }
            }
          }

          const updated = await deps.repo.updateJourney(
            fresh.id,
            {
              journeyStatus: OnboardingJourneyStatus.IN_PROGRESS,
              startedAt: fresh.startedAt ?? new Date(),
              failureCode: null,
              failureMessage: null,
            },
            fresh.version,
            actorId,
          );
          await deps.repo.appendHistory({
            resourceType: 'ONBOARDING_JOURNEY',
            resourceId: updated.id,
            tenantId: updated.tenantId,
            fromStatus: String(fresh.journeyStatus),
            toStatus: OnboardingJourneyStatus.IN_PROGRESS,
            action: 'MARK_STARTED',
            actorId,
            details: { workflowId: input.workflowId ?? null },
          });
          await recordEvidence(
            { journeyId: updated.id, tenantId: updated.tenantId },
            input,
            key,
            'SUCCEEDED',
            { journeyStatus: OnboardingJourneyStatus.IN_PROGRESS },
            startedAt,
          );
          return ok({ journeyStatus: OnboardingJourneyStatus.IN_PROGRESS });
        }

        case 'onboarding.advance_step': {
          const journey = await loadJourney(s);
          if (!journey) {
            return fail(OnboardingErrorCode.VALIDATION, 'journeyId required');
          }
          const { denied } = await gateMutation(
            input,
            {
              tenantId: journey.tenantId,
              productId: journey.productId,
              authorizationRowId: journey.authorizationRowId,
              authorizationVersion: journey.authorizationVersion,
              provisioningRequestId: journey.provisioningRequestId,
              journeyId: journey.id,
            },
            key,
          );
          if (denied) return denied;

          const steps = await deps.repo.listSteps(journey.id);
          const next = pickNextAdvanceableStep(steps);
          if (!next) {
            await recordEvidence(
              { journeyId: journey.id, tenantId: journey.tenantId },
              input,
              key,
              'SUCCEEDED',
              { note: 'No advanceable required steps remaining' },
              startedAt,
            );
            return ok({ advanced: false, reason: 'NO_PENDING_REQUIRED' });
          }

          const kind = String(next.stepKind);
          await deps.repo.updateStep(next.id, {
            stepStatus: OnboardingStepStatus.RUNNING,
            startedAt: next.startedAt ?? new Date(),
          });

          if (kind === OnboardingStepKind.HUMAN) {
            // Delegate to open_human_task semantics inline
            const task = await deps.repo.createTask({
              journeyId: journey.id,
              stepId: next.id,
              tenantId: journey.tenantId,
              taskCode: `onboarding.${next.stepKey}`,
              taskStatus: OnboardingTaskStatus.OPEN,
              title: `Approve onboarding step: ${next.stepKey}`,
              description: 'Human operational checklist — does not bypass P7.1 auth',
              assigneeRef: null,
              decisionReason: null,
              decidedBy: null,
              decidedAt: null,
              metadata: { stepKey: next.stepKey },
            });
            await deps.repo.updateStep(next.id, {
              stepStatus: OnboardingStepStatus.WAITING_APPROVAL,
            });
            const fresh = await deps.repo.getJourney(journey.id);
            if (fresh) {
              await deps.repo.updateJourney(
                fresh.id,
                {
                  journeyStatus: OnboardingJourneyStatus.WAITING_APPROVAL,
                  currentStepKey: next.stepKey,
                },
                fresh.version,
                actorId,
              );
            }
            await recordEvidence(
              { journeyId: journey.id, tenantId: journey.tenantId },
              input,
              key,
              'WAITING_APPROVAL',
              { stepKey: next.stepKey, taskId: task.id, human: true },
              startedAt,
            );
            return waitingApproval(
              `Human step ${next.stepKey} requires approval (task ${task.id}); P7.1 still required on decide`,
            );
          }

          if (
            kind === OnboardingStepKind.COORDINATION ||
            kind === OnboardingStepKind.VERIFY ||
            kind === OnboardingStepKind.SYSTEM
          ) {
            return passCoordOrVerify(
              next,
              journey,
              input,
              actorId,
              startedAt,
              `${kind}_SIGNAL`,
            );
          }

          if (kind === OnboardingStepKind.HANDOVER) {
            const ref = str(s.handoverEvidenceRef) ?? vaultHandoverRef(journey.id);
            await deps.repo.updateStep(next.id, {
              stepStatus: OnboardingStepStatus.PASSED,
              evidenceRef: ref,
              finishedAt: new Date(),
              message: 'HANDOVER_PACKAGE',
            });
            const fresh = await deps.repo.getJourney(journey.id);
            if (fresh) {
              await deps.repo.updateJourney(
                fresh.id,
                {
                  handoverEvidenceRef: ref,
                  currentStepKey: next.stepKey,
                  journeyStatus: OnboardingJourneyStatus.IN_PROGRESS,
                },
                fresh.version,
                actorId,
              );
            }
            await recordEvidence(
              { journeyId: journey.id, tenantId: journey.tenantId },
              input,
              key,
              'SUCCEEDED',
              { stepKey: next.stepKey, handoverEvidenceRef: ref, vaultStyle: true },
              startedAt,
            );
            return ok({
              stepKey: next.stepKey,
              stepStatus: OnboardingStepStatus.PASSED,
              handoverEvidenceRef: ref,
            });
          }

          return fail(OnboardingErrorCode.VALIDATION, `Unknown step kind: ${kind}`);
        }

        case 'onboarding.open_human_task': {
          const journey = await loadJourney(s);
          if (!journey) {
            return fail(OnboardingErrorCode.VALIDATION, 'journeyId required');
          }
          const { denied } = await gateMutation(
            input,
            {
              tenantId: journey.tenantId,
              productId: journey.productId,
              authorizationRowId: journey.authorizationRowId,
              authorizationVersion: journey.authorizationVersion,
              provisioningRequestId: journey.provisioningRequestId,
              journeyId: journey.id,
            },
            key,
          );
          if (denied) return denied;

          const stepKey = str(s.stepKey) ?? journey.currentStepKey;
          const steps = await deps.repo.listSteps(journey.id);
          const step = steps.find((x) => x.stepKey === stepKey);
          if (!step) {
            return fail(OnboardingErrorCode.STEP_NOT_READY, 'Human step not found');
          }

          const existingOpen = (await deps.repo.listTasks({ journeyId: journey.id, status: 'OPEN' }))
            .find((t) => t.stepId === step.id);
          if (existingOpen) {
            return waitingApproval(`Human task already open: ${existingOpen.id}`);
          }

          const task = await deps.repo.createTask({
            journeyId: journey.id,
            stepId: step.id,
            tenantId: journey.tenantId,
            taskCode: `onboarding.${step.stepKey}`,
            taskStatus: OnboardingTaskStatus.OPEN,
            title: `Approve onboarding step: ${step.stepKey}`,
            description: 'Human operational checklist — does not bypass P7.1 auth',
            assigneeRef: null,
            decisionReason: null,
            decidedBy: null,
            decidedAt: null,
            metadata: { stepKey: step.stepKey },
          });
          await deps.repo.updateStep(step.id, {
            stepStatus: OnboardingStepStatus.WAITING_APPROVAL,
          });
          const fresh = await deps.repo.getJourney(journey.id);
          if (fresh) {
            await deps.repo.updateJourney(
              fresh.id,
              {
                journeyStatus: OnboardingJourneyStatus.WAITING_APPROVAL,
                currentStepKey: step.stepKey,
              },
              fresh.version,
              actorId,
            );
          }
          return waitingApproval(`Human task opened: ${task.id}`);
        }

        case 'onboarding.apply_task_decision': {
          const journey = await loadJourney(s);
          if (!journey) {
            return fail(OnboardingErrorCode.VALIDATION, 'journeyId required');
          }
          // CRITICAL: human approval cannot bypass auth — gateMutation revalidates P7.1
          const { denied } = await gateMutation(
            input,
            {
              tenantId: journey.tenantId,
              productId: journey.productId,
              authorizationRowId: journey.authorizationRowId,
              authorizationVersion: journey.authorizationVersion,
              provisioningRequestId: journey.provisioningRequestId,
              journeyId: journey.id,
            },
            key,
          );
          if (denied) {
            return fail(
              OnboardingErrorCode.HUMAN_APPROVAL_CANNOT_BYPASS_AUTH,
              'Human approval/reject denied — P7.1 authorization revalidation failed',
            );
          }

          const taskId = str(s.taskId);
          if (!taskId) {
            return fail(OnboardingErrorCode.VALIDATION, 'taskId required');
          }
          const task = await deps.repo.getTask(taskId);
          if (!task || task.journeyId !== journey.id) {
            return fail(OnboardingErrorCode.VALIDATION, 'Task not found for journey');
          }
          if (task.taskStatus !== OnboardingTaskStatus.OPEN) {
            return fail(OnboardingErrorCode.CONFLICT, `Task not OPEN (${task.taskStatus})`);
          }

          const decision = String(s.decision ?? s.operation ?? '').toUpperCase();
          const approve = decision === 'APPROVE' || decision === 'APPROVED';
          const reject = decision === 'REJECT' || decision === 'REJECTED';
          if (!approve && !reject) {
            return fail(OnboardingErrorCode.VALIDATION, 'decision must be APPROVE or REJECT');
          }

          await deps.repo.updateTask(task.id, {
            taskStatus: approve
              ? OnboardingTaskStatus.APPROVED
              : OnboardingTaskStatus.REJECTED,
            decisionReason: str(s.reason) ?? str(s.decisionReason) ?? null,
            decidedBy: actorId,
            decidedAt: new Date(),
          });

          if (task.stepId) {
            await deps.repo.updateStep(task.stepId, {
              stepStatus: approve
                ? OnboardingStepStatus.PASSED
                : OnboardingStepStatus.FAILED,
              finishedAt: new Date(),
              message: approve ? 'HUMAN_APPROVED' : 'HUMAN_REJECTED',
            });
          }

          const fresh = await deps.repo.getJourney(journey.id);
          if (fresh) {
            await deps.repo.updateJourney(
              fresh.id,
              {
                journeyStatus: approve
                  ? OnboardingJourneyStatus.IN_PROGRESS
                  : OnboardingJourneyStatus.FAILED,
                failureCode: approve ? null : OnboardingErrorCode.APPROVAL_REQUIRED,
                failureMessage: approve ? null : 'Human task rejected',
              },
              fresh.version,
              actorId,
            );
          }

          await recordEvidence(
            { journeyId: journey.id, tenantId: journey.tenantId },
            input,
            key,
            approve ? 'SUCCEEDED' : 'FAILED',
            {
              taskId: task.id,
              decision: approve ? 'APPROVE' : 'REJECT',
              authRevalidated: true,
              humanCannotBypassAuth: true,
            },
            startedAt,
            approve
              ? undefined
              : {
                  code: OnboardingErrorCode.APPROVAL_REQUIRED,
                  message: 'Human task rejected',
                },
          );
          return ok({
            taskId: task.id,
            decision: approve ? 'APPROVE' : 'REJECT',
            authRevalidated: true,
          });
        }

        case 'onboarding.coord_verify': {
          const journey = await loadJourney(s);
          if (!journey) {
            return fail(OnboardingErrorCode.VALIDATION, 'journeyId required');
          }
          const { denied } = await gateMutation(
            input,
            {
              tenantId: journey.tenantId,
              productId: journey.productId,
              authorizationRowId: journey.authorizationRowId,
              authorizationVersion: journey.authorizationVersion,
              provisioningRequestId: journey.provisioningRequestId,
              journeyId: journey.id,
            },
            key,
          );
          if (denied) return denied;

          const steps = await deps.repo.listSteps(journey.id);
          const next = pickNextAdvanceableStep(steps);
          if (
            !next ||
            (String(next.stepKind) !== OnboardingStepKind.COORDINATION &&
              String(next.stepKind) !== OnboardingStepKind.VERIFY)
          ) {
            return ok({ skipped: true, reason: 'NO_COORD_VERIFY_STEP' });
          }
          return passCoordOrVerify(next, journey, input, actorId, startedAt, 'COORD_VERIFY_SIGNAL');
        }

        case 'onboarding.handover': {
          const journey = await loadJourney(s);
          if (!journey) {
            return fail(OnboardingErrorCode.VALIDATION, 'journeyId required');
          }
          const { denied } = await gateMutation(
            input,
            {
              tenantId: journey.tenantId,
              productId: journey.productId,
              authorizationRowId: journey.authorizationRowId,
              authorizationVersion: journey.authorizationVersion,
              provisioningRequestId: journey.provisioningRequestId,
              journeyId: journey.id,
            },
            key,
          );
          if (denied) return denied;

          const steps = await deps.repo.listSteps(journey.id);
          const handover = steps.find(
            (x) =>
              String(x.stepKind) === OnboardingStepKind.HANDOVER &&
              (x.stepStatus === OnboardingStepStatus.READY ||
                x.stepStatus === OnboardingStepStatus.PENDING ||
                x.stepStatus === OnboardingStepStatus.RUNNING),
          );
          if (!handover) {
            if (journey.handoverEvidenceRef) {
              return ok({
                handoverEvidenceRef: journey.handoverEvidenceRef,
                idempotent: true,
              });
            }
            return fail(OnboardingErrorCode.STEP_NOT_READY, 'Handover step not ready');
          }

          const ref = str(s.handoverEvidenceRef) ?? vaultHandoverRef(journey.id);
          await deps.repo.updateStep(handover.id, {
            stepStatus: OnboardingStepStatus.PASSED,
            evidenceRef: ref,
            finishedAt: new Date(),
          });
          const fresh = await deps.repo.getJourney(journey.id);
          if (fresh) {
            await deps.repo.updateJourney(
              fresh.id,
              { handoverEvidenceRef: ref, currentStepKey: handover.stepKey },
              fresh.version,
              actorId,
            );
          }
          await recordEvidence(
            { journeyId: journey.id, tenantId: journey.tenantId },
            input,
            key,
            'SUCCEEDED',
            { handoverEvidenceRef: ref, vaultStyle: true },
            startedAt,
          );
          return ok({ handoverEvidenceRef: ref });
        }

        case 'onboarding.mark_closed': {
          const journey = await loadJourney(s);
          if (!journey) {
            return fail(OnboardingErrorCode.VALIDATION, 'journeyId required');
          }
          const { denied } = await gateMutation(
            input,
            {
              tenantId: journey.tenantId,
              productId: journey.productId,
              authorizationRowId: journey.authorizationRowId,
              authorizationVersion: journey.authorizationVersion,
              provisioningRequestId: journey.provisioningRequestId,
              journeyId: journey.id,
            },
            key,
          );
          if (denied) return denied;

          const steps = await deps.repo.listSteps(journey.id);
          const guard = canRequestClose({
            journeyStatus: journey.journeyStatus,
            steps,
          });
          if (!guard.allowed) {
            return fail(guard.code, guard.reason);
          }

          const fresh = await deps.repo.getJourney(journey.id);
          if (!fresh) return fail(OnboardingErrorCode.VALIDATION, 'Journey missing');

          // Soft-allow CLOSING intermediate
          if (String(fresh.journeyStatus) !== OnboardingJourneyStatus.CLOSED) {
            if (String(fresh.journeyStatus) !== OnboardingJourneyStatus.CLOSING) {
              const toClosing = assertJourneyTransition(
                fresh.journeyStatus,
                OnboardingJourneyStatus.CLOSING,
              );
              if (!toClosing.allowed) {
                return fail(toClosing.code, toClosing.reason);
              }
            }
          }

          let current = fresh;
          if (String(current.journeyStatus) !== OnboardingJourneyStatus.CLOSING) {
            current = await deps.repo.updateJourney(
              current.id,
              { journeyStatus: OnboardingJourneyStatus.CLOSING },
              current.version,
              actorId,
            );
          }

          const updated = await deps.repo.updateJourney(
            current.id,
            {
              journeyStatus: OnboardingJourneyStatus.CLOSED,
              closedAt: new Date(),
              failureCode: null,
              failureMessage: null,
            },
            current.version,
            actorId,
          );
          await deps.repo.appendHistory({
            resourceType: 'ONBOARDING_JOURNEY',
            resourceId: updated.id,
            tenantId: updated.tenantId,
            fromStatus: String(fresh.journeyStatus),
            toStatus: OnboardingJourneyStatus.CLOSED,
            action: 'MARK_CLOSED',
            actorId,
            details: {
              workflowId: input.workflowId ?? null,
              note: 'Never CRM; never business invites; never Subscription.ACTIVE',
            },
          });
          await recordEvidence(
            { journeyId: updated.id, tenantId: updated.tenantId },
            input,
            key,
            'SUCCEEDED',
            { journeyStatus: OnboardingJourneyStatus.CLOSED },
            startedAt,
          );
          return ok({ journeyStatus: OnboardingJourneyStatus.CLOSED });
        }

        case 'onboarding.verify': {
          const journey = await loadJourney(s);
          if (!journey) {
            return fail(OnboardingErrorCode.VALIDATION, 'journeyId required');
          }
          const { denied } = await gateMutation(
            input,
            {
              tenantId: journey.tenantId,
              productId: journey.productId,
              authorizationRowId: journey.authorizationRowId,
              authorizationVersion: journey.authorizationVersion,
              provisioningRequestId: journey.provisioningRequestId,
              journeyId: journey.id,
            },
            key,
          );
          if (denied) return denied;

          const fresh = await deps.repo.getJourney(journey.id);
          if (!fresh) return fail(OnboardingErrorCode.VALIDATION, 'Journey missing');

          const operation = String(s.operation ?? '').toUpperCase();
          const expected =
            operation === 'START' || operation === 'ADVANCE'
              ? OnboardingJourneyStatus.IN_PROGRESS
              : operation === 'CLOSE'
                ? OnboardingJourneyStatus.CLOSED
                : operation === 'APPROVE'
                  ? OnboardingJourneyStatus.IN_PROGRESS
                  : null;

          // WAITING_APPROVAL is valid after advance into HUMAN step
          const waitingOk =
            operation === 'ADVANCE' &&
            String(fresh.journeyStatus) === OnboardingJourneyStatus.WAITING_APPROVAL;

          if (
            expected &&
            String(fresh.journeyStatus) !== expected &&
            !waitingOk
          ) {
            // Soft-allow STARTING after start launch race
            if (
              !(
                operation === 'START' &&
                String(fresh.journeyStatus) === OnboardingJourneyStatus.STARTING
              )
            ) {
              return fail(
                OnboardingErrorCode.JOURNEY_FORBIDDEN,
                `Verify expected ${expected}, got ${fresh.journeyStatus}`,
              );
            }
          }

          await recordEvidence(
            { journeyId: fresh.id, tenantId: fresh.tenantId },
            input,
            key,
            'SUCCEEDED',
            {
              journeyStatus: fresh.journeyStatus,
              operation: operation || null,
              templateStatus: OnboardingTemplateStatus.PUBLISHED,
            },
            startedAt,
          );
          return ok({
            verified: true,
            journeyStatus: fresh.journeyStatus,
          });
        }

        default:
          return fail(OnboardingErrorCode.VALIDATION, `Unknown handler key: ${String(key)}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(OnboardingErrorCode.PROVIDER_UNAVAILABLE, message, true);
    }
  };
}

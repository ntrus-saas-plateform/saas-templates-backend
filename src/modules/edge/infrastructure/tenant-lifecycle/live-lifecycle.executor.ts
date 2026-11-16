import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ActivationRepositoryPort } from '../../domain/readiness-activation/activation-repository.port.js';
import { ActivationRecordStatus } from '../../domain/readiness-activation/activation.types.js';
import type { LifecycleLiveExecutor } from '../../domain/tenant-lifecycle/lifecycle-handlers.js';
import { assertTransition } from '../../domain/tenant-lifecycle/lifecycle-policy.js';
import type { LifecycleRepositoryPort } from '../../domain/tenant-lifecycle/lifecycle-repository.port.js';
import {
  LifecycleErrorCode,
  LifecycleStatus,
  type LifecycleHandlerKey,
  type TenantLifecycleRecord,
} from '../../domain/tenant-lifecycle/lifecycle.types.js';
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
  code: LifecycleErrorCode | string,
  message: string,
  retryable = false,
): WorkflowHandlerOutcome {
  return {
    status: 'FAILED',
    errorClass: code,
    message,
    retryable,
    diagnostics: { handler: 'p7.11', message },
  };
}
function waitingApproval(
  instructions: string,
  requiredPermission = 'platform:lifecycle:deprovision',
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

/**
 * Bridges P7.4 workflow handlers → P7.11 tenant technical lifecycle.
 *
 * Coordination model (documented as coordination signals):
 *  - Required coordination writes evidence and PASSES when recording intent
 *    locally in metadata.coordination.* without calling foreign mutators that
 *    need separate workflows.
 *  - Do NOT invent success via foreign ports; ports are optional for signal-only.
 *  - Destructive mark_deprovisioned / destructive coords → WAITING_APPROVAL
 *    unless deprovisionAuthorized && deprovisionConfirmed.
 *
 * Security invariants:
 *  - P7.1 authorization REVALIDATED fail-closed before every mutation.
 *  - Lease validated when lease port present.
 *  - Activation Record must be ACTIVE (via ACTIVATION_REPOSITORY_PORT).
 *  - Never silent delete; never set commercial Subscription status alone.
 */
export function createLiveLifecycleExecutor(deps: {
  repo: LifecycleRepositoryPort;
  activationRepo: ActivationRepositoryPort;
  authorization: WorkflowAuthorizationPort;
  lease?: WorkflowLeasePort | null;
}): LifecycleLiveExecutor {
  const validateLease = async (
    input: WorkflowHandlerInput,
  ): Promise<LeaseValidationResult | null> => {
    // AUD-P1-04: lease is mandatory — missing port fails closed.
    if (!deps.lease) {
      return { valid: false, reason: 'DEPENDENCY_UNAVAILABLE', detail: 'lease port not wired' };
    }
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
    ctx: { lifecycleRecordId?: string | null; tenantId: string },
    input: WorkflowHandlerInput,
    operation: string,
    outcome: 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'PARTIAL' | 'WAITING_APPROVAL',
    evidence: Record<string, unknown>,
    startedAt: number,
    error?: { code: string; message: string },
  ) => {
    try {
      await deps.repo.createEvidence({
        lifecycleRecordId: ctx.lifecycleRecordId ?? null,
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
        'Lifecycle operation evidence could not be persisted',
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
      lifecycleRecordId?: string | null;
    },
    operation: string,
  ): Promise<{ denied: WorkflowHandlerOutcome | null; decision: AuthorizationDecision }> => {
    const startedAt = Date.now();
    const s = snap(input);

    {
      const leaseCheck = await validateLease(input);
      if (leaseCheck && !leaseCheck.valid) {
        await recordEvidence(
          { lifecycleRecordId: bound.lifecycleRecordId, tenantId: bound.tenantId },
          input,
          `${operation}:lease_check`,
          'FAILED',
          { leaseReason: leaseCheck.reason, detail: leaseCheck.detail ?? null },
          startedAt,
          { code: LifecycleErrorCode.AUTHORIZATION_FAILED, message: leaseCheck.reason },
        );
        return {
          denied: fail(
            LifecycleErrorCode.AUTHORIZATION_FAILED,
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
      { lifecycleRecordId: bound.lifecycleRecordId, tenantId: bound.tenantId },
      input,
      `${operation}:authorization_check`,
      decision.allowed ? 'SUCCEEDED' : 'FAILED',
      evidence,
      startedAt,
      decision.allowed
        ? undefined
        : {
            code: LifecycleErrorCode.AUTHORIZATION_FAILED,
            message: decision.reason,
          },
    );
    if (!decision.allowed) {
      return {
        denied: fail(
          LifecycleErrorCode.AUTHORIZATION_FAILED,
          `P7.1 authorization denied: ${decision.reason}`,
        ),
        decision,
      };
    }
    return { denied: null, decision };
  };

  const loadRecord = async (
    s: Record<string, unknown>,
  ): Promise<TenantLifecycleRecord | null> => {
    const id = str(s.lifecycleRecordId) ?? str(s.recordId);
    if (!id) return null;
    return deps.repo.getRecord(id);
  };

  const mergeCoordination = async (
    record: TenantLifecycleRecord,
    key: string,
    value: string,
    actorId: string,
  ): Promise<TenantLifecycleRecord> => {
    const prev = (record.metadata?.coordination as Record<string, unknown> | undefined) ?? {};
    const metadata = {
      ...record.metadata,
      coordination: { ...prev, [key]: value, updatedAt: new Date().toISOString() },
    };
    return deps.repo.updateRecord(record.id, { metadata }, record.version, actorId);
  };

  const hasDeprovisionFlags = (s: Record<string, unknown>): boolean =>
    (s.deprovisionAuthorized === true || s.authorized === true) &&
    (s.deprovisionConfirmed === true || s.confirmed === true);

  return async (input, key: LifecycleHandlerKey): Promise<WorkflowHandlerOutcome> => {
    const s = snap(input);
    const startedAt = Date.now();
    const actorId = str(s.actorId) ?? input.workerId ?? 'workflow-worker';

    try {
      switch (key) {
        case 'lifecycle.revalidate_auth': {
          const record = await loadRecord(s);
          if (!record) {
            return fail(LifecycleErrorCode.VALIDATION, 'lifecycleRecordId required');
          }
          const { denied, decision } = await gateMutation(
            input,
            {
              tenantId: record.tenantId,
              productId: record.productId,
              authorizationRowId: record.authorizationRowId,
              authorizationVersion: record.authorizationVersion,
              provisioningRequestId: record.provisioningRequestId,
              lifecycleRecordId: record.id,
            },
            key,
          );
          if (denied) {
            await deps.repo.updateRecord(
              record.id,
              {
                failureCode: LifecycleErrorCode.AUTHORIZATION_FAILED,
                failureMessage: decision.allowed ? 'denied' : decision.reason,
              },
              record.version,
              actorId,
            );
            return denied;
          }
          return ok({ lifecycleRecordId: record.id, auth: 'REVALIDATED' });
        }

        case 'lifecycle.require_activation_active': {
          const record = await loadRecord(s);
          if (!record) {
            return fail(LifecycleErrorCode.VALIDATION, 'lifecycleRecordId required');
          }
          const { denied } = await gateMutation(
            input,
            {
              tenantId: record.tenantId,
              productId: record.productId,
              authorizationRowId: record.authorizationRowId,
              authorizationVersion: record.authorizationVersion,
              provisioningRequestId: record.provisioningRequestId,
              lifecycleRecordId: record.id,
            },
            key,
          );
          if (denied) return denied;

          const activationId = str(s.activationRecordId) ?? record.activationRecordId;
          const activation = await deps.activationRepo.getActivationRecord(activationId);
          if (!activation || activation.activationStatus !== ActivationRecordStatus.ACTIVE) {
            await recordEvidence(
              { lifecycleRecordId: record.id, tenantId: record.tenantId },
              input,
              key,
              'FAILED',
              {
                activationRecordId: activationId,
                activationStatus: activation?.activationStatus ?? null,
              },
              startedAt,
              {
                code: LifecycleErrorCode.ACTIVATION_NOT_ACTIVE,
                message: 'Bound Activation Record must be ACTIVE',
              },
            );
            return fail(
              LifecycleErrorCode.ACTIVATION_NOT_ACTIVE,
              'P7.10 Activation Record is not ACTIVE (fail-closed)',
            );
          }
          await recordEvidence(
            { lifecycleRecordId: record.id, tenantId: record.tenantId },
            input,
            key,
            'SUCCEEDED',
            { activationRecordId: activation.id, activationStatus: activation.activationStatus },
            startedAt,
          );
          return ok({ activationRecordId: activation.id, activationStatus: 'ACTIVE' });
        }

        case 'lifecycle.require_suspended': {
          const record = await loadRecord(s);
          if (!record) {
            return fail(LifecycleErrorCode.VALIDATION, 'lifecycleRecordId required');
          }
          const { denied } = await gateMutation(
            input,
            {
              tenantId: record.tenantId,
              productId: record.productId,
              authorizationRowId: record.authorizationRowId,
              authorizationVersion: record.authorizationVersion,
              provisioningRequestId: record.provisioningRequestId,
              lifecycleRecordId: record.id,
            },
            key,
          );
          if (denied) return denied;

          const status = String(record.lifecycleStatus);
          if (
            status !== LifecycleStatus.SUSPENDED &&
            status !== LifecycleStatus.RESUMING
          ) {
            return fail(
              LifecycleErrorCode.LIFECYCLE_FORBIDDEN,
              `Lifecycle must be SUSPENDED/RESUMING; current=${status}`,
            );
          }
          return ok({ lifecycleStatus: status });
        }

        case 'lifecycle.require_flags': {
          const record = await loadRecord(s);
          if (!record) {
            return fail(LifecycleErrorCode.VALIDATION, 'lifecycleRecordId required');
          }
          const { denied } = await gateMutation(
            input,
            {
              tenantId: record.tenantId,
              productId: record.productId,
              authorizationRowId: record.authorizationRowId,
              authorizationVersion: record.authorizationVersion,
              provisioningRequestId: record.provisioningRequestId,
              lifecycleRecordId: record.id,
            },
            key,
          );
          if (denied) return denied;

          if (!hasDeprovisionFlags(s)) {
            return waitingApproval(
              'Deprovision requires authorized===true && confirmed===true (fail-closed)',
            );
          }
          if (record.deletionProtection && !hasDeprovisionFlags(s)) {
            return fail(
              LifecycleErrorCode.DELETION_PROTECTED,
              'deletion_protection active without flags',
            );
          }
          if (!str(s.reason)) {
            return fail(LifecycleErrorCode.VALIDATION, 'Deprovision reason required');
          }
          await recordEvidence(
            { lifecycleRecordId: record.id, tenantId: record.tenantId },
            input,
            key,
            'SUCCEEDED',
            { authorized: true, confirmed: true, deletionProtection: record.deletionProtection },
            startedAt,
          );
          return ok({ flags: 'PRESENT' });
        }

        case 'lifecycle.require_export_evidence': {
          const record = await loadRecord(s);
          if (!record) {
            return fail(LifecycleErrorCode.VALIDATION, 'lifecycleRecordId required');
          }
          const { denied } = await gateMutation(
            input,
            {
              tenantId: record.tenantId,
              productId: record.productId,
              authorizationRowId: record.authorizationRowId,
              authorizationVersion: record.authorizationVersion,
              provisioningRequestId: record.provisioningRequestId,
              lifecycleRecordId: record.id,
            },
            key,
          );
          if (denied) return denied;

          const exportRef = str(s.exportEvidenceRef) ?? record.exportEvidenceRef;
          if (!exportRef) {
            return fail(
              LifecycleErrorCode.EXPORT_EVIDENCE_REQUIRED,
              'exportEvidenceRef required before technical deprovision',
            );
          }
          return ok({ exportEvidenceRef: exportRef });
        }

        case 'lifecycle.mark_suspending':
        case 'lifecycle.mark_suspended':
        case 'lifecycle.mark_resuming':
        case 'lifecycle.mark_active':
        case 'lifecycle.mark_deprovisioning':
        case 'lifecycle.mark_deprovisioned': {
          const record = await loadRecord(s);
          if (!record) {
            return fail(LifecycleErrorCode.VALIDATION, 'lifecycleRecordId required');
          }
          const { denied } = await gateMutation(
            input,
            {
              tenantId: record.tenantId,
              productId: record.productId,
              authorizationRowId: record.authorizationRowId,
              authorizationVersion: record.authorizationVersion,
              provisioningRequestId: record.provisioningRequestId,
              lifecycleRecordId: record.id,
            },
            key,
          );
          if (denied) return denied;

          const targetMap: Record<string, LifecycleStatus> = {
            'lifecycle.mark_suspending': LifecycleStatus.SUSPENDING,
            'lifecycle.mark_suspended': LifecycleStatus.SUSPENDED,
            'lifecycle.mark_resuming': LifecycleStatus.RESUMING,
            'lifecycle.mark_active': LifecycleStatus.ACTIVE,
            'lifecycle.mark_deprovisioning': LifecycleStatus.DEPROVISIONING,
            'lifecycle.mark_deprovisioned': LifecycleStatus.DEPROVISIONED,
          };
          const target = targetMap[key]!;

          if (key === 'lifecycle.mark_deprovisioned') {
            if (!hasDeprovisionFlags(s)) {
              await recordEvidence(
                { lifecycleRecordId: record.id, tenantId: record.tenantId },
                input,
                key,
                'WAITING_APPROVAL',
                { reason: 'FLAGS_MISSING' },
                startedAt,
              );
              return waitingApproval(
                'mark_deprovisioned is destructive — requires authorized+confirmed; suspended for approval',
              );
            }
          }

          const fresh = await deps.repo.getRecord(record.id);
          if (!fresh) return fail(LifecycleErrorCode.VALIDATION, 'Lifecycle record missing');

          // Allow idempotent re-entry when already at target (workflow relaunch).
          if (String(fresh.lifecycleStatus) !== target) {
            const transition = assertTransition(fresh.lifecycleStatus, target);
            // Soft-allow when use-case already flipped to intermediate (SUSPENDING/RESUMING/DEPROVISIONING)
            const softOk =
              (key === 'lifecycle.mark_suspending' &&
                String(fresh.lifecycleStatus) === LifecycleStatus.SUSPENDING) ||
              (key === 'lifecycle.mark_resuming' &&
                String(fresh.lifecycleStatus) === LifecycleStatus.RESUMING) ||
              (key === 'lifecycle.mark_deprovisioning' &&
                String(fresh.lifecycleStatus) === LifecycleStatus.DEPROVISIONING);
            if (!transition.allowed && !softOk) {
              return fail(transition.code, transition.reason);
            }
          }

          const patch: Partial<TenantLifecycleRecord> = {
            lifecycleStatus: target,
            failureCode: null,
            failureMessage: null,
          };
          if (target === LifecycleStatus.SUSPENDED) patch.lastSuspendedAt = new Date();
          if (target === LifecycleStatus.ACTIVE && key === 'lifecycle.mark_active') {
            patch.lastResumedAt = new Date();
          }
          if (target === LifecycleStatus.DEPROVISIONED) {
            patch.deprovisionedAt = new Date();
          }

          const updated = await deps.repo.updateRecord(
            fresh.id,
            patch,
            fresh.version,
            actorId,
          );
          await deps.repo.appendHistory({
            resourceType: 'LIFECYCLE_RECORD',
            resourceId: updated.id,
            tenantId: updated.tenantId,
            fromStatus: String(fresh.lifecycleStatus),
            toStatus: target,
            action: key.toUpperCase().replace(/\./g, '_'),
            actorId,
            details: { workflowId: input.workflowId ?? null },
          });
          await recordEvidence(
            { lifecycleRecordId: updated.id, tenantId: updated.tenantId },
            input,
            key,
            'SUCCEEDED',
            { lifecycleStatus: target },
            startedAt,
          );
          return ok({ lifecycleStatus: target });
        }

        case 'lifecycle.coord_experience_deactivate':
        case 'lifecycle.coord_experience_resume':
        case 'lifecycle.coord_infra_quiesce':
        case 'lifecycle.coord_infra_resume':
        case 'lifecycle.coord_product_control_suspend':
        case 'lifecycle.coord_product_control_resume': {
          const record = await loadRecord(s);
          if (!record) {
            return fail(LifecycleErrorCode.VALIDATION, 'lifecycleRecordId required');
          }
          const { denied } = await gateMutation(
            input,
            {
              tenantId: record.tenantId,
              productId: record.productId,
              authorizationRowId: record.authorizationRowId,
              authorizationVersion: record.authorizationVersion,
              provisioningRequestId: record.provisioningRequestId,
              lifecycleRecordId: record.id,
            },
            key,
          );
          if (denied) return denied;

          const destructive =
            key === 'lifecycle.coord_experience_deactivate' ||
            key === 'lifecycle.coord_infra_quiesce' ||
            key === 'lifecycle.coord_product_control_suspend';
          const isDeprovisionPath =
            String(s.operation) === 'DEPROVISION' || s.destructive === true;

          // Destructive coords on deprovision path require flags; otherwise WAITING_APPROVAL.
          if (destructive && isDeprovisionPath && !hasDeprovisionFlags(s)) {
            await recordEvidence(
              { lifecycleRecordId: record.id, tenantId: record.tenantId },
              input,
              key,
              'WAITING_APPROVAL',
              { coordination: 'BLOCKED_FLAGS', note: 'destructive coord awaiting approval' },
              startedAt,
            );
            return waitingApproval(
              `${key} is destructive on deprovision path — requires authorized+confirmed`,
            );
          }

          const coordKey =
            key.includes('experience')
              ? 'experience'
              : key.includes('infra')
                ? 'infra'
                : 'product_control';
          const coordValue = key.includes('resume')
            ? 'RESUME_REQUESTED'
            : key.includes('quiesce') || key.includes('deactivate') || key.includes('suspend')
              ? 'REQUESTED'
              : 'REQUESTED';

          /**
           * Coordination signal: record intent locally in metadata.coordination.*
           * and evidence. Does NOT call foreign mutators (experience/infra/product-control
           * workflows). PASSES when the coordination signal is durably recorded.
           * Foreign ports are intentionally unused here — separate workflows own mutation.
           */
          const updated = await mergeCoordination(record, coordKey, coordValue, actorId);
          await recordEvidence(
            { lifecycleRecordId: updated.id, tenantId: updated.tenantId },
            input,
            key,
            'SUCCEEDED',
            {
              coordination: 'SIGNAL',
              domain: coordKey,
              status: coordValue,
              note: 'Local coordination signal recorded; foreign mutators not invoked',
              foreignPortsInvoked: false,
            },
            startedAt,
          );
          return ok({
            coordination: 'SIGNAL',
            domain: coordKey,
            status: coordValue,
          });
        }

        case 'lifecycle.verify': {
          const record = await loadRecord(s);
          if (!record) {
            return fail(LifecycleErrorCode.VALIDATION, 'lifecycleRecordId required');
          }
          const { denied } = await gateMutation(
            input,
            {
              tenantId: record.tenantId,
              productId: record.productId,
              authorizationRowId: record.authorizationRowId,
              authorizationVersion: record.authorizationVersion,
              provisioningRequestId: record.provisioningRequestId,
              lifecycleRecordId: record.id,
            },
            key,
          );
          if (denied) return denied;

          const fresh = await deps.repo.getRecord(record.id);
          if (!fresh) return fail(LifecycleErrorCode.VALIDATION, 'Lifecycle record missing');

          const operation = String(s.operation ?? '').toUpperCase();
          const expected =
            operation === 'SUSPEND'
              ? LifecycleStatus.SUSPENDED
              : operation === 'RESUME'
                ? LifecycleStatus.ACTIVE
                : operation === 'DEPROVISION'
                  ? LifecycleStatus.DEPROVISIONED
                  : null;

          if (expected && String(fresh.lifecycleStatus) !== expected) {
            return fail(
              LifecycleErrorCode.LIFECYCLE_FORBIDDEN,
              `Verify expected ${expected}, got ${fresh.lifecycleStatus}`,
            );
          }

          await recordEvidence(
            { lifecycleRecordId: fresh.id, tenantId: fresh.tenantId },
            input,
            key,
            'SUCCEEDED',
            {
              lifecycleStatus: fresh.lifecycleStatus,
              operation: operation || null,
              coordination: fresh.metadata?.coordination ?? null,
            },
            startedAt,
          );
          return ok({
            verified: true,
            lifecycleStatus: fresh.lifecycleStatus,
          });
        }

        default:
          return fail(LifecycleErrorCode.VALIDATION, `Unknown handler key: ${String(key)}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(LifecycleErrorCode.PROVIDER_UNAVAILABLE, message, true);
    }
  };
}

import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ReconciliationLiveExecutor } from '../../domain/reconciliation/reconciliation-handlers.js';
import {
  applyActiveWaivers,
  canAutoRemediate,
  classifyObservations,
  isWaiverValid,
  type DesiredResource,
  type ObservedResource,
} from '../../domain/reconciliation/reconciliation-policy.js';
import type { ReconciliationRepositoryPort } from '../../domain/reconciliation/reconciliation-repository.port.js';
import {
  FindingStatus,
  ObservationClass,
  ReconciliationErrorCode,
  ReconciliationRunStatus,
  RemediationStatus,
  type ReconciliationHandlerKey,
  type ReconciliationPolicyRecord,
  type ReconciliationRunRecord,
} from '../../domain/reconciliation/reconciliation.types.js';
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
  code: ReconciliationErrorCode | string,
  message: string,
  retryable = false,
): WorkflowHandlerOutcome {
  return {
    status: 'FAILED',
    errorClass: code,
    message,
    retryable,
    diagnostics: { handler: 'p7.13', message },
  };
}
function waitingApproval(
  instructions: string,
  requiredPermission = 'platform:reconciliation:approve',
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
  context: { tenantId: string | null; productId: string | null; provisioningRequestId: string | null },
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

function asResourceList(
  value: unknown,
): Array<{ resourceType: string; resourceRef: string; state?: Record<string, unknown> }> {
  if (!Array.isArray(value)) return [];
  const out: Array<{ resourceType: string; resourceRef: string; state?: Record<string, unknown> }> =
    [];
  for (const raw of value) {
    const r = raw as Record<string, unknown>;
    const resourceType = String(r.resourceType ?? r.type ?? '');
    const resourceRef = String(r.resourceRef ?? r.ref ?? r.id ?? '');
    if (!resourceType || !resourceRef) continue;
    const state =
      r.state && typeof r.state === 'object' && !Array.isArray(r.state)
        ? (r.state as Record<string, unknown>)
        : undefined;
    out.push({ resourceType, resourceRef, state });
  }
  return out;
}

/**
 * Bridges P7.4 workflow handlers → P7.13 reconciliation & operational governance.
 *
 * CRITICAL:
 * - Timeout/unreachable ⇒ UNKNOWN (never deleted)
 * - Auto-remediate only if eligible + policy + reversible
 * - Evidence-only local status updates — never call foreign destructors
 * - No blind deletes
 */
export function createLiveReconciliationExecutor(deps: {
  repo: ReconciliationRepositoryPort;
  authorization: WorkflowAuthorizationPort;
  lease?: WorkflowLeasePort | null;
}): ReconciliationLiveExecutor {
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

    // Fail-closed when provisioningRequestId is bound — trust material required
    if (provisioningRequestId && (!rowId || version == null)) {
      return { allowed: false, reason: 'TRUST_MATERIAL_MISSING', rowId, version };
    }
    if (!provisioningRequestId && (!rowId || version == null)) {
      // Unbound observe may proceed without P7.1 when no provisioning request is attached
      return {
        allowed: true,
        view: {
          authorizationRowId: rowId ?? 'UNBOUND',
          authorizationVersion: version ?? 0,
        } as WorkflowReadyAuthorizationView,
        rowId: rowId ?? 'UNBOUND',
        version: version ?? 0,
      };
    }

    let view: WorkflowReadyAuthorizationView | null;
    try {
      view = await withTimeout(
        deps.authorization.revalidateBoundAuthorization({
          authorizationRowId: rowId!,
          authorizationVersion: version!,
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
    return { allowed: true, view, rowId: rowId!, version: version! };
  };

  const recordEvidence = async (
    ctx: { runId?: string | null; findingId?: string | null; remediationId?: string | null; tenantId: string | null },
    input: WorkflowHandlerInput,
    operation: string,
    outcome: 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'PARTIAL' | 'WAITING_APPROVAL' | 'UNKNOWN',
    evidence: Record<string, unknown>,
    startedAt: number,
    error?: { code: string; message: string },
  ) => {
    try {
      await deps.repo.createEvidence({
        runId: ctx.runId ?? null,
        findingId: ctx.findingId ?? null,
        remediationId: ctx.remediationId ?? null,
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
        'Reconciliation operation evidence could not be persisted',
        [{ operation }],
        err instanceof Error ? err : undefined,
      );
    }
  };

  const gateMutation = async (
    input: WorkflowHandlerInput,
    bound: {
      tenantId: string | null;
      productId: string | null;
      authorizationRowId: string | null;
      authorizationVersion: number | null;
      provisioningRequestId: string | null;
      runId?: string | null;
    },
    operation: string,
  ): Promise<{ denied: WorkflowHandlerOutcome | null; decision: AuthorizationDecision }> => {
    const startedAt = Date.now();
    const s = snap(input);

    if (deps.lease) {
      const leaseCheck = await validateLease(input);
      if (leaseCheck && !leaseCheck.valid) {
        await recordEvidence(
          { runId: bound.runId, tenantId: bound.tenantId },
          input,
          `${operation}:lease_check`,
          'FAILED',
          { leaseReason: leaseCheck.reason, detail: leaseCheck.detail ?? null },
          startedAt,
          { code: ReconciliationErrorCode.AUTHORIZATION_FAILED, message: leaseCheck.reason },
        );
        return {
          denied: fail(
            ReconciliationErrorCode.AUTHORIZATION_FAILED,
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
      { runId: bound.runId, tenantId: bound.tenantId },
      input,
      `${operation}:authorization_check`,
      decision.allowed ? 'SUCCEEDED' : 'FAILED',
      evidence,
      startedAt,
      decision.allowed
        ? undefined
        : {
            code: ReconciliationErrorCode.AUTHORIZATION_FAILED,
            message: decision.reason,
          },
    );
    if (!decision.allowed) {
      return {
        denied: fail(
          ReconciliationErrorCode.AUTHORIZATION_FAILED,
          `P7.1 authorization denied: ${decision.reason}`,
        ),
        decision,
      };
    }
    return { denied: null, decision };
  };

  const loadRun = async (s: Record<string, unknown>): Promise<ReconciliationRunRecord | null> => {
    const id = str(s.runId) ?? str(s.reconciliationRunId) ?? str(s.recordId);
    if (!id) return null;
    return deps.repo.getRun(id);
  };

  const loadPolicy = async (
    run: ReconciliationRunRecord,
    s: Record<string, unknown>,
  ): Promise<ReconciliationPolicyRecord | null> => {
    const policyId = str(s.policyId) ?? run.policyId;
    if (!policyId) return null;
    return deps.repo.getPolicy(policyId);
  };

  return async (input, key: ReconciliationHandlerKey): Promise<WorkflowHandlerOutcome> => {
    const s = snap(input);
    const startedAt = Date.now();
    const actorId = str(s.actorId) ?? input.workerId ?? 'workflow-worker';

    try {
      switch (key) {
        case 'reconciliation.revalidate_auth': {
          const run = await loadRun(s);
          if (!run) return fail(ReconciliationErrorCode.VALIDATION, 'runId required');
          const { denied } = await gateMutation(
            input,
            {
              tenantId: run.tenantId,
              productId: run.productId,
              authorizationRowId: run.authorizationRowId,
              authorizationVersion: run.authorizationVersion,
              provisioningRequestId: run.provisioningRequestId,
              runId: run.id,
            },
            key,
          );
          if (denied) return denied;
          return ok({ runId: run.id, auth: 'REVALIDATED' });
        }

        case 'reconciliation.collect_desired': {
          const run = await loadRun(s);
          if (!run) return fail(ReconciliationErrorCode.VALIDATION, 'runId required');
          const { denied } = await gateMutation(
            input,
            {
              tenantId: run.tenantId,
              productId: run.productId,
              authorizationRowId: run.authorizationRowId,
              authorizationVersion: run.authorizationVersion,
              provisioningRequestId: run.provisioningRequestId,
              runId: run.id,
            },
            key,
          );
          if (denied) return denied;

          const fromInput = asResourceList(
            s.desired ??
              (s.desiredSnapshot as Record<string, unknown> | undefined)?.resources,
          );
          const fromRun = asResourceList(
            (run.desiredSnapshot as Record<string, unknown>)?.resources ?? run.desiredSnapshot,
          );
          const resources: DesiredResource[] =
            fromInput.length > 0 ? fromInput : fromRun;

          const snapshot = { resources, collectedAt: new Date().toISOString() };
          await deps.repo.updateRun(run.id, {
            desiredSnapshot: snapshot,
            runStatus: ReconciliationRunStatus.RUNNING,
          });
          await recordEvidence(
            { runId: run.id, tenantId: run.tenantId },
            input,
            key,
            'SUCCEEDED',
            { desiredCount: resources.length },
            startedAt,
          );
          return ok({ desiredCount: resources.length, desiredSnapshot: snapshot });
        }

        case 'reconciliation.collect_observed': {
          const run = await loadRun(s);
          if (!run) return fail(ReconciliationErrorCode.VALIDATION, 'runId required');
          const { denied } = await gateMutation(
            input,
            {
              tenantId: run.tenantId,
              productId: run.productId,
              authorizationRowId: run.authorizationRowId,
              authorizationVersion: run.authorizationVersion,
              provisioningRequestId: run.provisioningRequestId,
              runId: run.id,
            },
            key,
          );
          if (denied) return denied;

          const meta = {
            ...(typeof s.metadata === 'object' && s.metadata ? (s.metadata as Record<string, unknown>) : {}),
            ...(run.metadata ?? {}),
          };
          const providerUnreachable =
            meta.providerUnreachable === true ||
            s.providerUnreachable === true ||
            (run.metadata as Record<string, unknown>)?.providerUnreachable === true;

          // CRITICAL: unreachable ⇒ UNKNOWN — do NOT invent observed empties as deletes
          if (providerUnreachable) {
            const snapshot = {
              resources: [] as ObservedResource[],
              providerUnreachable: true,
              collectedAt: new Date().toISOString(),
              note: 'Provider unreachable — observations will be UNKNOWN (never deleted)',
            };
            await deps.repo.updateRun(run.id, {
              observedSnapshot: snapshot,
              metadata: { ...run.metadata, providerUnreachable: true },
            });
            await recordEvidence(
              { runId: run.id, tenantId: run.tenantId },
              input,
              key,
              'UNKNOWN',
              { providerUnreachable: true, neverTreatAsDeleted: true },
              startedAt,
              {
                code: ReconciliationErrorCode.PROVIDER_UNREACHABLE,
                message: 'Provider unreachable — UNKNOWN observation class',
              },
            );
            return ok({
              providerUnreachable: true,
              observedCount: 0,
              observationHint: ObservationClass.UNKNOWN,
            });
          }

          const fromInput = asResourceList(
            s.observed ??
              (s.observedSnapshot as Record<string, unknown> | undefined)?.resources,
          );
          const fromRun = asResourceList(
            (run.observedSnapshot as Record<string, unknown>)?.resources ?? run.observedSnapshot,
          );
          const resources: ObservedResource[] = fromInput.length > 0 ? fromInput : fromRun;
          const snapshot = { resources, providerUnreachable: false, collectedAt: new Date().toISOString() };
          await deps.repo.updateRun(run.id, { observedSnapshot: snapshot });
          await recordEvidence(
            { runId: run.id, tenantId: run.tenantId },
            input,
            key,
            'SUCCEEDED',
            { observedCount: resources.length, providerUnreachable: false },
            startedAt,
          );
          return ok({ observedCount: resources.length, observedSnapshot: snapshot });
        }

        case 'reconciliation.classify_findings': {
          const run = await loadRun(s);
          if (!run) return fail(ReconciliationErrorCode.VALIDATION, 'runId required');
          const { denied } = await gateMutation(
            input,
            {
              tenantId: run.tenantId,
              productId: run.productId,
              authorizationRowId: run.authorizationRowId,
              authorizationVersion: run.authorizationVersion,
              provisioningRequestId: run.provisioningRequestId,
              runId: run.id,
            },
            key,
          );
          if (denied) return denied;

          const desired = asResourceList(
            (run.desiredSnapshot as Record<string, unknown>)?.resources ?? run.desiredSnapshot,
          );
          const observedSnap = run.observedSnapshot as Record<string, unknown>;
          const providerUnreachable =
            observedSnap?.providerUnreachable === true ||
            run.metadata?.providerUnreachable === true ||
            s.providerUnreachable === true;
          const observed = providerUnreachable
            ? []
            : asResourceList(observedSnap?.resources ?? run.observedSnapshot);

          const drafts = classifyObservations({
            desired,
            observed,
            providerUnreachable: Boolean(providerUnreachable),
          });

          const existing = await deps.repo.listFindings({ runId: run.id, limit: 500 });
          if (existing.items.length === 0 && drafts.length > 0) {
            await deps.repo.createFindings(
              drafts.map((d) => ({
                runId: run.id,
                tenantId: run.tenantId,
                productId: run.productId,
                findingCode: d.findingCode,
                resourceType: d.resourceType,
                resourceRef: d.resourceRef,
                severity: d.severity,
                findingStatus: FindingStatus.OPEN,
                observationClass: d.observationClass,
                desiredState: d.desiredState,
                observedState: d.observedState,
                lastKnownState: d.lastKnownState,
                autoRemediateEligible: d.autoRemediateEligible,
                message: d.message,
                details: d.details,
              })),
            );
          }

          await deps.repo.updateRun(run.id, {
            driftCount: drafts.length,
            summary: {
              ...(run.summary ?? {}),
              classified: drafts.length,
              unknownCount: drafts.filter((d) => d.observationClass === ObservationClass.UNKNOWN)
                .length,
              providerUnreachable: Boolean(providerUnreachable),
            },
          });
          await recordEvidence(
            { runId: run.id, tenantId: run.tenantId },
            input,
            key,
            providerUnreachable ? 'UNKNOWN' : 'SUCCEEDED',
            {
              findingCount: drafts.length,
              providerUnreachable: Boolean(providerUnreachable),
              neverTreatAsDeleted: true,
            },
            startedAt,
          );
          return ok({
            findingCount: drafts.length,
            providerUnreachable: Boolean(providerUnreachable),
          });
        }

        case 'reconciliation.apply_waivers': {
          const run = await loadRun(s);
          if (!run) return fail(ReconciliationErrorCode.VALIDATION, 'runId required');
          const { denied } = await gateMutation(
            input,
            {
              tenantId: run.tenantId,
              productId: run.productId,
              authorizationRowId: run.authorizationRowId,
              authorizationVersion: run.authorizationVersion,
              provisioningRequestId: run.provisioningRequestId,
              runId: run.id,
            },
            key,
          );
          if (denied) return denied;

          const now = new Date();
          const waivers = await deps.repo.listActiveWaivers({
            tenantId: run.tenantId,
            productId: run.productId,
            now,
          });
          const findings = await deps.repo.listFindings({
            runId: run.id,
            status: FindingStatus.OPEN,
            limit: 500,
          });

          let waivedCount = 0;
          for (const finding of findings.items) {
            const byId = waivers.find((w) => w.findingId === finding.id && isWaiverValid(w, now));
            const byCode = waivers.find(
              (w) =>
                !w.findingId &&
                (w.waiverCode === finding.findingCode ||
                  (typeof w.metadata?.findingCode === 'string' &&
                    w.metadata.findingCode === finding.findingCode) ||
                  (typeof w.metadata?.resourceRef === 'string' &&
                    w.metadata.resourceRef === finding.resourceRef)),
            );
            // Expired already filtered by listActiveWaivers + isWaiverValid
            const match = byId ?? byCode;
            if (!match) continue;
            await deps.repo.updateFinding(finding.id, {
              findingStatus: FindingStatus.WAIVED,
              message: `Waived by ${match.waiverCode}`,
              details: { ...finding.details, waiverId: match.id, waiverCode: match.waiverCode },
            });
            waivedCount += 1;
          }

          // Also apply draft-level waiver matching for any still-open after code match
          const stillOpen = await deps.repo.listFindings({
            runId: run.id,
            status: FindingStatus.OPEN,
            limit: 500,
          });
          const drafts = stillOpen.items.map((f) => ({
            findingCode: f.findingCode,
            resourceType: f.resourceType,
            resourceRef: f.resourceRef ?? '',
            observationClass: f.observationClass as ObservationClass,
            severity: f.severity,
            desiredState: f.desiredState,
            observedState: f.observedState,
            lastKnownState: f.lastKnownState,
            autoRemediateEligible: f.autoRemediateEligible,
            message: f.message ?? '',
            details: f.details,
          }));
          const { waived } = applyActiveWaivers(drafts, waivers, now);
          for (const w of waived) {
            const finding = stillOpen.items.find((f) => f.findingCode === w.findingCode);
            if (!finding || finding.findingStatus === FindingStatus.WAIVED) continue;
            await deps.repo.updateFinding(finding.id, {
              findingStatus: FindingStatus.WAIVED,
              message: `Waived by ${w.waiverCode}`,
            });
            waivedCount += 1;
          }

          await recordEvidence(
            { runId: run.id, tenantId: run.tenantId },
            input,
            key,
            'SUCCEEDED',
            { waivedCount, activeWaiverCount: waivers.length, expiredIgnored: true },
            startedAt,
          );
          return ok({ waivedCount });
        }

        case 'reconciliation.plan_remediation': {
          const run = await loadRun(s);
          if (!run) return fail(ReconciliationErrorCode.VALIDATION, 'runId required');
          const { denied } = await gateMutation(
            input,
            {
              tenantId: run.tenantId,
              productId: run.productId,
              authorizationRowId: run.authorizationRowId,
              authorizationVersion: run.authorizationVersion,
              provisioningRequestId: run.provisioningRequestId,
              runId: run.id,
            },
            key,
          );
          if (denied) return denied;

          const policy = await loadPolicy(run, s);
          const findings = await deps.repo.listFindings({
            runId: run.id,
            status: FindingStatus.OPEN,
            limit: 500,
          });
          const existing = await deps.repo.listRemediations({ runId: run.id, limit: 500 });
          const plannedIds = new Set(existing.map((r) => r.findingId));

          let planned = 0;
          let waiting = 0;
          for (const finding of findings.items) {
            if (plannedIds.has(finding.id)) continue;
            if (String(finding.observationClass) === ObservationClass.UNKNOWN) {
              // Plan quarantine-oriented remediation — never delete
              await deps.repo.createRemediation({
                findingId: finding.id,
                runId: run.id,
                tenantId: run.tenantId,
                remediationStatus: RemediationStatus.WAITING_APPROVAL,
                plan: {
                  action: 'QUARANTINE_OR_REOBSERVE',
                  note: 'UNKNOWN — unreachable ≠ deleted; no auto-remediate',
                  foreignDestructors: false,
                },
                workflowId: null,
                reversible: true,
                approvedBy: null,
                approvedAt: null,
                executedAt: null,
                evidence: {},
                errorCode: ReconciliationErrorCode.UNKNOWN_STATE,
                errorMessage: 'UNKNOWN observation requires human decision',
                createdBy: actorId,
              });
              waiting += 1;
              planned += 1;
              continue;
            }

            const reversible =
              String(finding.observationClass) !== ObservationClass.UNEXPECTED &&
              finding.autoRemediateEligible;
            const candidate = {
              finding,
              policy: policy ?? {
                autoRemediate: false,
                requireApproval: true,
              },
              remediation: { reversible },
            };
            const auto = canAutoRemediate({
              finding: candidate.finding,
              policy: candidate.policy as Pick<
                ReconciliationPolicyRecord,
                'autoRemediate' | 'requireApproval'
              >,
              remediation: candidate.remediation,
            });

            const status = auto.allowed
              ? RemediationStatus.PENDING
              : RemediationStatus.WAITING_APPROVAL;

            await deps.repo.createRemediation({
              findingId: finding.id,
              runId: run.id,
              tenantId: run.tenantId,
              remediationStatus: status,
              plan: {
                action:
                  String(finding.observationClass) === ObservationClass.UNEXPECTED
                    ? 'REQUIRE_APPROVAL_NO_DELETE'
                    : 'ALIGN_TO_DESIRED',
                observationClass: finding.observationClass,
                reversible,
                autoRemediate: auto.allowed,
                denyReason: auto.allowed ? null : auto.reason,
                foreignDestructors: false,
                evidenceOnly: true,
              },
              workflowId: null,
              reversible,
              approvedBy: null,
              approvedAt: null,
              executedAt: null,
              evidence: {},
              errorCode: auto.allowed ? null : auto.code,
              errorMessage: auto.allowed ? null : auto.reason,
              createdBy: actorId,
            });
            planned += 1;
            if (!auto.allowed) waiting += 1;
          }

          const nextStatus =
            waiting > 0
              ? ReconciliationRunStatus.WAITING_APPROVAL
              : ReconciliationRunStatus.RUNNING;
          await deps.repo.updateRun(run.id, {
            runStatus: nextStatus,
            summary: { ...(run.summary ?? {}), planned, waitingApproval: waiting },
          });
          await recordEvidence(
            { runId: run.id, tenantId: run.tenantId },
            input,
            key,
            waiting > 0 ? 'WAITING_APPROVAL' : 'SUCCEEDED',
            { planned, waiting, noBlindDeletes: true, noUnsafeAutoRemediate: true },
            startedAt,
          );
          if (waiting > 0 && planned === waiting) {
            return waitingApproval(
              `${waiting} remediation(s) require approval (unsafe auto-remediate denied)`,
            );
          }
          return ok({ planned, waiting });
        }

        case 'reconciliation.execute_remediation': {
          const run = await loadRun(s);
          if (!run) return fail(ReconciliationErrorCode.VALIDATION, 'runId required');
          const { denied } = await gateMutation(
            input,
            {
              tenantId: run.tenantId,
              productId: run.productId,
              authorizationRowId: run.authorizationRowId,
              authorizationVersion: run.authorizationVersion,
              provisioningRequestId: run.provisioningRequestId,
              runId: run.id,
            },
            key,
          );
          if (denied) return denied;

          const remediationId = str(s.remediationId);
          const remediations = remediationId
            ? [await deps.repo.getRemediation(remediationId)].filter(Boolean)
            : await deps.repo.listRemediations({ runId: run.id, limit: 100 });

          const policy = await loadPolicy(run, s);
          let executed = 0;
          let waiting = 0;

          for (const rem of remediations) {
            if (!rem) continue;
            if (
              rem.remediationStatus === RemediationStatus.SUCCEEDED ||
              rem.remediationStatus === RemediationStatus.REJECTED ||
              rem.remediationStatus === RemediationStatus.CANCELLED
            ) {
              continue;
            }

            const finding = await deps.repo.getFinding(rem.findingId);
            if (!finding) continue;

            const approved =
              rem.remediationStatus === RemediationStatus.APPROVED ||
              s.approved === true ||
              String(s.decision ?? '').toUpperCase() === 'APPROVE';

            const auto = canAutoRemediate({
              finding,
              policy: (policy ?? {
                autoRemediate: false,
                requireApproval: true,
              }) as Pick<ReconciliationPolicyRecord, 'autoRemediate' | 'requireApproval'>,
              remediation: rem,
            });

            if (!auto.allowed && !approved) {
              await deps.repo.updateRemediation(rem.id, {
                remediationStatus: RemediationStatus.WAITING_APPROVAL,
                errorCode: auto.code,
                errorMessage: auto.reason,
              });
              waiting += 1;
              continue;
            }

            // Evidence-only local status update — NEVER call foreign destructors
            await deps.repo.updateRemediation(rem.id, {
              remediationStatus: RemediationStatus.RUNNING,
            });
            await deps.repo.updateFinding(finding.id, {
              findingStatus: FindingStatus.REMEDIATING,
            });

            await deps.repo.updateRemediation(rem.id, {
              remediationStatus: RemediationStatus.SUCCEEDED,
              executedAt: new Date(),
              evidence: {
                ...rem.evidence,
                mode: 'EVIDENCE_ONLY_LOCAL_STATUS',
                foreignDestructorsInvoked: false,
                noBlindDelete: true,
                markedRemediatedAt: new Date().toISOString(),
                approved: approved || auto.allowed,
              },
              errorCode: null,
              errorMessage: null,
            });
            await deps.repo.updateFinding(finding.id, {
              findingStatus: FindingStatus.REMEDIATED,
              message: 'Remediated (evidence-only local status — no foreign destructor)',
            });
            await deps.repo.appendHistory({
              resourceType: 'RECONCILIATION_FINDING',
              resourceId: finding.id,
              tenantId: finding.tenantId,
              fromStatus: String(finding.findingStatus),
              toStatus: FindingStatus.REMEDIATED,
              action: 'REMEDIATE_EVIDENCE_ONLY',
              actorId,
              details: {
                remediationId: rem.id,
                foreignDestructorsInvoked: false,
                workflowId: input.workflowId ?? null,
              },
            });
            executed += 1;
          }

          await recordEvidence(
            { runId: run.id, tenantId: run.tenantId },
            input,
            key,
            waiting > 0 ? 'WAITING_APPROVAL' : 'SUCCEEDED',
            {
              executed,
              waiting,
              foreignDestructorsInvoked: false,
              evidenceOnly: true,
            },
            startedAt,
          );

          if (waiting > 0 && executed === 0) {
            await deps.repo.updateRun(run.id, {
              runStatus: ReconciliationRunStatus.WAITING_APPROVAL,
            });
            return waitingApproval(`${waiting} remediation(s) require approval before execute`);
          }

          return ok({ executed, waiting, foreignDestructorsInvoked: false });
        }

        case 'reconciliation.quarantine': {
          const run = await loadRun(s);
          if (!run) return fail(ReconciliationErrorCode.VALIDATION, 'runId required');
          const { denied } = await gateMutation(
            input,
            {
              tenantId: run.tenantId,
              productId: run.productId,
              authorizationRowId: run.authorizationRowId,
              authorizationVersion: run.authorizationVersion,
              provisioningRequestId: run.provisioningRequestId,
              runId: run.id,
            },
            key,
          );
          if (denied) return denied;

          const findingId = str(s.findingId);
          if (!findingId) {
            // Quarantine all UNKNOWN findings for the run
            const unknowns = await deps.repo.listFindings({
              runId: run.id,
              observationClass: ObservationClass.UNKNOWN,
              limit: 200,
            });
            let count = 0;
            for (const f of unknowns.items) {
              if (f.findingStatus === FindingStatus.QUARANTINED) continue;
              await deps.repo.updateFinding(f.id, {
                findingStatus: FindingStatus.QUARANTINED,
                message: 'Quarantined UNKNOWN observation (unreachable ≠ deleted)',
              });
              count += 1;
            }
            await recordEvidence(
              { runId: run.id, tenantId: run.tenantId },
              input,
              key,
              'SUCCEEDED',
              { quarantined: count },
              startedAt,
            );
            return ok({ quarantined: count });
          }

          const finding = await deps.repo.getFinding(findingId);
          if (!finding || finding.runId !== run.id) {
            return fail(ReconciliationErrorCode.VALIDATION, 'Finding not found for run');
          }
          await deps.repo.updateFinding(finding.id, {
            findingStatus: FindingStatus.QUARANTINED,
            message: str(s.reason) ?? 'Quarantined by operator',
          });
          await deps.repo.appendHistory({
            resourceType: 'RECONCILIATION_FINDING',
            resourceId: finding.id,
            tenantId: finding.tenantId,
            fromStatus: String(finding.findingStatus),
            toStatus: FindingStatus.QUARANTINED,
            action: 'QUARANTINE',
            actorId,
            reason: str(s.reason) ?? null,
          });
          await recordEvidence(
            { runId: run.id, findingId: finding.id, tenantId: run.tenantId },
            input,
            key,
            'SUCCEEDED',
            { findingId: finding.id },
            startedAt,
          );
          return ok({ findingId: finding.id, findingStatus: FindingStatus.QUARANTINED });
        }

        case 'reconciliation.verify': {
          const run = await loadRun(s);
          if (!run) return fail(ReconciliationErrorCode.VALIDATION, 'runId required');
          const { denied } = await gateMutation(
            input,
            {
              tenantId: run.tenantId,
              productId: run.productId,
              authorizationRowId: run.authorizationRowId,
              authorizationVersion: run.authorizationVersion,
              provisioningRequestId: run.provisioningRequestId,
              runId: run.id,
            },
            key,
          );
          if (denied) return denied;

          const fresh = await deps.repo.getRun(run.id);
          if (!fresh) return fail(ReconciliationErrorCode.VALIDATION, 'Run missing');

          const operation = String(s.operation ?? '').toUpperCase();
          const findings = await deps.repo.listFindings({ runId: fresh.id, limit: 500 });
          const openCount = findings.items.filter(
            (f) =>
              f.findingStatus === FindingStatus.OPEN ||
              f.findingStatus === FindingStatus.REMEDIATING,
          ).length;
          const unknownCount = findings.items.filter(
            (f) => String(f.observationClass) === ObservationClass.UNKNOWN,
          ).length;
          const waiting =
            String(fresh.runStatus) === ReconciliationRunStatus.WAITING_APPROVAL;

          let finalStatus = String(fresh.runStatus);
          if (operation === 'OBSERVE' || operation === 'REMEDIATE') {
            if (waiting) {
              finalStatus = ReconciliationRunStatus.WAITING_APPROVAL;
            } else if (unknownCount > 0 && openCount > 0) {
              finalStatus = ReconciliationRunStatus.PARTIAL;
            } else if (openCount === 0) {
              finalStatus = ReconciliationRunStatus.SUCCEEDED;
            } else {
              finalStatus = ReconciliationRunStatus.PARTIAL;
            }
            if (String(fresh.runStatus) !== finalStatus) {
              await deps.repo.updateRun(fresh.id, {
                runStatus: finalStatus,
                finishedAt:
                  finalStatus === ReconciliationRunStatus.SUCCEEDED ||
                  finalStatus === ReconciliationRunStatus.PARTIAL
                    ? new Date()
                    : fresh.finishedAt,
                summary: {
                  ...(fresh.summary ?? {}),
                  openCount,
                  unknownCount,
                  verifiedAt: new Date().toISOString(),
                },
              });
            }
          }

          await recordEvidence(
            { runId: fresh.id, tenantId: fresh.tenantId },
            input,
            key,
            'SUCCEEDED',
            { runStatus: finalStatus, openCount, unknownCount, operation: operation || null },
            startedAt,
          );
          return ok({
            verified: true,
            runStatus: finalStatus,
            openCount,
            unknownCount,
          });
        }

        default:
          return fail(
            ReconciliationErrorCode.VALIDATION,
            `Unknown handler key: ${String(key)}`,
          );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(ReconciliationErrorCode.PROVIDER_UNAVAILABLE, message, true);
    }
  };
}

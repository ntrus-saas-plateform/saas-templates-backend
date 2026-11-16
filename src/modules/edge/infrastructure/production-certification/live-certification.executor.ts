import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { CertificationLiveExecutor } from '../../domain/production-certification/certification-handlers.js';
import {
  applyRevokeClearance,
  canCertify,
  canRevoke,
  defaultEvidenceKeySpecs,
  evaluateCertificationGates,
  type EvidenceKeySpec,
} from '../../domain/production-certification/certification-policy.js';
import type { CertificationRepositoryPort } from '../../domain/production-certification/certification-repository.port.js';
import {
  CertificationErrorCode,
  CertificationEvidenceItemStatus,
  CertificationPackageStatus,
  CertificationRunOutcome,
  type CertificationHandlerKey,
  type CertificationPackageRecord,
} from '../../domain/production-certification/certification.types.js';
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
  code: CertificationErrorCode | string,
  message: string,
  retryable = false,
): WorkflowHandlerOutcome {
  return {
    status: 'FAILED',
    errorClass: code,
    message,
    retryable,
    diagnostics: { handler: 'p7.15', message },
  };
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

/**
 * Bridges P7.4 workflow handlers → P7.15 production certification.
 *
 * CRITICAL:
 * - Cannot CERTIFY if any required evidence is MISSING or FAILED
 * - Revoke clears CERTIFIED (certifiedAt → null, status → REVOKED)
 * - p714_agents optional for Shared SaaS
 */
export function createLiveCertificationExecutor(deps: {
  repo: CertificationRepositoryPort;
  authorization: WorkflowAuthorizationPort;
  lease?: WorkflowLeasePort | null;
}): CertificationLiveExecutor {
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

    if (provisioningRequestId && (!rowId || version == null)) {
      return { allowed: false, reason: 'TRUST_MATERIAL_MISSING', rowId, version };
    }
    if (!provisioningRequestId && (!rowId || version == null)) {
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
          provisioningRequestId: provisioningRequestId!,
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
    packageId: string | null,
    input: WorkflowHandlerInput,
    operation: string,
    outcome: 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'PARTIAL' | 'WAITING_APPROVAL',
    evidence: Record<string, unknown>,
    startedAt: number,
    error?: { code: string; message: string },
  ) => {
    try {
      await deps.repo.createEvidence({
        packageId,
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
        'Certification operation evidence could not be persisted',
        [{ operation }],
        err instanceof Error ? err : undefined,
      );
    }
  };

  const loadPackage = async (
    s: Record<string, unknown>,
  ): Promise<CertificationPackageRecord | null> => {
    const id = str(s.packageId) ?? str(s.certificationPackageId) ?? str(s.recordId);
    if (!id) return null;
    return deps.repo.getPackage(id);
  };

  const parseSpecs = (s: Record<string, unknown>): EvidenceKeySpec[] => {
    const raw = s.evidenceSpecs;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw
        .map((r) => {
          const o = r as Record<string, unknown>;
          const evidenceKey = String(o.evidenceKey ?? '');
          if (!evidenceKey) return null;
          return {
            evidenceKey,
            phaseCode: String(o.phaseCode ?? evidenceKey.toUpperCase()),
            required: o.required !== false,
          } satisfies EvidenceKeySpec;
        })
        .filter((x): x is EvidenceKeySpec => x != null);
    }
    return defaultEvidenceKeySpecs();
  };

  return async (input, key: CertificationHandlerKey): Promise<WorkflowHandlerOutcome> => {
    const s = snap(input);
    const startedAt = Date.now();
    const actorId = str(s.actorId) ?? input.workerId ?? 'workflow-worker';

    try {
      switch (key) {
        case 'certification.revalidate_auth': {
          const pkg = await loadPackage(s);
          if (!pkg) {
            return fail(CertificationErrorCode.VALIDATION, 'packageId required');
          }
          if (deps.lease) {
            const leaseCheck = await validateLease(input);
            if (leaseCheck && !leaseCheck.valid) {
              await recordEvidence(
                pkg.id,
                input,
                'revalidate_auth:lease_check',
                'FAILED',
                { leaseReason: leaseCheck.reason },
                startedAt,
                { code: CertificationErrorCode.AUTHORIZATION_FAILED, message: leaseCheck.reason },
              );
              return fail(
                CertificationErrorCode.AUTHORIZATION_FAILED,
                `Lease validation failed: ${leaseCheck.reason}`,
              );
            }
          }
          const decision = await revalidateAuthorization(s, {
            authorizationRowId: pkg.authorizationRowId,
            authorizationVersion: pkg.authorizationVersion,
            provisioningRequestId: pkg.provisioningRequestId,
          });
          await recordEvidence(
            pkg.id,
            input,
            'revalidate_auth',
            decision.allowed ? 'SUCCEEDED' : 'FAILED',
            {
              p71AuthorizationDecision: decision.allowed ? 'ALLOW' : 'DENY',
              reason: decision.allowed ? 'REVALIDATED' : decision.reason,
            },
            startedAt,
            decision.allowed
              ? undefined
              : {
                  code: CertificationErrorCode.AUTHORIZATION_FAILED,
                  message: decision.reason,
                },
          );
          if (!decision.allowed) {
            return fail(
              CertificationErrorCode.AUTHORIZATION_FAILED,
              `P7.1 authorization denied: ${decision.reason}`,
            );
          }
          return ok({ packageId: pkg.id, authorizationOk: true });
        }

        case 'certification.assemble_manifest': {
          const pkg = await loadPackage(s);
          if (!pkg) return fail(CertificationErrorCode.VALIDATION, 'packageId required');
          const specs = parseSpecs(s);
          const manifest = specs.map((spec) => ({
            evidenceKey: spec.evidenceKey,
            phaseCode: spec.phaseCode,
            required: spec.required,
          }));
          await deps.repo.updatePackage(
            pkg.id,
            {
              evidenceManifest: manifest,
              packageStatus: CertificationPackageStatus.ASSEMBLING,
              gateResults: { assembling: true, manifestSize: manifest.length },
            },
            pkg.version,
            actorId,
          );
          await recordEvidence(
            pkg.id,
            input,
            'assemble_manifest',
            'SUCCEEDED',
            { manifest },
            startedAt,
          );
          return ok({ packageId: pkg.id, manifestSize: manifest.length });
        }

        case 'certification.collect_evidence': {
          const pkg = await loadPackage(s);
          if (!pkg) return fail(CertificationErrorCode.VALIDATION, 'packageId required');
          const specs = parseSpecs(s);
          const existing = await deps.repo.listEvidenceItems({ packageId: pkg.id, limit: 200 });
          const byKey = new Map(existing.map((i) => [i.evidenceKey, i]));
          for (const spec of specs) {
            if (byKey.has(spec.evidenceKey)) continue;
            await deps.repo.upsertEvidenceItem({
              packageId: pkg.id,
              evidenceKey: spec.evidenceKey,
              phaseCode: spec.phaseCode,
              required: spec.required,
              itemStatus: CertificationEvidenceItemStatus.MISSING,
              sourceRef: null,
              checksum: null,
              details: { seededBy: 'assemble' },
              attachedAt: null,
            });
          }
          const items = await deps.repo.listEvidenceItems({ packageId: pkg.id, limit: 200 });
          await recordEvidence(
            pkg.id,
            input,
            'collect_evidence',
            'SUCCEEDED',
            { itemCount: items.length },
            startedAt,
          );
          return ok({ packageId: pkg.id, itemCount: items.length });
        }

        case 'certification.evaluate_gates': {
          const pkg = await loadPackage(s);
          if (!pkg) return fail(CertificationErrorCode.VALIDATION, 'packageId required');
          const items = await deps.repo.listEvidenceItems({ packageId: pkg.id, limit: 200 });
          const gates = evaluateCertificationGates(items);
          const refreshed = await deps.repo.getPackage(pkg.id);
          if (!refreshed) return fail(CertificationErrorCode.VALIDATION, 'package missing');

          const nextStatus = gates.ready
            ? String(s.operation) === 'CERTIFY'
              ? refreshed.packageStatus
              : CertificationPackageStatus.READY
            : String(s.operation) === 'CERTIFY'
              ? refreshed.packageStatus
              : CertificationPackageStatus.FAILED;

          await deps.repo.updatePackage(
            refreshed.id,
            {
              gateResults: {
                ready: gates.ready,
                blocking: gates.blocking,
                summary: gates.summary,
                evaluatedAt: new Date().toISOString(),
              },
              packageStatus:
                String(s.operation) === 'CERTIFY'
                  ? refreshed.packageStatus
                  : (nextStatus as string),
            },
            refreshed.version,
            actorId,
          );

          await recordEvidence(
            pkg.id,
            input,
            'evaluate_gates',
            gates.ready ? 'SUCCEEDED' : 'FAILED',
            { ready: gates.ready, blocking: gates.blocking },
            startedAt,
            gates.ready
              ? undefined
              : {
                  code: CertificationErrorCode.GATE_FAILED,
                  message: gates.blocking.map((b) => b.reason).join('; '),
                },
          );

          if (String(s.operation) === 'CERTIFY' && !gates.ready) {
            return fail(
              CertificationErrorCode.GATE_FAILED,
              `Cannot CERTIFY: ${gates.blocking.map((b) => b.reason).join('; ')}`,
            );
          }
          return ok({ packageId: pkg.id, ready: gates.ready, blocking: gates.blocking });
        }

        case 'certification.apply_certify': {
          const pkg = await loadPackage(s);
          if (!pkg) return fail(CertificationErrorCode.VALIDATION, 'packageId required');
          const items = await deps.repo.listEvidenceItems({ packageId: pkg.id, limit: 200 });
          const decision = canCertify({
            packageStatus: String(pkg.packageStatus),
            evidenceItems: items,
          });
          // Also allow READY-equivalent if evaluate_gates already marked ready in gateResults
          const gateReady = Boolean((pkg.gateResults as { ready?: boolean } | null)?.ready);
          if (!decision.allowed && !(gateReady && String(pkg.packageStatus) === 'READY')) {
            // Re-check with READY if assemble left it READY
            const retry = canCertify({
              packageStatus: CertificationPackageStatus.READY,
              evidenceItems: items,
            });
            if (!retry.allowed || String(pkg.packageStatus) !== CertificationPackageStatus.READY) {
              await recordEvidence(
                pkg.id,
                input,
                'apply_certify',
                'FAILED',
                { decision },
                startedAt,
                {
                  code: decision.allowed ? CertificationErrorCode.NOT_READY : decision.code,
                  message: decision.allowed
                    ? 'Package not READY'
                    : decision.reason,
                },
              );
              return fail(
                decision.allowed ? CertificationErrorCode.NOT_READY : decision.code,
                decision.allowed ? 'Package not READY for certify' : decision.reason,
              );
            }
          } else if (!decision.allowed) {
            await recordEvidence(
              pkg.id,
              input,
              'apply_certify',
              'FAILED',
              { decision },
              startedAt,
              { code: decision.code, message: decision.reason },
            );
            return fail(decision.code, decision.reason);
          }

          const now = new Date();
          await deps.repo.updatePackage(
            pkg.id,
            {
              packageStatus: CertificationPackageStatus.CERTIFIED,
              certifiedAt: now,
              revokedAt: null,
              revocationReason: null,
              gateResults: {
                ...pkg.gateResults,
                certified: true,
                certifiedAt: now.toISOString(),
              },
            },
            pkg.version,
            actorId,
          );
          await deps.repo.appendHistory({
            resourceType: 'CERTIFICATION_PACKAGE',
            resourceId: pkg.id,
            fromStatus: String(pkg.packageStatus),
            toStatus: CertificationPackageStatus.CERTIFIED,
            action: 'CERTIFY',
            reason: str(s.reason) ?? null,
            actorId,
          });
          await recordEvidence(
            pkg.id,
            input,
            'apply_certify',
            'SUCCEEDED',
            { certifiedAt: now.toISOString() },
            startedAt,
          );
          return ok({ packageId: pkg.id, packageStatus: CertificationPackageStatus.CERTIFIED });
        }

        case 'certification.apply_revoke': {
          const pkg = await loadPackage(s);
          if (!pkg) return fail(CertificationErrorCode.VALIDATION, 'packageId required');
          const decision = canRevoke(String(pkg.packageStatus));
          if (!decision.allowed) {
            await recordEvidence(
              pkg.id,
              input,
              'apply_revoke',
              'FAILED',
              { decision },
              startedAt,
              { code: decision.code, message: decision.reason },
            );
            return fail(decision.code, decision.reason);
          }
          const reason =
            str(s.revocationReason) ?? str(s.reason) ?? 'Revoked via p715.certification.revoke';
          const clearance = applyRevokeClearance(pkg, reason);
          await deps.repo.updatePackage(pkg.id, clearance, pkg.version, actorId);
          await deps.repo.appendHistory({
            resourceType: 'CERTIFICATION_PACKAGE',
            resourceId: pkg.id,
            fromStatus: CertificationPackageStatus.CERTIFIED,
            toStatus: CertificationPackageStatus.REVOKED,
            action: 'REVOKE',
            reason,
            actorId,
            details: { clearedCertifiedAt: true },
          });
          await recordEvidence(
            pkg.id,
            input,
            'apply_revoke',
            'SUCCEEDED',
            { clearedCertifiedAt: true, reason },
            startedAt,
          );
          return ok({
            packageId: pkg.id,
            packageStatus: CertificationPackageStatus.REVOKED,
            certifiedAt: null,
          });
        }

        case 'certification.verify': {
          const pkg = await loadPackage(s);
          if (!pkg) return fail(CertificationErrorCode.VALIDATION, 'packageId required');
          const operation = str(s.operation) ?? 'VERIFY';
          const latest = await deps.repo.getPackage(pkg.id);
          if (!latest) return fail(CertificationErrorCode.VALIDATION, 'package missing');

          let outcome: 'SUCCEEDED' | 'FAILED' | 'PARTIAL' = 'SUCCEEDED';
          if (operation === 'ASSEMBLE') {
            outcome =
              latest.packageStatus === CertificationPackageStatus.READY ? 'SUCCEEDED' : 'PARTIAL';
          } else if (operation === 'CERTIFY') {
            outcome =
              latest.packageStatus === CertificationPackageStatus.CERTIFIED
                ? 'SUCCEEDED'
                : 'FAILED';
          } else if (operation === 'REVOKE') {
            outcome =
              latest.packageStatus === CertificationPackageStatus.REVOKED &&
              latest.certifiedAt == null
                ? 'SUCCEEDED'
                : 'FAILED';
          }

          const runs = await deps.repo.listRuns({
            packageId: pkg.id,
            limit: 5,
          });
          const pending = runs.items.find((r) => r.outcome === CertificationRunOutcome.PENDING);
          if (pending) {
            await deps.repo.updateRun(pending.id, {
              outcome:
                outcome === 'SUCCEEDED'
                  ? CertificationRunOutcome.SUCCEEDED
                  : outcome === 'PARTIAL'
                    ? CertificationRunOutcome.PARTIAL
                    : CertificationRunOutcome.FAILED,
              finishedAt: new Date(),
              observedState: {
                packageStatus: latest.packageStatus,
                certifiedAt: latest.certifiedAt?.toISOString() ?? null,
              },
            });
          }

          await recordEvidence(
            pkg.id,
            input,
            'verify',
            outcome === 'FAILED' ? 'FAILED' : outcome === 'PARTIAL' ? 'PARTIAL' : 'SUCCEEDED',
            {
              packageStatus: latest.packageStatus,
              certifiedAt: latest.certifiedAt?.toISOString() ?? null,
              operation,
            },
            startedAt,
          );

          if (outcome === 'FAILED') {
            return fail(
              CertificationErrorCode.GATE_FAILED,
              `Verify failed for operation=${operation} status=${latest.packageStatus}`,
            );
          }
          return ok({
            packageId: pkg.id,
            packageStatus: latest.packageStatus,
            certifiedAt: latest.certifiedAt?.toISOString() ?? null,
          });
        }

        default:
          return fail(
            CertificationErrorCode.VALIDATION,
            `Unknown certification handler key: ${key as string}`,
          );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(CertificationErrorCode.PROVIDER_UNAVAILABLE, message, true);
    }
  };
}

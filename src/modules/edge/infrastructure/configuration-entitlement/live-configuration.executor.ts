import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { redactConfigurationSecrets } from '../../application/configuration-entitlement/configuration.use-cases.js';
import type { ConfigurationLiveExecutor } from '../../domain/configuration-entitlement/configuration-handlers.js';
import type { ConfigurationRepositoryPort } from '../../domain/configuration-entitlement/configuration-repository.port.js';
import {
  checksumPayload,
  validateAgainstSchema,
} from '../../domain/configuration-entitlement/configuration-schema.engine.js';
import {
  AssignmentStatus,
  ConfigurationDriftStatus,
  ConfigurationErrorCode,
  DeploymentOperation,
  DeploymentRunOutcome,
  EntitlementDeploymentStatus,
  VersionRecordStatus,
  type ConfigurationHandlerKey,
  type TenantConfigurationAssignmentRecord,
} from '../../domain/configuration-entitlement/configuration.types.js';
import type { SecretsProviderPort } from '../../domain/infrastructure-provisioning/secrets-provider.port.js';
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
  code: ConfigurationErrorCode | string,
  message: string,
  retryable = false,
): WorkflowHandlerOutcome {
  return {
    status: 'FAILED',
    errorClass: code,
    message,
    retryable,
    diagnostics: { handler: 'p7.8', message },
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
 * Bridges P7.4 workflow handlers → P7.8 local configuration registry apply.
 *
 * Security invariants:
 *  - P7.1 authorization is REVALIDATED fail-closed before every mutation.
 *  - P7.4 fencing/lease is validated when a lease port is wired.
 *  - Evidence is durable and redacted (no plaintext secrets).
 */
export function createLiveConfigurationExecutor(deps: {
  repo: ConfigurationRepositoryPort;
  authorization: WorkflowAuthorizationPort;
  lease?: WorkflowLeasePort | null;
  secrets?: SecretsProviderPort | null;
}): ConfigurationLiveExecutor {
  void deps.secrets;

  const validateLease = async (input: WorkflowHandlerInput): Promise<LeaseValidationResult | null> => {
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
    assignment: TenantConfigurationAssignmentRecord,
  ): Promise<AuthorizationDecision> => {
    if (!deps.authorization) {
      return { allowed: false, reason: 'AUTHORIZATION_PORT_MISSING' };
    }
    const rowId =
      str(s.authorizationRowId) ??
      str(s.authorizationId) ??
      assignment.authorizationRowId ??
      null;
    const version =
      intOf(s.authorizationVersion) ?? assignment.authorizationVersion ?? null;
    const provisioningRequestId =
      str(s.provisioningRequestId) ?? assignment.provisioningRequestId ?? null;

    if (!rowId || version == null) {
      return { allowed: false, reason: 'AUTHORIZATION_MISSING', rowId, version };
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
    assignmentId: string,
    tenantId: string,
    input: WorkflowHandlerInput,
    operation: string,
    outcome: 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'PARTIAL',
    evidence: Record<string, unknown>,
    startedAt: number,
    error?: { code: string; message: string },
  ) => {
    try {
      await deps.repo.createEvidence({
        assignmentId,
        tenantId,
        workflowId: input.workflowId ?? null,
        stepKey: input.stepKey ?? null,
        operation,
        outcome,
        evidence: redactConfigurationSecrets(evidence),
        errorCode: error?.code ?? null,
        errorMessage: error?.message ?? null,
        durationMs: Date.now() - startedAt,
        performedBy: input.workerId ?? null,
      });
    } catch (err) {
      throw new DomainError(
        ErrorCode.DEPENDENCY_UNAVAILABLE,
        'Configuration operation evidence could not be persisted',
        [{ operation }],
        err instanceof Error ? err : undefined,
      );
    }
  };

  const gateMutation = async (
    input: WorkflowHandlerInput,
    assignment: TenantConfigurationAssignmentRecord,
    operation: string,
  ): Promise<WorkflowHandlerOutcome | null> => {
    const startedAt = Date.now();
    const s = snap(input);

    if (deps.lease) {
      const leaseCheck = await validateLease(input);
      if (leaseCheck && !leaseCheck.valid) {
        await recordEvidence(
          assignment.id,
          assignment.tenantId,
          input,
          `${operation}:lease_check`,
          'FAILED',
          { leaseReason: leaseCheck.reason, detail: leaseCheck.detail ?? null },
          startedAt,
          { code: ConfigurationErrorCode.AUTHORIZATION_FAILED, message: leaseCheck.reason },
        );
        return fail(
          ConfigurationErrorCode.AUTHORIZATION_FAILED,
          `Lease validation failed: ${leaseCheck.reason}`,
        );
      }
    }

    const decision = await revalidateAuthorization(s, assignment);
    const evidence = authorizationEvidence(decision, {
      tenantId: assignment.tenantId,
      productId: assignment.productId,
      provisioningRequestId: assignment.provisioningRequestId,
    });
    await recordEvidence(
      assignment.id,
      assignment.tenantId,
      input,
      `${operation}:authorization_check`,
      decision.allowed ? 'SUCCEEDED' : 'FAILED',
      evidence,
      startedAt,
      decision.allowed
        ? undefined
        : { code: ConfigurationErrorCode.AUTHORIZATION_FAILED, message: decision.reason },
    );
    if (!decision.allowed) {
      return fail(
        ConfigurationErrorCode.AUTHORIZATION_FAILED,
        `P7.1 authorization denied: ${decision.reason}`,
      );
    }
    return null;
  };

  return async (input, key: ConfigurationHandlerKey): Promise<WorkflowHandlerOutcome> => {
    const s = snap(input);
    const startedAt = Date.now();
    const assignmentId = str(s.assignmentId);
    if (!assignmentId) {
      return fail(ConfigurationErrorCode.VALIDATION, 'assignmentId required in workflow input');
    }
    const assignment = await deps.repo.getAssignment(assignmentId);
    if (!assignment) {
      return fail(ConfigurationErrorCode.VALIDATION, 'Assignment not found (fail-closed)');
    }
    const actorId = str(s.actorId) ?? input.workerId ?? 'workflow-worker';

    try {
      switch (key) {
        case 'configuration.validate_bundle': {
          const denied = await gateMutation(input, assignment, key);
          if (denied) return denied;

          const bv = await deps.repo.getBundleVersion(
            assignment.bundleId,
            assignment.bundleVersion,
          );
          if (!bv || bv.status !== VersionRecordStatus.PUBLISHED) {
            return fail(
              ConfigurationErrorCode.BUNDLE_NOT_PUBLISHED,
              'Bundle version is not PUBLISHED',
            );
          }
          if (bv.checksum !== assignment.bundleChecksum) {
            await recordEvidence(
              assignment.id,
              assignment.tenantId,
              input,
              key,
              'FAILED',
              { expected: assignment.bundleChecksum, actual: bv.checksum },
              startedAt,
              {
                code: ConfigurationErrorCode.CHECKSUM_MISMATCH,
                message: 'Assignment checksum does not match bundle version',
              },
            );
            return fail(
              ConfigurationErrorCode.CHECKSUM_MISMATCH,
              'Assignment checksum does not match bundle version',
            );
          }

          // Validate desiredConfig against the first template schema when available.
          for (const ref of bv.templateRefs) {
            const template = await deps.repo.getTemplate(ref.templateId);
            if (!template) continue;
            const schema = await deps.repo.getSchema(template.schemaId);
            if (!schema) continue;
            const validation = validateAgainstSchema(schema.jsonSchema, assignment.desiredConfig);
            if (!validation.ok) {
              await recordEvidence(
                assignment.id,
                assignment.tenantId,
                input,
                key,
                'FAILED',
                { issues: validation.issues },
                startedAt,
                {
                  code: ConfigurationErrorCode.SCHEMA_INVALID,
                  message: 'desiredConfig failed schema validation',
                },
              );
              return fail(
                ConfigurationErrorCode.SCHEMA_INVALID,
                'desiredConfig failed schema validation',
              );
            }
          }

          await recordEvidence(
            assignment.id,
            assignment.tenantId,
            input,
            key,
            'SUCCEEDED',
            { bundleVersion: bv.versionNumber, checksum: bv.checksum },
            startedAt,
          );
          return ok({ assignmentId, checksum: bv.checksum, validated: true });
        }

        case 'configuration.deploy_bundle': {
          const denied = await gateMutation(input, assignment, key);
          if (denied) return denied;

          const prevApplied = assignment.appliedConfig;
          const prevChecksum = assignment.appliedChecksum;
          const desired = assignment.desiredConfig;
          const appliedChecksum = checksumPayload(desired);

          const updated = await deps.repo.updateAssignment(
            assignment.id,
            {
              assignmentStatus: AssignmentStatus.DEPLOYING,
              appliedConfig: desired,
              appliedChecksum,
              metadata: {
                ...assignment.metadata,
                prevApplied,
                prevChecksum,
              },
              lastDeployedAt: new Date(),
            },
            assignment.version,
            actorId,
          );

          await deps.repo.createDeploymentRun({
            assignmentId: assignment.id,
            tenantId: assignment.tenantId,
            productId: assignment.productId,
            operation: DeploymentOperation.DEPLOY,
            strategy: String(assignment.deploymentStrategy),
            workflowId: input.workflowId ?? null,
            fromBundleVersion: null,
            toBundleVersion: assignment.bundleVersion,
            outcome: DeploymentRunOutcome.SUCCEEDED,
            errorCode: null,
            errorMessage: null,
            observedState: { appliedChecksum },
            evidence: redactConfigurationSecrets({ applied: true }),
            startedAt: new Date(startedAt),
            finishedAt: new Date(),
            performedBy: actorId,
            correlationId: input.correlationId ?? null,
          });

          await recordEvidence(
            assignment.id,
            assignment.tenantId,
            input,
            key,
            'SUCCEEDED',
            { appliedChecksum, assignmentVersion: updated.version },
            startedAt,
          );
          return ok({
            assignmentId,
            appliedChecksum,
            status: AssignmentStatus.DEPLOYING,
          });
        }

        case 'configuration.apply_entitlements': {
          const denied = await gateMutation(input, assignment, key);
          if (denied) return denied;

          const current = await deps.repo.getAssignment(assignment.id);
          if (!current) {
            return fail(ConfigurationErrorCode.VALIDATION, 'Assignment missing');
          }
          const entitlements =
            current.desiredConfig.entitlements &&
            typeof current.desiredConfig.entitlements === 'object'
              ? (current.desiredConfig.entitlements as Record<string, unknown>)
              : current.desiredConfig;
          const capabilities =
            (entitlements.capabilities as Record<string, unknown> | undefined) ?? {};
          const featureFlags =
            (entitlements.featureFlags as Record<string, unknown> | undefined) ?? {};
          const quotas = (entitlements.quotas as Record<string, unknown> | undefined) ?? {};
          const limits = (entitlements.limits as Record<string, unknown> | undefined) ?? {};
          const payloadDigest = checksumPayload({
            capabilities,
            featureFlags,
            quotas,
            limits,
            snapshotRef: current.entitlementSnapshotRef,
            version: current.entitlementVersion,
          });

          const existing = await deps.repo.getEntitlementByDigest(
            current.tenantId,
            current.productId,
            payloadDigest,
          );
          if (existing) {
            await recordEvidence(
              current.id,
              current.tenantId,
              input,
              key,
              'SUCCEEDED',
              {
                idempotent: true,
                entitlementDeploymentId: existing.id,
                payloadDigest,
              },
              startedAt,
            );
            return ok({
              entitlementDeploymentId: existing.id,
              payloadDigest,
              idempotent: true,
            });
          }

          const created = await deps.repo.createEntitlementDeployment({
            assignmentId: current.id,
            tenantId: current.tenantId,
            productId: current.productId,
            subscriptionId: current.subscriptionId,
            entitlementSnapshotRef: current.entitlementSnapshotRef ?? 'p5-snapshot',
            entitlementVersion: current.entitlementVersion ?? '1',
            payloadDigest,
            capabilities,
            featureFlags,
            quotas,
            limits,
            deploymentStatus: EntitlementDeploymentStatus.DEPLOYED,
            source: 'P5_SNAPSHOT',
            workflowId: input.workflowId ?? null,
            evidence: redactConfigurationSecrets({ appliedAt: new Date().toISOString() }),
            deployedAt: new Date(),
            revokedAt: null,
          });

          await recordEvidence(
            current.id,
            current.tenantId,
            input,
            key,
            'SUCCEEDED',
            { entitlementDeploymentId: created.id, payloadDigest },
            startedAt,
          );
          return ok({
            entitlementDeploymentId: created.id,
            payloadDigest,
            status: EntitlementDeploymentStatus.DEPLOYED,
          });
        }

        case 'configuration.verify_deployment': {
          const denied = await gateMutation(input, assignment, key);
          if (denied) return denied;

          const current = await deps.repo.getAssignment(assignment.id);
          if (!current) {
            return fail(ConfigurationErrorCode.VALIDATION, 'Assignment missing');
          }
          if (!current.appliedChecksum || current.appliedChecksum !== current.bundleChecksum) {
            // appliedChecksum is over desiredConfig; bundleChecksum is over bundle payload.
            // Verify applied matches desired and desired was validated against published bundle.
            const desiredChecksum = checksumPayload(current.desiredConfig);
            if (current.appliedChecksum !== desiredChecksum) {
              await deps.repo.updateAssignment(
                current.id,
                { assignmentStatus: AssignmentStatus.FAILED },
                current.version,
                actorId,
              );
              return fail(
                ConfigurationErrorCode.CHECKSUM_MISMATCH,
                'appliedChecksum does not match desiredConfig checksum',
              );
            }
          }

          const bv = await deps.repo.getBundleVersion(
            current.bundleId,
            current.bundleVersion,
          );
          if (!bv || bv.checksum !== current.bundleChecksum) {
            return fail(
              ConfigurationErrorCode.CHECKSUM_MISMATCH,
              'Bundle checksum verification failed',
            );
          }

          const updated = await deps.repo.updateAssignment(
            current.id,
            {
              assignmentStatus: AssignmentStatus.DEPLOYED,
              driftStatus: ConfigurationDriftStatus.NONE,
              lastDeployedAt: new Date(),
            },
            current.version,
            actorId,
          );

          await recordEvidence(
            current.id,
            current.tenantId,
            input,
            key,
            'SUCCEEDED',
            {
              status: AssignmentStatus.DEPLOYED,
              appliedChecksum: updated.appliedChecksum,
              bundleChecksum: updated.bundleChecksum,
            },
            startedAt,
          );
          return ok({ assignmentId: current.id, status: AssignmentStatus.DEPLOYED });
        }

        case 'configuration.rollback_bundle': {
          const denied = await gateMutation(input, assignment, key);
          if (denied) {
            const denyMessage =
              denied.status === 'FAILED' && 'message' in denied
                ? String(denied.message ?? 'Authorization denied for rollback')
                : 'Authorization denied for rollback';
            return fail(ConfigurationErrorCode.ROLLBACK_FORBIDDEN, denyMessage);
          }

          const current = await deps.repo.getAssignment(assignment.id);
          if (!current) {
            return fail(ConfigurationErrorCode.VALIDATION, 'Assignment missing');
          }
          const meta = current.metadata ?? {};
          const prevApplied = meta.prevApplied;
          if (!prevApplied || typeof prevApplied !== 'object') {
            await recordEvidence(
              current.id,
              current.tenantId,
              input,
              key,
              'FAILED',
              { reason: 'prevApplied missing' },
              startedAt,
              {
                code: ConfigurationErrorCode.ROLLBACK_FORBIDDEN,
                message: 'No previous applied config to restore',
              },
            );
            return fail(
              ConfigurationErrorCode.ROLLBACK_FORBIDDEN,
              'No previous applied config (metadata.prevApplied) to restore',
            );
          }
          const prevChecksum =
            typeof meta.prevChecksum === 'string'
              ? meta.prevChecksum
              : checksumPayload(prevApplied);

          const updated = await deps.repo.updateAssignment(
            current.id,
            {
              appliedConfig: prevApplied as Record<string, unknown>,
              appliedChecksum: prevChecksum,
              assignmentStatus: AssignmentStatus.ROLLED_BACK,
              lastDeployedAt: new Date(),
            },
            current.version,
            actorId,
          );

          await deps.repo.createDeploymentRun({
            assignmentId: current.id,
            tenantId: current.tenantId,
            productId: current.productId,
            operation: DeploymentOperation.ROLLBACK,
            strategy: String(current.deploymentStrategy),
            workflowId: input.workflowId ?? null,
            fromBundleVersion: current.bundleVersion,
            toBundleVersion: null,
            outcome: DeploymentRunOutcome.ROLLED_BACK,
            errorCode: null,
            errorMessage: null,
            observedState: { appliedChecksum: prevChecksum },
            evidence: redactConfigurationSecrets({ rolledBack: true }),
            startedAt: new Date(startedAt),
            finishedAt: new Date(),
            performedBy: actorId,
            correlationId: input.correlationId ?? null,
          });

          await recordEvidence(
            current.id,
            current.tenantId,
            input,
            key,
            'SUCCEEDED',
            { status: AssignmentStatus.ROLLED_BACK, appliedChecksum: updated.appliedChecksum },
            startedAt,
          );
          return ok({ assignmentId: current.id, status: AssignmentStatus.ROLLED_BACK });
        }

        case 'configuration.reconcile_entitlements': {
          const denied = await gateMutation(input, assignment, key);
          if (denied) return denied;

          const current = await deps.repo.getAssignment(assignment.id);
          if (!current) {
            return fail(ConfigurationErrorCode.VALIDATION, 'Assignment missing');
          }
          const desiredChecksum = checksumPayload(current.desiredConfig);
          const appliedChecksum =
            current.appliedChecksum ?? checksumPayload(current.appliedConfig);
          const drifted = desiredChecksum !== appliedChecksum;
          const driftStatus = drifted
            ? ConfigurationDriftStatus.DETECTED
            : ConfigurationDriftStatus.NONE;

          await deps.repo.updateAssignment(
            current.id,
            {
              driftStatus,
              lastReconciledAt: new Date(),
            },
            current.version,
            actorId,
          );

          await deps.repo.createDeploymentRun({
            assignmentId: current.id,
            tenantId: current.tenantId,
            productId: current.productId,
            operation: DeploymentOperation.RECONCILE,
            strategy: String(current.deploymentStrategy),
            workflowId: input.workflowId ?? null,
            fromBundleVersion: current.bundleVersion,
            toBundleVersion: current.bundleVersion,
            outcome: drifted ? DeploymentRunOutcome.PARTIAL : DeploymentRunOutcome.SUCCEEDED,
            errorCode: drifted ? ConfigurationErrorCode.DRIFT_DETECTED : null,
            errorMessage: drifted ? 'Applied config drifted from desired' : null,
            observedState: { desiredChecksum, appliedChecksum, drifted },
            evidence: {},
            startedAt: new Date(startedAt),
            finishedAt: new Date(),
            performedBy: actorId,
            correlationId: input.correlationId ?? null,
          });

          await recordEvidence(
            current.id,
            current.tenantId,
            input,
            key,
            drifted ? 'PARTIAL' : 'SUCCEEDED',
            { drifted, driftStatus, desiredChecksum, appliedChecksum },
            startedAt,
          );
          return ok({ drifted, driftStatus, assignmentId: current.id });
        }

        default:
          return fail(ConfigurationErrorCode.VALIDATION, `Unknown handler key: ${key as string}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        await recordEvidence(
          assignment.id,
          assignment.tenantId,
          input,
          key,
          'FAILED',
          { error: message },
          startedAt,
          { code: ConfigurationErrorCode.PROVIDER_UNAVAILABLE, message },
        );
      } catch {
        // evidence failure already surfaced below
      }
      return fail(ConfigurationErrorCode.PROVIDER_UNAVAILABLE, message, true);
    }
  };
}

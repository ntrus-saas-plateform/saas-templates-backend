import type {
  ConfigureDatabaseBackupUseCase,
  ConfigureDatabaseSecurityUseCase,
  CreateDatabaseCredentialsUseCase,
  DeprovisionResourceUseCase,
  ProvisionComputeUseCase,
  ProvisionDatabaseUseCase,
  ProvisionNetworkUseCase,
  ProvisionStorageUseCase,
  ReconcileResourceUseCase,
  ValidateResourcePlanUseCase,
  VerifyBackupPolicyUseCase,
  VerifyDatabaseConnectivityUseCase,
  VerifyDatabaseIsolationUseCase,
  VerifyResourcesUseCase,
} from '../../application/infrastructure-provisioning/infrastructure.use-cases.js';
import type { InfrastructureLiveExecutor } from '../../domain/infrastructure-provisioning/infrastructure-handlers.js';
import {
  InfrastructureErrorCode,
  type InfrastructureHandlerKey,
} from '../../domain/infrastructure-provisioning/infrastructure.types.js';
import type { WorkflowAuthorizationPort } from '../../domain/workflow/workflow-authorization.port.js';
import type { WorkflowLeasePort } from '../../domain/workflow/workflow-lease.port.js';
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

function intOf(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) return Number(v.trim());
  return null;
}

function fail(message: string, code = InfrastructureErrorCode.VALIDATION): WorkflowHandlerOutcome {
  return { status: 'FAILED', errorClass: code, message, retryable: false };
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Bridges P7.4 workflow handlers → P7.6 infrastructure / database use cases.
 *
 * AUD-P0-01 / AUD-P0-02 remediations:
 *  - Canonical P7.1 revalidation before every mutation (snapshot flags never authorize).
 *  - Authoritative P7.4 lease/fencing before every mutation (fail-closed if unwired).
 */
export function createLiveInfrastructureExecutor(deps: {
  validatePlan: ValidateResourcePlanUseCase;
  provisionNetwork: ProvisionNetworkUseCase;
  provisionCompute: ProvisionComputeUseCase;
  provisionStorage: ProvisionStorageUseCase;
  verifyResources: VerifyResourcesUseCase;
  provisionDatabase: ProvisionDatabaseUseCase;
  configureSecurity: ConfigureDatabaseSecurityUseCase;
  createCredentials: CreateDatabaseCredentialsUseCase;
  verifyConnectivity: VerifyDatabaseConnectivityUseCase;
  verifyIsolation: VerifyDatabaseIsolationUseCase;
  configureBackup: ConfigureDatabaseBackupUseCase;
  verifyBackupPolicy: VerifyBackupPolicyUseCase;
  reconcile: ReconcileResourceUseCase;
  deprovision: DeprovisionResourceUseCase;
  authorization: WorkflowAuthorizationPort;
  lease: WorkflowLeasePort;
}): InfrastructureLiveExecutor {
  const validateLease = async (input: WorkflowHandlerInput) => {
    if (!deps.lease) {
      return { valid: false as const, reason: 'DEPENDENCY_UNAVAILABLE', detail: 'lease port not wired' };
    }
    if (!Number.isInteger(input.fencingToken) || input.fencingToken < 1) {
      return {
        valid: false as const,
        reason: 'MISSING_TOKEN',
        detail: 'fencingToken must be a positive integer issued by the engine',
      };
    }
    if (!input.workflowId || !input.stepId || !input.workerId) {
      return { valid: false as const, reason: 'STEP_NOT_FOUND', detail: 'claim identity incomplete' };
    }
    try {
      return await deps.lease.validateLease({
        workflowId: input.workflowId,
        stepId: input.stepId,
        workerId: input.workerId,
        fencingToken: input.fencingToken,
      });
    } catch {
      return { valid: false as const, reason: 'DEPENDENCY_UNAVAILABLE', detail: 'lease validation failed' };
    }
  };

  const revalidateAuthorization = async (
    s: Record<string, unknown>,
  ): Promise<{ allowed: true } | { allowed: false; reason: string }> => {
    if (!deps.authorization) {
      return { allowed: false, reason: 'AUTHORIZATION_PORT_MISSING' };
    }
    // Snapshot flags can only DENY — never authorize.
    if (s.authorizationValid === false) {
      return { allowed: false, reason: 'SNAPSHOT_AUTHORIZATION_INVALID' };
    }
    if (s.authorizationExpired === true) {
      return { allowed: false, reason: 'SNAPSHOT_AUTHORIZATION_EXPIRED' };
    }
    if (s.authorizationRevoked === true) {
      return { allowed: false, reason: 'SNAPSHOT_AUTHORIZATION_REVOKED' };
    }

    const rowId = str(s.authorizationRowId) ?? str(s.authorizationId) ?? null;
    const version = intOf(s.authorizationVersion);
    const provisioningRequestId = str(s.provisioningRequestId) ?? null;

    if (!rowId || version == null || version < 1) {
      return { allowed: false, reason: 'AUTHORIZATION_REFERENCE_MISSING' };
    }

    try {
      const view = await withTimeout(
        deps.authorization.revalidateBoundAuthorization({
          authorizationRowId: rowId,
          authorizationVersion: version,
          provisioningRequestId,
        }),
        AUTHORIZATION_TIMEOUT_MS,
        'P7.1 authorization revalidation',
      );
      if (!view) {
        return { allowed: false, reason: 'AUTHORIZATION_INVALID' };
      }
      if (view.authorizationRowId !== rowId || view.authorizationVersion !== version) {
        return { allowed: false, reason: 'AUTHORIZATION_IDENTITY_MISMATCH' };
      }
      return { allowed: true };
    } catch {
      return { allowed: false, reason: 'AUTHORIZATION_TIMEOUT' };
    }
  };

  const gateMutation = async (
    input: WorkflowHandlerInput,
    operation: string,
  ): Promise<WorkflowHandlerOutcome | null> => {
    const leaseCheck = await validateLease(input);
    if (!leaseCheck.valid) {
      return fail(
        `P7.4 fencing/lease rejected (${operation}): ${leaseCheck.reason}${
          leaseCheck.detail ? ` (${leaseCheck.detail})` : ''
        }`,
        InfrastructureErrorCode.AUTHORIZATION_FAILED,
      );
    }

    const auth = await revalidateAuthorization(snap(input));
    if (!auth.allowed) {
      return fail(
        `P7.1 authorization rejected (${operation}): ${auth.reason}`,
        InfrastructureErrorCode.AUTHORIZATION_FAILED,
      );
    }
    return null;
  };

  return async (input, key: InfrastructureHandlerKey): Promise<WorkflowHandlerOutcome> => {
    const s = snap(input);
    const actorId = str(s.actorId) ?? input.workerId;
    const correlationId = input.correlationId;
    const planId = str(s.planId);
    const databaseResourceId = str(s.databaseResourceId);
    const resourceId = str(s.resourceId);

    try {
      const denied = await gateMutation(input, key);
      if (denied) return denied;

      switch (key) {
        case 'infrastructure.validate_plan': {
          if (!planId) return fail('planId required');
          // AUD-P0-01: plan context flags are derived from live revalidation outcome,
          // never from client/worker snapshot trust.
          const result = await deps.validatePlan.execute({
            planId,
            actorId,
            correlationId,
            context: {
              authorizationValid: true,
              authorizationExpired: false,
              authorizationRevoked: false,
              placementValid: s.placementValid === true,
              reservationValid: s.reservationValid === true,
              reservationCommitted: s.reservationCommitted === true,
              tlsRequiredByProfile: true,
              privateNetworkRequired: true,
            },
          });
          if (!result.validation.valid) {
            return fail('Plan validation failed', InfrastructureErrorCode.PLAN_INCOMPATIBLE);
          }
          return { status: 'SUCCEEDED', outputSnapshot: { planId, status: result.plan.status } };
        }
        case 'infrastructure.provision_network': {
          if (!planId) return fail('planId required');
          const r = await deps.provisionNetwork.execute({ planId, actorId, correlationId });
          return { status: 'SUCCEEDED', outputSnapshot: { resourceId: r.id } };
        }
        case 'infrastructure.provision_storage': {
          if (!planId) return fail('planId required');
          const r = await deps.provisionStorage.execute({ planId, actorId, correlationId });
          return { status: 'SUCCEEDED', outputSnapshot: { resourceId: r.id } };
        }
        case 'infrastructure.provision_compute': {
          if (!planId) return fail('planId required');
          const r = await deps.provisionCompute.execute({ planId, actorId, correlationId });
          return { status: 'SUCCEEDED', outputSnapshot: r as Record<string, unknown> };
        }
        case 'infrastructure.verify_resources': {
          if (!planId) return fail('planId required');
          const r = await deps.verifyResources.execute({ planId, actorId });
          return { status: 'SUCCEEDED', outputSnapshot: r };
        }
        case 'database.provision': {
          if (!planId) return fail('planId required');
          const r = await deps.provisionDatabase.execute({ planId, actorId, correlationId });
          return {
            status: 'SUCCEEDED',
            outputSnapshot: {
              databaseResourceId: r.database.id,
              resourceId: r.resource.id,
            },
          };
        }
        case 'database.configure_security': {
          if (!databaseResourceId) return fail('databaseResourceId required');
          const r = await deps.configureSecurity.execute({
            databaseResourceId,
            actorId,
            correlationId,
          });
          return { status: 'SUCCEEDED', outputSnapshot: { databaseResourceId: r.id } };
        }
        case 'database.create_credentials': {
          if (!databaseResourceId) return fail('databaseResourceId required');
          const r = await deps.createCredentials.execute({
            databaseResourceId,
            actorId,
            correlationId,
          });
          return {
            status: 'SUCCEEDED',
            outputSnapshot: { databaseResourceId: r.database.id, credentialRef: r.credentialRef },
          };
        }
        case 'database.verify_connectivity': {
          if (!databaseResourceId) return fail('databaseResourceId required');
          const r = await deps.verifyConnectivity.execute({
            databaseResourceId,
            actorId,
            correlationId,
          });
          if (!r.connectivityVerified) {
            return fail('Connectivity verification failed', InfrastructureErrorCode.CONNECTIVITY_FAILED);
          }
          return { status: 'SUCCEEDED', outputSnapshot: { databaseResourceId: r.id } };
        }
        case 'database.verify_isolation': {
          if (!databaseResourceId) return fail('databaseResourceId required');
          const r = await deps.verifyIsolation.execute({
            databaseResourceId,
            actorId,
            correlationId,
            foreignDatabaseName: str(s.foreignDatabaseName),
          });
          return { status: 'SUCCEEDED', outputSnapshot: { databaseResourceId: r.id, status: r.status } };
        }
        case 'database.configure_backup': {
          if (!databaseResourceId) return fail('databaseResourceId required');
          const r = await deps.configureBackup.execute({
            databaseResourceId,
            actorId,
            correlationId,
          });
          return { status: 'SUCCEEDED', outputSnapshot: { backupId: r.id } };
        }
        case 'database.verify_backup_policy': {
          if (!databaseResourceId) return fail('databaseResourceId required');
          const r = await deps.verifyBackupPolicy.execute({ databaseResourceId, actorId });
          return { status: 'SUCCEEDED', outputSnapshot: r };
        }
        case 'resource.reconcile': {
          if (!resourceId) return fail('resourceId required');
          const r = await deps.reconcile.execute({ resourceId, actorId, correlationId });
          return {
            status: 'SUCCEEDED',
            outputSnapshot: { drifted: r.drifted, reconciliationId: r.reconciliationId },
          };
        }
        case 'resource.deprovision': {
          if (!resourceId) return fail('resourceId required');
          const r = await deps.deprovision.execute({
            resourceId,
            actorId,
            correlationId,
            authorized: s.deprovisionAuthorized === true,
            confirmed: s.deprovisionConfirmed === true,
          });
          if (r.suspended) {
            return {
              status: 'WAITING_APPROVAL',
              instructions: r.assessment.reason,
              requiredPermission: 'platform:infrastructure:deprovision',
            };
          }
          return { status: 'SUCCEEDED', outputSnapshot: { resourceId: r.resource.id } };
        }
        default:
          return fail(`Unhandled handler ${key}`, InfrastructureErrorCode.OPERATION_NOT_IMPLEMENTED);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: 'FAILED',
        errorClass: InfrastructureErrorCode.DEPENDENCY_UNAVAILABLE,
        message,
        retryable: false,
        diagnostics: { handlerKey: key },
      };
    }
  };
}

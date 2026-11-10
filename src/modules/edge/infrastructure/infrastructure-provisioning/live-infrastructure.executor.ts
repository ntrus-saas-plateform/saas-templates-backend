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
import type {
  WorkflowHandlerInput,
  WorkflowHandlerOutcome,
} from '../../domain/workflow/workflow-handler.port.js';

function snap(input: WorkflowHandlerInput): Record<string, unknown> {
  return { ...input.workflowInput, ...input.inputSnapshot, ...(input.executionContext ?? {}) };
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}

function fail(message: string, code = InfrastructureErrorCode.VALIDATION): WorkflowHandlerOutcome {
  return { status: 'FAILED', errorClass: code, message, retryable: false };
}

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
}): InfrastructureLiveExecutor {
  return async (input, key: InfrastructureHandlerKey): Promise<WorkflowHandlerOutcome> => {
    const s = snap(input);
    const actorId = str(s.actorId) ?? input.workerId;
    const correlationId = input.correlationId;
    const planId = str(s.planId);
    const databaseResourceId = str(s.databaseResourceId);
    const resourceId = str(s.resourceId);

    try {
      switch (key) {
        case 'infrastructure.validate_plan': {
          if (!planId) return fail('planId required');
          const result = await deps.validatePlan.execute({
            planId,
            actorId,
            correlationId,
            context: {
              authorizationValid: s.authorizationValid !== false,
              authorizationExpired: s.authorizationExpired === true,
              authorizationRevoked: s.authorizationRevoked === true,
              placementValid: s.placementValid !== false,
              reservationValid: s.reservationValid !== false,
              reservationCommitted: s.reservationCommitted !== false,
              tlsRequiredByProfile: true,
              privateNetworkRequired: true,
            },
          });
          if (!result.validation.valid) {
            return fail(
              'Plan validation failed',
              InfrastructureErrorCode.PLAN_INCOMPATIBLE,
            );
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

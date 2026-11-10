import { createHash } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  DatabaseEngine,
  DatabaseTopology,
  InfrastructureErrorCode,
  ResourcePlanStatus,
  type ProviderCapabilities,
  type ResourcePlanRecord,
} from './infrastructure.types.js';

export type ResourcePlanInput = {
  tenantId: string;
  productId: string;
  subscriptionId?: string | null;
  authorizationId?: string | null;
  authorizationVersion?: number | null;
  placementDecisionId?: string | null;
  reservationId?: string | null;
  providerId: string;
  region: string;
  availabilityZone?: string | null;
  deploymentProfileId?: string | null;
  deploymentProfileVersion?: number | null;
  runtimeProfileId?: string | null;
  databaseEngine: DatabaseEngine;
  databaseTopology?: DatabaseTopology;
  computeRequirements?: Record<string, unknown>;
  storageRequirements?: Record<string, unknown>;
  networkRequirements?: Record<string, unknown>;
  backupPolicy?: Record<string, unknown>;
  encryptionPolicy?: Record<string, unknown>;
  retentionPolicy?: Record<string, unknown>;
  estimatedCapacity?: Record<string, unknown>;
  resourceDependencies?: unknown[];
  securityClassification?: string;
  metadata?: Record<string, unknown>;
};

export function computePlanFingerprint(input: ResourcePlanInput): string {
  const canonical = {
    tenantId: input.tenantId,
    productId: input.productId,
    subscriptionId: input.subscriptionId ?? null,
    authorizationId: input.authorizationId ?? null,
    authorizationVersion: input.authorizationVersion ?? null,
    placementDecisionId: input.placementDecisionId ?? null,
    reservationId: input.reservationId ?? null,
    providerId: input.providerId,
    region: input.region,
    availabilityZone: input.availabilityZone ?? null,
    deploymentProfileId: input.deploymentProfileId ?? null,
    deploymentProfileVersion: input.deploymentProfileVersion ?? null,
    runtimeProfileId: input.runtimeProfileId ?? null,
    databaseEngine: input.databaseEngine,
    databaseTopology: input.databaseTopology ?? DatabaseTopology.DEDICATED_DATABASE,
    computeRequirements: input.computeRequirements ?? {},
    storageRequirements: input.storageRequirements ?? {},
    networkRequirements: input.networkRequirements ?? {},
    backupPolicy: input.backupPolicy ?? {},
    encryptionPolicy: input.encryptionPolicy ?? {},
    retentionPolicy: input.retentionPolicy ?? {},
    estimatedCapacity: input.estimatedCapacity ?? {},
    resourceDependencies: input.resourceDependencies ?? [],
    securityClassification: input.securityClassification ?? 'INTERNAL',
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export type PlanValidationContext = {
  authorizationValid: boolean;
  authorizationExpired: boolean;
  authorizationRevoked: boolean;
  placementValid: boolean;
  reservationValid: boolean;
  reservationCommitted: boolean;
  providerActive: boolean;
  providerCapabilities: ProviderCapabilities;
  providerRegions: string[];
  providerEngines: string[];
  tlsRequiredByProfile: boolean;
  privateNetworkRequired: boolean;
};

export type PlanValidationResult = {
  valid: boolean;
  errors: Array<{ code: InfrastructureErrorCode; message: string }>;
};

export function validateResourcePlan(
  plan: Pick<
    ResourcePlanRecord,
    | 'tenantId'
    | 'productId'
    | 'providerId'
    | 'region'
    | 'databaseEngine'
    | 'databaseTopology'
    | 'encryptionPolicy'
    | 'networkRequirements'
    | 'backupPolicy'
    | 'authorizationId'
    | 'placementDecisionId'
    | 'reservationId'
  >,
  ctx: PlanValidationContext,
): PlanValidationResult {
  const errors: PlanValidationResult['errors'] = [];

  if (!plan.tenantId?.trim() || !plan.productId?.trim()) {
    errors.push({
      code: InfrastructureErrorCode.VALIDATION,
      message: 'tenantId and productId are required',
    });
  }
  if (!plan.authorizationId) {
    errors.push({
      code: InfrastructureErrorCode.AUTHORIZATION_FAILED,
      message: 'P7.1 authorizationId is required',
    });
  }
  if (ctx.authorizationRevoked) {
    errors.push({
      code: InfrastructureErrorCode.AUTHORIZATION_REVOKED,
      message: 'Provisioning authorization is revoked',
    });
  }
  if (ctx.authorizationExpired) {
    errors.push({
      code: InfrastructureErrorCode.AUTHORIZATION_EXPIRED,
      message: 'Provisioning authorization is expired',
    });
  }
  if (!ctx.authorizationValid) {
    errors.push({
      code: InfrastructureErrorCode.AUTHORIZATION_FAILED,
      message: 'Provisioning authorization is not valid',
    });
  }
  if (!plan.placementDecisionId || !ctx.placementValid) {
    errors.push({
      code: InfrastructureErrorCode.PLACEMENT_INVALID,
      message: 'P7.3 placement decision missing or invalid',
    });
  }
  if (!plan.reservationId || !ctx.reservationValid || !ctx.reservationCommitted) {
    errors.push({
      code: InfrastructureErrorCode.RESERVATION_INVALID,
      message: 'P7.3 capacity reservation missing, invalid, or not committed',
    });
  }
  if (!ctx.providerActive) {
    errors.push({
      code: InfrastructureErrorCode.PROVIDER_UNAVAILABLE,
      message: 'Infrastructure provider is not operational',
    });
  }
  if (!ctx.providerRegions.includes(plan.region)) {
    errors.push({
      code: InfrastructureErrorCode.CAPABILITY_UNSUPPORTED,
      message: `Region ${plan.region} not supported by provider`,
    });
  }
  if (!ctx.providerEngines.includes(plan.databaseEngine)) {
    errors.push({
      code: InfrastructureErrorCode.CAPABILITY_UNSUPPORTED,
      message: `Database engine ${plan.databaseEngine} not supported by provider`,
    });
  }
  if (plan.databaseTopology !== DatabaseTopology.DEDICATED_DATABASE) {
    // Shared DB topologies are out of scope for dedicated-isolation profiles in P7.6.
    if (plan.databaseTopology === DatabaseTopology.DEDICATED_SCHEMA) {
      errors.push({
        code: InfrastructureErrorCode.PLAN_INCOMPATIBLE,
        message: 'DEDICATED_SCHEMA is not allowed when dedicated database isolation is required',
      });
    }
  }
  if (ctx.tlsRequiredByProfile || ctx.providerCapabilities.tlsRequired) {
    const enc = plan.encryptionPolicy ?? {};
    if (enc.tls !== true && enc.requireTls !== true) {
      errors.push({
        code: InfrastructureErrorCode.TLS_VALIDATION_FAILED,
        message: 'TLS is mandatory for this deployment profile / provider',
      });
    }
  }
  if (ctx.privateNetworkRequired || ctx.providerCapabilities.privateNetworking) {
    const net = plan.networkRequirements ?? {};
    if (net.mode === 'PUBLIC' || net.publicEndpoint === true) {
      errors.push({
        code: InfrastructureErrorCode.VALIDATION,
        message: 'Public database endpoints are forbidden by default',
      });
    }
  }
  if (ctx.providerCapabilities.backup) {
    const bp = plan.backupPolicy ?? {};
    if (!bp.schedule && !bp.enabled) {
      errors.push({
        code: InfrastructureErrorCode.VALIDATION,
        message: 'Backup policy required when provider supports backups',
      });
    }
  }
  if (!Object.values(DatabaseEngine).includes(plan.databaseEngine)) {
    errors.push({
      code: InfrastructureErrorCode.VALIDATION,
      message: `Unknown database engine ${plan.databaseEngine}`,
    });
  }

  return { valid: errors.length === 0, errors };
}

export function assertPlanMutable(status: ResourcePlanStatus): void {
  if (
    status === ResourcePlanStatus.COMMITTED ||
    status === ResourcePlanStatus.SUPERSEDED ||
    status === ResourcePlanStatus.CANCELLED
  ) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Resource plan status ${status} is immutable; create a new version`,
      [{ code: InfrastructureErrorCode.PLAN_INCOMPATIBLE, status }],
    );
  }
}

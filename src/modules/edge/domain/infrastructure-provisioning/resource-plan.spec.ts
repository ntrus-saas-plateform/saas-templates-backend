import { describe, expect, it } from 'vitest';
import {
  computePlanFingerprint,
  validateResourcePlan,
} from './resource-plan.js';
import {
  DatabaseEngine,
  DatabaseTopology,
  InfrastructureErrorCode,
} from './infrastructure.types.js';

const basePlan = {
  tenantId: 't1',
  productId: 'p1',
  providerId: 'prov1',
  region: 'local',
  databaseEngine: DatabaseEngine.POSTGRESQL,
  databaseTopology: DatabaseTopology.DEDICATED_DATABASE,
  encryptionPolicy: { tls: true },
  networkRequirements: { mode: 'PRIVATE' },
  backupPolicy: { enabled: true, schedule: 'daily' },
  authorizationId: 'auth-1',
  placementDecisionId: 'place-1',
  reservationId: 'res-1',
};

const okCtx = {
  authorizationValid: true,
  authorizationExpired: false,
  authorizationRevoked: false,
  placementValid: true,
  reservationValid: true,
  reservationCommitted: true,
  providerActive: true,
  providerCapabilities: {
    encryption: true,
    backup: true,
    restore: true,
    highAvailability: false,
    privateNetworking: true,
    tlsRequired: true,
    operations: ['validate_plan', 'provision_database'],
  },
  providerRegions: ['local'],
  providerEngines: ['POSTGRESQL', 'MONGODB', 'SURREALDB'],
  tlsRequiredByProfile: true,
  privateNetworkRequired: true,
};

describe('resource-plan', () => {
  it('computes stable fingerprint', () => {
    const a = computePlanFingerprint({
      tenantId: 't1',
      productId: 'p1',
      providerId: 'prov1',
      region: 'local',
      databaseEngine: DatabaseEngine.POSTGRESQL,
    });
    const b = computePlanFingerprint({
      tenantId: 't1',
      productId: 'p1',
      providerId: 'prov1',
      region: 'local',
      databaseEngine: DatabaseEngine.POSTGRESQL,
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('validates a complete plan', () => {
    const result = validateResourcePlan(basePlan, okCtx);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects revoked authorization', () => {
    const result = validateResourcePlan(basePlan, {
      ...okCtx,
      authorizationRevoked: true,
      authorizationValid: false,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === InfrastructureErrorCode.AUTHORIZATION_REVOKED)).toBe(
      true,
    );
  });

  it('rejects public network endpoint', () => {
    const result = validateResourcePlan(
      { ...basePlan, networkRequirements: { mode: 'PUBLIC', publicEndpoint: true } },
      okCtx,
    );
    expect(result.valid).toBe(false);
  });

  it('rejects missing reservation', () => {
    const result = validateResourcePlan(
      { ...basePlan, reservationId: null },
      { ...okCtx, reservationValid: false, reservationCommitted: false },
    );
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.code === InfrastructureErrorCode.RESERVATION_INVALID),
    ).toBe(true);
  });
});

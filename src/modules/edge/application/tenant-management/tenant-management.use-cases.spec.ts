import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import type { TenantManagementRepositoryPort } from '../../domain/tenant-management/tenant-management-repository.port.js';
import {
  AdministrativeStatus,
  GovernanceStatus,
  HealthStatus,
  RiskLevel,
} from '../../domain/tenant-management/tenant-management.types.js';
import {
  EvaluateTenantRiskUseCase,
  ExecuteBulkOperationUseCase,
  RecordHealthSnapshotUseCase,
} from './tenant-management.use-cases.js';

function baseTenant() {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    productTenantId: '22222222-2222-4222-8222-222222222222',
    tenantCode: 'tn-demo',
    tenantSlug: 'tn-demo',
    displayName: 'Demo',
    legalNameRef: null,
    productId: '33333333-3333-4333-8333-333333333333',
    productCode: null,
    accountId: null,
    subscriptionId: null,
    classification: 'STANDARD',
    segment: null,
    deploymentProfile: null,
    environmentClassification: 'PRODUCTION',
    region: null,
    administrativeStatus: AdministrativeStatus.ACTIVE,
    technicalStatus: 'UNKNOWN',
    governanceStatus: GovernanceStatus.COMPLIANT,
    healthStatus: HealthStatus.UNKNOWN,
    riskLevel: RiskLevel.UNKNOWN,
    platformTenantRef: null,
    provisioningRequestId: null,
    activationRecordId: null,
    lifecycleRecordId: null,
    internalOwnerId: null,
    operationalTeam: null,
    supportClassification: null,
    locale: null,
    timezone: null,
    defaultLanguage: null,
    dataResidencyRef: null,
    retentionPolicyRef: null,
    securityPolicyRef: null,
    legalHold: false,
    deletionProtection: true,
    lastAdminActivityAt: null,
    lastSyncedAt: null,
    technicalObservedAt: null,
    healthObservedAt: null,
    metadata: {},
    createdBy: 'actor',
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  };
}

describe('P8 tenant-management use cases', () => {
  it('RecordHealthSnapshotUseCase coerces stale HEALTHY to STALE', async () => {
    const tenant = baseTenant();
    const repo = {
      getById: vi.fn().mockResolvedValue(tenant),
      createHealthSnapshot: vi.fn().mockImplementation(async (input) => ({
        id: 'snap-1',
        ...input,
        createdAt: new Date(),
      })),
      updateTenantHealthFromSnapshot: vi.fn().mockResolvedValue({
        ...tenant,
        healthStatus: HealthStatus.STALE,
      }),
    } as unknown as TenantManagementRepositoryPort;

    const outbox = {
      runWithOutbox: vi.fn(async (_t, fn) => fn({}, vi.fn())),
    };
    const audit = { create: vi.fn() };

    const uc = new RecordHealthSnapshotUseCase(repo, outbox as never, audit as never);
    const old = new Date(Date.now() - 60 * 60 * 1000);
    await uc.execute({
      actorId: 'approver-b',
      tenantRegistryId: tenant.id,
      overallStatus: HealthStatus.HEALTHY,
      indicators: {},
      sourceSystem: 'test',
      observedAt: old,
    });

    expect(repo.createHealthSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ overallStatus: HealthStatus.STALE }),
      expect.anything(),
    );
  });

  it('EvaluateTenantRiskUseCase applies legal hold rule', async () => {
    const tenant = { ...baseTenant(), legalHold: true };
    const repo = {
      getById: vi.fn().mockResolvedValue(tenant),
      countActiveExceptions: vi.fn().mockResolvedValue(0),
      listFindings: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      createRiskAssessment: vi.fn().mockImplementation(async (input) => ({
        id: 'risk-1',
        evaluatedAt: new Date(),
        createdAt: new Date(),
        ...input,
      })),
      updateTenantRiskLevel: vi.fn().mockResolvedValue({ ...tenant, riskLevel: RiskLevel.HIGH }),
    } as unknown as TenantManagementRepositoryPort;

    const outbox = {
      runWithOutbox: vi.fn(async (_t, fn) => fn({}, vi.fn())),
    };
    const audit = { create: vi.fn() };

    const uc = new EvaluateTenantRiskUseCase(repo, outbox as never, audit as never);
    const result = await uc.execute({ actorId: 'analyst', tenantRegistryId: tenant.id });
    expect(result.riskLevel).toBe(RiskLevel.HIGH);
    expect(result.ruleVersion).toBe('p8-risk-v1');
  });

  it('ExecuteBulkOperationUseCase enforces SoD for sensitive bulk', async () => {
    const repo = {
      getBulkOperation: vi.fn().mockResolvedValue({
        id: 'bulk-1',
        operationType: 'ASSIGN',
        status: 'PREVIEW',
        previewCount: 1,
        filter: {},
        payload: { internalOwnerId: 'owner-1' },
        results: [],
        requestedBy: 'requester-a',
        approverId: null,
        correlationId: null,
        idempotencyKey: 'key',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      search: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      updateBulkOperation: vi.fn(),
    } as unknown as TenantManagementRepositoryPort;

    const uc = new ExecuteBulkOperationUseCase(repo, {} as never, {} as never);
    await expect(
      uc.execute({
        actorId: 'requester-a',
        bulkOperationId: 'bulk-1',
        approverId: 'requester-a',
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import type { TenantManagementRepositoryPort } from '../../domain/tenant-management/tenant-management-repository.port.js';
import {
  AdministrativeStatus,
  GovernanceRequestStatus,
  GovernanceStatus,
  HealthStatus,
  LegalHoldChangeAction,
  LifecycleRequestType,
  RiskLevel,
} from '../../domain/tenant-management/tenant-management.types.js';
import type { TenantTechnicalLifecycleBridgePort } from '../../domain/tenant-management/tenant-technical-lifecycle-bridge.port.js';
import {
  ApproveLegalHoldChangeUseCase,
  ApproveLifecycleActionUseCase,
  RequestLegalHoldChangeUseCase,
  UpdateLegalHoldUseCase,
  EvaluateTenantRiskUseCase,
  ExecuteBulkOperationUseCase,
  RecordHealthSnapshotUseCase,
  RegisterTenantUseCase,
  RunReconciliationUseCase,
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
      sourceSystem: 'p7.monitor',
      observedAt: old,
    });

    expect(repo.createHealthSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ overallStatus: HealthStatus.STALE }),
      expect.anything(),
    );
  });

  it('RecordHealthSnapshotUseCase rejects untrusted HEALTHY source', async () => {
    const tenant = baseTenant();
    const repo = {
      getById: vi.fn().mockResolvedValue(tenant),
    } as unknown as TenantManagementRepositoryPort;

    const uc = new RecordHealthSnapshotUseCase(repo, {} as never, {} as never);
    await expect(
      uc.execute({
        actorId: 'admin',
        tenantRegistryId: tenant.id,
        overallStatus: HealthStatus.HEALTHY,
        indicators: {},
        sourceSystem: 'manual',
        observedAt: new Date(),
      }),
    ).rejects.toBeInstanceOf(DomainError);
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
        previewCount: 0,
        filter: {},
        payload: { frozenTenantIds: [] },
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
        expectedPreviewCount: 0,
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('ExecuteBulkOperationUseCase requires expectedPreviewCount to match preview', async () => {
    const repo = {
      getBulkOperation: vi.fn().mockResolvedValue({
        id: 'bulk-1',
        operationType: 'TAG',
        status: 'PREVIEW',
        previewCount: 2,
        filter: {},
        payload: { frozenTenantIds: ['a', 'b'], tagKey: 'env' },
        results: [],
        requestedBy: 'requester-a',
        approverId: null,
        correlationId: null,
        idempotencyKey: 'key',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      search: vi.fn().mockResolvedValue({
        items: [
          { id: 'a', version: 1 },
          { id: 'b', version: 1 },
        ],
        total: 2,
      }),
    } as unknown as TenantManagementRepositoryPort;

    const uc = new ExecuteBulkOperationUseCase(repo, {} as never, {} as never);
    await expect(
      uc.execute({
        actorId: 'executor-b',
        bulkOperationId: 'bulk-1',
        expectedPreviewCount: 3,
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('RegisterTenantUseCase preserves legalHold on re-register', async () => {
    const existing = { ...baseTenant(), legalHold: true, version: 4 };
    let upsertArg: { legalHold: boolean } | undefined;
    const repo = {
      getByProductTenantId: vi.fn().mockResolvedValue(existing),
      upsertByProductTenantId: vi.fn().mockImplementation(async (input) => {
        upsertArg = input;
        return { ...existing, ...input, displayName: input.displayName };
      }),
      appendActivity: vi.fn(),
    } as unknown as TenantManagementRepositoryPort;
    const outbox = {
      runWithOutbox: vi.fn(async (_t, fn) => fn({}, vi.fn())),
    };
    const audit = { create: vi.fn() };

    const uc = new RegisterTenantUseCase(repo, outbox as never, audit as never);
    await uc.execute({
      actorId: 'registrar',
      productTenantId: existing.productTenantId,
      tenantCode: existing.tenantCode,
      displayName: 'Updated display',
      productId: existing.productId,
    });

    expect(upsertArg?.legalHold).toBe(true);
  });

  it('RunReconciliationUseCase persists uppercase reconciliation mode', async () => {
    let capturedMode: string | undefined;
    const repo = {
      listDistinctProductTenantIdsFromP7: vi.fn().mockResolvedValue([]),
      listRegistryProductTenantIds: vi.fn().mockResolvedValue([]),
      createReconciliationRun: vi.fn().mockImplementation(async (input) => {
        capturedMode = input.mode;
        return { id: 'run-1', ...input };
      }),
      detectDuplicateRegistryRows: vi.fn().mockResolvedValue([]),
      detectDuplicateAccountProductRefs: vi.fn().mockResolvedValue([]),
      updateReconciliationRun: vi.fn(),
    } as unknown as TenantManagementRepositoryPort;

    const uc = new RunReconciliationUseCase(repo, {} as never, {} as never);
    await uc.execute({ actorId: 'reconciler', dryRun: true });

    expect(capturedMode).toBe('DRY_RUN');
  });

  it('ApproveLifecycleActionUseCase does not set SUSPENDED on SUSPEND approval', async () => {
    const tenant = { ...baseTenant(), administrativeStatus: AdministrativeStatus.ACTIVE };
    const request = {
      id: 'lr-1',
      tenantRegistryId: tenant.id,
      requestType: LifecycleRequestType.SUSPEND,
      status: GovernanceRequestStatus.WAITING_APPROVAL,
      requestedBy: 'requester-a',
      version: 1,
    };
    const updateTenant = vi.fn();
    const repo = {
      getLifecycleRequest: vi.fn().mockResolvedValue(request),
      getById: vi.fn().mockResolvedValue(tenant),
      updateTenant,
      updateLifecycleRequest: vi.fn().mockResolvedValue({
        ...request,
        status: GovernanceRequestStatus.APPROVED,
        result: { delegation: 'P7_PENDING' },
      }),
    } as unknown as TenantManagementRepositoryPort;
    const outbox = {
      runWithOutbox: vi.fn(async (_t, fn) => fn({}, vi.fn())),
    };
    const audit = { create: vi.fn() };

    const uc = new ApproveLifecycleActionUseCase(repo, outbox as never, audit as never);
    await uc.execute({ actorId: 'approver-b', requestId: request.id });

    expect(updateTenant).not.toHaveBeenCalled();
  });

  it('ApproveLifecycleActionUseCase delegates SUSPEND to P7 bridge when lifecycleRecordId present', async () => {
    const tenant = {
      ...baseTenant(),
      lifecycleRecordId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    };
    const request = {
      id: 'lr-bridge',
      tenantRegistryId: tenant.id,
      requestType: LifecycleRequestType.SUSPEND,
      status: GovernanceRequestStatus.WAITING_APPROVAL,
      requestedBy: 'requester-a',
      version: 1,
      justification: 'suspend justification text',
    };
    const bridge: TenantTechnicalLifecycleBridgePort = {
      requestSuspend: vi.fn().mockResolvedValue({
        workflowId: 'wf-999',
        outcome: 'STARTED',
      }),
      requestResume: vi.fn(),
      requestDeprovision: vi.fn(),
    };
    const repo = {
      getLifecycleRequest: vi.fn().mockResolvedValue(request),
      getById: vi.fn().mockResolvedValue(tenant),
      updateTenant: vi.fn(),
      updateLifecycleRequest: vi.fn().mockImplementation(async (_id, patch) => ({
        ...request,
        ...patch,
        status: GovernanceRequestStatus.APPROVED,
      })),
    } as unknown as TenantManagementRepositoryPort;
    const outbox = {
      runWithOutbox: vi.fn(async (_t, fn) => fn({}, vi.fn())),
    };
    const audit = { create: vi.fn() };

    const uc = new ApproveLifecycleActionUseCase(repo, outbox as never, audit as never, bridge);
    const updated = await uc.execute({ actorId: 'approver-b', requestId: request.id });

    expect(bridge.requestSuspend).toHaveBeenCalled();
    expect(updated.result).toMatchObject({
      delegation: 'P7_STARTED',
      p7Bridge: { outcome: 'STARTED', workflowId: 'wf-999' },
    });
  });

  it('UpdateLegalHoldUseCase blocks direct lift', async () => {
    const tenant = { ...baseTenant(), legalHold: true, version: 3 };
    const repo = {
      getById: vi.fn().mockResolvedValue(tenant),
    } as unknown as TenantManagementRepositoryPort;
    const uc = new UpdateLegalHoldUseCase(repo, {} as never, {} as never);
    await expect(
      uc.execute({
        actorId: 'admin',
        tenantRegistryId: tenant.id,
        expectedVersion: 3,
        legalHold: false,
        justification: 'attempt direct lift',
        legalHoldPermissionGranted: true,
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('ApproveLegalHoldChangeUseCase lifts hold with SoD', async () => {
    const tenant = { ...baseTenant(), legalHold: true, version: 2 };
    const request = {
      id: 'lh-approve',
      tenantRegistryId: tenant.id,
      action: LegalHoldChangeAction.LIFT,
      status: GovernanceRequestStatus.PENDING,
      requestedBy: 'requester-a',
      version: 1,
      justification: 'approved lift justification',
    };
    const repo = {
      getLegalHoldChangeRequest: vi.fn().mockResolvedValue(request),
      getById: vi.fn().mockResolvedValue(tenant),
      updateLegalHold: vi.fn().mockResolvedValue({ ...tenant, legalHold: false, version: 3 }),
      updateLegalHoldChangeRequest: vi.fn().mockResolvedValue({
        ...request,
        status: GovernanceRequestStatus.APPROVED,
      }),
    } as unknown as TenantManagementRepositoryPort;
    const outbox = {
      runWithOutbox: vi.fn(async (_t, fn) => fn({}, vi.fn())),
    };
    const audit = { create: vi.fn() };
    const uc = new ApproveLegalHoldChangeUseCase(repo, outbox as never, audit as never);
    await uc.execute({ actorId: 'approver-b', requestId: request.id });
    expect(repo.updateLegalHold).toHaveBeenCalledWith(
      tenant.id,
      false,
      tenant.version,
      'approver-b',
      expect.anything(),
    );
  });
});
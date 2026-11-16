import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../../src/core/domain/errors/domain-error.js';
import type { TenantManagementRepositoryPort } from '../../src/modules/edge/domain/tenant-management/tenant-management-repository.port.js';
import {
  AdministrativeStatus,
  GovernanceRequestStatus,
  HealthStatus,
  LegalHoldChangeAction,
  LifecycleRequestType,
} from '../../src/modules/edge/domain/tenant-management/tenant-management.types.js';
import {
  ApproveExceptionUseCase,
  ApproveLegalHoldChangeUseCase,
  ApproveLifecycleActionUseCase,
  ApproveMigrationUseCase,
  ExecuteBulkOperationUseCase,
  PreviewBulkOperationUseCase,
  RecordHealthSnapshotUseCase,
  RejectLegalHoldChangeUseCase,
  RequestLegalHoldChangeUseCase,
} from '../../src/modules/edge/application/tenant-management/tenant-management.use-cases.js';

const tenant = {
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
  governanceStatus: 'COMPLIANT',
  healthStatus: HealthStatus.UNKNOWN,
  riskLevel: 'UNKNOWN',
  platformTenantRef: null,
  provisioningRequestId: null,
  activationRecordId: null,
  lifecycleRecordId: '44444444-4444-4444-8444-444444444444',
  internalOwnerId: null,
  operationalTeam: null,
  supportClassification: null,
  locale: null,
  timezone: null,
  defaultLanguage: null,
  dataResidencyRef: null,
  retentionPolicyRef: null,
  securityPolicyRef: null,
  legalHold: true,
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
  version: 2,
};

describe('P8 tenant-management adversarial (E4-lite)', () => {
  it('blocks self-approval on lifecycle', async () => {
    const repo = {
      getLifecycleRequest: vi.fn().mockResolvedValue({
        id: 'lr-1',
        tenantRegistryId: tenant.id,
        requestType: LifecycleRequestType.SUSPEND,
        status: GovernanceRequestStatus.WAITING_APPROVAL,
        requestedBy: 'actor-a',
        version: 1,
        justification: 'test justification here',
      }),
      getById: vi.fn().mockResolvedValue({ ...tenant, legalHold: false }),
    } as unknown as TenantManagementRepositoryPort;
    const uc = new ApproveLifecycleActionUseCase(repo, {} as never, {} as never, null);
    await expect(uc.execute({ actorId: 'actor-a', requestId: 'lr-1' })).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it('blocks self-approval on exception', async () => {
    const repo = {
      getException: vi.fn().mockResolvedValue({
        id: 'ex-1',
        tenantRegistryId: tenant.id,
        status: 'REQUESTED',
        requesterId: 'actor-a',
        version: 1,
      }),
      getById: vi.fn().mockResolvedValue(tenant),
    } as unknown as TenantManagementRepositoryPort;
    const uc = new ApproveExceptionUseCase(repo, {} as never, {} as never);
    await expect(uc.execute({ actorId: 'actor-a', exceptionId: 'ex-1' })).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it('blocks self-approval on migration', async () => {
    const repo = {
      getMigrationRequest: vi.fn().mockResolvedValue({
        id: 'mig-1',
        tenantRegistryId: tenant.id,
        status: 'REQUESTED',
        requestedBy: 'actor-a',
        version: 1,
      }),
      getById: vi.fn().mockResolvedValue(tenant),
    } as unknown as TenantManagementRepositoryPort;
    const uc = new ApproveMigrationUseCase(repo, {} as never, {} as never);
    await expect(uc.execute({ actorId: 'actor-a', requestId: 'mig-1' })).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it('blocks self-approval on legal hold lift', async () => {
    const repo = {
      getLegalHoldChangeRequest: vi.fn().mockResolvedValue({
        id: 'lh-1',
        tenantRegistryId: tenant.id,
        action: LegalHoldChangeAction.LIFT,
        status: GovernanceRequestStatus.PENDING,
        requestedBy: 'actor-a',
        version: 1,
        justification: 'lift justification minimum',
      }),
      getById: vi.fn().mockResolvedValue(tenant),
    } as unknown as TenantManagementRepositoryPort;
    const uc = new ApproveLegalHoldChangeUseCase(repo, {} as never, {} as never);
    await expect(uc.execute({ actorId: 'actor-a', requestId: 'lh-1' })).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it('rejects bulk execute when expectedPreviewCount mismatches', async () => {
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
      uc.execute({ actorId: 'executor-b', bulkOperationId: 'bulk-1', expectedPreviewCount: 99 }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('rejects bulk execute by requester (SoD on sensitive)', async () => {
    const repo = {
      getBulkOperation: vi.fn().mockResolvedValue({
        id: 'bulk-1',
        operationType: 'ASSIGN',
        status: 'PREVIEW',
        previewCount: 1,
        filter: {},
        payload: { frozenTenantIds: ['a'] },
        results: [],
        requestedBy: 'requester-a',
        correlationId: null,
        idempotencyKey: 'key',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      search: vi.fn().mockResolvedValue({ items: [{ id: 'a', version: 1 }], total: 1 }),
    } as unknown as TenantManagementRepositoryPort;
    const uc = new ExecuteBulkOperationUseCase(repo, {} as never, {} as never);
    await expect(
      uc.execute({ actorId: 'requester-a', bulkOperationId: 'bulk-1', expectedPreviewCount: 1 }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('rejects HEALTHY from admin source', async () => {
    const repo = {
      getById: vi.fn().mockResolvedValue({ ...tenant, legalHold: false }),
    } as unknown as TenantManagementRepositoryPort;
    const uc = new RecordHealthSnapshotUseCase(repo, {} as never, {} as never);
    await expect(
      uc.execute({
        actorId: 'admin',
        tenantRegistryId: tenant.id,
        overallStatus: HealthStatus.HEALTHY,
        indicators: {},
        sourceSystem: 'admin',
        observedAt: new Date(),
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('rejects EXPORT bulk preview type', async () => {
    const repo = {
      getBulkOperationByIdempotency: vi.fn(),
      search: vi.fn(),
      createBulkOperation: vi.fn(),
    } as unknown as TenantManagementRepositoryPort;
    const uc = new PreviewBulkOperationUseCase(repo);
    await expect(
      uc.execute({
        actorId: 'admin',
        operationType: 'EXPORT',
        filter: {},
        idempotencyKey: 'k1',
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('legal hold lift reject enforces SoD', async () => {
    const repo = {
      getLegalHoldChangeRequest: vi.fn().mockResolvedValue({
        id: 'lh-2',
        status: GovernanceRequestStatus.PENDING,
        requestedBy: 'req-a',
        version: 1,
      }),
    } as unknown as TenantManagementRepositoryPort;
    const uc = new RejectLegalHoldChangeUseCase(repo, {} as never, {} as never);
    await expect(
      uc.execute({
        actorId: 'req-a',
        requestId: 'lh-2',
        rejectedReason: 'nope',
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('request legal hold lift idempotency returns existing', async () => {
    const existing = {
      id: 'lh-existing',
      action: LegalHoldChangeAction.LIFT,
      status: GovernanceRequestStatus.PENDING,
    };
    const repo = {
      getById: vi.fn().mockResolvedValue(tenant),
      getLegalHoldChangeRequestByIdempotency: vi.fn().mockResolvedValue(existing),
    } as unknown as TenantManagementRepositoryPort;
    const uc = new RequestLegalHoldChangeUseCase(repo, {} as never, {} as never);
    const result = await uc.execute({
      actorId: 'req-b',
      tenantRegistryId: tenant.id,
      action: LegalHoldChangeAction.LIFT,
      justification: 'lift with justification',
      idempotencyKey: 'idem-1',
    });
    expect(result).toBe(existing);
  });

  it('fail-closes lifecycle approve when P7 bridge FAILED (chaos)', async () => {
    const repo = {
      getLifecycleRequest: vi.fn().mockResolvedValue({
        id: 'lr-chaos',
        tenantRegistryId: tenant.id,
        requestType: LifecycleRequestType.SUSPEND,
        status: GovernanceRequestStatus.WAITING_APPROVAL,
        requestedBy: 'requester-a',
        version: 1,
        justification: 'chaos justification text',
      }),
      getById: vi.fn().mockResolvedValue({ ...tenant, legalHold: false }),
      updateLifecycleRequest: vi.fn(),
    } as unknown as TenantManagementRepositoryPort;
    const bridge = {
      requestSuspend: vi.fn().mockResolvedValue({ outcome: 'FAILED', workflowId: null }),
      requestResume: vi.fn(),
      requestDeprovision: vi.fn(),
    };
    const outbox = { runWithOutbox: vi.fn() };
    const uc = new ApproveLifecycleActionUseCase(
      repo,
      outbox as never,
      { create: vi.fn() } as never,
      bridge as never,
    );
    await expect(
      uc.execute({ actorId: 'approver-b', requestId: 'lr-chaos' }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(outbox.runWithOutbox).not.toHaveBeenCalled();
  });
});
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransferTenantOwnershipUseCase } from './tenant.use-cases.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

describe('TransferTenantOwnershipUseCase concurrency', () => {
  const tenantAdmin = {
    getOwnerIdentityId: vi.fn(),
    transferOwnership: vi.fn(),
    updateProfile: vi.fn(),
    transitionStatus: vi.fn(),
    setOwner: vi.fn(),
  };
  const userTenantMembership = { ensureMember: vi.fn() };
  const controlPlaneTransaction = {
    runInTransaction: vi.fn(async (fn: (client: unknown) => Promise<unknown>) => fn({})),
  };

  let useCase: TransferTenantOwnershipUseCase;

  const ctx = {
    tenantId: 'tenant-1',
    subjectId: 'owner-sub',
    username: 'owner',
    organizationId: null,
    correlationId: 'c1',
    traceId: null,
    permissions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new TransferTenantOwnershipUseCase(
      tenantAdmin as never,
      userTenantMembership as never,
      controlPlaneTransaction as never,
    );
  });

  it('succeeds when conditional ownership transfer applies', async () => {
    tenantAdmin.getOwnerIdentityId.mockResolvedValue('owner-sub');
    tenantAdmin.transferOwnership.mockResolvedValue(true);

    const result = await useCase.execute({
      ctx,
      tenantId: 'tenant-1',
      newOwnerIdentityId: 'new-owner-sub',
    });

    expect(result.ownerIdentityId).toBe('new-owner-sub');
    expect(tenantAdmin.transferOwnership).toHaveBeenCalledWith(
      'tenant-1',
      'owner-sub',
      'new-owner-sub',
      {},
    );
  });

  it('rejects concurrent transfer when ownership already changed', async () => {
    tenantAdmin.getOwnerIdentityId.mockResolvedValue('owner-sub');
    tenantAdmin.transferOwnership.mockResolvedValue(false);

    await expect(
      useCase.execute({
        ctx,
        tenantId: 'tenant-1',
        newOwnerIdentityId: 'new-owner-sub',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
  });

  it('denies transfer when caller is not current owner', async () => {
    tenantAdmin.getOwnerIdentityId.mockResolvedValue('other-owner');

    await expect(
      useCase.execute({
        ctx,
        tenantId: 'tenant-1',
        newOwnerIdentityId: 'new-owner-sub',
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RevokeMembershipUseCase } from './membership.use-cases.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

describe('RevokeMembershipUseCase last-admin protection', () => {
  const organizationRepository = { findById: vi.fn() };
  const membershipRepository = {
    findById: vi.fn(),
    countTenantAdmins: vi.fn(),
    revoke: vi.fn(),
  };
  const controlPlaneOutbox = {
    runWithOutbox: vi.fn(async (_tenantId, fn: (client: unknown, enqueue: unknown) => Promise<unknown>) =>
      fn({}, vi.fn()),
    ),
  };
  const keycloakSync = { syncMembership: vi.fn() };

  let useCase: RevokeMembershipUseCase;

  const ctx = {
    tenantId: 'tenant-1',
    subjectId: 'actor-sub',
    username: 'actor',
    organizationId: 'org-1',
    correlationId: 'c1',
    traceId: null,
    permissions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new RevokeMembershipUseCase(
      organizationRepository as never,
      membershipRepository as never,
      controlPlaneOutbox as never,
      keycloakSync as never,
    );
  });

  it('denies revoke of sole tenant admin inside transaction', async () => {
    membershipRepository.findById.mockResolvedValue({
      id: 'm-1',
      organizationId: 'org-1',
      userId: 'admin-user',
      roles: ['tenant-administrator'],
    });
    organizationRepository.findById.mockResolvedValue({ id: 'org-1' });
    membershipRepository.countTenantAdmins.mockResolvedValue(1);

    await expect(useCase.execute({ ctx, membershipId: 'm-1' })).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
    expect(membershipRepository.revoke).not.toHaveBeenCalled();
  });

  it('revokes when multiple tenant admins exist', async () => {
    membershipRepository.findById.mockResolvedValue({
      id: 'm-1',
      organizationId: 'org-1',
      userId: 'admin-user',
      roles: ['tenant-administrator'],
    });
    organizationRepository.findById.mockResolvedValue({ id: 'org-1' });
    membershipRepository.countTenantAdmins.mockResolvedValue(2);
    membershipRepository.revoke.mockResolvedValue({ id: 'm-1', status: 'REMOVED' });

    await useCase.execute({ ctx, membershipId: 'm-1' });

    expect(membershipRepository.countTenantAdmins).toHaveBeenCalledWith('tenant-1', {});
    expect(membershipRepository.revoke).toHaveBeenCalledWith('tenant-1', 'm-1', {});
  });
});

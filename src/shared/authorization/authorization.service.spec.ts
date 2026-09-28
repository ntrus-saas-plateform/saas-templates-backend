import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthorizationService } from './authorization.service.js';
import { MembershipStatus } from '../../modules/identity/domain/membership/organization-membership.entity.js';
import { isDelegationActive } from '../../modules/identity/domain/delegation/delegation.entity.js';

describe('AuthorizationService', () => {
  const tenantContext = { get: vi.fn() };
  const membershipRepository = {
    findByUser: vi.fn(),
  };
  const roleRepository = {
    findPermissionsForRoles: vi.fn(),
    listPermissions: vi.fn(),
  };
  const delegationRepository = {
    findActiveByGrantee: vi.fn(),
  };
  const emergencyAccessRepository = {
    findByTenant: vi.fn(),
  };

  let service: AuthorizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthorizationService(
      tenantContext as never,
      membershipRepository as never,
      roleRepository as never,
      delegationRepository as never,
      emergencyAccessRepository as never,
    );
  });

  it('derives permissions from membership roles, not forged JWT claims', async () => {
    tenantContext.get.mockReturnValue({
      tenantId: 'tenant-a',
      subjectId: 'user-a',
      organizationId: 'org-a',
      permissions: ['tenant:ownership_transfer'],
      roles: [],
    });

    membershipRepository.findByUser.mockResolvedValue([
      {
        id: 'mem-1',
        userId: 'user-a',
        tenantId: 'tenant-a',
        organizationId: 'org-a',
        status: MembershipStatus.ACTIVE,
        roles: ['viewer'],
        permissions: [],
        joinedAt: new Date(),
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    roleRepository.findPermissionsForRoles.mockResolvedValue(['users:read']);
    roleRepository.listPermissions.mockResolvedValue([
      { id: '1', resource: 'users', action: 'read', description: null },
      { id: '2', resource: 'tenant', action: 'ownership_transfer', description: null },
    ]);
    delegationRepository.findActiveByGrantee.mockResolvedValue([]);
    emergencyAccessRepository.findByTenant.mockResolvedValue([]);

    const effective = await service.resolveEffectivePermissions();
    expect(effective).toContain('users:read');
    expect(effective).not.toContain('tenant:ownership_transfer');
  });

  it('merges active delegation permissions for grantee', async () => {
    tenantContext.get.mockReturnValue({
      tenantId: 'tenant-a',
      subjectId: 'user-a',
      organizationId: 'org-a',
      permissions: [],
      roles: [],
    });

    membershipRepository.findByUser.mockResolvedValue([
      {
        id: 'mem-1',
        userId: 'user-a',
        tenantId: 'tenant-a',
        organizationId: 'org-a',
        status: MembershipStatus.ACTIVE,
        roles: ['viewer'],
        permissions: [],
        joinedAt: new Date(),
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    roleRepository.findPermissionsForRoles.mockResolvedValue(['users:read']);
    roleRepository.listPermissions.mockResolvedValue([]);
    delegationRepository.findActiveByGrantee.mockResolvedValue([
      {
        id: 'del-1',
        tenantId: 'tenant-a',
        organizationId: 'org-a',
        grantorIdentityId: 'grantor',
        granteeIdentityId: 'user-a',
        permissions: ['memberships:create'],
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        revokedAt: null,
      },
    ]);
    emergencyAccessRepository.findByTenant.mockResolvedValue([]);

    const effective = await service.resolveEffectivePermissions();
    expect(effective).toContain('memberships:create');
    expect(isDelegationActive).toBeDefined();
  });
});

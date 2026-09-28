import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InProcessPolicyEvaluator } from './in-process-policy-evaluator.js';
import type { AuthorizationService } from './authorization.service.js';
import type { MembershipRepositoryPort } from '../../modules/identity/domain/ports/membership-repository.port.js';
import { MembershipStatus } from '../../modules/identity/domain/membership/organization-membership.entity.js';

describe('InProcessPolicyEvaluator', () => {
  let authorizationService: AuthorizationService;
  let membershipRepository: MembershipRepositoryPort;
  let evaluator: InProcessPolicyEvaluator;

  beforeEach(() => {
    authorizationService = {
      resolveEffectivePermissions: vi.fn(),
      hasAnyPermission: vi.fn().mockResolvedValue(true),
      hasAllPermissions: vi.fn(),
    } as unknown as AuthorizationService;

    membershipRepository = {
      findByUser: vi.fn().mockResolvedValue([
        {
          id: 'mem-1',
          userId: 'user-1',
          tenantId: 'tenant-1',
          organizationId: 'org-1',
          status: MembershipStatus.ACTIVE,
          roles: ['viewer'],
          permissions: [],
          joinedAt: new Date(),
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
      findByOrganization: vi.fn(),
      findByUsers: vi.fn(),
      findByUserPage: vi.fn(),
      findByOrganizationPage: vi.fn(),
      countByOrganizationStatus: vi.fn(),
      findById: vi.fn(),
      countTenantAdmins: vi.fn(),
      create: vi.fn(),
      updateRoles: vi.fn(),
      update: vi.fn(),
      revoke: vi.fn(),
      updateStatus: vi.fn(),
    };

    evaluator = new InProcessPolicyEvaluator(authorizationService, membershipRepository);
  });

  it('allows when RBAC permission matches', async () => {
    const decision = await evaluator.evaluate({
      tenantId: 'tenant-1',
      subjectId: 'user-1',
      organizationId: 'org-1',
      action: 'read',
      resource: { type: 'users' },
      permissions: ['users:read'],
    });

    expect(decision.allowed).toBe(true);
    expect(decision.source).toBe('rbac');
  });

  it('denies when permission missing', async () => {
    vi.mocked(authorizationService.hasAnyPermission).mockResolvedValue(false);

    const decision = await evaluator.evaluate({
      tenantId: 'tenant-1',
      subjectId: 'user-1',
      organizationId: 'org-1',
      action: 'delete',
      resource: { type: 'users' },
      permissions: ['users:read'],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.source).toBe('rbac');
  });

  it('denies org-scoped resource when ABAC fails', async () => {
    const decision = await evaluator.evaluate({
      tenantId: 'tenant-1',
      subjectId: 'user-1',
      organizationId: 'org-1',
      action: 'read',
      resource: { type: 'users', attributes: { organizationId: 'org-other' } },
      permissions: ['users:read'],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.source).toBe('abac');
  });
});

import { describe, it, expect } from 'vitest';
import { MembershipStatus } from '../../src/modules/identity/domain/membership/organization-membership.entity.js';
import { AuthorizationService } from '../../src/shared/authorization/authorization.service.js';

describe('Load: AuthorizationService multi-tenant resolution', () => {
  it('resolves permissions for 500 memberships under 100ms p95', async () => {
    const memberships = Array.from({ length: 500 }, (_, i) => ({
      id: `mem-${i}`,
      userId: 'user-a',
      tenantId: 'tenant-a',
      organizationId: `org-${i}`,
      status: MembershipStatus.ACTIVE,
      roles: ['viewer'],
      permissions: [],
      joinedAt: new Date(),
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const membershipRepository = {
      findByUser: async () => memberships,
    };
    const roleRepository = {
      findPermissionsForRoles: async () => ['users:read'],
      listPermissions: async () => [],
    };
    const delegationRepository = { findActiveByGrantee: async () => [] };
    const emergencyAccessRepository = { findByTenant: async () => [] };

    const tenantContext = {
      get: () => ({
        tenantId: 'tenant-a',
        subjectId: 'user-a',
        organizationId: 'org-0',
        permissions: [],
        roles: [],
      }),
    };

    const service = new AuthorizationService(
      tenantContext as never,
      membershipRepository as never,
      roleRepository as never,
      delegationRepository as never,
      emergencyAccessRepository as never,
    );

    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      const perms = await service.resolveEffectivePermissions();
      samples.push(performance.now() - start);
      expect(perms).toContain('users:read');
    }

    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95)];
    expect(p95).toBeLessThan(100);
  });
});

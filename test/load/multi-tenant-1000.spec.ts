import { describe, it, expect } from 'vitest';
import { MembershipStatus } from '../../src/modules/identity/domain/membership/organization-membership.entity.js';
import { AuthorizationService } from '../../src/shared/authorization/authorization.service.js';

describe('Load: multi-tenant authorization at scale', () => {
  it('resolves permissions across 1000 tenant contexts under 200ms p95', async () => {
    const tenantCount = 1000;
    const membershipsPerTenant = 3;

    const membershipRepository = {
      findByUser: async (tenantId: string, userId: string) => {
        if (userId !== 'user-scale') return [];
        return Array.from({ length: membershipsPerTenant }, (_, i) => ({
          id: `mem-${tenantId}-${i}`,
          userId,
          tenantId,
          organizationId: `org-${tenantId}-${i}`,
          status: MembershipStatus.ACTIVE,
          roles: ['viewer'],
          permissions: [],
          joinedAt: new Date(),
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
      },
    };

    const roleRepository = {
      findPermissionsForRoles: async () => ['users:read'],
      listRoles: async () => [],
      listPermissions: async () => [],
      findRoleByName: async () => null,
      findById: async () => null,
      create: async () => {
        throw new Error('not implemented');
      },
      update: async () => {
        throw new Error('not implemented');
      },
      delete: async () => {
        throw new Error('not implemented');
      },
    };

    const delegationRepository = { findActiveByGrantee: async () => [] };
    const emergencyAccessRepository = { findByTenant: async () => [] };

    const tenantIds = Array.from({ length: tenantCount }, (_, i) => `tenant-${String(i).padStart(4, '0')}`);
    const samples: number[] = [];

    for (const tenantId of tenantIds) {
      const tenantContext = {
        get: () => ({
          tenantId,
          subjectId: 'user-scale',
          organizationId: `org-${tenantId}-0`,
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

      const start = performance.now();
      const perms = await service.resolveEffectivePermissions();
      samples.push(performance.now() - start);
      expect(perms).toContain('users:read');
    }

    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95)];
    expect(p95).toBeLessThan(200);
  });
});

import { describe, it, expect } from 'vitest';
import { ListMembershipsUseCase } from '../../src/modules/identity/application/membership/membership.use-cases.js';
import type { OrganizationMembership } from '../../src/modules/identity/domain/membership/organization-membership.entity.js';
import { MembershipStatus } from '../../src/modules/identity/domain/membership/organization-membership.entity.js';
import { OrganizationAccessPolicyService } from '../../src/modules/identity/application/services/organization-access-policy.service.js';

const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = 'user-sub';
const ORG_ID = '11111111-1111-4111-8111-111111111111';

function buildMemberships(count: number): OrganizationMembership[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `mem-${String(i).padStart(4, '0')}`,
    userId: USER_ID,
    tenantId: TENANT_ID,
    organizationId: `${ORG_ID.slice(0, -4)}${String(i).padStart(4, '0')}`,
    status: MembershipStatus.ACTIVE,
    roles: ['viewer'],
    permissions: [],
    department: null,
    position: null,
    managerUserId: null,
    resourceScopes: [],
    joinedAt: new Date(),
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

describe('Load: ListMembershipsUseCase performance', () => {
  it('lists 500 memberships under 50ms p95 (in-process mock)', async () => {
    const memberships = buildMemberships(500);
    const repository = {
      findByUser: async () => memberships,
      findByUsers: async () => memberships,
      findByUserPage: async () => ({ items: memberships, total: memberships.length }),
      findByOrganization: async () => memberships,
      findByOrganizationPage: async () => ({ items: memberships, total: memberships.length }),
      findById: async () => null,
      countTenantAdmins: async () => 0,
      countByOrganizationStatus: async () => ({
        total: memberships.length,
        active: memberships.length,
        invited: 0,
        suspended: 0,
        removed: 0,
        expired: 0,
      }),
      create: async () => memberships[0]!,
      updateRoles: async () => memberships[0]!,
      update: async () => memberships[0]!,
      revoke: async () => memberships[0]!,
      updateStatus: async () => memberships[0]!,
    };

    const organizationAccessPolicy = new OrganizationAccessPolicyService(repository);
    const useCase = new ListMembershipsUseCase(repository, organizationAccessPolicy);
    const ctx = {
      tenantId: TENANT_ID,
      subjectId: USER_ID,
      username: 'user',
      organizationId: ORG_ID,
      permissions: [],
      correlationId: 'c',
      traceId: 't',
    };

    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      const result = await useCase.execute({ ctx, organizationId: undefined, page: 1, limit: 500 });
      const elapsed = performance.now() - start;
      samples.push(elapsed);
      expect(result.data).toHaveLength(500);
    }

    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95)];
    expect(p95).toBeLessThan(50);
  });
});

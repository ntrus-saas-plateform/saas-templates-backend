import { describe, it, expect, vi } from 'vitest';
import { ListUsersUseCase } from './user-lifecycle.use-cases.js';
import { ApplicationUserStatus } from '../../domain/user/application-user.entity.js';
import { MembershipStatus } from '../../domain/membership/organization-membership.entity.js';
import type { ExecutionContext } from '../common/execution-context.js';

const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORG_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'user-sub';

const ctx: ExecutionContext = {
  tenantId: TENANT_ID,
  subjectId: 'admin-sub',
  username: 'admin',
  organizationId: ORG_ID,
  permissions: ['users:read'],
  correlationId: 'corr',
  traceId: 'trace',
};

describe('ListUsersUseCase', () => {
  it('attaches organization memberships to each listed user', async () => {
    const applicationUserRepository = {
      listPage: vi.fn(async () => ({
        items: [
          {
            id: 'app-1',
            identityId: USER_ID,
            tenantId: TENANT_ID,
            status: ApplicationUserStatus.ACTIVE,
            profile: { displayName: 'Ada', email: 'ada@example.com' },
            securityMetadata: {},
            lastSeenAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      })),
    };
    const membershipRepository = {
      findByUsers: vi.fn(async () => [
        {
          id: 'mem-1',
          userId: USER_ID,
          tenantId: TENANT_ID,
          organizationId: ORG_ID,
          status: MembershipStatus.ACTIVE,
          roles: ['tenant-administrator'],
          permissions: [],
          department: 'Ops',
          position: 'Admin',
          managerUserId: null,
          resourceScopes: [],
          joinedAt: new Date(),
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    };
    const organizationRepository = {
      findAllByTenant: vi.fn(async () => [
        { id: ORG_ID, name: 'TenantA HQ' },
      ]),
    };

    const useCase = new ListUsersUseCase(
      applicationUserRepository as never,
      membershipRepository as never,
      organizationRepository as never,
    );
    const result = await useCase.execute({ ctx, page: 1, limit: 20, search: 'Ada' });

    expect(applicationUserRepository.listPage).toHaveBeenCalledWith(
      TENANT_ID,
      1,
      20,
      undefined,
      'Ada',
    );
    expect(result.data[0]?.organizations).toEqual([
      {
        organizationId: ORG_ID,
        organizationName: 'TenantA HQ',
        roles: ['tenant-administrator'],
        department: 'Ops',
        position: 'Admin',
        status: MembershipStatus.ACTIVE,
      },
    ]);
  });
});

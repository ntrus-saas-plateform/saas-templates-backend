import { MembershipStatus } from '../../src/modules/identity/domain/membership/organization-membership.entity.js';
import type { MembershipRepositoryPort } from '../../src/modules/identity/domain/ports/membership-repository.port.js';
import type { RoleRepositoryPort } from '../../src/modules/identity/domain/ports/role-repository.port.js';
import type { DelegationRepositoryPort } from '../../src/modules/identity/domain/ports/delegation-repository.port.js';
import type { EmergencyAccessRepositoryPort } from '../../src/modules/identity/domain/ports/emergency-access-repository.port.js';
import { MEMBERSHIP_REPOSITORY_PORT } from '../../src/modules/identity/domain/ports/membership-repository.port.js';
import { ROLE_REPOSITORY_PORT } from '../../src/modules/identity/domain/ports/role-repository.port.js';
import { DELEGATION_REPOSITORY_PORT } from '../../src/modules/identity/domain/ports/delegation-repository.port.js';
import { EMERGENCY_ACCESS_REPOSITORY_PORT } from '../../src/modules/identity/domain/ports/emergency-access-repository.port.js';
import { MfaEnforcementService } from '../../src/shared/auth/mfa-enforcement.service.js';
import { CapabilityResolverService } from '../../src/shared/authorization/capability-resolver.service.js';
import { DOMAIN_REGISTRY_PORT } from '../../src/modules/identity/domain/ports/domain-registry.port.js';

const CATALOG_PERMISSIONS = [
  'tenant:read',
  'tenant:update',
  'tenant:ownership_transfer',
  'organizations:read',
  'organizations:create',
  'organizations:update',
  'organizations:suspend',
  'users:read',
  'users:invite',
  'users:update',
  'users:suspend',
  'memberships:read',
  'memberships:create',
  'memberships:update',
  'memberships:revoke',
  'roles:read',
  'roles:create',
  'roles:update',
  'permissions:read',
  'settings:read',
  'settings:update',
  'security:read',
  'security:update',
  'platform:read',
  'platform:organizations:read',
  'delegation:read',
  'delegation:grant',
  'emergency_access:read',
  'emergency_access:grant',
  'tenants:create',
  'tenants:admin',
  'roles:delete',
  'customers:read',
  'customers:create',
  'customers:update',
  'customers:delete',
  'customers:export',
  'customers:merge',
  'customers:view_sensitive',
  'customers:manage_consent',
  'customers:view_financial',
  'customers:crm_read',
  'customers:crm_write',
  'commerce:read',
  'commerce:create',
  'commerce:update',
  'commerce:pos_checkout',
  'orders:read',
  'orders:cancel',
  'orders:refund',
  'loyalty:read',
  'pharmacy:read',
  'pharmacy:create',
  'pharmacy:link_customer',
] as const;

const TENANT_OWNER_PERMISSIONS = [...CATALOG_PERMISSIONS];

const TENANT_ADMIN_PERMISSIONS = TENANT_OWNER_PERMISSIONS.filter(
  (p) => p !== 'tenant:ownership_transfer' && !p.startsWith('tenant:'),
);

export function createMembershipRepositoryMock(
  tenantId: string,
  userId: string,
  organizationId: string,
  roles: readonly string[] = ['tenant-owner'],
): MembershipRepositoryPort {
  const membership = {
    id: 'mem-test-1',
    userId,
    tenantId,
    organizationId,
    status: MembershipStatus.ACTIVE,
    roles,
    permissions: [],
    department: null,
    position: null,
    managerUserId: null,
    resourceScopes: [],
    joinedAt: new Date(),
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    findByUser: async (t, u) => (t === tenantId && u === userId ? [membership] : []),
    findByUsers: async (t, ids) =>
      ids.flatMap((u) => (t === tenantId && u === userId ? [membership] : [])),
    findByOrganization: async (t, orgId) =>
      t === tenantId && orgId === organizationId ? [membership] : [],
    findByUserPage: async (t, u, page, limit) => {
      const items = t === tenantId && u === userId ? [membership] : [];
      return { items, total: items.length };
    },
    findByOrganizationPage: async (t, orgId, page, limit) => {
      const items = t === tenantId && orgId === organizationId ? [membership] : [];
      return { items, total: items.length };
    },
    findById: async () => membership,
    countTenantAdmins: async () => 1,
    create: async () => membership,
    updateRoles: async () => membership,
    update: async () => membership,
    revoke: async () => membership,
    updateStatus: async () => membership,
    countByOrganizationStatus: async () => ({
      total: 1,
      active: 1,
      invited: 0,
      suspended: 0,
      removed: 0,
      expired: 0,
    }),
  };
}

export function createRoleRepositoryMock(): RoleRepositoryPort {
  return {
    listPermissions: async () =>
      CATALOG_PERMISSIONS.map((key, index) => {
        const [resource, action] = key.split(':');
        return {
          id: `perm-${index}`,
          resource,
          action,
          description: null,
        };
      }),
    listRoles: async () => [],
    findPermissionsForRoles: async (roleNames) => {
      if (roleNames.includes('tenant-owner')) return TENANT_OWNER_PERMISSIONS;
      if (roleNames.includes('tenant-administrator')) return TENANT_ADMIN_PERMISSIONS;
      if (roleNames.includes('viewer')) {
        return CATALOG_PERMISSIONS.filter((p) => p.endsWith(':read'));
      }
      return [];
    },
    findRoleByName: async () => null,
    findById: async () => null,
    create: async () => {
      throw new Error('not implemented in test mock');
    },
    update: async () => {
      throw new Error('not implemented in test mock');
    },
    delete: async () => {
      throw new Error('not implemented in test mock');
    },
    listRolesPage: async (tenantId, page, limit) => {
      const roles = await createRoleRepositoryMock().listRoles(tenantId);
      const offset = (page - 1) * limit;
      return { items: roles.slice(offset, offset + limit), total: roles.length };
    },
    listPermissionsPage: async (page, limit) => {
      const perms = await createRoleRepositoryMock().listPermissions();
      const offset = (page - 1) * limit;
      return { items: perms.slice(offset, offset + limit), total: perms.length };
    },
  };
}

export function createDelegationRepositoryMock(): DelegationRepositoryPort {
  return {
    findActiveByGrantee: async () => [],
    findByTenant: async () => [],
    findByTenantPage: async () => ({ items: [], total: 0 }),
    create: async () => {
      throw new Error('not implemented in test mock');
    },
    revoke: async () => {
      throw new Error('not implemented in test mock');
    },
  };
}

export function createEmergencyAccessRepositoryMock(): EmergencyAccessRepositoryPort {
  return {
    findByTenant: async () => [],
    findByTenantPage: async () => ({ items: [], total: 0 }),
    create: async () => {
      throw new Error('not implemented in test mock');
    },
    revoke: async () => {
      throw new Error('not implemented in test mock');
    },
  };
}

export function authorizationTestProviders(
  tenantId: string,
  userId: string,
  organizationId: string,
  roles: readonly string[] = ['tenant-owner'],
) {
  return [
    {
      provide: MEMBERSHIP_REPOSITORY_PORT,
      useValue: createMembershipRepositoryMock(tenantId, userId, organizationId, roles),
    },
    {
      provide: ROLE_REPOSITORY_PORT,
      useValue: createRoleRepositoryMock(),
    },
    {
      provide: DELEGATION_REPOSITORY_PORT,
      useValue: createDelegationRepositoryMock(),
    },
    {
      provide: EMERGENCY_ACCESS_REPOSITORY_PORT,
      useValue: createEmergencyAccessRepositoryMock(),
    },
    {
      provide: MfaEnforcementService,
      useValue: { assertLoginMfaCompliance: async () => {} },
    },
    {
      provide: CapabilityResolverService,
      useValue: {
        assertModuleEnabled: async () => undefined,
        isModuleEnabled: async () => true,
        resolveForCurrentUser: async () => ({
          plan: null,
          modules: {
            identity: true,
            customer: true,
            commerce: true,
            pharmacy: true,
            platform: true,
          },
          permissions: [],
          features: {},
          organizations: [],
          defaultOrganizationId: null,
          navigationHints: [],
        }),
      },
    },
    {
      provide: DOMAIN_REGISTRY_PORT,
      useValue: {
        findByHostname: async () => null,
        listByTenant: async () => [],
        create: async () => {
          throw new Error('not used');
        },
        setPrimary: async () => {
          throw new Error('not used');
        },
        disable: async () => {
          throw new Error('not used');
        },
      },
    },
  ];
}

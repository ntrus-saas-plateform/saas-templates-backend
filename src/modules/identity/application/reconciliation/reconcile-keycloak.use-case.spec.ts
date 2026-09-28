import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReconcileKeycloakUseCase } from './reconcile-keycloak.use-case.js';
import type { OrganizationRepositoryPort } from '../../domain/ports/organization-repository.port.js';
import type { MembershipRepositoryPort } from '../../domain/ports/membership-repository.port.js';
import type { OrganizationAdminPort } from '../../domain/ports/organization-admin.port.js';
import type { KeycloakAdminPort } from '../../domain/ports/keycloak-admin.port.js';
import type { ApplicationUserRepositoryPort } from '../../domain/ports/application-user-repository.port.js';
import { OrganizationStatus, OrganizationType } from '../../domain/organization/organization.entity.js';
import { ApplicationUserStatus } from '../../domain/user/application-user.entity.js';

describe('ReconcileKeycloakUseCase', () => {
  let organizationRepository: OrganizationRepositoryPort;
  let membershipRepository: MembershipRepositoryPort;
  let organizationAdmin: OrganizationAdminPort;
  let keycloakAdmin: KeycloakAdminPort;
  let applicationUserRepository: ApplicationUserRepositoryPort;
  let useCase: ReconcileKeycloakUseCase;

  beforeEach(() => {
    organizationRepository = {
      findById: vi.fn(),
      findByKeycloakId: vi.fn(),
      findByUserMembership: vi.fn(),
      findByUserMembershipPage: vi.fn(async () => ({ items: [], total: 0 })),
      findAllByTenantPage: vi.fn(async () => ({ items: [], total: 0 })),
      countOrganizations: vi.fn(async () => 0),
      countDistinctUsers: vi.fn(async () => 0),
      findAllByTenant: vi.fn().mockResolvedValue([
        {
          id: 'org-1',
          tenantId: 'tenant-1',
          keycloakOrganizationId: 'kc-placeholder',
          name: 'Org One',
          slug: 'org-one',
          status: OrganizationStatus.ACTIVE,
          type: OrganizationType.OTHER,
          code: null,
          parentId: null,
          isPrimary: true,
          description: null,
          timezone: null,
          locale: null,
          address: {},
          contact: {},
          openingHours: {},
          operationalSettings: {},
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    };
    membershipRepository = {
      findById: vi.fn(),
      findByUser: vi.fn(),
      findByUsers: vi.fn().mockResolvedValue([]),
      findByOrganization: vi.fn().mockResolvedValue([]),
      findByUserPage: vi.fn(async () => ({ items: [], total: 0 })),
      findByOrganizationPage: vi.fn(async () => ({ items: [], total: 0 })),
      countByOrganizationStatus: vi.fn(async () => ({
        total: 0,
        active: 0,
        invited: 0,
        suspended: 0,
        removed: 0,
        expired: 0,
      })),
      countTenantAdmins: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      revoke: vi.fn(),
      updateRoles: vi.fn(),
      updateStatus: vi.fn(),
    };
    organizationAdmin = {
      create: vi.fn(),
      update: vi.fn(),
      transitionStatus: vi.fn(),
      updateKeycloakOrganizationId: vi.fn(),
      clearPrimary: vi.fn(),
      getAncestorChain: vi.fn(async () => []),
    };
    keycloakAdmin = {
      isAvailable: vi.fn().mockResolvedValue(true),
      listUserSessions: vi.fn(),
      revokeSession: vi.fn(),
      revokeAllUserSessions: vi.fn(),
      createOrganization: vi.fn().mockResolvedValue('kc-real-id'),
      updateOrganization: vi.fn(),
      listOrganizations: vi.fn().mockResolvedValue([]),
      listOrganizationMemberIds: vi.fn(),
      addUserToOrganization: vi.fn(),
      removeUserFromOrganization: vi.fn(),
      setUserActiveOrganization: vi.fn(),
      createUser: vi.fn(),
      createB2cUser: vi.fn(),
      setUserPassword: vi.fn(),
      getUserMfaStatus: vi.fn(),
      listUserCredentials: vi.fn(async () => []),
      deleteUserCredential: vi.fn(),
      getAccountUrls: vi.fn(async () => ({
        accountConsoleUrl: 'http://localhost:8181/realms/platform/account',
        passwordUrl: 'http://localhost:8181/realms/platform/account/#/security/signing-in',
        enrollTotpUrl: 'http://localhost:8181/realms/platform/protocol/openid-connect/auth?kc_action=CONFIGURE_TOTP',
        enrollWebauthnUrl: 'http://localhost:8181/realms/platform/protocol/openid-connect/auth?kc_action=webauthn-register-passwordless',
        linkedAccountsUrl: 'http://localhost:8181/realms/platform/account/#/security/linked-accounts',
        recoveryCodesUrl: 'http://localhost:8181/realms/platform/account/#/security/signing-in',
      })),
      listIdentityProviders: vi.fn(async () => []),
      getIdentityProvider: vi.fn(async () => null),
      createIdentityProvider: vi.fn(),
      updateIdentityProvider: vi.fn(),
      deleteIdentityProvider: vi.fn(),
      listFederatedIdentities: vi.fn(async () => []),
      removeFederatedIdentity: vi.fn(async () => undefined),
      sendExecuteActionsEmail: vi.fn(),
      setUserEnabled: vi.fn(),
      getUser: vi.fn(),
      listUsersPage: vi.fn().mockResolvedValue([]),
    };
    applicationUserRepository = {
      findByIdentity: vi.fn(),
      findById: vi.fn(),
      findByIdentityOrId: vi.fn(),
      create: vi.fn(),
      updateProfile: vi.fn(),
      updateStatus: vi.fn(),
      touchLastSeen: vi.fn(),
      listPage: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    useCase = new ReconcileKeycloakUseCase(
      organizationRepository,
      membershipRepository,
      organizationAdmin,
      keycloakAdmin,
      applicationUserRepository,
    );
  });

  it('reports placeholder Keycloak org IDs when KC is available', async () => {
    const result = await useCase.execute({ tenantId: 'tenant-1', repair: false });
    expect(result.drifts.some((d) => d.type === 'organization.keycloak_placeholder')).toBe(true);
  });

  it('repairs placeholder org by creating KC org and updating app record', async () => {
    const result = await useCase.execute({ tenantId: 'tenant-1', repair: true });
    expect(keycloakAdmin.createOrganization).toHaveBeenCalledWith('Org One', 'org-one');
    expect(organizationAdmin.updateKeycloakOrganizationId).toHaveBeenCalledWith(
      'tenant-1',
      'org-1',
      'kc-real-id',
    );
    expect(result.repairs.some((r) => r.status === 'applied')).toBe(true);
  });

  it('reports user.enabled_mismatch when KC enabled state differs from app status', async () => {
    vi.mocked(applicationUserRepository.listPage).mockResolvedValue({
      items: [
        {
          id: 'app-user-1',
          identityId: 'kc-user-1',
          tenantId: 'tenant-1',
          status: ApplicationUserStatus.SUSPENDED,
          profile: {},
          securityMetadata: {},
          lastSeenAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      total: 1,
    });
    vi.mocked(keycloakAdmin.getUser).mockResolvedValue({
      id: 'kc-user-1',
      enabled: true,
    });

    const result = await useCase.execute({ tenantId: 'tenant-1', repair: false });
    expect(result.drifts.some((d) => d.type === 'user.enabled_mismatch')).toBe(true);
  });

  it('repairs user.enabled_mismatch via setUserEnabled', async () => {
    vi.mocked(applicationUserRepository.listPage).mockResolvedValue({
      items: [
        {
          id: 'app-user-1',
          identityId: 'kc-user-1',
          tenantId: 'tenant-1',
          status: ApplicationUserStatus.SUSPENDED,
          profile: {},
          securityMetadata: {},
          lastSeenAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      total: 1,
    });
    vi.mocked(keycloakAdmin.getUser).mockResolvedValue({
      id: 'kc-user-1',
      enabled: true,
    });

    const result = await useCase.execute({ tenantId: 'tenant-1', repair: true });
    expect(keycloakAdmin.setUserEnabled).toHaveBeenCalledWith('kc-user-1', false);
    expect(result.repairs.some((r) => r.type === 'user.enabled_mismatch' && r.status === 'applied')).toBe(
      true,
    );
  });
});

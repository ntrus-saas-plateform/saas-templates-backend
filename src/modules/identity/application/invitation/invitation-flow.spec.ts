import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import {
  CreateInvitationUseCase,
  AcceptInvitationUseCase,
} from './invitation.use-cases.js';
import { InvitationStatus } from '../../domain/invitation/invitation.entity.js';
import { OrganizationStatus, OrganizationType } from '../../domain/organization/organization.entity.js';
import type { OrganizationRepositoryPort } from '../../domain/ports/organization-repository.port.js';
import type { MembershipRepositoryPort } from '../../domain/ports/membership-repository.port.js';
import type { InvitationRepositoryPort } from '../../domain/ports/invitation-repository.port.js';
import type { RoleRepositoryPort } from '../../domain/ports/role-repository.port.js';
import type { ApplicationUserRepositoryPort } from '../../domain/ports/application-user-repository.port.js';
import type { UserTenantMembershipPort } from '../../domain/ports/user-tenant-membership.port.js';
import type { EmailSendResult, EmailSenderPort } from '../../../../core/domain/ports/email-sender.port.js';
import type { TenantMailSurface } from '../services/tenant-mail-surface.service.js';
import { KeycloakOrganizationSyncService } from '../services/keycloak-sync.service.js';
import { ApplicationUserStatus } from '../../domain/user/application-user.entity.js';
import { MembershipStatus } from '../../domain/membership/organization-membership.entity.js';
import type { ExecutionContext } from '../common/execution-context.js';

const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORG_ID = '11111111-1111-4111-8111-111111111111';
const GRANTOR_SUB = 'grantor-sub';
const INVITEE_SUB = 'invitee-sub';
const GRANTEE_SUB = 'grantee-sub';

const ctx: ExecutionContext = {
  tenantId: TENANT_ID,
  subjectId: GRANTOR_SUB,
  username: 'grantor',
  organizationId: ORG_ID,
  permissions: ['users:invite', 'memberships:read'],
  correlationId: 'corr',
  traceId: 'trace',
};

const inviteeCtx: ExecutionContext = {
  tenantId: TENANT_ID,
  subjectId: INVITEE_SUB,
  username: 'invitee@example.com',
  organizationId: ORG_ID,
  permissions: ['users:read'],
  correlationId: 'corr',
  traceId: 'trace',
};

describe('Invitation flow (create → accept → membership)', () => {
  let token: string;
  let tokenHash: string;
  let invitationId: string;
  let membershipCreated = false;

  const organizationRepository: OrganizationRepositoryPort = {
    findById: vi.fn(async (tenantId: string, orgId: string) => {
      if (tenantId === TENANT_ID && orgId === ORG_ID) {
        return {
          id: ORG_ID,
          tenantId: TENANT_ID,
          keycloakOrganizationId: 'kc-org',
          name: 'Org',
          slug: 'org',
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
        };
      }
      return null;
    }),
    findByKeycloakId: vi.fn(async () => null),
    findByUserMembership: vi.fn(async () => []),
    findByUserMembershipPage: vi.fn(async () => ({ items: [], total: 0 })),
    countOrganizations: vi.fn(async () => 0),
    countDistinctUsers: vi.fn(async () => 0),
    findAllByTenant: vi.fn(async () => []),
    findAllByTenantPage: vi.fn(async () => ({ items: [], total: 0 })),
  };

  const invitationRepository: InvitationRepositoryPort = {
    findById: vi.fn(async () => null),
    create: vi.fn(async (params) => {
      invitationId = 'inv-1';
      tokenHash = params.tokenHash;
      return {
        id: invitationId,
        tenantId: TENANT_ID,
        organizationId: ORG_ID,
        email: params.email,
        invitedBy: GRANTOR_SUB,
        roles: ['viewer'],
        permissions: [],
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 86400000),
        acceptedAt: null,
        createdAt: new Date(),
      };
    }),
    findByTokenHash: vi.fn(async (hash: string) => {
      if (hash !== tokenHash) return null;
      return {
        id: invitationId,
        tenantId: TENANT_ID,
        organizationId: ORG_ID,
        email: 'invitee@example.com',
        invitedBy: GRANTOR_SUB,
        roles: ['viewer'],
        permissions: [],
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 86400000),
        acceptedAt: null,
        createdAt: new Date(),
      };
    }),
    updateStatus: vi.fn(async () => ({
      id: invitationId,
      tenantId: TENANT_ID,
      organizationId: ORG_ID,
      email: 'invitee@example.com',
      invitedBy: GRANTOR_SUB,
      roles: ['viewer'],
      permissions: [],
      status: InvitationStatus.ACCEPTED,
      expiresAt: new Date(Date.now() + 86400000),
      acceptedAt: new Date(),
      createdAt: new Date(),
    })),
    listByTenantPage: vi.fn(async () => ({ items: [], total: 0 })),
  };

  const membershipRepository = {
    findByUser: vi.fn(async (tenantId: string, userId: string) => {
      if (tenantId === TENANT_ID && userId === GRANTOR_SUB) {
        return [
          {
            id: 'mem-grantor',
            userId: GRANTOR_SUB,
            tenantId: TENANT_ID,
            organizationId: ORG_ID,
            status: MembershipStatus.ACTIVE,
            roles: ['tenant-owner'],
            permissions: [],
            joinedAt: new Date(),
            expiresAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      }
      if (tenantId === TENANT_ID && userId === INVITEE_SUB && membershipCreated) {
        return [
          {
            id: 'mem-1',
            userId: INVITEE_SUB,
            tenantId: TENANT_ID,
            organizationId: ORG_ID,
            status: MembershipStatus.ACTIVE,
            roles: ['viewer'],
            permissions: [],
            joinedAt: new Date(),
            expiresAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      }
      return [];
    }),
    create: vi.fn(async () => {
      membershipCreated = true;
      return {
        id: 'mem-new',
        userId: INVITEE_SUB,
        tenantId: TENANT_ID,
        organizationId: ORG_ID,
        status: MembershipStatus.ACTIVE,
        roles: ['viewer'],
        permissions: [],
        joinedAt: new Date(),
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }),
    update: vi.fn(),
    findByOrganization: vi.fn(),
    findByUsers: vi.fn(async () => []),
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
    findById: vi.fn(),
    countTenantAdmins: vi.fn(),
    updateRoles: vi.fn(),
    revoke: vi.fn(),
    updateStatus: vi.fn(),
  } as unknown as MembershipRepositoryPort;

  const roleRepository: RoleRepositoryPort = {
    findPermissionsForRoles: vi.fn(async (roleNames: readonly string[]) => {
      if (roleNames.includes('tenant-owner')) {
        return ['users:invite', 'memberships:read', 'users:read'];
      }
      if (roleNames.includes('viewer')) {
        return ['users:read'];
      }
      return [];
    }),
    listRoles: vi.fn(),
    listPermissions: vi.fn(),
    findRoleByName: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    listRolesPage: vi.fn(async () => ({ items: [], total: 0 })),
    listPermissionsPage: vi.fn(async () => ({ items: [], total: 0 })),
  };

  const controlPlaneOutbox = {
    runWithOutbox: vi.fn(async <T>(_tenantId: string, fn: (client: unknown, enqueue: (event: unknown) => Promise<string>) => Promise<T>) =>
      fn({}, vi.fn(async () => 'evt-id')),
    ),
  };

  const applicationUserRepository = {
    findByIdentity: vi.fn(async () => null),
    findById: vi.fn(async () => null),
    create: vi.fn(async () => ({
      id: 'user-1',
      identityId: INVITEE_SUB,
      tenantId: TENANT_ID,
      status: ApplicationUserStatus.ACTIVE,
      profile: { email: 'invitee@example.com' },
      securityMetadata: {},
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    updateStatus: vi.fn(),
    updateProfile: vi.fn(),
    touchLastSeen: vi.fn(),
  } as unknown as ApplicationUserRepositoryPort;

  const userTenantMembership = {
    isMember: vi.fn(async () => true),
    ensureMember: vi.fn(async () => {}),
  } as unknown as UserTenantMembershipPort;
  const keycloakSync = {
    syncMembership: vi.fn(async () => {}),
  } as unknown as KeycloakOrganizationSyncService;
  const keycloakAdmin = {
    isAvailable: vi.fn(async () => false),
    getUser: vi.fn(),
  };

  const noopEmailSender: EmailSenderPort = {
    provider: 'none',
    send: vi.fn(async (): Promise<EmailSendResult> => ({ sent: false, provider: 'none' })),
  };
  const mailSurface: TenantMailSurface = {
    resolvePublicAppUrl: vi.fn(async () => 'http://localhost:3001'),
    resolveMailFrom: vi.fn(async () => 'Atlas <noreply@localhost>'),
  };

  beforeEach(() => {
    membershipCreated = false;
    vi.clearAllMocks();
  });

  it('creates invitation and accepts it creating membership', async () => {
    const noop = { getEffectiveQuotas: async () => ({ maxOrganizations: 999, maxUsers: 999 }), countDistinctUsers: async () => 0 };
    const noopTenantRegistry = { findById: async () => null };
    const createUseCase = new CreateInvitationUseCase(
      organizationRepository,
      invitationRepository,
      membershipRepository,
      roleRepository,
      controlPlaneOutbox as never,
      noop as never,
      noopTenantRegistry as never,
      noopEmailSender,
      mailSurface,
    );

    const acceptUseCase = new AcceptInvitationUseCase(
      organizationRepository,
      invitationRepository,
      applicationUserRepository,
      membershipRepository,
      userTenantMembership,
      controlPlaneOutbox as never,
      keycloakSync,
      keycloakAdmin as never,
    );

    const createResult = await createUseCase.execute({
      ctx,
      organizationId: ORG_ID,
      email: 'invitee@example.com',
    });
    token = createResult.token;
    expect(createResult.invitation.status).toBe(InvitationStatus.PENDING);
    expect(token).toHaveLength(64);
    expect(noopEmailSender.send).toHaveBeenCalledOnce();
    expect(mailSurface.resolvePublicAppUrl).toHaveBeenCalledWith(TENANT_ID);
    expect(noopEmailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'invitee@example.com',
        from: 'Atlas <noreply@localhost>',
      }),
    );
    expect(mailSurface.resolvePublicAppUrl).toHaveBeenCalledWith(TENANT_ID);

    const acceptResult = await acceptUseCase.execute({ ctx: inviteeCtx, token });
    expect(acceptResult.status).toBe('ACCEPTED');
    expect(acceptResult.organizationId).toBe(ORG_ID);
    expect(membershipRepository.create).toHaveBeenCalledOnce();
    expect(keycloakSync.syncMembership).toHaveBeenCalledOnce();
    expect(controlPlaneOutbox.runWithOutbox).toHaveBeenCalledTimes(2);
  });

  it('still returns the token when email delivery fails', async () => {
    const failingMailer: EmailSenderPort = {
      provider: 'resend',
      send: vi.fn(async () => {
        throw new Error('network down');
      }),
    };
    const createUseCase = new CreateInvitationUseCase(
      organizationRepository,
      invitationRepository,
      membershipRepository,
      roleRepository,
      controlPlaneOutbox as never,
      { getEffectiveQuotas: async () => ({ maxOrganizations: 999, maxUsers: 999 }), countDistinctUsers: async () => 0 } as never,
      { findById: async () => null } as never,
      failingMailer,
      mailSurface,
    );

    const result = await createUseCase.execute({
      ctx,
      organizationId: ORG_ID,
      email: 'invitee@example.com',
    });

    expect(result.token).toHaveLength(64);
    expect(result.emailDelivery).toEqual({
      sent: false,
      provider: 'resend',
      error: 'network down',
    });
  });

  it('rejects accept with wrong token hash', async () => {
    invitationRepository.findByTokenHash = vi.fn(async () => null);

    const acceptUseCase = new AcceptInvitationUseCase(
      organizationRepository,
      invitationRepository,
      applicationUserRepository,
      membershipRepository,
      userTenantMembership,
      controlPlaneOutbox as never,
      keycloakSync,
      keycloakAdmin as never,
    );

    tokenHash = createHash('sha256').update('wrong-token').digest('hex');
    await expect(
      acceptUseCase.execute({ ctx: inviteeCtx, token: 'wrong-token' }),
    ).rejects.toThrow();
  });
});

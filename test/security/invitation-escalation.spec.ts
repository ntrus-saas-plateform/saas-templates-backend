import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CreateInvitationUseCase,
  AcceptInvitationUseCase,
} from '../../src/modules/identity/application/invitation/invitation.use-cases.js';
import { DomainError, ErrorCode } from '../../src/core/domain/errors/domain-error.js';
import { InvitationStatus } from '../../src/modules/identity/domain/invitation/invitation.entity.js';
import { ApplicationUserStatus } from '../../src/modules/identity/domain/user/application-user.entity.js';
import type { EmailSenderPort } from '../../src/core/domain/ports/email-sender.port.js';
import type { TenantMailSurface } from '../../src/modules/identity/application/services/tenant-mail-surface.service.js';

describe('Security: Invitation escalation and email binding', () => {
  describe('CreateInvitationUseCase', () => {
    const organizationRepository = { findById: vi.fn() };
    const invitationRepository = { create: vi.fn() };
    const membershipRepository = { findByUser: vi.fn() };
    const roleRepository = { findPermissionsForRoles: vi.fn() };
    const controlPlaneOutbox = {
      runWithOutbox: vi.fn(async (_tenantId, fn) => fn({}, vi.fn())),
    };

    let useCase: CreateInvitationUseCase;

    const ctx = {
      tenantId: 'tenant-1',
      subjectId: 'inviter',
      username: 'inviter@example.com',
      organizationId: 'org-1',
      permissions: ['users:invite', 'memberships:create'],
      roles: ['viewer'],
      correlationId: 'corr',
      traceId: 'trace',
    };

    beforeEach(() => {
      vi.clearAllMocks();
      organizationRepository.findById.mockResolvedValue({ id: 'org-1', tenantId: 'tenant-1' });
      membershipRepository.findByUser.mockResolvedValue([
        {
          organizationId: 'org-1',
          roles: ['organization-administrator'],
          permissions: ['users:invite', 'memberships:create'],
        },
      ]);
      roleRepository.findPermissionsForRoles.mockImplementation(async (roles: readonly string[]) => {
        if (roles.includes('tenant-owner')) {
          return ['tenant:ownership_transfer', 'tenant:update', 'memberships:revoke'];
        }
        if (roles.includes('organization-administrator')) {
          return ['memberships:read', 'memberships:update'];
        }
        if (roles.includes('viewer')) {
          return ['memberships:read'];
        }
        return [];
      });
      invitationRepository.create.mockImplementation(async (input) => ({
        id: 'inv-1',
        ...input,
        status: InvitationStatus.PENDING,
        acceptedAt: null,
        createdAt: new Date(),
      }));
      const noop = { getEffectiveQuotas: async () => ({ maxOrganizations: 999, maxUsers: 999 }), countDistinctUsers: async () => 0 };
      const noopTenantRegistry = { findById: async () => null };
      const noopEmailSender: EmailSenderPort = {
        provider: 'none',
        send: vi.fn(async () => ({ sent: false, provider: 'none' as const })),
      };
      const mailSurface: TenantMailSurface = {
        resolvePublicAppUrl: vi.fn(async () => 'http://localhost:3001'),
        resolveMailFrom: vi.fn(async () => 'Atlas <noreply@localhost>'),
      };
      useCase = new CreateInvitationUseCase(
        organizationRepository as never,
        invitationRepository as never,
        membershipRepository as never,
        roleRepository as never,
        controlPlaneOutbox as never,
        noop as never,
        noopTenantRegistry as never,
        noopEmailSender,
        mailSurface,
      );
    });

    it('rejects roles that exceed inviter effective permissions', async () => {
      await expect(
        useCase.execute({
          ctx,
          organizationId: 'org-1',
          email: 'new@example.com',
          roles: ['tenant-owner'],
        }),
      ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });

      expect(invitationRepository.create).not.toHaveBeenCalled();
    });

    it('allows invitation when roles are within inviter scope', async () => {
      const result = await useCase.execute({
        ctx,
        organizationId: 'org-1',
        email: 'new@example.com',
        roles: ['viewer'],
      });

      expect(result.invitation.roles).toEqual(['viewer']);
      expect(result.token).toBeTruthy();
    });
  });

  describe('AcceptInvitationUseCase', () => {
    const organizationRepository = { findById: vi.fn() };
    const invitationRepository = {
      findByTokenHash: vi.fn(),
      updateStatus: vi.fn(),
    };
    const applicationUserRepository = {
      findByIdentity: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
    };
    const membershipRepository = {
      findByUser: vi.fn(),
      create: vi.fn(),
    };
    const userTenantMembership = { ensureMember: vi.fn() };
    const controlPlaneOutbox = {
      runWithOutbox: vi.fn(async (_tenantId, fn) => fn({}, vi.fn())),
    };
    const keycloakSync = { syncMembership: vi.fn() };
    const keycloakAdmin = {
      isAvailable: vi.fn(),
      getUser: vi.fn(),
    };

    let useCase: AcceptInvitationUseCase;

    const ctx = {
      tenantId: 'tenant-1',
      subjectId: 'user-b',
      username: 'other@example.com',
      organizationId: null,
      permissions: [],
      roles: [],
      correlationId: 'corr',
      traceId: 'trace',
    };

    const invitation = {
      id: 'inv-1',
      tenantId: 'tenant-1',
      organizationId: 'org-1',
      email: 'invited@example.com',
      invitedBy: 'inviter',
      roles: ['viewer'],
      permissions: [],
      tokenHash: 'hash',
      status: InvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 3600_000),
      acceptedAt: null,
      createdAt: new Date(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
      invitationRepository.findByTokenHash.mockResolvedValue(invitation);
      organizationRepository.findById.mockResolvedValue({
        id: 'org-1',
        tenantId: 'tenant-1',
        keycloakOrganizationId: 'kc-org-1',
        slug: 'org-a',
      });
      applicationUserRepository.findByIdentity.mockResolvedValue(null);
      membershipRepository.findByUser.mockResolvedValue([]);
      membershipRepository.create.mockResolvedValue({});
      applicationUserRepository.create.mockResolvedValue({
        identityId: 'user-b',
        tenantId: 'tenant-1',
        status: ApplicationUserStatus.ACTIVE,
        profile: { email: 'invited@example.com' },
      });
      keycloakAdmin.isAvailable.mockResolvedValue(false);
      useCase = new AcceptInvitationUseCase(
        organizationRepository as never,
        invitationRepository as never,
        applicationUserRepository as never,
        membershipRepository as never,
        userTenantMembership as never,
        controlPlaneOutbox as never,
        keycloakSync as never,
        keycloakAdmin as never,
      );
    });

    it('rejects accept when JWT email does not match invitation email', async () => {
      await expect(
        useCase.execute({ ctx, token: 'plain-token' }),
      ).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
        message: 'Invitation email does not match authenticated user',
      });
    });

    it('rejects when the pasted value is an organization or invitation id', async () => {
      await expect(
        useCase.execute({
          ctx,
          token: '11111111-1111-4111-8111-111111111111',
        }),
      ).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
        message: 'Paste the one-time invitation token, not an organization or invitation id',
      });
      expect(invitationRepository.findByTokenHash).not.toHaveBeenCalled();
    });

    it('accepts when JWT email claim matches invitation', async () => {
      const matchingCtx = {
        ...ctx,
        username: 'user-a',
        email: 'invited@example.com',
      };

      const result = await useCase.execute({ ctx: matchingCtx, token: 'plain-token' });

      expect(result.status).toBe('ACCEPTED');
      expect(membershipRepository.create).toHaveBeenCalled();
    });

    it('accepts when email matches invitation', async () => {
      const matchingCtx = {
        ...ctx,
        username: 'invited@example.com',
      };

      const result = await useCase.execute({ ctx: matchingCtx, token: 'plain-token' });

      expect(result.status).toBe('ACCEPTED');
      expect(membershipRepository.create).toHaveBeenCalled();
    });
  });
});

import { createHash, randomBytes } from 'node:crypto';
import type { UseCase } from '../common/use-case.js';
import type { ExecutionContext } from '../common/execution-context.js';
import { requireSubject } from '../common/access-control.js';
import type { OrganizationRepositoryPort } from '../../domain/ports/organization-repository.port.js';
import type { InvitationRepositoryPort } from '../../domain/ports/invitation-repository.port.js';
import type { ApplicationUserRepositoryPort } from '../../domain/ports/application-user-repository.port.js';
import type { MembershipRepositoryPort } from '../../domain/ports/membership-repository.port.js';
import type { UserTenantMembershipPort } from '../../domain/ports/user-tenant-membership.port.js';
import type { RoleRepositoryPort } from '../../domain/ports/role-repository.port.js';
import type { PlanRepositoryPort } from '../../domain/ports/plan-repository.port.js';
import type { TenantRegistryPort } from '../../domain/ports/tenant-registry.port.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { Invitation } from '../../domain/invitation/invitation.entity.js';
import { InvitationStatus, isInvitationUsable } from '../../domain/invitation/invitation.entity.js';
import { ApplicationUserStatus } from '../../domain/user/application-user.entity.js';
import { accessDeniedError } from '../../../../core/domain/errors/access-denied.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { createUserInvitedEvent, createUserActivatedEvent } from '../../domain/events/user-lifecycle.events.js';
import {
  assertInviterCanGrantRolesAndPermissions,
} from '../common/resolve-inviter-permissions.js';
import {
  extractEmailFromUsername,
  normalizeEmail,
} from '../common/normalize-email.js';
import type { KeycloakAdminPort } from '../../domain/ports/keycloak-admin.port.js';
import { KeycloakOrganizationSyncService } from '../services/keycloak-sync.service.js';
import { OrganizationAccessPolicyService } from '../services/organization-access-policy.service.js';
import type { PaginatedResult } from '../common/pagination.js';
import { buildPaginationMeta, normalizePageLimit } from '../common/pagination.js';
import type { EmailSendResult, EmailSenderPort } from '../../../../core/domain/ports/email-sender.port.js';
import { buildInvitationAcceptUrl, buildInvitationEmail } from './invitation-mail.js';
import type { TenantMailSurface } from '../services/tenant-mail-surface.service.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeInvitationToken(raw: string): string {
  return raw.trim().replace(/^["']+|["']+$/g, '').trim();
}

function isUuidLike(value: string): boolean {
  return UUID_RE.test(value);
}

export class CreateInvitationUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        organizationId: string;
        email: string;
        roles?: readonly string[];
        permissions?: readonly string[];
        expiresInHours?: number;
      },
      { invitation: Invitation; token: string; emailDelivery: EmailSendResult }
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly invitationRepository: InvitationRepositoryPort,
    private readonly membershipRepository: MembershipRepositoryPort,
    private readonly roleRepository: RoleRepositoryPort,
    private readonly controlPlaneOutbox: ControlPlaneOutboxTransactionService,
    private readonly planRepository: PlanRepositoryPort,
    private readonly tenantRegistry: TenantRegistryPort,
    private readonly emailSender: EmailSenderPort,
    private readonly mailSurface: TenantMailSurface,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId: string;
    email: string;
    roles?: readonly string[];
    permissions?: readonly string[];
    expiresInHours?: number;
  }): Promise<{ invitation: Invitation; token: string; emailDelivery: EmailSendResult }> {
    const ctx = requireSubject(input.ctx);
    const org = await this.organizationRepository.findById(ctx.tenantId, input.organizationId);
    if (!org) throw accessDeniedError();

    const tenant = await this.tenantRegistry.findById(ctx.tenantId);
    if (tenant) {
      const quotas = await this.planRepository.getEffectiveQuotas(tenant);
      const currentUsers = await this.planRepository.countDistinctUsers(ctx.tenantId);
      if (currentUsers >= quotas.maxUsers) {
        throw new DomainError(
          ErrorCode.CONFLICT,
          `User quota exceeded: limit is ${quotas.maxUsers}`,
        );
      }
    }

    const requestedRoles = input.roles ?? ['viewer'];
    const requestedPermissions = input.permissions ?? [];
    await assertInviterCanGrantRolesAndPermissions(
      ctx,
      this.membershipRepository,
      this.roleRepository,
      requestedRoles,
      requestedPermissions,
    );

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + (input.expiresInHours ?? 72) * 60 * 60 * 1000);

    const invitation = await this.controlPlaneOutbox.runWithOutbox(
      ctx.tenantId,
      async (client, enqueue) => {
        const created = await this.invitationRepository.create(
          {
            tenantId: ctx.tenantId,
            organizationId: input.organizationId,
            email: input.email,
            invitedBy: ctx.subjectId,
            roles: requestedRoles,
            permissions: requestedPermissions,
            tokenHash,
            expiresAt,
          },
          client,
        );

        await enqueue(
          createUserInvitedEvent({
            tenantId: ctx.tenantId,
            organizationId: input.organizationId,
            invitationId: created.id,
            email: input.email,
            actorId: ctx.subjectId,
            correlationId: ctx.correlationId,
            traceId: ctx.traceId,
          }),
        );

        return created;
      },
    );

    const emailDelivery = await this.deliverInvitationEmail({
      tenantId: ctx.tenantId,
      to: input.email,
      organizationName: org.name,
      token,
      expiresAt: invitation.expiresAt,
    });

    return { invitation, token, emailDelivery };
  }

  private async deliverInvitationEmail(input: {
    tenantId: string;
    to: string;
    organizationName: string;
    token: string;
    expiresAt: Date;
  }): Promise<EmailSendResult> {
    try {
      const publicAppUrl = await this.mailSurface.resolvePublicAppUrl(input.tenantId);
      const mailFrom = await this.mailSurface.resolveMailFrom(input.tenantId);
      const acceptUrl = buildInvitationAcceptUrl(publicAppUrl, input.token);
      const mail = buildInvitationEmail({
        organizationName: input.organizationName,
        acceptUrl,
        token: input.token,
        expiresAt: input.expiresAt,
      });
      return await this.emailSender.send({
        to: input.to,
        from: mailFrom,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
    } catch (error) {
      return {
        sent: false,
        provider: this.emailSender.provider,
        error: error instanceof Error ? error.message : 'Email send failed',
      };
    }
  }
}

export class AcceptInvitationUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; token: string },
      { organizationId: string; status: string }
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly invitationRepository: InvitationRepositoryPort,
    private readonly applicationUserRepository: ApplicationUserRepositoryPort,
    private readonly membershipRepository: MembershipRepositoryPort,
    private readonly userTenantMembership: UserTenantMembershipPort,
    private readonly controlPlaneOutbox: ControlPlaneOutboxTransactionService,
    private readonly keycloakSync: KeycloakOrganizationSyncService,
    private readonly keycloakAdmin: KeycloakAdminPort,
  ) {}

  async execute(input: { ctx: ExecutionContext; token: string }): Promise<{
    organizationId: string;
    status: string;
  }> {
    const ctx = requireSubject(input.ctx);
    const token = normalizeInvitationToken(input.token);
    if (!token) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid invitation token');
    }
    if (isUuidLike(token)) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'Paste the one-time invitation token, not an organization or invitation id',
      );
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invitation = await this.invitationRepository.findByTokenHash(tokenHash);

    if (!invitation || invitation.tenantId !== ctx.tenantId) {
      throw accessDeniedError();
    }
    if (!isInvitationUsable(invitation)) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'Invitation is expired or no longer valid');
    }

    const invitationEmail = normalizeEmail(invitation.email);
    const userEmail = await this.resolveAuthenticatedEmail(ctx);
    if (!userEmail || userEmail !== invitationEmail) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'Invitation email does not match authenticated user',
      );
    }

    if (invitation.organizationId) {
      const org = await this.organizationRepository.findById(
        ctx.tenantId,
        invitation.organizationId,
      );
      if (!org) throw accessDeniedError();
    }

    await this.controlPlaneOutbox.runWithOutbox(ctx.tenantId, async (client, enqueue) => {
      await this.userTenantMembership.ensureMember(ctx.subjectId, ctx.tenantId, client);

      let user = await this.applicationUserRepository.findByIdentity(ctx.tenantId, ctx.subjectId);
      if (!user) {
        user = await this.applicationUserRepository.create(
          {
            identityId: ctx.subjectId,
            tenantId: ctx.tenantId,
            status: ApplicationUserStatus.ACTIVE,
            profile: { email: invitation.email },
          },
          client,
        );
      } else if (user.status !== ApplicationUserStatus.ACTIVE) {
        await this.applicationUserRepository.updateStatus(
          ctx.tenantId,
          ctx.subjectId,
          ApplicationUserStatus.ACTIVE,
          client,
        );
      }

      const existing = await this.membershipRepository.findByUser(ctx.tenantId, ctx.subjectId);
      if (!existing.some((m) => m.organizationId === invitation.organizationId)) {
        await this.membershipRepository.create(
          {
            userId: ctx.subjectId,
            tenantId: ctx.tenantId,
            organizationId: invitation.organizationId,
            roles: invitation.roles,
            permissions: invitation.permissions,
          },
          client,
        );
      }

      await this.invitationRepository.updateStatus(
        ctx.tenantId,
        invitation.id,
        InvitationStatus.ACCEPTED,
        new Date(),
        client,
      );

      await enqueue(
        createUserActivatedEvent({
          tenantId: ctx.tenantId,
          identityId: ctx.subjectId,
          actorId: ctx.subjectId,
          correlationId: ctx.correlationId,
          traceId: ctx.traceId,
        }),
      );
    });

    const acceptedOrg = await this.organizationRepository.findById(
      ctx.tenantId,
      invitation.organizationId,
    );
    if (acceptedOrg) {
      await this.keycloakSync.syncMembership(ctx, acceptedOrg, ctx.subjectId, 'add');
    }

    return { organizationId: invitation.organizationId, status: 'ACCEPTED' };
  }

  private async resolveAuthenticatedEmail(ctx: ExecutionContext): Promise<string | null> {
    const fromJwt =
      extractEmailFromUsername(ctx.email) ?? extractEmailFromUsername(ctx.username);
    if (fromJwt) return fromJwt;

    const profileEmail = (
      await this.applicationUserRepository.findByIdentity(ctx.tenantId, ctx.subjectId)
    )?.profile?.email;
    const fromProfile = extractEmailFromUsername(profileEmail);
    if (fromProfile) return fromProfile;

    if (await this.keycloakAdmin.isAvailable()) {
      const kcUser = await this.keycloakAdmin.getUser(ctx.subjectId);
      return extractEmailFromUsername(kcUser?.email ?? kcUser?.username);
    }
    return null;
  }
}

export class RevokeInvitationUseCase
  implements UseCase<{ ctx: ExecutionContext; invitationId: string }, Invitation>
{
  constructor(private readonly invitationRepository: InvitationRepositoryPort) {}

  async execute(input: { ctx: ExecutionContext; invitationId: string }): Promise<Invitation> {
    const ctx = requireSubject(input.ctx);
    const invitation = await this.invitationRepository.findById(ctx.tenantId, input.invitationId);
    if (!invitation) throw accessDeniedError();
    return this.invitationRepository.updateStatus(
      ctx.tenantId,
      input.invitationId,
      InvitationStatus.REVOKED,
    );
  }
}

export class ListInvitationsUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        organizationId?: string;
        page?: number;
        limit?: number;
        status?: import('../../domain/invitation/invitation.entity.js').InvitationStatus;
        search?: string;
      },
      PaginatedResult<Invitation>
    >
{
  constructor(
    private readonly invitationRepository: InvitationRepositoryPort,
    private readonly organizationAccessPolicy: OrganizationAccessPolicyService,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId?: string;
    page?: number;
    limit?: number;
    status?: import('../../domain/invitation/invitation.entity.js').InvitationStatus;
    search?: string;
  }): Promise<PaginatedResult<Invitation>> {
    const ctx = requireSubject(input.ctx);
    const { page, limit } = normalizePageLimit(input.page, input.limit);
    if (input.organizationId) {
      await this.organizationAccessPolicy.assertOrganizationDataAccess(
        ctx.tenantId,
        ctx.subjectId,
        input.organizationId,
      );
    }
    const result = await this.invitationRepository.listByTenantPage(
      ctx.tenantId,
      page,
      limit,
      input.organizationId,
      { status: input.status, search: input.search },
    );
    return {
      data: result.items,
      pagination: buildPaginationMeta(page, limit, result.total),
    };
  }
}

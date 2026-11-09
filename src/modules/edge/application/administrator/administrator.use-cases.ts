import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  assertAdministratorTransition,
  PlatformAdministratorStatus,
  type PlatformAdministrator,
} from '../../domain/administrator/platform-administrator.entity.js';
import type { AdministratorRepositoryPort } from '../../domain/ports/administrator-repository.port.js';
import type { InvitationRepositoryPort } from '../../domain/ports/invitation-repository.port.js';
import type { MembershipRepositoryPort } from '../../domain/ports/membership-repository.port.js';
import type { RoleRepositoryPort } from '../../domain/ports/role-repository.port.js';
import type { WorkspaceSessionRepositoryPort } from '../../domain/ports/workspace-session-repository.port.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import {
  generateInvitationToken,
  hashInvitationToken,
  markInvitationAccepted,
} from '../../domain/invitation/edge-invitation.entity.js';
import { MembershipStatus } from '../../domain/membership/vertical-membership.entity.js';
import { EdgeRoleScope } from '../../domain/role/edge-role.entity.js';

export class InviteAdministratorUseCase {
  constructor(
    private readonly administrators: AdministratorRepositoryPort,
    private readonly invitations: InvitationRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
    private readonly invitationTtlHours: number,
  ) {}

  async execute(input: {
    actorId: string;
    email: string;
    displayName: string;
    verticalIds?: readonly string[];
    roleCodes?: readonly string[];
  }): Promise<{ administrator: PlatformAdministrator; invitationId: string; token: string }> {
    const email = input.email.trim().toLowerCase();
    let administrator = await this.administrators.findByEmail(email);
    if (!administrator) {
      administrator = await this.administrators.create({
        externalIdentityId: `pending:${randomUUID()}`,
        email,
        displayName: input.displayName,
        status: PlatformAdministratorStatus.INVITATION_PENDING,
        createdBy: input.actorId,
      });
    } else if (
      administrator.status !== PlatformAdministratorStatus.INVITED &&
      administrator.status !== PlatformAdministratorStatus.INVITATION_PENDING
    ) {
      throw new DomainError(ErrorCode.CONFLICT, 'Administrator already exists for email');
    } else {
      assertAdministratorTransition(
        administrator.status,
        PlatformAdministratorStatus.INVITATION_PENDING,
      );
      administrator = await this.administrators.updateStatus(
        administrator.id,
        PlatformAdministratorStatus.INVITATION_PENDING,
        { updatedBy: input.actorId },
      );
    }

    const { token, tokenHash } = generateInvitationToken();
    const expiresAt = new Date(Date.now() + this.invitationTtlHours * 60 * 60 * 1000);
    const invitation = await this.invitations.create({
      email,
      invitedBy: input.actorId,
      tokenHash,
      expiresAt,
      verticalIds: input.verticalIds ?? [],
      roleCodes: input.roleCodes ?? ['EDGE_PLATFORM_OPERATOR'],
      workflowState: 'INVITED',
      deliveryStatus: 'PENDING',
    });

    await this.audit.create({
      eventType: 'edge.administrator.invited',
      actorId: input.actorId,
      subjectType: 'administrator',
      subjectId: administrator.id,
      details: { invitationId: invitation.id, email },
    });

    return { administrator, invitationId: invitation.id, token };
  }
}

export class AcceptInvitationUseCase {
  constructor(
    private readonly administrators: AdministratorRepositoryPort,
    private readonly invitations: InvitationRepositoryPort,
    private readonly memberships: MembershipRepositoryPort,
    private readonly roles: RoleRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    token: string;
    externalIdentityId: string;
    displayName?: string;
  }): Promise<PlatformAdministrator> {
    const invitation = await this.invitations.findByTokenHash(hashInvitationToken(input.token));
    if (!invitation) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Invitation not found');
    }
    const accepted = markInvitationAccepted(invitation);
    await this.invitations.updateStatus(invitation.id, accepted.status, {
      acceptedAt: accepted.acceptedAt,
      workflowState: 'ACCEPTED',
    });

    let administrator = await this.administrators.findByEmail(invitation.email);
    if (!administrator) {
      administrator = await this.administrators.create({
        externalIdentityId: input.externalIdentityId,
        email: invitation.email,
        displayName: input.displayName ?? invitation.email,
        status: PlatformAdministratorStatus.ACTIVE,
        emailVerified: true,
      });
    } else {
      assertAdministratorTransition(administrator.status, PlatformAdministratorStatus.ACTIVE);
      administrator = await this.administrators.updateStatus(
        administrator.id,
        PlatformAdministratorStatus.ACTIVE,
        {
          externalIdentityId: input.externalIdentityId,
          emailVerified: true,
          lastSuccessfulAccessAt: new Date(),
        },
      );
    }

    for (const roleCode of invitation.roleCodes) {
      const role = await this.roles.findRoleByCode(roleCode);
      if (!role) continue;
      if (role.scope === EdgeRoleScope.GLOBAL) {
        await this.roles.createAssignment({
          administratorId: administrator.id,
          roleId: role.id,
          assignedBy: invitation.invitedBy,
        });
      }
    }

    for (const verticalId of invitation.verticalIds) {
      const existing = await this.memberships.findByAdminAndVertical(
        administrator.id,
        verticalId,
      );
      let membership = existing;
      if (!membership) {
        membership = await this.memberships.create({
          administratorId: administrator.id,
          verticalId,
          status: MembershipStatus.ACTIVE,
          invitationId: invitation.id,
          invitedBy: invitation.invitedBy,
          reason: 'invitation-accept',
        });
        membership = await this.memberships.updateStatus(membership.id, MembershipStatus.ACTIVE, {
          activatedAt: new Date(),
        });
      }
      for (const roleCode of invitation.roleCodes) {
        const role = await this.roles.findRoleByCode(roleCode);
        if (!role || role.scope !== EdgeRoleScope.VERTICAL) continue;
        await this.roles.createAssignment({
          administratorId: administrator.id,
          membershipId: membership.id,
          roleId: role.id,
          scopeVerticalId: verticalId,
          assignedBy: invitation.invitedBy,
        });
      }
    }

    await this.audit.create({
      eventType: 'edge.invitation.accepted',
      actorId: administrator.id,
      subjectType: 'invitation',
      subjectId: invitation.id,
    });

    return administrator;
  }
}

export class GetAdministratorMeUseCase {
  constructor(private readonly administrators: AdministratorRepositoryPort) {}

  async execute(administratorId: string): Promise<PlatformAdministrator> {
    const admin = await this.administrators.findById(administratorId);
    if (!admin) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Administrator not found');
    return admin;
  }
}

export class GetAdministratorByIdUseCase {
  constructor(private readonly administrators: AdministratorRepositoryPort) {}

  async execute(id: string): Promise<PlatformAdministrator> {
    const admin = await this.administrators.findById(id);
    if (!admin) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Administrator not found');
    return admin;
  }
}

export class ListAdministratorsUseCase {
  constructor(private readonly administrators: AdministratorRepositoryPort) {}

  async execute(input: {
    page: number;
    limit: number;
    status?: PlatformAdministratorStatus;
    search?: string;
  }) {
    return this.administrators.list(input);
  }
}

export class UpdateAdministratorProfileUseCase {
  constructor(private readonly administrators: AdministratorRepositoryPort) {}

  async execute(input: {
    id: string;
    actorId: string;
    displayName?: string;
    preferredLanguage?: string;
    timezone?: string;
    profilePictureRef?: string | null;
  }): Promise<PlatformAdministrator> {
    const admin = await this.administrators.findById(input.id);
    if (!admin) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Administrator not found');
    return this.administrators.updateProfile(input.id, {
      displayName: input.displayName,
      preferredLanguage: input.preferredLanguage,
      timezone: input.timezone,
      profilePictureRef: input.profilePictureRef,
      updatedBy: input.actorId,
    });
  }
}

export class SuspendAdministratorUseCase {
  constructor(
    private readonly administrators: AdministratorRepositoryPort,
    private readonly sessions: WorkspaceSessionRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    id: string;
    actorId: string;
    reason?: string;
  }): Promise<PlatformAdministrator> {
    const admin = await this.administrators.findById(input.id);
    if (!admin) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Administrator not found');
    assertAdministratorTransition(admin.status, PlatformAdministratorStatus.SUSPENDED);
    const updated = await this.administrators.updateStatus(
      admin.id,
      PlatformAdministratorStatus.SUSPENDED,
      {
        suspensionReason: input.reason ?? null,
        suspendedAt: new Date(),
        updatedBy: input.actorId,
      },
    );
    await this.sessions.revokeAllForAdministrator(admin.id, input.reason ?? 'administrator-suspended');
    await this.audit.create({
      eventType: 'edge.administrator.suspended',
      actorId: input.actorId,
      subjectType: 'administrator',
      subjectId: admin.id,
      details: { reason: input.reason ?? null },
    });
    return updated;
  }
}

export class ReinstateAdministratorUseCase {
  constructor(
    private readonly administrators: AdministratorRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { id: string; actorId: string }): Promise<PlatformAdministrator> {
    const admin = await this.administrators.findById(input.id);
    if (!admin) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Administrator not found');
    assertAdministratorTransition(admin.status, PlatformAdministratorStatus.ACTIVE);
    const updated = await this.administrators.updateStatus(
      admin.id,
      PlatformAdministratorStatus.ACTIVE,
      {
        suspensionReason: null,
        suspendedAt: null,
        updatedBy: input.actorId,
      },
    );
    await this.audit.create({
      eventType: 'edge.administrator.reinstated',
      actorId: input.actorId,
      subjectType: 'administrator',
      subjectId: admin.id,
    });
    return updated;
  }
}

export class DeactivateAdministratorUseCase {
  constructor(
    private readonly administrators: AdministratorRepositoryPort,
    private readonly sessions: WorkspaceSessionRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { id: string; actorId: string; reason?: string }): Promise<PlatformAdministrator> {
    const admin = await this.administrators.findById(input.id);
    if (!admin) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Administrator not found');
    if (admin.status !== PlatformAdministratorStatus.DEACTIVATION_PENDING) {
      assertAdministratorTransition(
        admin.status,
        PlatformAdministratorStatus.DEACTIVATION_PENDING,
      );
      await this.administrators.updateStatus(
        admin.id,
        PlatformAdministratorStatus.DEACTIVATION_PENDING,
        { updatedBy: input.actorId, suspensionReason: input.reason ?? null },
      );
    }
    const pending = await this.administrators.findById(input.id);
    if (!pending) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Administrator not found');
    assertAdministratorTransition(pending.status, PlatformAdministratorStatus.DEACTIVATED);
    const updated = await this.administrators.updateStatus(
      pending.id,
      PlatformAdministratorStatus.DEACTIVATED,
      {
        deactivatedAt: new Date(),
        updatedBy: input.actorId,
        suspensionReason: input.reason ?? pending.suspensionReason,
      },
    );
    await this.sessions.revokeAllForAdministrator(
      pending.id,
      input.reason ?? 'administrator-deactivated',
    );
    await this.audit.create({
      eventType: 'edge.administrator.deactivated',
      actorId: input.actorId,
      subjectType: 'administrator',
      subjectId: pending.id,
    });
    return updated;
  }
}

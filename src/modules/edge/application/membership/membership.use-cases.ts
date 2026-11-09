import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  assertMembershipTransition,
  MembershipStatus,
  type VerticalMembership,
} from '../../domain/membership/vertical-membership.entity.js';
import type { MembershipRepositoryPort } from '../../domain/ports/membership-repository.port.js';
import type { AdministratorRepositoryPort } from '../../domain/ports/administrator-repository.port.js';
import type { VerticalRepositoryPort } from '../../domain/ports/vertical-repository.port.js';
import type { WorkspaceSessionRepositoryPort } from '../../domain/ports/workspace-session-repository.port.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import {
  isVerticalOperational,
  VerticalStatus,
} from '../../domain/vertical/vertical.entity.js';
import { isAdministratorAccessible } from '../../domain/administrator/platform-administrator.entity.js';

export class InviteMembershipUseCase {
  constructor(
    private readonly memberships: MembershipRepositoryPort,
    private readonly administrators: AdministratorRepositoryPort,
    private readonly verticals: VerticalRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    verticalId: string;
    administratorId: string;
  }): Promise<VerticalMembership> {
    const [admin, vertical] = await Promise.all([
      this.administrators.findById(input.administratorId),
      this.verticals.findById(input.verticalId),
    ]);
    if (!admin) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Administrator not found');
    if (!vertical) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Vertical not found');
    if (
      !isVerticalOperational(vertical.status) &&
      vertical.status !== VerticalStatus.READY_FOR_ACTIVATION
    ) {
      throw new DomainError(ErrorCode.CONFLICT, 'Vertical cannot accept memberships');
    }
    const existing = await this.memberships.findByAdminAndVertical(
      input.administratorId,
      input.verticalId,
    );
    if (existing && existing.status !== MembershipStatus.REVOKED) {
      throw new DomainError(ErrorCode.CONFLICT, 'Membership already exists');
    }
    const membership = await this.memberships.create({
      administratorId: input.administratorId,
      verticalId: input.verticalId,
      status: MembershipStatus.INVITED,
      invitedBy: input.actorId,
    });
    await this.audit.create({
      eventType: 'edge.membership.invited',
      actorId: input.actorId,
      subjectType: 'membership',
      subjectId: membership.id,
      verticalId: input.verticalId,
    });
    return membership;
  }
}

export class ActivateMembershipUseCase {
  constructor(
    private readonly memberships: MembershipRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { id: string; actorId: string }): Promise<VerticalMembership> {
    const membership = await this.memberships.findById(input.id);
    if (!membership) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Membership not found');
    assertMembershipTransition(membership.status, MembershipStatus.ACTIVE);
    const updated = await this.memberships.updateStatus(membership.id, MembershipStatus.ACTIVE, {
      activatedAt: new Date(),
    });
    await this.audit.create({
      eventType: 'edge.membership.activated',
      actorId: input.actorId,
      subjectType: 'membership',
      subjectId: updated.id,
      verticalId: updated.verticalId,
    });
    return updated;
  }
}

export class SuspendMembershipUseCase {
  constructor(
    private readonly memberships: MembershipRepositoryPort,
    private readonly sessions: WorkspaceSessionRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    id: string;
    actorId: string;
    reason?: string;
  }): Promise<VerticalMembership> {
    const membership = await this.memberships.findById(input.id);
    if (!membership) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Membership not found');
    assertMembershipTransition(membership.status, MembershipStatus.SUSPENDED);
    const updated = await this.memberships.updateStatus(membership.id, MembershipStatus.SUSPENDED, {
      reason: input.reason ?? null,
      suspendedAt: new Date(),
    });
    await this.sessions.revokeAllForMembership(
      membership.id,
      input.reason ?? 'membership-suspended',
    );
    await this.audit.create({
      eventType: 'edge.membership.suspended',
      actorId: input.actorId,
      subjectType: 'membership',
      subjectId: updated.id,
      verticalId: updated.verticalId,
    });
    return updated;
  }
}

export class ReinstateMembershipUseCase {
  constructor(
    private readonly memberships: MembershipRepositoryPort,
    private readonly administrators: AdministratorRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { id: string; actorId: string }): Promise<VerticalMembership> {
    const membership = await this.memberships.findById(input.id);
    if (!membership) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Membership not found');
    const admin = await this.administrators.findById(membership.administratorId);
    if (!admin || !isAdministratorAccessible(admin.status)) {
      throw new DomainError(ErrorCode.CONFLICT, 'Administrator is not active');
    }
    assertMembershipTransition(membership.status, MembershipStatus.ACTIVE);
    const updated = await this.memberships.updateStatus(membership.id, MembershipStatus.ACTIVE, {
      suspendedAt: null,
      reason: null,
    });
    await this.audit.create({
      eventType: 'edge.membership.reinstated',
      actorId: input.actorId,
      subjectType: 'membership',
      subjectId: updated.id,
      verticalId: updated.verticalId,
    });
    return updated;
  }
}

export class RevokeMembershipUseCase {
  constructor(
    private readonly memberships: MembershipRepositoryPort,
    private readonly sessions: WorkspaceSessionRepositoryPort,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    id: string;
    actorId: string;
    reason?: string;
  }): Promise<VerticalMembership> {
    const membership = await this.memberships.findById(input.id);
    if (!membership) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Membership not found');
    assertMembershipTransition(membership.status, MembershipStatus.REVOKED);
    const updated = await this.memberships.updateStatus(membership.id, MembershipStatus.REVOKED, {
      reason: input.reason ?? null,
      revokedAt: new Date(),
    });
    await this.sessions.revokeAllForMembership(membership.id, input.reason ?? 'membership-revoked');
    await this.audit.create({
      eventType: 'edge.membership.revoked',
      actorId: input.actorId,
      subjectType: 'membership',
      subjectId: updated.id,
      verticalId: updated.verticalId,
    });
    return updated;
  }
}

export class ListMembershipsByVerticalUseCase {
  constructor(private readonly memberships: MembershipRepositoryPort) {}

  async execute(verticalId: string) {
    return this.memberships.listByVertical(verticalId);
  }
}

export class ListMembershipsByAdministratorUseCase {
  constructor(private readonly memberships: MembershipRepositoryPort) {}

  async execute(administratorId: string) {
    return this.memberships.listByAdministrator(administratorId);
  }
}

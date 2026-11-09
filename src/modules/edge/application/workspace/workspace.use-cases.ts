import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { MembershipRepositoryPort } from '../../domain/ports/membership-repository.port.js';
import type { VerticalRepositoryPort } from '../../domain/ports/vertical-repository.port.js';
import type { WorkspaceSessionRepositoryPort } from '../../domain/ports/workspace-session-repository.port.js';
import type { AdministratorRepositoryPort } from '../../domain/ports/administrator-repository.port.js';
import type { RoleRepositoryPort } from '../../domain/ports/role-repository.port.js';
import {
  assertWorkspaceSessionValid,
  generateWorkspaceSessionToken,
  hashWorkspaceSessionToken,
  WorkspaceSessionStatus,
  type WorkspaceSession,
} from '../../domain/session/workspace-session.entity.js';
import { isMembershipActive } from '../../domain/membership/vertical-membership.entity.js';
import { isVerticalOperational } from '../../domain/vertical/vertical.entity.js';
import { isAdministratorAccessible } from '../../domain/administrator/platform-administrator.entity.js';

export class ListAvailableWorkspacesUseCase {
  constructor(
    private readonly memberships: MembershipRepositoryPort,
    private readonly verticals: VerticalRepositoryPort,
  ) {}

  async execute(administratorId: string) {
    const memberships = await this.memberships.listByAdministrator(administratorId);
    const active = memberships.filter((m) => isMembershipActive(m.status));
    const workspaces = [];
    for (const membership of active) {
      const vertical = await this.verticals.findById(membership.verticalId);
      if (vertical && isVerticalOperational(vertical.status)) {
        workspaces.push({ membership, vertical });
      }
    }
    return workspaces;
  }
}

export class SwitchWorkspaceUseCase {
  constructor(
    private readonly memberships: MembershipRepositoryPort,
    private readonly verticals: VerticalRepositoryPort,
    private readonly administrators: AdministratorRepositoryPort,
    private readonly sessions: WorkspaceSessionRepositoryPort,
    private readonly ttlSeconds: number,
  ) {}

  async execute(input: {
    administratorId: string;
    verticalId: string;
  }): Promise<{ session: WorkspaceSession; token: string }> {
    const [administrator, membership, vertical] = await Promise.all([
      this.administrators.findById(input.administratorId),
      this.memberships.findByAdminAndVertical(input.administratorId, input.verticalId),
      this.verticals.findById(input.verticalId),
    ]);
    if (!administrator || !isAdministratorAccessible(administrator.status)) {
      throw new DomainError(ErrorCode.UNAUTHORIZED, 'Administrator is not active');
    }
    if (!membership || !isMembershipActive(membership.status)) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'No active membership for vertical');
    }
    if (!vertical || !isVerticalOperational(vertical.status)) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'Vertical is not operational');
    }

    await this.sessions.revokeAllForAdministrator(
      input.administratorId,
      'workspace-switch-rotate',
    );

    const { token, tokenHash } = generateWorkspaceSessionToken();
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);
    const session = await this.sessions.create({
      administratorId: administrator.id,
      membershipId: membership.id,
      verticalId: vertical.id,
      tokenHash,
      expiresAt,
    });
    return { session, token };
  }
}

export class BootstrapWorkspaceUseCase {
  constructor(private readonly switchWorkspace: SwitchWorkspaceUseCase) {}

  async execute(input: { administratorId: string; verticalId: string }) {
    return this.switchWorkspace.execute(input);
  }
}

export class GetActiveWorkspaceUseCase {
  constructor(
    private readonly sessions: WorkspaceSessionRepositoryPort,
    private readonly administrators: AdministratorRepositoryPort,
    private readonly memberships: MembershipRepositoryPort,
    private readonly verticals: VerticalRepositoryPort,
  ) {}

  async execute(input: { administratorId: string; workspaceToken: string }) {
    const session = await this.sessions.findByTokenHash(
      hashWorkspaceSessionToken(input.workspaceToken),
    );
    if (!session) throw new DomainError(ErrorCode.UNAUTHORIZED, 'Workspace session not found');
    const [administrator, membership, vertical] = await Promise.all([
      this.administrators.findById(input.administratorId),
      this.memberships.findById(session.membershipId),
      this.verticals.findById(session.verticalId),
    ]);
    if (!administrator || !membership || !vertical) {
      throw new DomainError(ErrorCode.UNAUTHORIZED, 'Workspace session invalid');
    }
    assertWorkspaceSessionValid({ session, administrator, membership, vertical });
    return { session, membership, vertical };
  }
}

export class RenewWorkspaceUseCase {
  constructor(
    private readonly sessions: WorkspaceSessionRepositoryPort,
    private readonly administrators: AdministratorRepositoryPort,
    private readonly memberships: MembershipRepositoryPort,
    private readonly verticals: VerticalRepositoryPort,
    private readonly ttlSeconds: number,
  ) {}

  async execute(input: { administratorId: string; workspaceToken: string }) {
    const session = await this.sessions.findByTokenHash(
      hashWorkspaceSessionToken(input.workspaceToken),
    );
    if (!session) throw new DomainError(ErrorCode.UNAUTHORIZED, 'Workspace session not found');
    const [administrator, membership, vertical] = await Promise.all([
      this.administrators.findById(input.administratorId),
      this.memberships.findById(session.membershipId),
      this.verticals.findById(session.verticalId),
    ]);
    if (!administrator || !membership || !vertical) {
      throw new DomainError(ErrorCode.UNAUTHORIZED, 'Workspace session invalid');
    }
    assertWorkspaceSessionValid({ session, administrator, membership, vertical });
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);
    return this.sessions.renew(session.id, expiresAt);
  }
}

export class RevokeWorkspaceUseCase {
  constructor(private readonly sessions: WorkspaceSessionRepositoryPort) {}

  async execute(input: { administratorId: string; workspaceToken: string; reason?: string }) {
    const session = await this.sessions.findByTokenHash(
      hashWorkspaceSessionToken(input.workspaceToken),
    );
    if (!session) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Workspace session not found');
    if (session.administratorId !== input.administratorId) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'Session does not belong to administrator');
    }
    return this.sessions.updateStatus(session.id, WorkspaceSessionStatus.REVOKED, {
      revokedAt: new Date(),
      revocationReason: input.reason ?? 'explicit-revoke',
    });
  }
}

export class RevokeAllWorkspacesUseCase {
  constructor(private readonly sessions: WorkspaceSessionRepositoryPort) {}

  async execute(administratorId: string, reason = 'revoke-all') {
    return this.sessions.revokeAllForAdministrator(administratorId, reason);
  }
}

export class ResolveWorkspacePermissionsUseCase {
  constructor(private readonly roles: RoleRepositoryPort) {}

  async execute(administratorId: string, verticalId: string) {
    const scoped = await this.roles.listActiveAssignmentsForAdministrator(
      administratorId,
      verticalId,
    );
    const global = await this.roles.listActiveAssignmentsForAdministrator(administratorId);
    const roleIds = [...new Set([...scoped, ...global].map((a) => a.roleId))];
    return this.roles.findPermissionCodesByRoleIds(roleIds);
  }
}

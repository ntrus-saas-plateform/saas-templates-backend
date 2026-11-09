import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { RoleRepositoryPort } from '../../domain/ports/role-repository.port.js';
import type { MembershipRepositoryPort } from '../../domain/ports/membership-repository.port.js';
import {
  EdgeRoleScope,
  type EdgeRole,
  type EdgeRoleAssignment,
} from '../../domain/role/edge-role.entity.js';
import { isMembershipActive } from '../../domain/membership/vertical-membership.entity.js';

export class ListEdgeRolesUseCase {
  constructor(private readonly roles: RoleRepositoryPort) {}

  async execute(scope?: EdgeRoleScope) {
    return this.roles.listRoles(scope);
  }
}

export class CreateCustomEdgeRoleUseCase {
  constructor(private readonly roles: RoleRepositoryPort) {}

  async execute(input: {
    code: string;
    name: string;
    description?: string | null;
    scope: EdgeRoleScope;
    permissionCodes: readonly string[];
  }): Promise<EdgeRole> {
    const existing = await this.roles.findRoleByCode(input.code);
    if (existing) throw new DomainError(ErrorCode.CONFLICT, 'Role code already exists');
    return this.roles.createRole(input);
  }
}

export class UpdateCustomEdgeRoleUseCase {
  constructor(private readonly roles: RoleRepositoryPort) {}

  async execute(input: {
    id: string;
    name?: string;
    description?: string | null;
    isActive?: boolean;
    permissionCodes?: readonly string[];
  }): Promise<EdgeRole> {
    return this.roles.updateRole(input.id, input);
  }
}

export class ListEdgePermissionsUseCase {
  constructor(private readonly roles: RoleRepositoryPort) {}

  async execute() {
    return this.roles.listPermissions();
  }
}

export class AssignEdgeRoleUseCase {
  constructor(
    private readonly roles: RoleRepositoryPort,
    private readonly memberships: MembershipRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    administratorId: string;
    roleId: string;
    membershipId?: string | null;
    scopeVerticalId?: string | null;
    expiresAt?: Date | null;
    /** Actor effective permissions in the calling context (backend-resolved). */
    actorPermissions?: readonly string[];
  }): Promise<EdgeRoleAssignment> {
    const role = await this.roles.findRoleById(input.roleId);
    if (!role || !role.isActive) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Role not found or inactive');
    }
    if (role.scope === EdgeRoleScope.GLOBAL) {
      if (input.membershipId || input.scopeVerticalId) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Global roles must not be assigned through a vertical membership',
        );
      }
      // Global assignment requires the actor to hold at least one active GLOBAL role.
      const actorGlobalAssignments = await this.roles.listActiveAssignmentsForAdministrator(
        input.actorId,
        null,
      );
      if (!actorGlobalAssignments.length) {
        throw new DomainError(
          ErrorCode.FORBIDDEN,
          'Vertical administrators cannot assign global platform roles',
        );
      }
    }
    if (role.scope === EdgeRoleScope.VERTICAL) {
      if (!input.membershipId || !input.scopeVerticalId) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Vertical role assignment requires membershipId and scopeVerticalId',
        );
      }
      const membership = await this.memberships.findById(input.membershipId);
      if (!membership || !isMembershipActive(membership.status)) {
        throw new DomainError(ErrorCode.CONFLICT, 'Membership is not active');
      }
      if (membership.verticalId !== input.scopeVerticalId) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Membership/vertical mismatch');
      }
      if (membership.administratorId !== input.administratorId) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Membership does not belong to the target administrator',
        );
      }
    }
    return this.roles.createAssignment({
      administratorId: input.administratorId,
      roleId: input.roleId,
      membershipId: input.membershipId ?? null,
      scopeVerticalId: input.scopeVerticalId ?? null,
      expiresAt: input.expiresAt ?? null,
      assignedBy: input.actorId,
    });
  }
}

export class RevokeEdgeRoleAssignmentUseCase {
  constructor(private readonly roles: RoleRepositoryPort) {}

  async execute(assignmentId: string) {
    return this.roles.revokeAssignment(assignmentId);
  }
}

export class ResolveEffectivePermissionsUseCase {
  constructor(private readonly roles: RoleRepositoryPort) {}

  /**
   * When verticalId is set: GLOBAL + that vertical only.
   * When omitted/null: GLOBAL only (never merge all vertical memberships).
   */
  async execute(input: { administratorId: string; verticalId?: string | null }) {
    const scopeVerticalId = input.verticalId === undefined ? null : input.verticalId;
    const assignments = await this.roles.listActiveAssignmentsForAdministrator(
      input.administratorId,
      scopeVerticalId,
    );
    const roleIds = [...new Set(assignments.map((a) => a.roleId))];
    const permissions = roleIds.length
      ? await this.roles.findPermissionCodesByRoleIds(roleIds)
      : [];
    return { roleIds, permissions, assignments };
  }
}

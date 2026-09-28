import { Injectable, Inject } from '@nestjs/common';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { MEMBERSHIP_REPOSITORY_PORT } from '../../modules/identity/domain/ports/membership-repository.port.js';
import type { MembershipRepositoryPort } from '../../modules/identity/domain/ports/membership-repository.port.js';
import { ROLE_REPOSITORY_PORT } from '../../modules/identity/domain/ports/role-repository.port.js';
import type { RoleRepositoryPort } from '../../modules/identity/domain/ports/role-repository.port.js';
import { DELEGATION_REPOSITORY_PORT } from '../../modules/identity/domain/ports/delegation-repository.port.js';
import type { DelegationRepositoryPort } from '../../modules/identity/domain/ports/delegation-repository.port.js';
import { EMERGENCY_ACCESS_REPOSITORY_PORT } from '../../modules/identity/domain/ports/emergency-access-repository.port.js';
import type { EmergencyAccessRepositoryPort } from '../../modules/identity/domain/ports/emergency-access-repository.port.js';
import { isDelegationActive } from '../../modules/identity/domain/delegation/delegation.entity.js';
import { isEmergencyGrantActive } from '../../modules/identity/domain/delegation/emergency-access-grant.entity.js';
import { formatPermissionKey } from '../../modules/identity/domain/role/role.entity.js';
import { isMembershipActive } from '../../modules/identity/domain/membership/organization-membership.entity.js';

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly tenantContext: TenantContextService,
    @Inject(MEMBERSHIP_REPOSITORY_PORT)
    private readonly membershipRepository: MembershipRepositoryPort,
    @Inject(ROLE_REPOSITORY_PORT)
    private readonly roleRepository: RoleRepositoryPort,
    @Inject(DELEGATION_REPOSITORY_PORT)
    private readonly delegationRepository: DelegationRepositoryPort,
    @Inject(EMERGENCY_ACCESS_REPOSITORY_PORT)
    private readonly emergencyAccessRepository: EmergencyAccessRepositoryPort,
  ) {}

  async resolveEffectivePermissions(): Promise<readonly string[]> {
    const ctx = this.tenantContext.get();
    const permissions = new Set<string>();

    if (!ctx.subjectId || !ctx.tenantId) {
      return [];
    }

    const memberships = await this.membershipRepository.findByUser(ctx.tenantId, ctx.subjectId);
    const scopedMemberships = ctx.organizationId
      ? memberships.filter((m) => m.organizationId === ctx.organizationId)
      : memberships;

    for (const membership of scopedMemberships) {
      if (!isMembershipActive(membership)) continue;
      membership.permissions.forEach((p) => permissions.add(p));
      const rolePermissions = await this.roleRepository.findPermissionsForRoles(
        membership.roles,
        ctx.tenantId,
      );
      rolePermissions.forEach((p) => permissions.add(p));
    }

    const delegations = await this.delegationRepository.findActiveByGrantee(
      ctx.tenantId,
      ctx.subjectId,
    );
    for (const delegation of delegations) {
      if (!isDelegationActive(delegation)) continue;
      if (ctx.organizationId && delegation.organizationId !== ctx.organizationId) continue;
      delegation.permissions.forEach((p) => permissions.add(p));
    }

    const emergencyGrants = await this.emergencyAccessRepository.findByTenant(ctx.tenantId);
    for (const grant of emergencyGrants) {
      if (!isEmergencyGrantActive(grant)) continue;
      if (grant.operatorIdentityId !== ctx.subjectId) continue;
      if (
        ctx.organizationId &&
        grant.organizationId &&
        grant.organizationId !== ctx.organizationId
      ) {
        continue;
      }
      const scopePermissions = grant.scope.permissions;
      if (Array.isArray(scopePermissions)) {
        for (const entry of scopePermissions) {
          if (typeof entry === 'string' && entry.length > 0) {
            permissions.add(entry);
          }
        }
      }
    }

    await this.addValidatedJwtPermissions(ctx.permissions, permissions);
    this.addPlatformAdminRolePermissions(ctx.roles, permissions);

    // Personal API tokens: non-empty scopes restrict to intersection with membership perms.
    if (ctx.authKind === 'pat' && ctx.permissions.length > 0) {
      const allowed = new Set(ctx.permissions);
      return [...permissions].filter((p) => allowed.has(p));
    }

    return [...permissions];
  }

  private addPlatformAdminRolePermissions(
    roles: readonly string[],
    permissions: Set<string>,
  ): void {
    if (!roles.includes('platform-admin')) return;
    for (const permission of [
      'tenants:create',
      'tenants:admin',
      'platform:read',
      'platform:organizations:read',
    ]) {
      permissions.add(permission);
    }
  }

  async hasAnyPermission(required: readonly string[]): Promise<boolean> {
    if (required.length === 0) return true;
    const effective = await this.resolveEffectivePermissions();
    return required.some((perm) => effective.includes(perm));
  }

  /**
   * JWT permissions are only accepted when they exist in the catalog and are already
   * derivable from membership/roles/delegation (prevents forged permission claims).
   */
  private async addValidatedJwtPermissions(
    jwtPermissions: readonly string[],
    permissions: Set<string>,
  ): Promise<void> {
    if (jwtPermissions.length === 0) return;

    const catalog = await this.roleRepository.listPermissions();
    const catalogKeys = new Set(catalog.map((p) => formatPermissionKey(p)));
    const derivedSnapshot = new Set(permissions);

    for (const permission of jwtPermissions) {
      if (!catalogKeys.has(permission)) continue;
      if (derivedSnapshot.has(permission)) {
        permissions.add(permission);
      }
    }
  }
}

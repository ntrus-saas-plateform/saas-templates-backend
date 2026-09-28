import type { MembershipRepositoryPort } from '../../domain/ports/membership-repository.port.js';
import type { RoleRepositoryPort } from '../../domain/ports/role-repository.port.js';
import type { ExecutionContext } from '../common/execution-context.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export async function resolveInviterPermissions(
  ctx: ExecutionContext,
  membershipRepository: MembershipRepositoryPort,
  roleRepository: RoleRepositoryPort,
): Promise<readonly string[]> {
  const permissions = new Set<string>();
  const memberships = await membershipRepository.findByUser(ctx.tenantId, ctx.subjectId);
  for (const membership of memberships) {
    membership.permissions.forEach((p) => permissions.add(p));
    const rolePerms = await roleRepository.findPermissionsForRoles(
      membership.roles,
      ctx.tenantId,
    );
    rolePerms.forEach((p) => permissions.add(p));
  }
  return [...permissions];
}

export async function assertInviterCanGrantRolesAndPermissions(
  ctx: ExecutionContext,
  membershipRepository: MembershipRepositoryPort,
  roleRepository: RoleRepositoryPort,
  requestedRoles: readonly string[],
  requestedPermissions: readonly string[],
): Promise<void> {
  const effectivePermissions = await resolveInviterPermissions(
    ctx,
    membershipRepository,
    roleRepository,
  );
  const roleDerivedPermissions = await roleRepository.findPermissionsForRoles(
    requestedRoles,
    ctx.tenantId,
  );
  const allRequested = [...requestedPermissions, ...roleDerivedPermissions];
  if (allRequested.some((p) => !effectivePermissions.includes(p))) {
    throw new DomainError(
      ErrorCode.FORBIDDEN,
      'Cannot grant roles or permissions exceeding your own',
    );
  }
}

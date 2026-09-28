import type { OrganizationMembership } from './organization-membership.entity.js';
import { hasTenantAdminRole, isMembershipActive } from './organization-membership.entity.js';
import { accessDeniedError } from '../../../../core/domain/errors/access-denied.js';

export function assertOrganizationMembershipAccess(
  memberships: readonly OrganizationMembership[],
  organizationId: string,
): void {
  const allowed =
    memberships.some(
      (m) => isMembershipActive(m) && m.organizationId === organizationId,
    ) || memberships.some((m) => isMembershipActive(m) && hasTenantAdminRole(m.roles));

  if (!allowed) {
    throw accessDeniedError();
  }
}

export function canAccessOrganizationMembershipData(
  memberships: readonly OrganizationMembership[],
  organizationId: string,
): boolean {
  try {
    assertOrganizationMembershipAccess(memberships, organizationId);
    return true;
  } catch {
    return false;
  }
}

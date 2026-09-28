import type { MembershipRepositoryPort } from '../../domain/ports/membership-repository.port.js';
import type { OrganizationRepositoryPort } from '../../domain/ports/organization-repository.port.js';
import type {
  ApplicationUser,
  UserOrganizationSummary,
} from '../../domain/user/application-user.entity.js';

export async function attachUserOrganizations(
  tenantId: string,
  users: readonly ApplicationUser[],
  membershipRepository: MembershipRepositoryPort,
  organizationRepository: OrganizationRepositoryPort,
): Promise<ApplicationUser[]> {
  if (users.length === 0) return [];
  const identityIds = users.map((user) => user.identityId);
  const [memberships, orgs] = await Promise.all([
    membershipRepository.findByUsers(tenantId, identityIds),
    organizationRepository.findAllByTenant(tenantId),
  ]);
  const orgNameById = new Map(orgs.map((org) => [org.id, org.name]));
  const byUser = new Map<string, UserOrganizationSummary[]>();
  for (const membership of memberships) {
    const summary: UserOrganizationSummary = {
      organizationId: membership.organizationId,
      organizationName: orgNameById.get(membership.organizationId) ?? null,
      roles: membership.roles ?? [],
      department: membership.department ?? null,
      position: membership.position ?? null,
      status: membership.status,
    };
    const list = byUser.get(membership.userId);
    if (list) list.push(summary);
    else byUser.set(membership.userId, [summary]);
  }
  return users.map((user) => ({
    ...user,
    organizations: byUser.get(user.identityId) ?? [],
  }));
}

export enum MembershipStatus {
  INVITED = 'INVITED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REMOVED = 'REMOVED',
  EXPIRED = 'EXPIRED',
}

export interface MembershipResourceScope {
  readonly permission: string;
  readonly organizationId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
}

export interface OrganizationMembership {
  readonly id: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly status: MembershipStatus;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly department: string | null;
  readonly position: string | null;
  readonly managerUserId: string | null;
  readonly resourceScopes: readonly MembershipResourceScope[];
  readonly joinedAt: Date;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const TENANT_ADMIN_ROLES: readonly string[] = [
  'tenant-owner',
  'tenant-administrator',
];

export const MEMBERSHIP_TERMINAL_STATUSES: readonly MembershipStatus[] = [
  MembershipStatus.REMOVED,
  MembershipStatus.EXPIRED,
];

export function isMembershipActive(membership: OrganizationMembership): boolean {
  if (membership.status !== MembershipStatus.ACTIVE) return false;
  if (membership.expiresAt && membership.expiresAt < new Date()) return false;
  return true;
}

export function hasTenantAdminRole(roles: readonly string[]): boolean {
  return roles.some((r) => TENANT_ADMIN_ROLES.includes(r));
}

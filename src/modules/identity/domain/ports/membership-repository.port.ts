import type {
  MembershipResourceScope,
  MembershipStatus,
  OrganizationMembership,
} from '../membership/organization-membership.entity.js';

export type MembershipListFilters = {
  status?: MembershipStatus;
  search?: string;
};

export type MembershipStatusCounts = {
  total: number;
  active: number;
  invited: number;
  suspended: number;
  removed: number;
  expired: number;
};

export interface MembershipRepositoryPort {
  findById(tenantId: string, membershipId: string): Promise<OrganizationMembership | null>;
  findByUser(tenantId: string, userId: string): Promise<readonly OrganizationMembership[]>;
  findByUsers(
    tenantId: string,
    userIds: readonly string[],
  ): Promise<readonly OrganizationMembership[]>;
  findByOrganization(
    tenantId: string,
    organizationId: string,
  ): Promise<readonly OrganizationMembership[]>;
  findByUserPage(
    tenantId: string,
    userId: string,
    page: number,
    limit: number,
    filters?: MembershipListFilters,
  ): Promise<{ items: readonly OrganizationMembership[]; total: number }>;
  findByOrganizationPage(
    tenantId: string,
    organizationId: string,
    page: number,
    limit: number,
    filters?: MembershipListFilters,
  ): Promise<{ items: readonly OrganizationMembership[]; total: number }>;
  countByOrganizationStatus(
    tenantId: string,
    organizationId: string,
  ): Promise<MembershipStatusCounts>;
  countTenantAdmins(tenantId: string, client?: unknown): Promise<number>;
  create(
    params: {
      userId: string;
      tenantId: string;
      organizationId: string;
      roles?: readonly string[];
      permissions?: readonly string[];
      status?: MembershipStatus;
      department?: string | null;
      position?: string | null;
      managerUserId?: string | null;
      resourceScopes?: readonly MembershipResourceScope[];
      expiresAt?: Date | null;
    },
    client?: unknown,
  ): Promise<OrganizationMembership>;
  updateRoles(
    tenantId: string,
    membershipId: string,
    roles: readonly string[],
    permissions: readonly string[],
    client?: unknown,
  ): Promise<OrganizationMembership>;
  update(
    tenantId: string,
    membershipId: string,
    params: {
      roles?: readonly string[];
      permissions?: readonly string[];
      status?: MembershipStatus;
      department?: string | null;
      position?: string | null;
      managerUserId?: string | null;
      resourceScopes?: readonly MembershipResourceScope[];
      expiresAt?: Date | null;
    },
    client?: unknown,
  ): Promise<OrganizationMembership>;
  revoke(tenantId: string, membershipId: string, client?: unknown): Promise<OrganizationMembership>;
  updateStatus(
    tenantId: string,
    membershipId: string,
    status: MembershipStatus,
    client?: unknown,
  ): Promise<OrganizationMembership>;
}

export const MEMBERSHIP_REPOSITORY_PORT = Symbol('MEMBERSHIP_REPOSITORY_PORT');

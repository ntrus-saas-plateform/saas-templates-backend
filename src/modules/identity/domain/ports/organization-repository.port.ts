import type { Organization } from '../organization/organization.entity.js';

export interface OrganizationRepositoryPort {
  findById(tenantId: string, organizationId: string): Promise<Organization | null>;
  findByKeycloakId(tenantId: string, keycloakOrganizationId: string): Promise<Organization | null>;
  findByUserMembership(tenantId: string, userId: string): Promise<readonly Organization[]>;
  findByUserMembershipPage(
    tenantId: string,
    userId: string,
    page: number,
    limit: number,
    opts?: { parentId?: string | null },
  ): Promise<{ items: readonly Organization[]; total: number }>;
  findAllByTenant(tenantId: string): Promise<readonly Organization[]>;
  findAllByTenantPage(
    tenantId: string,
    page: number,
    limit: number,
    opts?: { parentId?: string | null },
  ): Promise<{ items: readonly Organization[]; total: number }>;
  countOrganizations(tenantId: string): Promise<number>;
  countDistinctUsers(tenantId: string): Promise<number>;
}

export const ORGANIZATION_REPOSITORY_PORT = Symbol('ORGANIZATION_REPOSITORY_PORT');

import type { Delegation } from '../delegation/delegation.entity.js';

export interface CreateDelegationParams {
  tenantId: string;
  organizationId: string;
  grantorIdentityId: string;
  granteeIdentityId: string;
  permissions: readonly string[];
  expiresAt: Date;
}

export interface DelegationRepositoryPort {
  create(params: CreateDelegationParams): Promise<Delegation>;
  findByTenant(tenantId: string): Promise<readonly Delegation[]>;
  findByTenantPage(
    tenantId: string,
    page: number,
    limit: number,
  ): Promise<{ items: readonly Delegation[]; total: number }>;
  findActiveByGrantee(tenantId: string, granteeIdentityId: string): Promise<readonly Delegation[]>;
  revoke(tenantId: string, id: string): Promise<Delegation>;
}

export const DELEGATION_REPOSITORY_PORT = Symbol('DELEGATION_REPOSITORY_PORT');

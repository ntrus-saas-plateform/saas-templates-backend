import type { TenantDomain, DomainType } from '../domain/tenant-domain.entity.js';

export interface CreateDomainParams {
  tenantId: string;
  hostname: string;
  type?: DomainType;
  isPrimary?: boolean;
}

export interface DomainRegistryPort {
  findByHostname(hostname: string): Promise<TenantDomain | null>;
  findById(domainId: string, tenantId: string): Promise<TenantDomain | null>;
  listByTenant(tenantId: string): Promise<readonly TenantDomain[]>;
  create(params: CreateDomainParams): Promise<TenantDomain>;
  setPrimary(domainId: string, tenantId: string): Promise<void>;
  disable(domainId: string, tenantId: string): Promise<void>;
  beginVerification(domainId: string, tenantId: string): Promise<{ token: string; txtName: string }>;
  markVerified(domainId: string, tenantId: string, token: string): Promise<TenantDomain>;
}

export const DOMAIN_REGISTRY_PORT = Symbol('DOMAIN_REGISTRY_PORT');

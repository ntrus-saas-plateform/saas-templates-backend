import type { Tenant } from '../tenant/tenant.entity.js';

export interface TenantRegistryPort {
  findById(tenantId: string): Promise<Tenant | null>;
  findBySlug(slug: string): Promise<Tenant | null>;
  listActiveTenantIds(): Promise<readonly string[]>;
}

export const TENANT_REGISTRY_PORT = Symbol('TENANT_REGISTRY_PORT');

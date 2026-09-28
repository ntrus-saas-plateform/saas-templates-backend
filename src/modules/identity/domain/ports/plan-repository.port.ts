import type { Plan, PlanModule } from '../plan/plan.entity.js';
import type { Tenant } from '../tenant/tenant.entity.js';

export interface EffectiveQuotas {
  maxOrganizations: number;
  maxUsers: number;
  maxCustomers: number;
  maxProducts: number;
}

export interface PlanRepositoryPort {
  findById(planId: string): Promise<Plan | null>;
  findByCode(code: string): Promise<Plan | null>;
  findModules(planId: string): Promise<readonly PlanModule[]>;
  getEffectiveQuotas(tenant: Tenant): Promise<EffectiveQuotas>;
  countOrganizations(tenantId: string): Promise<number>;
  countDistinctUsers(tenantId: string): Promise<number>;
  countTenantCustomers(tenantId: string): Promise<number>;
  countTenantProducts(tenantId: string): Promise<number>;
}

export const PLAN_REPOSITORY_PORT = Symbol('PLAN_REPOSITORY_PORT');

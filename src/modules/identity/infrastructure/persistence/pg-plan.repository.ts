import { Injectable } from '@nestjs/common';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import type { PlanRepositoryPort, EffectiveQuotas } from '../../domain/ports/plan-repository.port.js';
import type { Plan, PlanModule } from '../../domain/plan/plan.entity.js';
import type { Tenant } from '../../domain/tenant/tenant.entity.js';

interface PlanRow {
  id: string;
  code: string;
  name: string;
  max_organizations: number;
  max_users: number;
  max_customers: number;
  max_products: number;
  created_at: Date;
  updated_at: Date;
}

interface PlanModuleRow {
  plan_id: string;
  module_key: string;
  enabled: boolean;
}

@Injectable()
export class PgPlanRepository implements PlanRepositoryPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  private get pool() {
    return this.dbManager.getControlPlanePool();
  }

  async findById(planId: string): Promise<Plan | null> {
    const result = await this.pool.query<PlanRow>(
      `SELECT id, code, name, max_organizations, max_users, max_customers, max_products, created_at, updated_at
       FROM plans WHERE id = $1`,
      [planId],
    );
    return result.rows[0] ? this.mapPlanRow(result.rows[0]) : null;
  }

  async findByCode(code: string): Promise<Plan | null> {
    const result = await this.pool.query<PlanRow>(
      `SELECT id, code, name, max_organizations, max_users, max_customers, max_products, created_at, updated_at
       FROM plans WHERE code = $1`,
      [code],
    );
    return result.rows[0] ? this.mapPlanRow(result.rows[0]) : null;
  }

  async findModules(planId: string): Promise<readonly PlanModule[]> {
    const result = await this.pool.query<PlanModuleRow>(
      `SELECT plan_id, module_key, enabled FROM plan_modules WHERE plan_id = $1`,
      [planId],
    );
    return result.rows.map((row) => ({
      planId: row.plan_id,
      moduleKey: row.module_key,
      enabled: row.enabled,
    }));
  }

  async getEffectiveQuotas(tenant: Tenant): Promise<EffectiveQuotas> {
    let baseMaxOrgs = 5;
    let baseMaxUsers = 25;
    let baseMaxCustomers = 1000;
    let baseMaxProducts = 5000;

    if (tenant.planId) {
      const plan = await this.findById(tenant.planId);
      if (plan) {
        baseMaxOrgs = plan.maxOrganizations;
        baseMaxUsers = plan.maxUsers;
        baseMaxCustomers = plan.maxCustomers;
        baseMaxProducts = plan.maxProducts;
      }
    }

    return {
      maxOrganizations: tenant.maxOrganizationsOverride ?? baseMaxOrgs,
      maxUsers: tenant.maxUsersOverride ?? baseMaxUsers,
      maxCustomers: tenant.maxCustomersOverride ?? baseMaxCustomers,
      maxProducts: tenant.maxProductsOverride ?? baseMaxProducts,
    };
  }

  async countOrganizations(tenantId: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM organizations
       WHERE tenant_id = $1 AND status = 'ACTIVE'`,
      [tenantId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async countDistinctUsers(tenantId: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(DISTINCT m.user_id)::text AS count
       FROM user_organization_memberships m
       INNER JOIN organizations o ON o.id = m.organization_id
       WHERE o.tenant_id = $1`,
      [tenantId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async countTenantCustomers(tenantId: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tenant_customers WHERE tenant_id = $1`,
      [tenantId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async countTenantProducts(tenantId: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM products WHERE tenant_id = $1 AND status = 'ACTIVE'`,
      [tenantId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private mapPlanRow(row: PlanRow): Plan {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      maxOrganizations: row.max_organizations,
      maxUsers: row.max_users,
      maxCustomers: row.max_customers ?? 1000,
      maxProducts: row.max_products ?? 5000,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

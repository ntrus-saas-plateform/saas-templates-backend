import { Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type { TenantRegistryPort } from '../../domain/ports/tenant-registry.port.js';
import type { Tenant } from '../../domain/tenant/tenant.entity.js';
import { TENANT_SELECT_COLUMNS } from '../../domain/tenant/tenant-profile.js';
import { mapTenantRow, type TenantRow } from '../../domain/tenant/tenant-row.mapper.js';

@Injectable()
export class PgTenantRegistry implements TenantRegistryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async findById(tenantId: string): Promise<Tenant | null> {
    const result = await this.pool.query<TenantRow>(
      `SELECT ${TENANT_SELECT_COLUMNS} FROM tenants WHERE id = $1 AND status != 'DELETED'`,
      [tenantId],
    );
    return result.rows[0] ? mapTenantRow(result.rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const result = await this.pool.query<TenantRow>(
      `SELECT ${TENANT_SELECT_COLUMNS} FROM tenants WHERE slug = $1 AND status != 'DELETED'`,
      [slug],
    );
    return result.rows[0] ? mapTenantRow(result.rows[0]) : null;
  }

  async listActiveTenantIds(): Promise<readonly string[]> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT id FROM tenants WHERE status = 'ACTIVE'`,
    );
    return result.rows.map((r) => r.id);
  }
}

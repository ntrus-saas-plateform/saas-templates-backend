import { Injectable } from '@nestjs/common';
import type { UserTenantMembershipPort } from '../../domain/ports/user-tenant-membership.port.js';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';

@Injectable()
export class PgUserTenantMembershipRepository implements UserTenantMembershipPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async isMember(userId: string, tenantId: string): Promise<boolean> {
    const pool = this.dbManager.getControlPlanePool();
    const result = await pool.query(
      `SELECT 1 FROM user_tenant_memberships
       WHERE user_id = $1 AND tenant_id = $2 AND status = 'ACTIVE'`,
      [userId, tenantId],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async ensureMember(userId: string, tenantId: string, client?: unknown): Promise<void> {
    const pool = client
      ? (client as import('pg').PoolClient)
      : this.dbManager.getControlPlanePool();
    await pool.query(
      `INSERT INTO user_tenant_memberships (user_id, tenant_id, status)
       VALUES ($1, $2, 'ACTIVE')
       ON CONFLICT (user_id, tenant_id) DO UPDATE SET status = 'ACTIVE', updated_at = NOW()`,
      [userId, tenantId],
    );
  }

  async listActiveMemberIdentityIds(tenantId: string): Promise<readonly string[]> {
    const pool = this.dbManager.getControlPlanePool();
    const result = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM user_tenant_memberships
       WHERE tenant_id = $1 AND status = 'ACTIVE'`,
      [tenantId],
    );
    return result.rows.map((row) => row.user_id);
  }
}

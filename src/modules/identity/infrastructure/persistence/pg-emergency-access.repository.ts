import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import type {
  EmergencyAccessRepositoryPort,
  CreateEmergencyAccessParams,
} from '../../domain/ports/emergency-access-repository.port.js';
import type { EmergencyAccessGrant } from '../../domain/delegation/emergency-access-grant.entity.js';

interface EmergencyAccessRow {
  id: string;
  tenant_id: string;
  organization_id: string | null;
  operator_identity_id: string;
  approved_by_identity_id: string;
  reason: string;
  scope: Record<string, unknown>;
  expires_at: Date;
  created_at: Date;
  revoked_at: Date | null;
}

@Injectable()
export class PgEmergencyAccessRepository implements EmergencyAccessRepositoryPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async create(params: CreateEmergencyAccessParams): Promise<EmergencyAccessGrant> {
    const id = randomUUID();
    const result = await this.pool.query<EmergencyAccessRow>(
      `INSERT INTO emergency_access_grants (id, tenant_id, organization_id, operator_identity_id,
         approved_by_identity_id, reason, scope, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, tenant_id, organization_id, operator_identity_id, approved_by_identity_id,
                 reason, scope, expires_at, created_at, revoked_at`,
      [
        id,
        params.tenantId,
        params.organizationId,
        params.operatorIdentityId,
        params.approvedByIdentityId,
        params.reason,
        JSON.stringify(params.scope),
        params.expiresAt,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async findByTenant(tenantId: string): Promise<readonly EmergencyAccessGrant[]> {
    const result = await this.pool.query<EmergencyAccessRow>(
      `SELECT id, tenant_id, organization_id, operator_identity_id, approved_by_identity_id,
              reason, scope, expires_at, created_at, revoked_at
       FROM emergency_access_grants WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async findByTenantPage(
    tenantId: string,
    page: number,
    limit: number,
  ): Promise<{ items: readonly EmergencyAccessGrant[]; total: number }> {
    const offset = (page - 1) * limit;
    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM emergency_access_grants WHERE tenant_id = $1`,
      [tenantId],
    );
    const total = Number(countResult.rows[0]?.count ?? 0);
    const result = await this.pool.query<EmergencyAccessRow>(
      `SELECT id, tenant_id, organization_id, operator_identity_id, approved_by_identity_id,
              reason, scope, expires_at, created_at, revoked_at
       FROM emergency_access_grants WHERE tenant_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset],
    );
    return { items: result.rows.map((row) => this.mapRow(row)), total };
  }

  async revoke(tenantId: string, id: string): Promise<EmergencyAccessGrant> {
    const result = await this.pool.query<EmergencyAccessRow>(
      `UPDATE emergency_access_grants SET revoked_at = NOW()
       WHERE tenant_id = $1 AND id = $2 AND revoked_at IS NULL
       RETURNING id, tenant_id, organization_id, operator_identity_id, approved_by_identity_id,
                 reason, scope, expires_at, created_at, revoked_at`,
      [tenantId, id],
    );
    if (!result.rows[0]) {
      throw new Error('Emergency access grant not found or already revoked');
    }
    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: EmergencyAccessRow): EmergencyAccessGrant {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      organizationId: row.organization_id,
      operatorIdentityId: row.operator_identity_id,
      approvedByIdentityId: row.approved_by_identity_id,
      reason: row.reason,
      scope: row.scope ?? {},
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      revokedAt: row.revoked_at,
    };
  }

  private get pool() {
    return this.dbManager.getControlPlanePool();
  }
}

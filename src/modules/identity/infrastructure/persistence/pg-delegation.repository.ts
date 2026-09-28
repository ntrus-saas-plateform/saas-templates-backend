import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import type {
  DelegationRepositoryPort,
  CreateDelegationParams,
} from '../../domain/ports/delegation-repository.port.js';
import type { Delegation } from '../../domain/delegation/delegation.entity.js';

interface DelegationRow {
  id: string;
  tenant_id: string;
  organization_id: string;
  grantor_identity_id: string;
  grantee_identity_id: string;
  permissions: string[];
  expires_at: Date;
  created_at: Date;
  revoked_at: Date | null;
}

@Injectable()
export class PgDelegationRepository implements DelegationRepositoryPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async create(params: CreateDelegationParams): Promise<Delegation> {
    const id = randomUUID();
    const result = await this.pool.query<DelegationRow>(
      `INSERT INTO delegations (id, tenant_id, organization_id, grantor_identity_id,
         grantee_identity_id, permissions, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, tenant_id, organization_id, grantor_identity_id, grantee_identity_id,
                 permissions, expires_at, created_at, revoked_at`,
      [
        id,
        params.tenantId,
        params.organizationId,
        params.grantorIdentityId,
        params.granteeIdentityId,
        JSON.stringify(params.permissions),
        params.expiresAt,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async findByTenant(tenantId: string): Promise<readonly Delegation[]> {
    const result = await this.pool.query<DelegationRow>(
      `SELECT id, tenant_id, organization_id, grantor_identity_id, grantee_identity_id,
              permissions, expires_at, created_at, revoked_at
       FROM delegations WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async findByTenantPage(
    tenantId: string,
    page: number,
    limit: number,
  ): Promise<{ items: readonly Delegation[]; total: number }> {
    const offset = (page - 1) * limit;
    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM delegations WHERE tenant_id = $1`,
      [tenantId],
    );
    const total = Number(countResult.rows[0]?.count ?? 0);
    const result = await this.pool.query<DelegationRow>(
      `SELECT id, tenant_id, organization_id, grantor_identity_id, grantee_identity_id,
              permissions, expires_at, created_at, revoked_at
       FROM delegations WHERE tenant_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset],
    );
    return { items: result.rows.map((row) => this.mapRow(row)), total };
  }

  async findActiveByGrantee(
    tenantId: string,
    granteeIdentityId: string,
  ): Promise<readonly Delegation[]> {
    const result = await this.pool.query<DelegationRow>(
      `SELECT id, tenant_id, organization_id, grantor_identity_id, grantee_identity_id,
              permissions, expires_at, created_at, revoked_at
       FROM delegations
       WHERE tenant_id = $1 AND grantee_identity_id = $2
         AND revoked_at IS NULL AND expires_at > NOW()`,
      [tenantId, granteeIdentityId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async revoke(tenantId: string, id: string): Promise<Delegation> {
    const result = await this.pool.query<DelegationRow>(
      `UPDATE delegations SET revoked_at = NOW()
       WHERE tenant_id = $1 AND id = $2 AND revoked_at IS NULL
       RETURNING id, tenant_id, organization_id, grantor_identity_id, grantee_identity_id,
                 permissions, expires_at, created_at, revoked_at`,
      [tenantId, id],
    );
    if (!result.rows[0]) {
      throw new Error('Delegation not found or already revoked');
    }
    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: DelegationRow): Delegation {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      organizationId: row.organization_id,
      grantorIdentityId: row.grantor_identity_id,
      granteeIdentityId: row.grantee_identity_id,
      permissions: row.permissions ?? [],
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      revokedAt: row.revoked_at,
    };
  }

  private get pool() {
    return this.dbManager.getControlPlanePool();
  }
}

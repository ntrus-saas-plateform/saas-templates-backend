import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import type { ApplicationUserRepositoryPort } from '../../domain/ports/application-user-repository.port.js';
import {
  ApplicationUserStatus,
  type ApplicationUser,
  type ApplicationUserProfile,
} from '../../domain/user/application-user.entity.js';

interface ApplicationUserRow {
  id: string;
  identity_id: string;
  tenant_id: string;
  status: ApplicationUserStatus;
  profile: ApplicationUserProfile;
  security_metadata: Record<string, unknown>;
  last_seen_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PgApplicationUserRepository implements ApplicationUserRepositoryPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async findByIdentity(tenantId: string, identityId: string): Promise<ApplicationUser | null> {
    const pool = this.dbManager.getControlPlanePool();
    const result = await pool.query<ApplicationUserRow>(
      `SELECT id, identity_id, tenant_id, status, profile, security_metadata,
              last_seen_at, created_at, updated_at
       FROM application_users WHERE tenant_id = $1 AND identity_id = $2`,
      [tenantId, identityId],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findById(tenantId: string, id: string): Promise<ApplicationUser | null> {
    const pool = this.dbManager.getControlPlanePool();
    const result = await pool.query<ApplicationUserRow>(
      `SELECT id, identity_id, tenant_id, status, profile, security_metadata,
              last_seen_at, created_at, updated_at
       FROM application_users WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByIdentityOrId(
    tenantId: string,
    identityOrUserId: string,
  ): Promise<ApplicationUser | null> {
    const byIdentity = await this.findByIdentity(tenantId, identityOrUserId);
    if (byIdentity) return byIdentity;
    return this.findById(tenantId, identityOrUserId);
  }

  async create(
    params: {
      identityId: string;
      tenantId: string;
      status?: ApplicationUserStatus;
      profile?: ApplicationUserProfile;
    },
    client?: unknown,
  ): Promise<ApplicationUser> {
    const id = randomUUID();
    const query = `INSERT INTO application_users (id, identity_id, tenant_id, status, profile)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, identity_id, tenant_id, status, profile, security_metadata,
                last_seen_at, created_at, updated_at`;
    const values = [
      id,
      params.identityId,
      params.tenantId,
      params.status ?? ApplicationUserStatus.PENDING_ACTIVATION,
      JSON.stringify(params.profile ?? {}),
    ];
    const executor = this.getExecutor(client);
    const result = await executor.query<ApplicationUserRow>(query, values);
    return this.mapRow(result.rows[0]);
  }

  async updateProfile(
    tenantId: string,
    identityId: string,
    profile: ApplicationUserProfile,
    client?: unknown,
  ): Promise<ApplicationUser> {
    const executor = this.getExecutor(client);
    const result = await executor.query<ApplicationUserRow>(
      `UPDATE application_users SET profile = $3, updated_at = NOW()
       WHERE tenant_id = $1 AND identity_id = $2
       RETURNING id, identity_id, tenant_id, status, profile, security_metadata,
                 last_seen_at, created_at, updated_at`,
      [tenantId, identityId, JSON.stringify(profile)],
    );
    return this.mapRow(result.rows[0]);
  }

  async updateStatus(
    tenantId: string,
    identityId: string,
    status: ApplicationUserStatus,
    client?: unknown,
  ): Promise<ApplicationUser> {
    const executor = this.getExecutor(client);
    const result = await executor.query<ApplicationUserRow>(
      `UPDATE application_users SET status = $3, updated_at = NOW()
       WHERE tenant_id = $1 AND identity_id = $2
       RETURNING id, identity_id, tenant_id, status, profile, security_metadata,
                 last_seen_at, created_at, updated_at`,
      [tenantId, identityId, status],
    );
    return this.mapRow(result.rows[0]);
  }

  async touchLastSeen(tenantId: string, identityId: string): Promise<void> {
    const pool = this.dbManager.getControlPlanePool();
    await pool.query(
      `UPDATE application_users SET last_seen_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND identity_id = $2`,
      [tenantId, identityId],
    );
  }

  async listPage(
    tenantId: string,
    page: number,
    limit: number,
    status?: ApplicationUserStatus,
    search?: string,
  ): Promise<{ items: readonly ApplicationUser[]; total: number }> {
    const offset = (page - 1) * limit;
    const pool = this.dbManager.getControlPlanePool();
    const params: unknown[] = [tenantId];
    const filters: string[] = ['tenant_id = $1'];
    if (status) {
      params.push(status);
      filters.push(`status = $${params.length}`);
    }
    const term = search?.trim();
    if (term) {
      params.push(`%${term.replace(/[%_]/g, '')}%`);
      const p = `$${params.length}`;
      filters.push(`(
        COALESCE(profile->>'displayName', '') ILIKE ${p}
        OR COALESCE(profile->>'email', '') ILIKE ${p}
        OR COALESCE(profile->>'firstName', '') ILIKE ${p}
        OR COALESCE(profile->>'lastName', '') ILIKE ${p}
        OR COALESCE(profile->>'jobTitle', '') ILIKE ${p}
        OR COALESCE(profile->>'employeeNumber', '') ILIKE ${p}
        OR COALESCE(profile->>'preferredName', '') ILIKE ${p}
      )`);
    }
    const where = filters.join(' AND ');
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM application_users WHERE ${where}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);
    params.push(limit, offset);
    const result = await pool.query<ApplicationUserRow>(
      `SELECT id, identity_id, tenant_id, status, profile, security_metadata,
              last_seen_at, created_at, updated_at
       FROM application_users WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: result.rows.map((row) => this.mapRow(row)), total };
  }

  private getExecutor(client?: unknown) {
    return client ? (client as PoolClient) : this.dbManager.getControlPlanePool();
  }

  private mapRow(row: ApplicationUserRow): ApplicationUser {
    return {
      id: row.id,
      identityId: row.identity_id,
      tenantId: row.tenant_id,
      status: row.status,
      profile: row.profile ?? {},
      securityMetadata: row.security_metadata ?? {},
      lastSeenAt: row.last_seen_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

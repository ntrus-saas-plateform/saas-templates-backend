import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import type { InvitationRepositoryPort, CreateInvitationParams } from '../../domain/ports/invitation-repository.port.js';
import {
  InvitationStatus,
  type Invitation,
} from '../../domain/invitation/invitation.entity.js';

interface InvitationRow {
  id: string;
  tenant_id: string;
  organization_id: string;
  email: string;
  invited_by: string;
  roles: string[];
  permissions: string[];
  status: InvitationStatus;
  expires_at: Date;
  accepted_at: Date | null;
  created_at: Date;
}

@Injectable()
export class PgInvitationRepository implements InvitationRepositoryPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async findById(tenantId: string, id: string): Promise<Invitation | null> {
    const result = await this.pool.query<InvitationRow>(
      `SELECT id, tenant_id, organization_id, email, invited_by, roles, permissions,
              status, expires_at, accepted_at, created_at
       FROM invitations WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    const result = await this.pool.query<InvitationRow>(
      `SELECT id, tenant_id, organization_id, email, invited_by, roles, permissions,
              status, expires_at, accepted_at, created_at
       FROM invitations WHERE token_hash = $1`,
      [tokenHash],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async create(params: CreateInvitationParams, client?: unknown): Promise<Invitation> {
    const id = randomUUID();
    const executor = this.getExecutor(client);
    const result = await executor.query<InvitationRow>(
      `INSERT INTO invitations (id, tenant_id, organization_id, email, invited_by,
         roles, permissions, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, tenant_id, organization_id, email, invited_by, roles, permissions,
                 status, expires_at, accepted_at, created_at`,
      [
        id,
        params.tenantId,
        params.organizationId,
        params.email.toLowerCase(),
        params.invitedBy,
        JSON.stringify(params.roles),
        JSON.stringify(params.permissions),
        params.tokenHash,
        params.expiresAt,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: InvitationStatus,
    acceptedAt?: Date | null,
    client?: unknown,
  ): Promise<Invitation> {
    const executor = this.getExecutor(client);
    const result = await executor.query<InvitationRow>(
      `UPDATE invitations SET status = $3, accepted_at = $4
       WHERE tenant_id = $1 AND id = $2
       RETURNING id, tenant_id, organization_id, email, invited_by, roles, permissions,
                 status, expires_at, accepted_at, created_at`,
      [tenantId, id, status, acceptedAt ?? null],
    );
    return this.mapRow(result.rows[0]);
  }

  async listByTenantPage(
    tenantId: string,
    page: number,
    limit: number,
    organizationId?: string,
    filters?: { status?: InvitationStatus; search?: string },
  ): Promise<{ items: readonly Invitation[]; total: number }> {
    const offset = (page - 1) * limit;
    const params: unknown[] = [tenantId];
    const clauses = ['tenant_id = $1'];
    if (organizationId) {
      params.push(organizationId);
      clauses.push(`organization_id = $${params.length}`);
    }
    if (filters?.status) {
      params.push(filters.status);
      clauses.push(`status = $${params.length}`);
    }
    const search = filters?.search?.trim();
    if (search) {
      params.push(`%${search}%`);
      clauses.push(`email ILIKE $${params.length}`);
    }
    const whereSql = clauses.join(' AND ');
    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM invitations WHERE ${whereSql}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);
    params.push(limit, offset);
    const result = await this.pool.query<InvitationRow>(
      `SELECT id, tenant_id, organization_id, email, invited_by, roles, permissions,
              status, expires_at, accepted_at, created_at
       FROM invitations WHERE ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: result.rows.map((row) => this.mapRow(row)), total };
  }

  private get pool() {
    return this.dbManager.getControlPlanePool();
  }

  private getExecutor(client?: unknown) {
    return client ? (client as PoolClient) : this.pool;
  }

  private mapRow(row: InvitationRow): Invitation {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      organizationId: row.organization_id,
      email: row.email,
      invitedBy: row.invited_by,
      roles: row.roles ?? [],
      permissions: row.permissions ?? [],
      status: row.status,
      expiresAt: row.expires_at,
      acceptedAt: row.accepted_at,
      createdAt: row.created_at,
    };
  }
}

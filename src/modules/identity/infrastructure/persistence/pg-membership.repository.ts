import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import type {
  MembershipListFilters,
  MembershipRepositoryPort,
  MembershipStatusCounts,
} from '../../domain/ports/membership-repository.port.js';
import {
  MembershipStatus,
  TENANT_ADMIN_ROLES,
  type MembershipResourceScope,
  type OrganizationMembership,
} from '../../domain/membership/organization-membership.entity.js';

interface MembershipRow {
  id: string;
  user_id: string;
  tenant_id: string;
  organization_id: string;
  status: MembershipStatus;
  roles: string[];
  permissions: string[];
  department: string | null;
  position: string | null;
  manager_user_id: string | null;
  resource_scopes: MembershipResourceScope[] | null;
  joined_at: Date;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const MEMBERSHIP_COLUMNS = `
  id, user_id, tenant_id, organization_id, status, roles, permissions,
  department, position, manager_user_id, resource_scopes,
  joined_at, expires_at, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const ACTIVE_FILTER = `status NOT IN ('REMOVED', 'EXPIRED')`;

@Injectable()
export class PgMembershipRepository implements MembershipRepositoryPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async findById(tenantId: string, membershipId: string): Promise<OrganizationMembership | null> {
    const result = await this.pool.query<MembershipRow>(
      `SELECT ${MEMBERSHIP_COLUMNS}
       FROM user_organization_memberships WHERE tenant_id = $1 AND id = $2`,
      [tenantId, membershipId],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByUser(tenantId: string, userId: string): Promise<readonly OrganizationMembership[]> {
    const result = await this.pool.query<MembershipRow>(
      `SELECT ${MEMBERSHIP_COLUMNS}
       FROM user_organization_memberships WHERE tenant_id = $1 AND user_id = $2
       AND ${ACTIVE_FILTER}`,
      [tenantId, userId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async findByUsers(
    tenantId: string,
    userIds: readonly string[],
  ): Promise<readonly OrganizationMembership[]> {
    if (userIds.length === 0) return [];
    const result = await this.pool.query<MembershipRow>(
      `SELECT ${MEMBERSHIP_COLUMNS}
       FROM user_organization_memberships
       WHERE tenant_id = $1 AND user_id = ANY($2::text[])
       AND ${ACTIVE_FILTER}`,
      [tenantId, userIds],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async findByOrganization(
    tenantId: string,
    organizationId: string,
  ): Promise<readonly OrganizationMembership[]> {
    const result = await this.pool.query<MembershipRow>(
      `SELECT ${MEMBERSHIP_COLUMNS}
       FROM user_organization_memberships WHERE tenant_id = $1 AND organization_id = $2
       AND ${ACTIVE_FILTER}`,
      [tenantId, organizationId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async findByUserPage(
    tenantId: string,
    userId: string,
    page: number,
    limit: number,
    filters?: MembershipListFilters,
  ): Promise<{ items: readonly OrganizationMembership[]; total: number }> {
    return this.pageQuery(
      'tenant_id = $1 AND user_id = $2',
      [tenantId, userId],
      page,
      limit,
      filters,
    );
  }

  async findByOrganizationPage(
    tenantId: string,
    organizationId: string,
    page: number,
    limit: number,
    filters?: MembershipListFilters,
  ): Promise<{ items: readonly OrganizationMembership[]; total: number }> {
    return this.pageQuery(
      'tenant_id = $1 AND organization_id = $2',
      [tenantId, organizationId],
      page,
      limit,
      filters,
    );
  }

  async countByOrganizationStatus(
    tenantId: string,
    organizationId: string,
  ): Promise<MembershipStatusCounts> {
    const result = await this.pool.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count
       FROM user_organization_memberships
       WHERE tenant_id = $1 AND organization_id = $2
       GROUP BY status`,
      [tenantId, organizationId],
    );
    const counts: MembershipStatusCounts = {
      total: 0,
      active: 0,
      invited: 0,
      suspended: 0,
      removed: 0,
      expired: 0,
    };
    for (const row of result.rows) {
      const n = Number(row.count ?? 0);
      counts.total += n;
      if (row.status === MembershipStatus.ACTIVE) counts.active = n;
      else if (row.status === MembershipStatus.INVITED) counts.invited = n;
      else if (row.status === MembershipStatus.SUSPENDED) counts.suspended = n;
      else if (row.status === MembershipStatus.REMOVED) counts.removed = n;
      else if (row.status === MembershipStatus.EXPIRED) counts.expired = n;
    }
    // KPI "total" excludes terminal statuses (matches default list filter)
    counts.total = counts.active + counts.invited + counts.suspended;
    return counts;
  }

  async countTenantAdmins(tenantId: string, client?: unknown): Promise<number> {
    const executor = this.getExecutor(client);
    const result = await executor.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM user_organization_memberships m
       WHERE m.tenant_id = $1 AND m.status = 'ACTIVE'
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(m.roles) AS role(name)
         WHERE role.name = ANY($2::text[])
       )`,
      [tenantId, TENANT_ADMIN_ROLES],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async create(
    params: {
      userId: string;
      tenantId: string;
      organizationId: string;
      roles?: readonly string[];
      permissions?: readonly string[];
      status?: MembershipStatus;
      department?: string | null;
      position?: string | null;
      managerUserId?: string | null;
      resourceScopes?: readonly MembershipResourceScope[];
      expiresAt?: Date | null;
    },
    client?: unknown,
  ): Promise<OrganizationMembership> {
    const id = randomUUID();
    const executor = this.getExecutor(client);
    const result = await executor.query<MembershipRow>(
      `INSERT INTO user_organization_memberships
        (id, user_id, tenant_id, organization_id, status, roles, permissions,
         department, position, manager_user_id, resource_scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
       RETURNING ${MEMBERSHIP_COLUMNS}`,
      [
        id,
        params.userId,
        params.tenantId,
        params.organizationId,
        params.status ?? MembershipStatus.ACTIVE,
        JSON.stringify(params.roles ?? []),
        JSON.stringify(params.permissions ?? []),
        params.department ?? null,
        params.position ?? null,
        params.managerUserId ?? null,
        JSON.stringify(params.resourceScopes ?? []),
        params.expiresAt ?? null,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async updateRoles(
    tenantId: string,
    membershipId: string,
    roles: readonly string[],
    permissions: readonly string[],
    client?: unknown,
  ): Promise<OrganizationMembership> {
    return this.update(
      tenantId,
      membershipId,
      { roles, permissions },
      client,
    );
  }

  async update(
    tenantId: string,
    membershipId: string,
    params: {
      roles?: readonly string[];
      permissions?: readonly string[];
      status?: MembershipStatus;
      department?: string | null;
      position?: string | null;
      managerUserId?: string | null;
      resourceScopes?: readonly MembershipResourceScope[];
      expiresAt?: Date | null;
    },
    client?: unknown,
  ): Promise<OrganizationMembership> {
    const fields: string[] = [];
    const values: unknown[] = [tenantId, membershipId];
    let idx = 3;

    if (params.roles !== undefined) {
      fields.push(`roles = $${idx}`);
      values.push(JSON.stringify(params.roles));
      idx++;
    }
    if (params.permissions !== undefined) {
      fields.push(`permissions = $${idx}`);
      values.push(JSON.stringify(params.permissions));
      idx++;
    }
    if (params.status !== undefined) {
      fields.push(`status = $${idx}`);
      values.push(params.status);
      idx++;
    }
    if (params.department !== undefined) {
      fields.push(`department = $${idx}`);
      values.push(params.department);
      idx++;
    }
    if (params.position !== undefined) {
      fields.push(`position = $${idx}`);
      values.push(params.position);
      idx++;
    }
    if (params.managerUserId !== undefined) {
      fields.push(`manager_user_id = $${idx}`);
      values.push(params.managerUserId);
      idx++;
    }
    if (params.resourceScopes !== undefined) {
      fields.push(`resource_scopes = $${idx}::jsonb`);
      values.push(JSON.stringify(params.resourceScopes));
      idx++;
    }
    if (params.expiresAt !== undefined) {
      fields.push(`expires_at = $${idx}`);
      values.push(params.expiresAt);
      idx++;
    }

    if (fields.length === 0) {
      const existing = await this.findById(tenantId, membershipId);
      if (!existing) throw new Error('Membership not found');
      return existing;
    }

    fields.push('updated_at = NOW()');
    const executor = this.getExecutor(client);
    const result = await executor.query<MembershipRow>(
      `UPDATE user_organization_memberships
       SET ${fields.join(', ')}
       WHERE tenant_id = $1 AND id = $2
       RETURNING ${MEMBERSHIP_COLUMNS}`,
      values,
    );
    return this.mapRow(result.rows[0]);
  }

  async revoke(tenantId: string, membershipId: string, client?: unknown): Promise<OrganizationMembership> {
    return this.updateStatus(tenantId, membershipId, MembershipStatus.REMOVED, client);
  }

  async updateStatus(
    tenantId: string,
    membershipId: string,
    status: MembershipStatus,
    client?: unknown,
  ): Promise<OrganizationMembership> {
    return this.update(tenantId, membershipId, { status }, client);
  }

  private async pageQuery(
    baseWhere: string,
    baseParams: unknown[],
    page: number,
    limit: number,
    filters?: MembershipListFilters,
  ): Promise<{ items: readonly OrganizationMembership[]; total: number }> {
    const params = [...baseParams];
    const clauses = [baseWhere];

    if (filters?.status) {
      params.push(filters.status);
      clauses.push(`status = $${params.length}`);
    } else {
      clauses.push(ACTIVE_FILTER);
    }

    const search = filters?.search?.trim();
    if (search) {
      params.push(`%${search}%`);
      const i = params.length;
      clauses.push(
        `(user_id ILIKE $${i} OR COALESCE(department, '') ILIKE $${i} OR COALESCE(position, '') ILIKE $${i} OR roles::text ILIKE $${i})`,
      );
    }

    const whereSql = clauses.join(' AND ');
    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM user_organization_memberships WHERE ${whereSql}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    const result = await this.pool.query<MembershipRow>(
      `SELECT ${MEMBERSHIP_COLUMNS}
       FROM user_organization_memberships
       WHERE ${whereSql}
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

  private mapRow(row: MembershipRow): OrganizationMembership {
    return {
      id: row.id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      organizationId: row.organization_id,
      status: row.status,
      roles: row.roles ?? [],
      permissions: row.permissions ?? [],
      department: row.department ?? null,
      position: row.position ?? null,
      managerUserId: row.manager_user_id ?? null,
      resourceScopes: row.resource_scopes ?? [],
      joinedAt: row.joined_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

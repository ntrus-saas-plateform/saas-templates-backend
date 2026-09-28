import { Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import type { OrganizationRepositoryPort } from '../../domain/ports/organization-repository.port.js';
import type { Organization } from '../../domain/organization/organization.entity.js';
import {
  ORGANIZATION_SELECT_COLUMNS,
  mapOrganizationRow,
  type OrganizationRow,
} from '../../domain/organization/organization-row.js';

@Injectable()
export class PgOrganizationRepository implements OrganizationRepositoryPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  private get pool(): Pool {
    return this.dbManager.getControlPlanePool();
  }

  async findById(tenantId: string, organizationId: string): Promise<Organization | null> {
    const result = await this.pool.query<OrganizationRow>(
      `SELECT ${ORGANIZATION_SELECT_COLUMNS}
       FROM organizations WHERE id = $1 AND tenant_id = $2`,
      [organizationId, tenantId],
    );
    return result.rows[0] ? mapOrganizationRow(result.rows[0]) : null;
  }

  async findByKeycloakId(
    tenantId: string,
    keycloakOrganizationId: string,
  ): Promise<Organization | null> {
    const result = await this.pool.query<OrganizationRow>(
      `SELECT ${ORGANIZATION_SELECT_COLUMNS}
       FROM organizations WHERE keycloak_organization_id = $1 AND tenant_id = $2`,
      [keycloakOrganizationId, tenantId],
    );
    return result.rows[0] ? mapOrganizationRow(result.rows[0]) : null;
  }

  async findByUserMembership(tenantId: string, userId: string): Promise<readonly Organization[]> {
    const result = await this.pool.query<OrganizationRow>(
      `SELECT o.id, o.tenant_id, o.keycloak_organization_id, o.name, o.slug, o.status, o.type,
              o.code, o.parent_id, o.is_primary, o.description, o.timezone, o.locale,
              o.address, o.contact, o.opening_hours, o.operational_settings, o.metadata,
              o.created_at, o.updated_at
       FROM organizations o
       INNER JOIN user_organization_memberships m ON m.organization_id = o.id
       WHERE m.user_id = $1 AND o.tenant_id = $2 AND o.status = 'ACTIVE'
       AND m.status = 'ACTIVE'`,
      [userId, tenantId],
    );
    return result.rows.map((row) => mapOrganizationRow(row));
  }

  async findByUserMembershipPage(
    tenantId: string,
    userId: string,
    page: number,
    limit: number,
    opts?: { parentId?: string | null },
  ): Promise<{ items: readonly Organization[]; total: number }> {
    const offset = (page - 1) * limit;
    const params: unknown[] = [userId, tenantId];
    let parentFilter = '';
    if (opts?.parentId === null) {
      parentFilter = ' AND o.parent_id IS NULL';
    } else if (opts?.parentId !== undefined) {
      params.push(opts.parentId);
      parentFilter = ` AND o.parent_id = $${params.length}`;
    }

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM organizations o
       INNER JOIN user_organization_memberships m ON m.organization_id = o.id
       WHERE m.user_id = $1 AND o.tenant_id = $2 AND o.status = 'ACTIVE'
       AND m.status = 'ACTIVE'${parentFilter}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);
    const listParams = [...params, limit, offset];
    const result = await this.pool.query<OrganizationRow>(
      `SELECT o.id, o.tenant_id, o.keycloak_organization_id, o.name, o.slug, o.status, o.type,
              o.code, o.parent_id, o.is_primary, o.description, o.timezone, o.locale,
              o.address, o.contact, o.opening_hours, o.operational_settings, o.metadata,
              o.created_at, o.updated_at
       FROM organizations o
       INNER JOIN user_organization_memberships m ON m.organization_id = o.id
       WHERE m.user_id = $1 AND o.tenant_id = $2 AND o.status = 'ACTIVE'
       AND m.status = 'ACTIVE'${parentFilter}
       ORDER BY o.name LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );
    return { items: result.rows.map((row) => mapOrganizationRow(row)), total };
  }

  async findAllByTenant(tenantId: string): Promise<readonly Organization[]> {
    const result = await this.pool.query<OrganizationRow>(
      `SELECT ${ORGANIZATION_SELECT_COLUMNS}
       FROM organizations WHERE tenant_id = $1
       ORDER BY name`,
      [tenantId],
    );
    return result.rows.map((row) => mapOrganizationRow(row));
  }

  async findAllByTenantPage(
    tenantId: string,
    page: number,
    limit: number,
    opts?: { parentId?: string | null },
  ): Promise<{ items: readonly Organization[]; total: number }> {
    const offset = (page - 1) * limit;
    const params: unknown[] = [tenantId];
    let parentFilter = '';
    if (opts?.parentId === null) {
      parentFilter = ' AND parent_id IS NULL';
    } else if (opts?.parentId !== undefined) {
      params.push(opts.parentId);
      parentFilter = ` AND parent_id = $${params.length}`;
    }

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM organizations
       WHERE tenant_id = $1${parentFilter}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);
    const listParams = [...params, limit, offset];
    const result = await this.pool.query<OrganizationRow>(
      `SELECT ${ORGANIZATION_SELECT_COLUMNS}
       FROM organizations WHERE tenant_id = $1${parentFilter}
       ORDER BY name LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );
    return { items: result.rows.map((row) => mapOrganizationRow(row)), total };
  }

  async countOrganizations(tenantId: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM organizations WHERE tenant_id = $1 AND status = 'ACTIVE'`,
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
}

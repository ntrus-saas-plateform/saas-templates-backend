import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import type {
  RoleRepositoryPort,
  CreateRoleParams,
  UpdateRoleParams,
} from '../../domain/ports/role-repository.port.js';
import type { Role, Permission } from '../../domain/role/role.entity.js';
import { formatPermissionKey } from '../../domain/role/role.entity.js';

interface PermissionRow {
  id: string;
  resource: string;
  action: string;
  description: string | null;
}

interface RoleRow {
  id: string;
  tenant_id: string | null;
  scope: 'platform' | 'tenant' | 'organization';
  name: string;
  is_system: boolean;
  description: string | null;
  created_at: Date;
}

@Injectable()
export class PgRoleRepository implements RoleRepositoryPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async listPermissions(): Promise<readonly Permission[]> {
    const result = await this.pool.query<PermissionRow>(
      `SELECT id, resource, action, description FROM permissions ORDER BY resource, action`,
    );
    return result.rows.map((row) => ({
      id: row.id,
      resource: row.resource,
      action: row.action,
      description: row.description,
    }));
  }

  async listRoles(tenantId: string | null): Promise<readonly Role[]> {
    const result = await this.pool.query<RoleRow>(
      `SELECT id, tenant_id, scope, name, is_system, description, created_at
       FROM roles
       WHERE tenant_id IS NULL OR tenant_id IS NOT DISTINCT FROM $1
       ORDER BY is_system DESC, scope, name`,
      [tenantId],
    );
    return this.withPermissions(result.rows.map((row) => this.mapRoleRow(row)));
  }

  async listRolesPage(
    tenantId: string | null,
    page: number,
    limit: number,
  ): Promise<{ items: readonly Role[]; total: number }> {
    const offset = (page - 1) * limit;
    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM roles
       WHERE tenant_id IS NULL OR tenant_id IS NOT DISTINCT FROM $1`,
      [tenantId],
    );
    const total = Number(countResult.rows[0]?.count ?? 0);
    const result = await this.pool.query<RoleRow>(
      `SELECT id, tenant_id, scope, name, is_system, description, created_at
       FROM roles
       WHERE tenant_id IS NULL OR tenant_id IS NOT DISTINCT FROM $1
       ORDER BY is_system DESC, scope, name
       LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset],
    );
    const items = await this.withPermissions(result.rows.map((row) => this.mapRoleRow(row)));
    return { items, total };
  }

  async listPermissionsPage(
    page: number,
    limit: number,
  ): Promise<{ items: readonly Permission[]; total: number }> {
    const offset = (page - 1) * limit;
    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM permissions`,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);
    const result = await this.pool.query<PermissionRow>(
      `SELECT id, resource, action, description FROM permissions
       ORDER BY resource, action LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return {
      items: result.rows.map((row) => ({
        id: row.id,
        resource: row.resource,
        action: row.action,
        description: row.description,
      })),
      total,
    };
  }

  async findPermissionsForRoles(roleNames: readonly string[], tenantId: string): Promise<readonly string[]> {
    if (roleNames.length === 0) return [];

    const result = await this.pool.query<PermissionRow>(
      `SELECT DISTINCT p.resource, p.action
       FROM roles r
       INNER JOIN role_permissions rp ON rp.role_id = r.id
       INNER JOIN permissions p ON p.id = rp.permission_id
       WHERE r.name = ANY($1::text[])
       AND (r.tenant_id IS NULL OR r.tenant_id = $2)`,
      [roleNames, tenantId],
    );

    return result.rows.map((row) => formatPermissionKey(row));
  }

  async findRoleByName(tenantId: string | null, name: string): Promise<Role | null> {
    const result = await this.pool.query<RoleRow>(
      `SELECT id, tenant_id, scope, name, is_system, description, created_at
       FROM roles WHERE name = $1 AND tenant_id IS NOT DISTINCT FROM $2`,
      [name, tenantId],
    );
    return result.rows[0] ? this.mapRoleRow(result.rows[0]) : null;
  }

  async findById(tenantId: string, roleId: string): Promise<Role | null> {
    const result = await this.pool.query<RoleRow>(
      `SELECT id, tenant_id, scope, name, is_system, description, created_at
       FROM roles WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)`,
      [roleId, tenantId],
    );
    return result.rows[0] ? this.mapRoleRow(result.rows[0]) : null;
  }

  async create(params: CreateRoleParams): Promise<Role> {
    const id = randomUUID();
    const result = await this.pool.query<RoleRow>(
      `INSERT INTO roles (id, tenant_id, scope, name, is_system, description)
       VALUES ($1, $2, $3, $4, false, $5)
       RETURNING id, tenant_id, scope, name, is_system, description, created_at`,
      [id, params.tenantId, params.scope, params.name, params.description ?? null],
    );
    const role = this.mapRoleRow(result.rows[0]);
    if (params.permissionKeys?.length) {
      await this.replaceRolePermissions(role.id, params.permissionKeys);
    }
    const [enriched] = await this.withPermissions([role]);
    return enriched!;
  }

  async update(tenantId: string, roleId: string, params: UpdateRoleParams): Promise<Role> {
    const existing = await this.findById(tenantId, roleId);
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error('Role not found');
    }
    if (existing.isSystem) {
      throw new Error('Cannot modify system role');
    }

    const result = await this.pool.query<RoleRow>(
      `UPDATE roles SET description = COALESCE($3, description)
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, tenant_id, scope, name, is_system, description, created_at`,
      [roleId, tenantId, params.description ?? null],
    );

    if (params.permissionKeys) {
      await this.replaceRolePermissions(roleId, params.permissionKeys);
    }

    const [enriched] = await this.withPermissions([this.mapRoleRow(result.rows[0])]);
    return enriched!;
  }

  async delete(tenantId: string, roleId: string): Promise<void> {
    const existing = await this.findById(tenantId, roleId);
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error('Role not found');
    }
    if (existing.isSystem) {
      throw new Error('Cannot delete system role');
    }
    await this.pool.query(`DELETE FROM roles WHERE id = $1 AND tenant_id = $2`, [roleId, tenantId]);
  }

  private async replaceRolePermissions(roleId: string, permissionKeys: readonly string[]): Promise<void> {
    const catalog = await this.listPermissions();
    const permissionIds = catalog
      .filter((p) => permissionKeys.includes(formatPermissionKey(p)))
      .map((p) => p.id);

    await this.pool.query(`DELETE FROM role_permissions WHERE role_id = $1`, [roleId]);
    for (const permissionId of permissionIds) {
      await this.pool.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [roleId, permissionId],
      );
    }
  }

  private async withPermissions(roles: Role[]): Promise<Role[]> {
    if (roles.length === 0) return roles;
    const result = await this.pool.query<{
      role_id: string;
      resource: string;
      action: string;
    }>(
      `SELECT rp.role_id, p.resource, p.action
       FROM role_permissions rp
       INNER JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ANY($1::uuid[])
       ORDER BY p.resource, p.action`,
      [roles.map((r) => r.id)],
    );
    const byRole = new Map<string, string[]>();
    for (const row of result.rows) {
      const list = byRole.get(row.role_id) ?? [];
      list.push(formatPermissionKey(row));
      byRole.set(row.role_id, list);
    }
    return roles.map((role) => ({
      ...role,
      permissions: byRole.get(role.id) ?? [],
    }));
  }

  private get pool() {
    return this.dbManager.getControlPlanePool();
  }

  private mapRoleRow(row: RoleRow): Role {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      scope: row.scope,
      name: row.name,
      isSystem: row.is_system,
      description: row.description,
      createdAt: row.created_at,
    };
  }
}

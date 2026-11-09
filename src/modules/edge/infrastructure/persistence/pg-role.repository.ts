import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  CreateEdgeRoleParams,
  CreateRoleAssignmentParams,
  RoleRepositoryPort,
  UpdateEdgeRoleParams,
} from '../../domain/ports/role-repository.port.js';
import {
  EdgeRoleScope,
  type EdgePermission,
  type EdgeRole,
  type EdgeRoleAssignment,
} from '../../domain/role/edge-role.entity.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

interface RoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  scope: EdgeRoleScope;
  is_system: boolean;
  is_active: boolean;
  version: number;
  created_at: Date;
  updated_at: Date;
}

interface PermissionRow {
  id: string;
  code: string;
  description: string | null;
  created_at: Date;
}

interface AssignmentRow {
  id: string;
  membership_id: string | null;
  administrator_id: string;
  role_id: string;
  scope_vertical_id: string | null;
  expires_at: Date | null;
  revoked_at: Date | null;
  assigned_by: string | null;
  created_at: Date;
}

@Injectable()
export class PgRoleRepository implements RoleRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async listRoles(scope?: EdgeRoleScope): Promise<readonly EdgeRole[]> {
    const result = scope
      ? await this.pool.query<RoleRow>(
          `SELECT * FROM edge_roles WHERE scope = $1 ORDER BY code`,
          [scope],
        )
      : await this.pool.query<RoleRow>(`SELECT * FROM edge_roles ORDER BY code`);
    return result.rows.map((r) => this.mapRole(r));
  }

  async findRoleById(id: string): Promise<EdgeRole | null> {
    const result = await this.pool.query<RoleRow>(`SELECT * FROM edge_roles WHERE id = $1`, [id]);
    return result.rows[0] ? this.mapRole(result.rows[0]) : null;
  }

  async findRoleByCode(code: string): Promise<EdgeRole | null> {
    const result = await this.pool.query<RoleRow>(`SELECT * FROM edge_roles WHERE code = $1`, [
      code,
    ]);
    return result.rows[0] ? this.mapRole(result.rows[0]) : null;
  }

  async listPermissions(): Promise<readonly EdgePermission[]> {
    const result = await this.pool.query<PermissionRow>(
      `SELECT * FROM edge_permissions ORDER BY code`,
    );
    return result.rows.map((r) => ({
      id: r.id,
      code: r.code,
      description: r.description,
      createdAt: r.created_at,
    }));
  }

  async findPermissionCodesByRoleIds(roleIds: readonly string[]): Promise<readonly string[]> {
    if (!roleIds.length) return [];
    const result = await this.pool.query<{ code: string }>(
      `SELECT DISTINCT p.code
       FROM edge_role_permissions rp
       INNER JOIN edge_permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ANY($1::uuid[])
       ORDER BY p.code`,
      [roleIds],
    );
    return result.rows.map((r) => r.code);
  }

  async createRole(params: CreateEdgeRoleParams): Promise<EdgeRole> {
    const id = randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const roleResult = await client.query<RoleRow>(
        `INSERT INTO edge_roles (id, code, name, description, scope, is_system, is_active, version)
         VALUES ($1,$2,$3,$4,$5,false,true,1)
         RETURNING *`,
        [id, params.code, params.name, params.description ?? null, params.scope],
      );
      if (params.permissionCodes.length) {
        await client.query(
          `INSERT INTO edge_role_permissions (role_id, permission_id)
           SELECT $1, p.id FROM edge_permissions p WHERE p.code = ANY($2::text[])
           ON CONFLICT DO NOTHING`,
          [id, params.permissionCodes],
        );
      }
      await client.query('COMMIT');
      return this.mapRole(roleResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateRole(id: string, params: UpdateEdgeRoleParams): Promise<EdgeRole> {
    const current = await this.findRoleById(id);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Role not found');
    if (current.isSystem) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'System roles cannot be updated');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<RoleRow>(
        `UPDATE edge_roles SET
           name = $2,
           description = $3,
           is_active = $4,
           version = version + 1,
           updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          id,
          params.name ?? current.name,
          params.description !== undefined ? params.description : current.description,
          params.isActive ?? current.isActive,
        ],
      );
      if (params.permissionCodes) {
        await client.query(`DELETE FROM edge_role_permissions WHERE role_id = $1`, [id]);
        if (params.permissionCodes.length) {
          await client.query(
            `INSERT INTO edge_role_permissions (role_id, permission_id)
             SELECT $1, p.id FROM edge_permissions p WHERE p.code = ANY($2::text[])
             ON CONFLICT DO NOTHING`,
            [id, params.permissionCodes],
          );
        }
      }
      await client.query('COMMIT');
      return this.mapRole(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createAssignment(params: CreateRoleAssignmentParams): Promise<EdgeRoleAssignment> {
    const id = randomUUID();
    const result = await this.pool.query<AssignmentRow>(
      `INSERT INTO edge_role_assignments (
         id, membership_id, administrator_id, role_id, scope_vertical_id, expires_at, assigned_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        id,
        params.membershipId ?? null,
        params.administratorId,
        params.roleId,
        params.scopeVerticalId ?? null,
        params.expiresAt ?? null,
        params.assignedBy ?? null,
      ],
    );
    return this.mapAssignment(result.rows[0]);
  }

  async revokeAssignment(id: string, revokedAt = new Date()): Promise<EdgeRoleAssignment> {
    const result = await this.pool.query<AssignmentRow>(
      `UPDATE edge_role_assignments SET revoked_at = $2 WHERE id = $1 RETURNING *`,
      [id, revokedAt],
    );
    if (!result.rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Role assignment not found');
    }
    return this.mapAssignment(result.rows[0]);
  }

  async listAssignmentsForAdministrator(
    administratorId: string,
  ): Promise<readonly EdgeRoleAssignment[]> {
    const result = await this.pool.query<AssignmentRow>(
      `SELECT * FROM edge_role_assignments WHERE administrator_id = $1 ORDER BY created_at DESC`,
      [administratorId],
    );
    return result.rows.map((r) => this.mapAssignment(r));
  }

  async listActiveAssignmentsForAdministrator(
    administratorId: string,
    verticalId?: string | null,
  ): Promise<readonly EdgeRoleAssignment[]> {
    const values: unknown[] = [administratorId];
    let sql = `SELECT a.*
      FROM edge_role_assignments a
      INNER JOIN edge_roles r ON r.id = a.role_id
      WHERE a.administrator_id = $1
        AND a.revoked_at IS NULL
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
        AND r.is_active = true`;
    if (verticalId) {
      values.push(verticalId);
      sql += ` AND (a.scope_vertical_id IS NULL OR a.scope_vertical_id = $${values.length})`;
    } else if (verticalId === null) {
      sql += ` AND a.scope_vertical_id IS NULL AND a.membership_id IS NULL`;
    }
    const result = await this.pool.query<AssignmentRow>(sql, values);
    return result.rows.map((r) => this.mapAssignment(r));
  }

  private mapRole(row: RoleRow): EdgeRole {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      scope: row.scope,
      isSystem: row.is_system,
      isActive: row.is_active,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapAssignment(row: AssignmentRow): EdgeRoleAssignment {
    return {
      id: row.id,
      membershipId: row.membership_id,
      administratorId: row.administrator_id,
      roleId: row.role_id,
      scopeVerticalId: row.scope_vertical_id,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      assignedBy: row.assigned_by,
      createdAt: row.created_at,
    };
  }
}

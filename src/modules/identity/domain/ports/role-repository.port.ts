import type { Role, Permission } from '../role/role.entity.js';

export interface CreateRoleParams {
  tenantId: string;
  scope: Role['scope'];
  name: string;
  description?: string | null;
  permissionKeys?: readonly string[];
}

export interface UpdateRoleParams {
  description?: string | null;
  permissionKeys?: readonly string[];
}

export interface RoleRepositoryPort {
  listPermissions(): Promise<readonly Permission[]>;
  listRoles(tenantId: string | null): Promise<readonly Role[]>;
  listRolesPage(
    tenantId: string | null,
    page: number,
    limit: number,
  ): Promise<{ items: readonly Role[]; total: number }>;
  listPermissionsPage(
    page: number,
    limit: number,
  ): Promise<{ items: readonly Permission[]; total: number }>;
  findPermissionsForRoles(roleNames: readonly string[], tenantId: string): Promise<readonly string[]>;
  findRoleByName(tenantId: string | null, name: string): Promise<Role | null>;
  findById(tenantId: string, roleId: string): Promise<Role | null>;
  create(params: CreateRoleParams): Promise<Role>;
  update(tenantId: string, roleId: string, params: UpdateRoleParams): Promise<Role>;
  delete(tenantId: string, roleId: string): Promise<void>;
}

export const ROLE_REPOSITORY_PORT = Symbol('ROLE_REPOSITORY_PORT');

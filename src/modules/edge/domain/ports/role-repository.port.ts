import type {
  EdgePermission,
  EdgeRole,
  EdgeRoleAssignment,
  EdgeRoleScope,
} from '../role/edge-role.entity.js';

export interface CreateEdgeRoleParams {
  code: string;
  name: string;
  description?: string | null;
  scope: EdgeRoleScope;
  permissionCodes: readonly string[];
}

export interface UpdateEdgeRoleParams {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  permissionCodes?: readonly string[];
}

export interface CreateRoleAssignmentParams {
  membershipId?: string | null;
  administratorId: string;
  roleId: string;
  scopeVerticalId?: string | null;
  expiresAt?: Date | null;
  assignedBy?: string | null;
}

export interface RoleRepositoryPort {
  listRoles(scope?: EdgeRoleScope): Promise<readonly EdgeRole[]>;
  findRoleById(id: string): Promise<EdgeRole | null>;
  findRoleByCode(code: string): Promise<EdgeRole | null>;
  listPermissions(): Promise<readonly EdgePermission[]>;
  findPermissionCodesByRoleIds(roleIds: readonly string[]): Promise<readonly string[]>;
  createRole(params: CreateEdgeRoleParams): Promise<EdgeRole>;
  updateRole(id: string, params: UpdateEdgeRoleParams): Promise<EdgeRole>;
  createAssignment(params: CreateRoleAssignmentParams): Promise<EdgeRoleAssignment>;
  revokeAssignment(id: string, revokedAt?: Date): Promise<EdgeRoleAssignment>;
  listAssignmentsForAdministrator(
    administratorId: string,
  ): Promise<readonly EdgeRoleAssignment[]>;
  listActiveAssignmentsForAdministrator(
    administratorId: string,
    verticalId?: string | null,
  ): Promise<readonly EdgeRoleAssignment[]>;
}

export const ROLE_REPOSITORY_PORT = Symbol('EDGE_ROLE_REPOSITORY_PORT');

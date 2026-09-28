import type { UseCase } from '../common/use-case.js';
import type { ExecutionContext } from '../common/execution-context.js';
import { requireSubject } from '../common/access-control.js';
import type { RoleRepositoryPort } from '../../domain/ports/role-repository.port.js';
import type { Role } from '../../domain/role/role.entity.js';
import type { Permission } from '../../domain/role/role.entity.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

import type { PaginatedResult } from '../common/pagination.js';
import { buildPaginationMeta, normalizePageLimit } from '../common/pagination.js';

export class ListRolesUseCase
  implements UseCase<{ ctx: ExecutionContext; page?: number; limit?: number }, PaginatedResult<Role>>
{
  constructor(private readonly roleRepository: RoleRepositoryPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<Role>> {
    const ctx = requireSubject(input.ctx);
    const { page, limit } = normalizePageLimit(input.page, input.limit);
    const result = await this.roleRepository.listRolesPage(ctx.tenantId, page, limit);
    return {
      data: result.items,
      pagination: buildPaginationMeta(page, limit, result.total),
    };
  }
}

export class ListPermissionsUseCase
  implements UseCase<{ ctx: ExecutionContext; page?: number; limit?: number }, PaginatedResult<Permission>>
{
  constructor(private readonly roleRepository: RoleRepositoryPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<Permission>> {
    requireSubject(input.ctx);
    const { page, limit } = normalizePageLimit(input.page, input.limit);
    const result = await this.roleRepository.listPermissionsPage(page, limit);
    return {
      data: result.items,
      pagination: buildPaginationMeta(page, limit, result.total),
    };
  }
}

export class CreateRoleUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        name: string;
        scope: Role['scope'];
        description?: string;
        permissions?: readonly string[];
      },
      Role
    >
{
  constructor(private readonly roleRepository: RoleRepositoryPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    name: string;
    scope: Role['scope'];
    description?: string;
    permissions?: readonly string[];
  }): Promise<Role> {
    const ctx = requireSubject(input.ctx);
    if (input.scope === 'platform') {
      throw new DomainError(ErrorCode.FORBIDDEN, 'Cannot create platform-scoped roles via tenant API');
    }
    const existing = await this.roleRepository.findRoleByName(ctx.tenantId, input.name);
    if (existing) {
      throw new DomainError(ErrorCode.CONFLICT, 'Role name already exists');
    }
    return this.roleRepository.create({
      tenantId: ctx.tenantId,
      scope: input.scope,
      name: input.name,
      description: input.description,
      permissionKeys: input.permissions,
    });
  }
}

export class UpdateRoleUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        roleId: string;
        description?: string;
        permissions?: readonly string[];
      },
      Role
    >
{
  constructor(private readonly roleRepository: RoleRepositoryPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    roleId: string;
    description?: string;
    permissions?: readonly string[];
  }): Promise<Role> {
    const ctx = requireSubject(input.ctx);
    try {
      return await this.roleRepository.update(ctx.tenantId, input.roleId, {
        description: input.description,
        permissionKeys: input.permissions,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('system role')) {
        throw new DomainError(ErrorCode.FORBIDDEN, error.message);
      }
      throw error;
    }
  }
}

export class DeleteRoleUseCase implements UseCase<{ ctx: ExecutionContext; roleId: string }, void> {
  constructor(private readonly roleRepository: RoleRepositoryPort) {}

  async execute(input: { ctx: ExecutionContext; roleId: string }): Promise<void> {
    const ctx = requireSubject(input.ctx);
    try {
      await this.roleRepository.delete(ctx.tenantId, input.roleId);
    } catch (error) {
      if (error instanceof Error && error.message.includes('system role')) {
        throw new DomainError(ErrorCode.FORBIDDEN, error.message);
      }
      throw error;
    }
  }
}

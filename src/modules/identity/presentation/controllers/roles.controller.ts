import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuditAction, RequirePermissions } from '../../../../shared/auth/decorators.js';
import { TenantContextService } from '../../../../shared/tenancy/tenant-context.service.js';
import { SwaggerTags } from '../../../../shared/swagger/swagger.constants.js';
import { ApiOkDataResponse, ApiCreatedDataResponse, ApiJsonBody } from '../../../../shared/swagger/api-decorators.js';
import { toExecutionContext } from '../execution-context.mapper.js';
import {
  ListRolesUseCase,
  ListPermissionsUseCase,
  CreateRoleUseCase,
  UpdateRoleUseCase,
  DeleteRoleUseCase,
} from '../../application/role/role.use-cases.js';
import { CreateRoleDto, UpdateRoleDto } from '../dto/role.dto.js';
import {
  RoleResponseDto,
  PermissionResponseDto,
  RoleDeletedResponseDto,
} from '../dto/identity-response.dto.js';
import { PaginationQueryDto } from '../../../../shared/validation/query.dto.js';

@ApiTags(SwaggerTags.ROLES)
@ApiBearerAuth()
@Controller()
export class RolesController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly listRolesUseCase: ListRolesUseCase,
    private readonly listPermissionsUseCase: ListPermissionsUseCase,
    private readonly createRoleUseCase: CreateRoleUseCase,
    private readonly updateRoleUseCase: UpdateRoleUseCase,
    private readonly deleteRoleUseCase: DeleteRoleUseCase,
  ) {}

  @Get('roles')
  @RequirePermissions('roles:read')
  @ApiOperation({ summary: 'List roles for current tenant (includes system roles)' })
  @ApiOkDataResponse(RoleResponseDto, true)
  async listRoles(@Query() pagination: PaginationQueryDto) {
    const result = await this.listRolesUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      page: pagination.page,
      limit: pagination.limit,
    });
    return { data: result.data, pagination: result.pagination };
  }

  @Post('roles')
  @RequirePermissions('roles:create')
  @AuditAction('role.create', 'role')
  @ApiOperation({ summary: 'Create custom tenant or organization role' })
  @ApiJsonBody(CreateRoleDto)
  @ApiCreatedDataResponse(RoleResponseDto)
  async createRole(@Body() dto: CreateRoleDto) {
    const role = await this.createRoleUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      name: dto.name,
      scope: dto.scope,
      description: dto.description,
      permissions: dto.permissions,
    });
    return { data: role };
  }

  @Patch('roles/:roleId')
  @RequirePermissions('roles:update')
  @AuditAction('role.update', 'role')
  @ApiOperation({ summary: 'Update custom role' })
  @ApiParam({ name: 'roleId', format: 'uuid' })
  @ApiJsonBody(UpdateRoleDto)
  @ApiOkDataResponse(RoleResponseDto)
  async updateRole(@Param('roleId', ParseUUIDPipe) roleId: string, @Body() dto: UpdateRoleDto) {
    const role = await this.updateRoleUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      roleId,
      description: dto.description,
      permissions: dto.permissions,
    });
    return { data: role };
  }

  @Delete('roles/:roleId')
  @RequirePermissions('roles:delete')
  @AuditAction('role.delete', 'role')
  @ApiOperation({ summary: 'Delete custom role' })
  @ApiParam({ name: 'roleId', format: 'uuid' })
  @ApiOkDataResponse(RoleDeletedResponseDto)
  async deleteRole(@Param('roleId', ParseUUIDPipe) roleId: string) {
    await this.deleteRoleUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      roleId,
    });
    return { data: { deleted: true, roleId } };
  }

  @Get('permissions')
  @RequirePermissions('permissions:read')
  @ApiOperation({ summary: 'List permission catalog' })
  @ApiOkDataResponse(PermissionResponseDto, true)
  async listPermissions(@Query() pagination: PaginationQueryDto) {
    const result = await this.listPermissionsUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      page: pagination.page,
      limit: pagination.limit,
    });
    return { data: result.data, pagination: result.pagination };
  }
}

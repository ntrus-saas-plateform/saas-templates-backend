import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EdgeRoute, RequireEdgePermissions } from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import { EdgeContextService } from '../../../../shared/auth/edge-context.service.js';
import {
  AssignEdgeRoleUseCase,
  CreateCustomEdgeRoleUseCase,
  ListEdgePermissionsUseCase,
  ListEdgeRolesUseCase,
  RevokeEdgeRoleAssignmentUseCase,
  UpdateCustomEdgeRoleUseCase,
} from '../../application/authorization/authorization.use-cases.js';
import { EdgeRoleScope } from '../../domain/role/edge-role.entity.js';

@ApiTags('edge-authorization')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgePermissionGuard)
@Controller('edge')
export class EdgeAuthorizationController {
  constructor(
    private readonly edgeContext: EdgeContextService,
    private readonly listRoles: ListEdgeRolesUseCase,
    private readonly createRole: CreateCustomEdgeRoleUseCase,
    private readonly updateRole: UpdateCustomEdgeRoleUseCase,
    private readonly listPermissions: ListEdgePermissionsUseCase,
    private readonly assignRole: AssignEdgeRoleUseCase,
    private readonly revokeAssignment: RevokeEdgeRoleAssignmentUseCase,
  ) {}

  @Get('roles')
  @RequireEdgePermissions('authorization:roles:read')
  async roles(@Query('scope') scope?: EdgeRoleScope) {
    return { data: await this.listRoles.execute(scope) };
  }

  @Post('roles')
  @RequireEdgePermissions('authorization:roles:create')
  async create(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string | null;
      scope: EdgeRoleScope;
      permissionCodes: string[];
    },
  ) {
    return { data: await this.createRole.execute(body) };
  }

  @Patch('roles/:id')
  @RequireEdgePermissions('authorization:roles:update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      name?: string;
      description?: string | null;
      isActive?: boolean;
      permissionCodes?: string[];
    },
  ) {
    return { data: await this.updateRole.execute({ id, ...body }) };
  }

  @Get('permissions')
  @RequireEdgePermissions('authorization:roles:read')
  async permissions() {
    return { data: await this.listPermissions.execute() };
  }

  @Post('role-assignments')
  @RequireEdgePermissions('authorization:roles:assign')
  async assign(
    @Body()
    body: {
      administratorId: string;
      roleId: string;
      membershipId?: string | null;
      scopeVerticalId?: string | null;
      expiresAt?: string | null;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.assignRole.execute({
        actorId: ctx.administratorId!,
        administratorId: body.administratorId,
        roleId: body.roleId,
        membershipId: body.membershipId,
        scopeVerticalId: body.scopeVerticalId,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        actorPermissions: ctx.permissions,
      }),
    };
  }

  @Delete('role-assignments/:id')
  @RequireEdgePermissions('authorization:roles:revoke')
  async revoke(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.revokeAssignment.execute(id) };
  }
}

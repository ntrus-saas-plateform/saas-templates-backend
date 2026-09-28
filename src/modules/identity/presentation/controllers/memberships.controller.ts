import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuditAction, RequirePermissions } from '../../../../shared/auth/decorators.js';
import { TenantContextService } from '../../../../shared/tenancy/tenant-context.service.js';
import { IdentityMetricsService } from '../../../../shared/observability/identity-metrics.service.js';
import { SwaggerTags } from '../../../../shared/swagger/swagger.constants.js';
import { ApiErrorResponseDto } from '../../../../shared/swagger/api-response.dto.js';
import { ApiOkDataResponse, ApiCreatedDataResponse, ApiJsonBody } from '../../../../shared/swagger/api-decorators.js';
import { toExecutionContext } from '../execution-context.mapper.js';
import {
  ListMembershipsUseCase,
  GrantMembershipUseCase,
  UpdateMembershipRolesUseCase,
  RevokeMembershipUseCase,
} from '../../application/membership/membership.use-cases.js';
import { GrantMembershipDto, UpdateMembershipDto } from '../dto/membership.dto.js';
import { ListMembershipsQueryDto } from '../dto/list-memberships-query.dto.js';
import { OrganizationMembershipResponseDto } from '../dto/identity-response.dto.js';

@ApiTags(SwaggerTags.MEMBERSHIPS)
@ApiBearerAuth()
@Controller('memberships')
export class MembershipsController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly listMembershipsUseCase: ListMembershipsUseCase,
    private readonly grantMembershipUseCase: GrantMembershipUseCase,
    private readonly updateMembershipRolesUseCase: UpdateMembershipRolesUseCase,
    private readonly revokeMembershipUseCase: RevokeMembershipUseCase,
    private readonly identityMetrics: IdentityMetricsService,
  ) {}

  @Get()
  @RequirePermissions('memberships:read')
  @ApiOperation({ summary: 'List memberships for user or organization' })
  @ApiQuery({ name: 'organizationId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'status', required: false, enum: ['INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED', 'EXPIRED'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiOkDataResponse(OrganizationMembershipResponseDto, true)
  async list(@Query() query: ListMembershipsQueryDto) {
    const result = await this.listMembershipsUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId: query.organizationId,
      page: query.page,
      limit: query.limit,
      status: query.status,
      search: query.search,
    });
    return {
      data: result.data,
      pagination: result.pagination,
      ...(result.stats ? { stats: result.stats } : {}),
    };
  }

  @Post()
  @RequirePermissions('memberships:create')
  @AuditAction('membership.create', 'membership')
  @ApiOperation({ summary: 'Grant organization membership' })
  @ApiJsonBody(GrantMembershipDto)
  @ApiCreatedDataResponse(OrganizationMembershipResponseDto)
  async grant(@Body() dto: GrantMembershipDto) {
    const membership = await this.grantMembershipUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      userId: dto.userId,
      organizationId: dto.organizationId,
      roles: dto.roles,
      permissions: dto.permissions,
      status: dto.status,
      department: dto.department,
      position: dto.position,
      managerUserId: dto.managerUserId,
      resourceScopes: dto.resourceScopes,
      expiresAt: dto.expiresAt,
    });
    this.identityMetrics.recordMembershipChange('grant');
    return { data: membership };
  }

  @Patch(':membershipId')
  @RequirePermissions('memberships:update')
  @AuditAction('membership.roles.update', 'membership')
  @ApiOperation({ summary: 'Update membership roles, permissions, and employment context' })
  @ApiParam({ name: 'membershipId', format: 'uuid' })
  @ApiJsonBody(UpdateMembershipDto)
  @ApiOkDataResponse(OrganizationMembershipResponseDto)
  async updateRoles(
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: UpdateMembershipDto,
  ) {
    const membership = await this.updateMembershipRolesUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      membershipId,
      ...dto,
    });
    return { data: membership };
  }

  @Delete(':membershipId')
  @RequirePermissions('memberships:revoke')
  @AuditAction('membership.revoke', 'membership')
  @ApiOperation({ summary: 'Revoke membership (last-admin protected)' })
  @ApiParam({ name: 'membershipId', format: 'uuid' })
  @ApiOkDataResponse(OrganizationMembershipResponseDto)
  @ApiResponse({ status: 403, description: 'Last admin protection', type: ApiErrorResponseDto })
  async revoke(@Param('membershipId', ParseUUIDPipe) membershipId: string) {
    const membership = await this.revokeMembershipUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      membershipId,
    });
    this.identityMetrics.recordMembershipChange('revoke');
    return { data: membership };
  }
}

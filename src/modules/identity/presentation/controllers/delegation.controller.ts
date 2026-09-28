import { Controller, Get, Post, Body, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuditAction,
  RequirePermissions,
  RequireStepUp,
} from '../../../../shared/auth/decorators.js';
import { TenantContextService } from '../../../../shared/tenancy/tenant-context.service.js';
import { SwaggerTags } from '../../../../shared/swagger/swagger.constants.js';
import { ApiErrorResponseDto } from '../../../../shared/swagger/api-response.dto.js';
import { ApiOkDataResponse, ApiCreatedDataResponse, ApiJsonBody } from '../../../../shared/swagger/api-decorators.js';
import { toExecutionContext } from '../execution-context.mapper.js';
import {
  GrantDelegationUseCase,
  ListDelegationsUseCase,
  RevokeDelegationUseCase,
  GrantEmergencyAccessUseCase,
  ListEmergencyAccessGrantsUseCase,
  RevokeEmergencyAccessUseCase,
} from '../../application/delegation/delegation.use-cases.js';
import { GrantDelegationDto, GrantEmergencyAccessDto } from '../dto/delegation.dto.js';
import {
  DelegationResponseDto,
  EmergencyAccessGrantResponseDto,
} from '../dto/identity-response.dto.js';
import { PaginationQueryDto } from '../../../../shared/validation/query.dto.js';

@ApiTags(SwaggerTags.SECURITY)
@ApiBearerAuth()
@Controller('delegations')
export class DelegationsController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly grantDelegationUseCase: GrantDelegationUseCase,
    private readonly listDelegationsUseCase: ListDelegationsUseCase,
    private readonly revokeDelegationUseCase: RevokeDelegationUseCase,
  ) {}

  @Get()
  @RequirePermissions('delegation:read')
  @ApiOperation({ summary: 'List delegations in tenant' })
  @ApiOkDataResponse(DelegationResponseDto, true)
  async list(@Query() pagination: PaginationQueryDto) {
    const result = await this.listDelegationsUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      page: pagination.page,
      limit: pagination.limit,
    });
    return { data: result.data, pagination: result.pagination };
  }

  @Post()
  @RequirePermissions('delegation:grant')
  @AuditAction('delegation.grant', 'delegation')
  @ApiOperation({ summary: 'Grant temporary permission delegation' })
  @ApiJsonBody(GrantDelegationDto)
  @ApiCreatedDataResponse(DelegationResponseDto)
  async grant(@Body() dto: GrantDelegationDto) {
    const delegation = await this.grantDelegationUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId: dto.organizationId,
      granteeIdentityId: dto.granteeIdentityId,
      permissions: dto.permissions,
      expiresInHours: dto.expiresInHours,
    });
    return { data: delegation };
  }

  @Post(':delegationId/revoke')
  @RequirePermissions('delegation:grant')
  @AuditAction('delegation.revoke', 'delegation')
  @ApiOperation({ summary: 'Revoke delegation (grantor only)' })
  @ApiParam({ name: 'delegationId', format: 'uuid' })
  @ApiOkDataResponse(DelegationResponseDto)
  async revoke(@Param('delegationId', ParseUUIDPipe) delegationId: string) {
    const delegation = await this.revokeDelegationUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      delegationId,
    });
    return { data: delegation };
  }
}

@ApiTags(SwaggerTags.SECURITY)
@ApiBearerAuth()
@Controller('emergency-access')
export class EmergencyAccessController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly grantEmergencyAccessUseCase: GrantEmergencyAccessUseCase,
    private readonly listEmergencyAccessGrantsUseCase: ListEmergencyAccessGrantsUseCase,
    private readonly revokeEmergencyAccessUseCase: RevokeEmergencyAccessUseCase,
  ) {}

  @Get()
  @RequirePermissions('emergency_access:read')
  @ApiOperation({ summary: 'List break-glass emergency access grants' })
  @ApiOkDataResponse(EmergencyAccessGrantResponseDto, true)
  async list(@Query() pagination: PaginationQueryDto) {
    const result = await this.listEmergencyAccessGrantsUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      page: pagination.page,
      limit: pagination.limit,
    });
    return { data: result.data, pagination: result.pagination };
  }

  @Post()
  @RequirePermissions('emergency_access:grant')
  @RequireStepUp('1')
  @AuditAction('emergency_access.grant', 'emergency_access')
  @ApiOperation({ summary: 'Grant break-glass emergency access (audited, max 24h)' })
  @ApiJsonBody(GrantEmergencyAccessDto)
  @ApiCreatedDataResponse(EmergencyAccessGrantResponseDto)
  @ApiResponse({ status: 403, type: ApiErrorResponseDto })
  async grant(@Body() dto: GrantEmergencyAccessDto) {
    const grant = await this.grantEmergencyAccessUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      operatorIdentityId: dto.operatorIdentityId,
      reason: dto.reason,
      organizationId: dto.organizationId,
      scope: dto.scope,
      expiresInHours: dto.expiresInHours,
    });
    return { data: grant };
  }

  @Post(':grantId/revoke')
  @RequirePermissions('emergency_access:grant')
  @AuditAction('emergency_access.revoke', 'emergency_access')
  @ApiOperation({ summary: 'Revoke emergency access grant' })
  @ApiParam({ name: 'grantId', format: 'uuid' })
  @ApiOkDataResponse(EmergencyAccessGrantResponseDto)
  async revoke(@Param('grantId', ParseUUIDPipe) grantId: string) {
    const grant = await this.revokeEmergencyAccessUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      grantId,
    });
    return { data: grant };
  }
}

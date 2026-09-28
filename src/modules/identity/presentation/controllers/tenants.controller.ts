import { Controller, Get, Patch, Post, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuditAction, RequirePermissions, RequireStepUp } from '../../../../shared/auth/decorators.js';
import { TenantContextService } from '../../../../shared/tenancy/tenant-context.service.js';
import { SwaggerTags } from '../../../../shared/swagger/swagger.constants.js';
import { ApiErrorResponseDto } from '../../../../shared/swagger/api-response.dto.js';
import { ApiOkDataResponse, ApiCreatedDataResponse, ApiJsonBody } from '../../../../shared/swagger/api-decorators.js';
import { toExecutionContext } from '../execution-context.mapper.js';
import {
  GetTenantUseCase,
  UpdateTenantUseCase,
  TransitionTenantStatusUseCase,
  TransferTenantOwnershipUseCase,
} from '../../application/tenant/tenant.use-cases.js';
import {
  UpdateTenantDto,
  TransitionTenantStatusDto,
  TransferOwnershipDto,
} from '../dto/tenant.dto.js';
import { TenantResponseDto, OwnershipTransferResponseDto } from '../dto/identity-response.dto.js';

@ApiTags(SwaggerTags.TENANTS)
@ApiBearerAuth()
@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly getTenantUseCase: GetTenantUseCase,
    private readonly updateTenantUseCase: UpdateTenantUseCase,
    private readonly transitionTenantStatusUseCase: TransitionTenantStatusUseCase,
    private readonly transferTenantOwnershipUseCase: TransferTenantOwnershipUseCase,
  ) {}

  @Get(':tenantId')
  @RequirePermissions('tenant:read')
  @ApiOperation({ summary: 'Get tenant profile (must match JWT tenant)' })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiOkDataResponse(TenantResponseDto)
  @ApiResponse({ status: 403, type: ApiErrorResponseDto })
  async getTenant(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    const tenant = await this.getTenantUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      tenantId,
    });
    return { data: tenant };
  }

  @Patch(':tenantId')
  @RequirePermissions('tenant:update')
  @AuditAction('tenant.update', 'tenant')
  @ApiOperation({ summary: 'Update tenant profile fields' })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiJsonBody(UpdateTenantDto)
  @ApiOkDataResponse(TenantResponseDto)
  async updateTenant(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: UpdateTenantDto,
  ) {
    const tenant = await this.updateTenantUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      tenantId,
      update: dto,
    });
    return { data: tenant };
  }

  @Post(':tenantId/status')
  @RequirePermissions('tenant:update')
  @AuditAction('tenant.status.change', 'tenant')
  @ApiOperation({ summary: 'Transition tenant lifecycle status' })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiJsonBody(TransitionTenantStatusDto)
  @ApiOkDataResponse(TenantResponseDto)
  async transitionStatus(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: TransitionTenantStatusDto,
  ) {
    const tenant = await this.transitionTenantStatusUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      tenantId,
      status: dto.status,
    });
    return { data: tenant };
  }

  @Post(':tenantId/ownership/transfer')
  @RequirePermissions('tenant:ownership_transfer')
  @RequireStepUp('1')
  @AuditAction('tenant.ownership.transfer', 'tenant')
  @ApiOperation({ summary: 'Transfer tenant ownership to another identity' })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiJsonBody(TransferOwnershipDto)
  @ApiOkDataResponse(OwnershipTransferResponseDto)
  async transferOwnership(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: TransferOwnershipDto,
  ) {
    const result = await this.transferTenantOwnershipUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      tenantId,
      newOwnerIdentityId: dto.newOwnerIdentityId,
    });
    return { data: result };
  }
}

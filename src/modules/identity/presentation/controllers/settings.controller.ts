import { Controller, Get, Patch, Body, Param } from '@nestjs/common';
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
import { ApiErrorResponseDto } from '../../../../shared/swagger/api-response.dto.js';
import { ApiOkDataResponse, ApiCreatedDataResponse, ApiJsonBody } from '../../../../shared/swagger/api-decorators.js';
import { toExecutionContext } from '../execution-context.mapper.js';
import {
  GetTenantSettingsNamespaceUseCase,
  UpdateTenantSettingsNamespaceUseCase,
  GetOrganizationSettingsNamespaceUseCase,
  UpdateOrganizationSettingsNamespaceUseCase,
} from '../../application/configuration/settings.use-cases.js';
import { GetSettingsCatalogUseCase } from '../../application/configuration/tenant-settings-resources.use-cases.js';
import { UpdateSettingsNamespaceDto } from '../dto/settings.dto.js';
import {
  SettingsNamespaceResponseDto,
  OrganizationSettingsResponseDto,
} from '../dto/identity-response.dto.js';

@ApiTags(SwaggerTags.SETTINGS)
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly getTenantSettingsNamespaceUseCase: GetTenantSettingsNamespaceUseCase,
    private readonly updateTenantSettingsNamespaceUseCase: UpdateTenantSettingsNamespaceUseCase,
    private readonly getOrganizationSettingsNamespaceUseCase: GetOrganizationSettingsNamespaceUseCase,
    private readonly updateOrganizationSettingsNamespaceUseCase: UpdateOrganizationSettingsNamespaceUseCase,
    private readonly getSettingsCatalogUseCase: GetSettingsCatalogUseCase,
  ) {}

  @Get('catalog')
  @RequirePermissions('settings:read')
  @ApiOperation({ summary: 'List settings namespaces and typed key definitions' })
  @ApiOkDataResponse(Object)
  async catalog() {
    const data = await this.getSettingsCatalogUseCase.execute();
    return { data };
  }

  @Get('tenant/:namespace')
  @RequirePermissions('settings:read')
  @ApiOperation({ summary: 'Get tenant settings namespace (resolved with defaults)' })
  @ApiParam({ name: 'namespace', example: 'localization' })
  @ApiOkDataResponse(SettingsNamespaceResponseDto)
  @ApiResponse({ status: 403, type: ApiErrorResponseDto })
  async getTenantNamespace(@Param('namespace') namespace: string) {
    const result = await this.getTenantSettingsNamespaceUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      namespace,
    });
    return { data: result };
  }

  @Patch('tenant/:namespace')
  @RequirePermissions('settings:update')
  @AuditAction('settings.tenant.update', 'settings')
  @ApiOperation({ summary: 'Update tenant settings namespace' })
  @ApiParam({ name: 'namespace', example: 'localization' })
  @ApiJsonBody(UpdateSettingsNamespaceDto)
  @ApiOkDataResponse(SettingsNamespaceResponseDto)
  async updateTenantNamespace(
    @Param('namespace') namespace: string,
    @Body() dto: UpdateSettingsNamespaceDto,
  ) {
    const result = await this.updateTenantSettingsNamespaceUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      namespace,
      values: dto.values,
    });
    return { data: result };
  }

  @Get('organizations/:organizationId/:namespace')
  @RequirePermissions('settings:read')
  @ApiOperation({ summary: 'Get organization settings namespace (with tenant defaults)' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'namespace', example: 'ui' })
  @ApiOkDataResponse(OrganizationSettingsResponseDto)
  async getOrganizationNamespace(
    @Param('organizationId') organizationId: string,
    @Param('namespace') namespace: string,
  ) {
    const result = await this.getOrganizationSettingsNamespaceUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      namespace,
    });
    return { data: result };
  }

  @Patch('organizations/:organizationId/:namespace')
  @RequirePermissions('settings:update')
  @AuditAction('settings.organization.update', 'settings')
  @ApiOperation({ summary: 'Update organization settings overrides' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'namespace', example: 'ui' })
  @ApiJsonBody(UpdateSettingsNamespaceDto)
  @ApiOkDataResponse(OrganizationSettingsResponseDto)
  async updateOrganizationNamespace(
    @Param('organizationId') organizationId: string,
    @Param('namespace') namespace: string,
    @Body() dto: UpdateSettingsNamespaceDto,
  ) {
    const result = await this.updateOrganizationSettingsNamespaceUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      namespace,
      values: dto.values,
    });
    return { data: result };
  }
}

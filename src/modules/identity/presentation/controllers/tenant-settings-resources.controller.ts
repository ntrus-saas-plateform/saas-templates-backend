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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuditAction, RequirePermissions } from '../../../../shared/auth/decorators.js';
import { TenantContextService } from '../../../../shared/tenancy/tenant-context.service.js';
import { SwaggerTags } from '../../../../shared/swagger/swagger.constants.js';
import {
  ApiOkDataResponse,
  ApiCreatedDataResponse,
} from '../../../../shared/swagger/api-decorators.js';
import { toExecutionContext } from '../execution-context.mapper.js';
import {
  ListTenantResourceUseCase,
  CreateTenantResourceUseCase,
  UpdateTenantResourceUseCase,
  DeleteTenantResourceUseCase,
  PreviewNumberSequenceUseCase,
  NextNumberSequenceUseCase,
  ListAuditLogsUseCase,
  GetTenantModulesUseCase,
  PatchTenantModulesUseCase,
  GetTenantBillingOverviewUseCase,
} from '../../application/configuration/tenant-settings-resources.use-cases.js';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../../shared/validation/query.dto.js';

class ModulesOverlayDto {
  @ApiProperty({ type: 'object', additionalProperties: { type: 'boolean' } })
  @IsObject()
  overlays!: Record<string, boolean>;
}

class AuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  to?: string;
}

@ApiTags(SwaggerTags.SETTINGS)
@ApiBearerAuth()
@Controller('tenant-settings')
export class TenantSettingsResourcesController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly listResource: ListTenantResourceUseCase,
    private readonly createResource: CreateTenantResourceUseCase,
    private readonly updateResource: UpdateTenantResourceUseCase,
    private readonly deleteResource: DeleteTenantResourceUseCase,
    private readonly previewNumber: PreviewNumberSequenceUseCase,
    private readonly nextNumber: NextNumberSequenceUseCase,
    private readonly getModules: GetTenantModulesUseCase,
    private readonly patchModules: PatchTenantModulesUseCase,
    private readonly getBilling: GetTenantBillingOverviewUseCase,
  ) {}

  @Get('modules')
  @RequirePermissions('settings:read')
  @ApiOperation({ summary: 'List effective tenant modules (plan ∩ overlay)' })
  @ApiOkDataResponse(Object)
  async modules() {
    const data = await this.getModules.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
    });
    return { data };
  }

  @Patch('modules')
  @RequirePermissions('settings:update')
  @AuditAction('settings.modules.update', 'settings')
  @ApiOperation({ summary: 'Patch module overlay flags' })
  @ApiOkDataResponse(Object)
  async updateModules(@Body() body: ModulesOverlayDto) {
    const data = await this.patchModules.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      overlays: body.overlays,
    });
    return { data };
  }

  @Get('billing')
  @RequirePermissions('tenant:billing:read')
  @ApiOperation({ summary: 'Tenant billing overview (plan, quotas, invoices)' })
  @ApiOkDataResponse(Object)
  async billing() {
    const data = await this.getBilling.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
    });
    return { data };
  }

  @Post('numbering/:id/preview')
  @RequirePermissions('settings:read')
  @ApiOperation({ summary: 'Preview next document number without consuming' })
  @ApiOkDataResponse(Object)
  async preview(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.previewNumber.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      id,
    });
    return { data };
  }

  @Post('numbering/:id/next')
  @RequirePermissions('settings:update')
  @AuditAction('settings.numbering.next', 'settings')
  @ApiOperation({ summary: 'Atomically allocate next document number' })
  @ApiOkDataResponse(Object)
  async next(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.nextNumber.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      id,
    });
    return { data };
  }

  @Get(':resource')
  @RequirePermissions('settings:read')
  @ApiOperation({ summary: 'List tenant settings resource collection' })
  @ApiParam({ name: 'resource', example: 'currencies' })
  @ApiOkDataResponse(Object, true)
  async list(@Param('resource') resource: string) {
    const data = await this.listResource.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      resource,
    });
    return { data };
  }

  @Post(':resource')
  @RequirePermissions('settings:update')
  @AuditAction('settings.resource.create', 'settings')
  @ApiOperation({ summary: 'Create tenant settings resource row' })
  @ApiParam({ name: 'resource' })
  @ApiCreatedDataResponse(Object)
  async create(@Param('resource') resource: string, @Body() body: Record<string, unknown>) {
    const payload =
      body.values && typeof body.values === 'object' && !Array.isArray(body.values)
        ? (body.values as Record<string, unknown>)
        : body;
    const data = await this.createResource.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      resource,
      body: payload,
    });
    return { data };
  }

  @Patch(':resource/:id')
  @RequirePermissions('settings:update')
  @AuditAction('settings.resource.update', 'settings')
  @ApiOperation({ summary: 'Update tenant settings resource row' })
  @ApiParam({ name: 'resource' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkDataResponse(Object)
  async update(
    @Param('resource') resource: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const payload =
      body.values && typeof body.values === 'object' && !Array.isArray(body.values)
        ? (body.values as Record<string, unknown>)
        : body;
    const data = await this.updateResource.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      resource,
      id,
      body: payload,
    });
    return { data };
  }

  @Delete(':resource/:id')
  @RequirePermissions('settings:update')
  @AuditAction('settings.resource.delete', 'settings')
  @ApiOperation({ summary: 'Delete tenant settings resource row' })
  @ApiOkDataResponse(Object)
  async remove(
    @Param('resource') resource: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.deleteResource.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      resource,
      id,
    });
    return { data };
  }
}

@ApiTags(SwaggerTags.SETTINGS)
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogsController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly listAuditLogs: ListAuditLogsUseCase,
  ) {}

  @Get()
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'List tenant audit logs' })
  @ApiOkDataResponse(Object, true)
  async list(@Query() query: AuditQueryDto) {
    const result = await this.listAuditLogs.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      page: query.page,
      limit: query.limit,
      action: query.action,
      resource: query.resource,
      from: query.from,
      to: query.to,
    });
    return { data: result.data, pagination: result.pagination };
  }
}

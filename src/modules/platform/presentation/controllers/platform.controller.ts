import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuditAction, RequirePermissions } from '../../../../shared/auth/decorators.js';
import { TenantContextService } from '../../../../shared/tenancy/tenant-context.service.js';
import { SwaggerTags } from '../../../../shared/swagger/swagger.constants.js';
import { ApiErrorResponseDto } from '../../../../shared/swagger/api-response.dto.js';
import { ApiOkDataResponse, ApiCreatedDataResponse, ApiJsonBody } from '../../../../shared/swagger/api-decorators.js';
import { SwitchOrganizationDto } from '../dto/switch-organization.dto.js';
import { ListPlatformOrganizationsUseCase } from '../../application/organization/list-platform-organizations.use-case.js';
import { SwitchOrganizationUseCase } from '../../application/organization/switch-organization.use-case.js';
import { CapabilityResolverService } from '../../../../shared/authorization/capability-resolver.service.js';
import { toExecutionContext } from '../execution-context.mapper.js';
import { PaginationQueryDto } from '../../../../shared/validation/query.dto.js';
import {
  PlatformContextResponseDto,
  PlatformOrganizationListItemResponseDto,
  SwitchOrganizationResultResponseDto,
  CapabilitiesSnapshotDto,
} from '../dto/platform-response.dto.js';
@ApiTags(SwaggerTags.PLATFORM)
@ApiBearerAuth()
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly listOrganizationsUseCase: ListPlatformOrganizationsUseCase,
    private readonly switchOrganizationUseCase: SwitchOrganizationUseCase,
    private readonly capabilityResolver: CapabilityResolverService,
  ) {}

  @Get('context')
  @RequirePermissions('platform:read')
  @ApiOperation({ summary: 'Get current request context (tenant, org, user, permissions)' })
  @ApiOkDataResponse(PlatformContextResponseDto)
  @ApiResponse({ status: 401, type: ApiErrorResponseDto })
  getContext() {
    const ctx = this.tenantContext.get();
    return {
      data: {
        tenantId: ctx.tenantId,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        username: ctx.username,
        roles: ctx.roles,
        permissions: ctx.permissions,
        locale: ctx.locale,
        timezone: ctx.timezone,
      },
    };
  }

  @Get('organizations')
  @RequirePermissions('platform:read')
  @ApiOperation({
    summary: 'List organizations for current user (Keycloak memberships mirrored in app DB)',
  })
  @ApiOkDataResponse(PlatformOrganizationListItemResponseDto, true)
  async listOrganizations(@Query() pagination: PaginationQueryDto) {
    const result = await this.listOrganizationsUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      page: pagination.page,
      limit: pagination.limit,
    });

    return {
      data: result.data.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        keycloakOrganizationId: org.keycloakOrganizationId,
      })),
      pagination: result.pagination,
    };
  }

  @Get('me/capabilities')
  @ApiOperation({
    summary: 'Get effective capabilities for the authenticated user (plan, modules, permissions, navigation hints)',
  })
  @ApiOkDataResponse(CapabilitiesSnapshotDto)
  @ApiResponse({ status: 401, type: ApiErrorResponseDto })
  async getCapabilities() {
    const snapshot = await this.capabilityResolver.resolveForCurrentUser();
    return { data: snapshot };
  }

  @Post('organizations/switch')
  @RequirePermissions('platform:read')
  @AuditAction('organization.switch', 'organization')
  @ApiOperation({
    summary: 'Switch active organization (updates Keycloak; client must refresh token)',
  })
  @ApiJsonBody(SwitchOrganizationDto)
  @ApiCreatedDataResponse(SwitchOrganizationResultResponseDto)
  @ApiResponse({ status: 403, type: ApiErrorResponseDto })
  async switchOrganization(@Body() dto: SwitchOrganizationDto) {
    const result = await this.switchOrganizationUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId: dto.organizationId,
    });

    // Optimistic context for the current request; subsequent requests need a refreshed JWT.
    this.tenantContext.set({ organizationId: result.organizationId });

    return { data: result };
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
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
import {
  ApiOkDataResponse,
  ApiCreatedDataResponse,
  ApiJsonBody,
} from '../../../../shared/swagger/api-decorators.js';
import { toExecutionContext } from '../execution-context.mapper.js';
import {
  ListOrganizationsUseCase,
  ListOrganizationTreeUseCase,
  GetOrganizationUseCase,
  CreateOrganizationUseCase,
  UpdateOrganizationUseCase,
  SuspendOrganizationUseCase,
  ActivateOrganizationUseCase,
} from '../../application/organization/organization.use-cases.js';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  ListOrganizationsQueryDto,
} from '../dto/organization.dto.js';
import {
  OrganizationListItemResponseDto,
  OrganizationResponseDto,
} from '../dto/identity-response.dto.js';
import type { Organization } from '../../domain/organization/organization.entity.js';

function toOrgResponse(org: Organization) {
  return {
    id: org.id,
    tenantId: org.tenantId,
    keycloakOrganizationId: org.keycloakOrganizationId,
    name: org.name,
    slug: org.slug,
    status: org.status,
    type: org.type,
    code: org.code,
    parentId: org.parentId,
    isPrimary: org.isPrimary,
    description: org.description,
    timezone: org.timezone,
    locale: org.locale,
    address: org.address,
    contact: org.contact,
    openingHours: org.openingHours,
    operationalSettings: org.operationalSettings,
    metadata: org.metadata,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}

function toOrgListItem(org: Organization, childCount = 0) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    status: org.status,
    type: org.type,
    code: org.code,
    parentId: org.parentId,
    isPrimary: org.isPrimary,
    description: org.description,
    timezone: org.timezone,
    locale: org.locale,
    country: org.address?.country ?? null,
    city: org.address?.city ?? null,
    province: org.address?.province ?? null,
    phone: org.contact?.phone ?? null,
    email: org.contact?.email ?? null,
    defaultCurrency: org.operationalSettings?.defaultCurrency ?? null,
    childCount,
  };
}

@ApiTags(SwaggerTags.ORGANIZATIONS)
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly listOrganizationsUseCase: ListOrganizationsUseCase,
    private readonly listOrganizationTreeUseCase: ListOrganizationTreeUseCase,
    private readonly getOrganizationUseCase: GetOrganizationUseCase,
    private readonly createOrganizationUseCase: CreateOrganizationUseCase,
    private readonly updateOrganizationUseCase: UpdateOrganizationUseCase,
    private readonly suspendOrganizationUseCase: SuspendOrganizationUseCase,
    private readonly activateOrganizationUseCase: ActivateOrganizationUseCase,
  ) {}

  @Get()
  @RequirePermissions('organizations:read')
  @ApiOperation({ summary: 'List organizations (membership or tenant scope; optional tree)' })
  @ApiOkDataResponse(OrganizationListItemResponseDto, true)
  async list(@Query() query: ListOrganizationsQueryDto) {
    const ctx = toExecutionContext(this.tenantContext.getOrThrow());
    const scope = query.scope === 'tenant' ? 'tenant' : 'membership';
    const parentId =
      query.parentId === undefined
        ? undefined
        : query.parentId === '' || query.parentId === 'null'
          ? null
          : query.parentId;

    if (query.tree) {
      const items = await this.listOrganizationTreeUseCase.execute({ ctx, scope });
      const filtered =
        parentId === undefined
          ? items
          : items.filter((o) => o.parentId === parentId);
      const childCounts = new Map<string, number>();
      for (const org of items) {
        if (org.parentId) {
          childCounts.set(org.parentId, (childCounts.get(org.parentId) ?? 0) + 1);
        }
      }
      return {
        data: filtered.map((org) =>
          toOrgListItem(org, childCounts.get(org.id) ?? 0),
        ),
      };
    }

    const result = await this.listOrganizationsUseCase.execute({
      ctx,
      page: query.page,
      limit: query.limit,
      parentId,
      scope,
    });
    return {
      data: result.data.map((org) => toOrgListItem(org)),
      pagination: result.pagination,
    };
  }

  @Get(':organizationId')
  @RequirePermissions('organizations:read')
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiOkDataResponse(OrganizationResponseDto)
  @ApiResponse({ status: 403, type: ApiErrorResponseDto })
  async get(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    const organization = await this.getOrganizationUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
    });
    return { data: toOrgResponse(organization) };
  }

  @Post()
  @RequirePermissions('organizations:create')
  @AuditAction('organization.create', 'organization')
  @ApiOperation({ summary: 'Create organization (syncs to Keycloak when available)' })
  @ApiJsonBody(CreateOrganizationDto)
  @ApiCreatedDataResponse(OrganizationResponseDto)
  async create(@Body() dto: CreateOrganizationDto) {
    const organization = await this.createOrganizationUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      ...dto,
    });
    return { data: toOrgResponse(organization) };
  }

  @Patch(':organizationId')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.update', 'organization')
  @ApiOperation({ summary: 'Update organization' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiJsonBody(UpdateOrganizationDto)
  @ApiOkDataResponse(OrganizationResponseDto)
  async update(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    const organization = await this.updateOrganizationUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      ...dto,
    });
    return { data: toOrgResponse(organization) };
  }

  @Post(':organizationId/suspend')
  @RequirePermissions('organizations:suspend')
  @AuditAction('organization.suspend', 'organization')
  @ApiOperation({ summary: 'Suspend organization' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiOkDataResponse(OrganizationResponseDto)
  async suspend(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    const organization = await this.suspendOrganizationUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
    });
    return { data: toOrgResponse(organization) };
  }

  @Post(':organizationId/activate')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.activate', 'organization')
  @ApiOperation({ summary: 'Activate a suspended organization' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiOkDataResponse(OrganizationResponseDto)
  async activate(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    const organization = await this.activateOrganizationUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
    });
    return { data: toOrgResponse(organization) };
  }
}

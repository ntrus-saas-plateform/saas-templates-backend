import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  Delete,
  Headers,
  BadRequestException,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuditAction, RequireRoles } from '../../../../shared/auth/decorators.js';
import { TenantContextService } from '../../../../shared/tenancy/tenant-context.service.js';
import { SwaggerTags } from '../../../../shared/swagger/swagger.constants.js';
import {
  ApiOkDataResponse,
  ApiCreatedDataResponse,
  ApiJsonBody,
} from '../../../../shared/swagger/api-decorators.js';
import { toExecutionContext } from '../execution-context.mapper.js';
import { ProvisionTenantUseCase, RetryTenantProvisioningUseCase } from '../../application/admin/provision-tenant.use-case.js';
import { DeprovisionTenantUseCase } from '../../application/admin/deprovision-tenant.use-case.js';
import { GetTenantHealthUseCase } from '../../application/admin/get-tenant-health.use-case.js';
import { TransitionTenantStatusUseCase } from '../../../identity/application/tenant/tenant.use-cases.js';
import {
  ProvisionTenantDto,
  PlatformTransitionTenantStatusDto,
} from '../dto/platform-admin.dto.js';
import {
  TenantProvisioningResultResponseDto,
  TenantDeprovisionResultResponseDto,
  TenantHealthResponseDto,
} from '../dto/platform-response.dto.js';
import { TenantResponseDto } from '../../../identity/presentation/dto/identity-response.dto.js';
import { PlatformAdminAuditService } from '../../application/admin/platform-admin-audit.service.js';

@ApiTags(SwaggerTags.ADMIN)
@ApiBearerAuth()
@RequireRoles('platform-admin')
@Controller('admin/tenants')
export class PlatformAdminController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly provisionTenantUseCase: ProvisionTenantUseCase,
    private readonly retryTenantProvisioningUseCase: RetryTenantProvisioningUseCase,
    private readonly deprovisionTenantUseCase: DeprovisionTenantUseCase,
    private readonly transitionTenantStatusUseCase: TransitionTenantStatusUseCase,
    private readonly getTenantHealthUseCase: GetTenantHealthUseCase,
    private readonly auditService: PlatformAdminAuditService,
  ) {}

  private auditCtx(req: Request) {
    const ctx = this.tenantContext.getOrThrow();
    return {
      actorIdentityId: ctx.userId ?? undefined,
      actorClientId: ctx.clientId ?? undefined,
      requestId: ctx.requestId || ((req.headers['x-request-id'] as string | undefined) ?? undefined),
      ip: req.ip ?? undefined,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? undefined,
    };
  }

  @Post()
  @AuditAction('tenant.provision', 'tenant')
  @ApiOperation({
    summary: 'Provision a new tenant (DB-per-tenant + optional default Keycloak Organization)',
    description:
      'Creates an isolated PostgreSQL database and LOGIN role on the shared cluster, runs tenant migrations, ' +
      'then optionally bootstraps a default Keycloak Organization in the shared realm (not a dedicated realm). ' +
      'Additional organizations can be created later via POST /api/v1/organizations. ' +
      'Requires an Idempotency-Key header for safe retries.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Client-generated idempotency key (UUID or opaque string) for safe retries',
    required: true,
  })
  @ApiJsonBody(ProvisionTenantDto)
  @ApiCreatedDataResponse(TenantProvisioningResultResponseDto)
  async provision(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: ProvisionTenantDto,
    @Req() req: Request,
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    let result: Awaited<ReturnType<ProvisionTenantUseCase['execute']>>;
    try {
      result = await this.provisionTenantUseCase.execute({
        ctx: toExecutionContext(this.tenantContext.getOrThrow()),
        idempotencyKey,
        slug: dto.slug,
        region: dto.region,
        environment: dto.environment,
        databaseHost: dto.databaseHost,
        databasePort: dto.databasePort,
        databaseName: dto.databaseName,
        credentialsReference: dto.credentialsReference,
        ownerIdentityId: dto.ownerIdentityId,
        bootstrapOrganization: dto.bootstrapOrganization,
        defaultOrganizationName: dto.defaultOrganizationName,
        defaultOrganizationSlug: dto.defaultOrganizationSlug,
      });
    } catch (err) {
      await this.auditService.record({
        ...this.auditCtx(req),
        action: 'tenant.provision',
        resourceType: 'tenant',
        result: 'failure',
        metadata: { slug: dto.slug, error: String(err) },
      });
      throw err;
    }
    await this.auditService.record({
      ...this.auditCtx(req),
      action: 'tenant.provision',
      resourceType: 'tenant',
      resourceId: result.tenantId,
      result: 'success',
      metadata: { slug: dto.slug },
    });
    return { data: result };
  }

  @Post(':tenantId/provisioning/retry')
  @AuditAction('tenant.provisioning.retry', 'tenant')
  @ApiOperation({
    summary: 'Retry a failed or stalled tenant provisioning saga',
    description:
      'Resumes a FAILED or PROVISIONING tenant from the last recorded step. ' +
      'Returns 400 if the tenant is in a state that does not allow retry.',
  })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiCreatedDataResponse(TenantProvisioningResultResponseDto)
  async retryProvisioning(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Req() req: Request,
  ) {
    let result: Awaited<ReturnType<RetryTenantProvisioningUseCase['execute']>>;
    try {
      result = await this.retryTenantProvisioningUseCase.execute({
        ctx: toExecutionContext(this.tenantContext.getOrThrow()),
        tenantId,
      });
    } catch (err) {
      await this.auditService.record({
        ...this.auditCtx(req),
        action: 'tenant.provisioning.retry',
        resourceType: 'tenant',
        resourceId: tenantId,
        tenantId,
        result: 'failure',
        metadata: { error: String(err) },
      });
      throw err;
    }
    await this.auditService.record({
      ...this.auditCtx(req),
      action: 'tenant.provisioning.retry',
      resourceType: 'tenant',
      resourceId: tenantId,
      tenantId,
      result: 'success',
    });
    return { data: result };
  }

  @Delete(':tenantId')
  @AuditAction('tenant.deprovision', 'tenant')
  @ApiOperation({
    summary: 'Deprovision tenant (soft or hard)',
    description:
      'Soft (default): marks tenant DELETED. Hard (?hard=true): closes pools, DROP DATABASE + DROP ROLE, then DELETED. ' +
      'Does not delete a Keycloak realm (shared realm). Keycloak Organizations for this tenant should be cleaned via reconciliation/admin as needed.',
  })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiQuery({ name: 'hard', required: false, type: Boolean })
  @ApiOkDataResponse(TenantDeprovisionResultResponseDto)
  async deprovision(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Query('hard') hard?: string,
    @Req() req?: Request,
  ) {
    const isHard = hard === 'true' || hard === '1';
    let result: Awaited<ReturnType<DeprovisionTenantUseCase['execute']>>;
    try {
      result = await this.deprovisionTenantUseCase.execute({
        ctx: toExecutionContext(this.tenantContext.getOrThrow()),
        tenantId,
        hard: isHard,
      });
    } catch (err) {
      if (req) {
        await this.auditService.record({
          ...this.auditCtx(req),
          action: 'tenant.deprovision',
          resourceType: 'tenant',
          resourceId: tenantId,
          tenantId,
          result: 'failure',
          metadata: { hard: isHard, error: String(err) },
        });
      }
      throw err;
    }
    if (req) {
      await this.auditService.record({
        ...this.auditCtx(req),
        action: 'tenant.deprovision',
        resourceType: 'tenant',
        resourceId: tenantId,
        tenantId,
        result: 'success',
        metadata: { hard: isHard },
      });
    }
    return { data: result };
  }

  @Post(':tenantId/status')
  @AuditAction('tenant.status.change.platform', 'tenant')
  @ApiOperation({ summary: 'Transition tenant status (cross-tenant platform admin)' })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiJsonBody(PlatformTransitionTenantStatusDto)
  @ApiOkDataResponse(TenantResponseDto)
  async transitionStatus(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: PlatformTransitionTenantStatusDto,
    @Req() req: Request,
  ) {
    let tenant: Awaited<ReturnType<TransitionTenantStatusUseCase['execute']>>;
    try {
      tenant = await this.transitionTenantStatusUseCase.execute({
        ctx: toExecutionContext(this.tenantContext.getOrThrow()),
        tenantId,
        status: dto.status,
        skipTenantScope: true,
      });
    } catch (err) {
      await this.auditService.record({
        ...this.auditCtx(req),
        action: 'tenant.status.change.platform',
        resourceType: 'tenant',
        resourceId: tenantId,
        tenantId,
        result: 'failure',
        metadata: { status: dto.status, error: String(err) },
      });
      throw err;
    }
    await this.auditService.record({
      ...this.auditCtx(req),
      action: 'tenant.status.change.platform',
      resourceType: 'tenant',
      resourceId: tenantId,
      tenantId,
      result: 'success',
      metadata: { status: dto.status },
    });
    return { data: tenant };
  }

  @Get(':tenantId/health')
  @ApiOperation({
    summary: 'Get tenant infrastructure health',
    description:
      'Returns database reachability, schema version list, Keycloak org consistency, ' +
      'and domain configuration for a given tenant. All checks are best-effort; errors ' +
      'are surfaced as `reachable: false` rather than HTTP exceptions.',
  })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiOkDataResponse(TenantHealthResponseDto)
  async tenantHealth(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Req() req: Request,
  ) {
    let result: Awaited<ReturnType<GetTenantHealthUseCase['execute']>>;
    try {
      result = await this.getTenantHealthUseCase.execute(tenantId);
    } catch (err) {
      await this.auditService.record({
        ...this.auditCtx(req),
        action: 'tenant.health.get',
        resourceType: 'tenant',
        resourceId: tenantId,
        tenantId,
        result: 'failure',
        metadata: { error: String(err) },
      });
      throw err;
    }
    await this.auditService.record({
      ...this.auditCtx(req),
      action: 'tenant.health.get',
      resourceType: 'tenant',
      resourceId: tenantId,
      tenantId,
      result: 'success',
    });
    return { data: result };
  }
}

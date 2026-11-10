import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { EdgeRoute, RequireEdgePermissions } from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import {
  ConfigureDatabaseBackupUseCase,
  CreateResourcePlanUseCase,
  DeprovisionResourceUseCase,
  ListInfrastructureResourcesUseCase,
  ReconcileResourceUseCase,
  RotateDatabaseCredentialsUseCase,
  ValidateResourcePlanUseCase,
  VerifyDatabaseConnectivityUseCase,
  VerifyDatabaseIsolationUseCase,
} from '../../application/infrastructure-provisioning/infrastructure.use-cases.js';
import { DatabaseEngine } from '../../domain/infrastructure-provisioning/infrastructure.types.js';
import {
  CreateResourcePlanDto,
  DeprovisionResourceDto,
  InfrastructureActionDto,
  InfrastructurePaginationQueryDto,
  ValidateResourcePlanDto,
} from '../dto/infrastructure.dto.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

@ApiTags('edge-p7-infrastructure')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller()
export class EdgeInfrastructureController {
  constructor(
    private readonly lists: ListInfrastructureResourcesUseCase,
    private readonly createPlan: CreateResourcePlanUseCase,
    private readonly validatePlan: ValidateResourcePlanUseCase,
    private readonly reconcile: ReconcileResourceUseCase,
    private readonly verifyConnectivity: VerifyDatabaseConnectivityUseCase,
    private readonly verifyIsolation: VerifyDatabaseIsolationUseCase,
    private readonly rotateCredentials: RotateDatabaseCredentialsUseCase,
    private readonly configureBackup: ConfigureDatabaseBackupUseCase,
    private readonly deprovision: DeprovisionResourceUseCase,
  ) {}

  @Get('edge/infrastructure/providers')
  @RequireEdgePermissions('platform:infrastructure:read')
  @ApiOperation({ summary: 'List infrastructure providers' })
  async listProviders() {
    const items = await this.lists.listProviders();
    return { items, total: items.length };
  }

  @Get('edge/infrastructure/providers/:id')
  @RequireEdgePermissions('platform:infrastructure:read')
  async getProvider(@Param('id') id: string) {
    return this.lists.getProvider(id);
  }

  @Get('edge/infrastructure/resources')
  @RequireEdgePermissions('platform:infrastructure:read')
  async listResources(@Query() query: InfrastructurePaginationQueryDto) {
    return this.lists.listResources({
      limit: query.limit,
      offset: query.offset,
      status: query.status,
      tenantId: query.tenantId,
      resourceType: query.resourceType,
    });
  }

  @Get('edge/infrastructure/resources/:id')
  @RequireEdgePermissions('platform:infrastructure:read')
  async getResource(@Param('id') id: string) {
    return this.lists.getResource(id);
  }

  @Post('edge/infrastructure/resources/:id/reconcile')
  @RequireEdgePermissions('platform:infrastructure:reconcile')
  async reconcileResource(
    @Param('id') id: string,
    @Body() body: InfrastructureActionDto,
    @Req() req: EdgeRequest,
  ) {
    return this.reconcile.execute({
      resourceId: id,
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/infrastructure/resource-plans')
  @RequireEdgePermissions('platform:infrastructure:manage')
  async createResourcePlan(@Body() body: CreateResourcePlanDto, @Req() req: EdgeRequest) {
    return this.createPlan.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      tenantId: body.tenantId,
      productId: body.productId,
      subscriptionId: body.subscriptionId,
      authorizationId: body.authorizationId,
      authorizationVersion: body.authorizationVersion,
      placementDecisionId: body.placementDecisionId,
      reservationId: body.reservationId,
      providerId: body.providerId,
      region: body.region,
      databaseEngine: body.databaseEngine as DatabaseEngine,
      encryptionPolicy: body.encryptionPolicy ?? { tls: true },
      networkRequirements: body.networkRequirements ?? { mode: 'PRIVATE' },
      backupPolicy: body.backupPolicy ?? { enabled: true, schedule: 'daily' },
      computeRequirements: body.computeRequirements,
      storageRequirements: body.storageRequirements,
      deploymentProfileId: body.deploymentProfileId,
    });
  }

  @Get('edge/infrastructure/resource-plans')
  @RequireEdgePermissions('platform:infrastructure:read')
  async listPlans(@Query() query: InfrastructurePaginationQueryDto) {
    return this.lists.listPlans({
      limit: query.limit,
      offset: query.offset,
      status: query.status,
      tenantId: query.tenantId,
      productId: query.productId,
    });
  }

  @Get('edge/infrastructure/resource-plans/:id')
  @RequireEdgePermissions('platform:infrastructure:read')
  async getPlan(@Param('id') id: string) {
    return this.lists.getPlan(id);
  }

  @Post('edge/infrastructure/resource-plans/:id/validate')
  @RequireEdgePermissions('platform:infrastructure:manage')
  async validateResourcePlan(
    @Param('id') id: string,
    @Body() body: ValidateResourcePlanDto,
    @Req() req: EdgeRequest,
  ) {
    return this.validatePlan.execute({
      planId: id,
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      context: {
        authorizationValid: body.authorizationValid ?? false,
        authorizationExpired: body.authorizationExpired ?? false,
        authorizationRevoked: body.authorizationRevoked ?? false,
        placementValid: body.placementValid ?? false,
        reservationValid: body.reservationValid ?? false,
        reservationCommitted: body.reservationCommitted ?? false,
      },
    });
  }

  @Get('edge/databases/resources')
  @RequireEdgePermissions('platform:database:read')
  async listDatabases(@Query() query: InfrastructurePaginationQueryDto) {
    return this.lists.listDatabases({
      limit: query.limit,
      offset: query.offset,
      status: query.status,
      tenantId: query.tenantId,
      engine: query.engine,
    });
  }

  @Get('edge/databases/resources/:id')
  @RequireEdgePermissions('platform:database:read')
  async getDatabase(@Param('id') id: string) {
    return this.lists.getDatabase(id);
  }

  @Post('edge/databases/resources/:id/verify')
  @RequireEdgePermissions('platform:database:verify')
  async verifyDatabase(
    @Param('id') id: string,
    @Body() body: InfrastructureActionDto,
    @Req() req: EdgeRequest,
  ) {
    const correlationId = body.correlationId?.trim() || randomUUID();
    await this.verifyConnectivity.execute({
      databaseResourceId: id,
      actorId: actorId(req),
      correlationId,
    });
    return this.verifyIsolation.execute({
      databaseResourceId: id,
      actorId: actorId(req),
      correlationId,
    });
  }

  @Post('edge/databases/resources/:id/rotate-credentials')
  @RequireEdgePermissions('platform:database:credentials:rotate')
  async rotateDatabaseCredentials(
    @Param('id') id: string,
    @Body() body: InfrastructureActionDto,
    @Req() req: EdgeRequest,
  ) {
    return this.rotateCredentials.execute({
      databaseResourceId: id,
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/resources/:id/history')
  @RequireEdgePermissions('platform:infrastructure:history:read')
  async history(@Param('id') id: string, @Query() query: InfrastructurePaginationQueryDto) {
    const items = await this.lists.listHistory('INFRASTRUCTURE', id, query.limit ?? 50);
    const dbItems = await this.lists.listHistory('DATABASE', id, query.limit ?? 50);
    const merged = [...items, ...dbItems].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    return { items: merged, total: merged.length };
  }

  @Get('edge/resources/:id/backups')
  @RequireEdgePermissions('platform:database:backup')
  async listBackups(@Param('id') id: string) {
    const items = await this.lists.listBackups(id);
    return { items, total: items.length };
  }

  @Post('edge/resources/:id/backups')
  @RequireEdgePermissions('platform:database:backup')
  async createBackup(
    @Param('id') id: string,
    @Body() body: InfrastructureActionDto,
    @Req() req: EdgeRequest,
  ) {
    const db = await this.lists.getDatabase(id);
    const databaseResourceId = db?.id ?? id;
    return this.configureBackup.execute({
      databaseResourceId,
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/resources/:id/deprovision')
  @RequireEdgePermissions('platform:infrastructure:deprovision')
  async deprovisionResource(
    @Param('id') id: string,
    @Body() body: DeprovisionResourceDto,
    @Req() req: EdgeRequest,
  ) {
    return this.deprovision.execute({
      resourceId: id,
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      authorized: body.authorized,
      confirmed: body.confirmed,
    });
  }
}

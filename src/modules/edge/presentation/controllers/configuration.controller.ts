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
  AssignTenantConfigurationUseCase,
  CreateConfigurationBundleUseCase,
  CreateConfigurationSchemaUseCase,
  CreateConfigurationTemplateUseCase,
  ListConfigurationUseCase,
  PublishConfigurationBundleUseCase,
  PublishConfigurationTemplateUseCase,
  RequestConfigurationDeploymentUseCase,
  RequestConfigurationReconcileUseCase,
  RequestConfigurationRollbackUseCase,
} from '../../application/configuration-entitlement/configuration.use-cases.js';
import {
  AssignTenantConfigurationDto,
  ConfigurationPaginationQueryDto,
  CreateConfigurationBundleDto,
  CreateConfigurationSchemaDto,
  CreateConfigurationTemplateDto,
  PublishConfigurationVersionDto,
  RequestConfigurationDeploymentDto,
  RequestConfigurationRollbackDto,
} from '../dto/configuration.dto.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

/**
 * P7.8 — Configuration & Entitlement Deployment API.
 * Mutative deployments ONLY through P7.4 workflows (fail-closed P7.1 auth).
 */
@ApiTags('edge-p7-configuration')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller()
export class EdgeConfigurationController {
  constructor(
    private readonly lists: ListConfigurationUseCase,
    private readonly createSchema: CreateConfigurationSchemaUseCase,
    private readonly createTemplate: CreateConfigurationTemplateUseCase,
    private readonly publishTemplate: PublishConfigurationTemplateUseCase,
    private readonly createBundle: CreateConfigurationBundleUseCase,
    private readonly publishBundle: PublishConfigurationBundleUseCase,
    private readonly assign: AssignTenantConfigurationUseCase,
    private readonly requestDeploy: RequestConfigurationDeploymentUseCase,
    private readonly requestRollback: RequestConfigurationRollbackUseCase,
    private readonly requestReconcile: RequestConfigurationReconcileUseCase,
  ) {}

  // --- schemas ------------------------------------------------------------

  @Get('edge/configuration/schemas')
  @RequireEdgePermissions('platform:configuration:read')
  @ApiOperation({ summary: 'List configuration schemas' })
  async listSchemas(@Query() query: ConfigurationPaginationQueryDto) {
    return this.lists.schemas({
      limit: query.limit,
      offset: query.offset,
      status: query.status,
      q: query.q,
    });
  }

  @Get('edge/configuration/schemas/:id')
  @RequireEdgePermissions('platform:configuration:read')
  async getSchema(@Param('id') id: string) {
    return this.lists.schema(id);
  }

  @Post('edge/configuration/schemas')
  @RequireEdgePermissions('platform:configuration:manage')
  @ApiOperation({ summary: 'Create a configuration JSON schema version' })
  async createSchemaEndpoint(
    @Body() body: CreateConfigurationSchemaDto,
    @Req() req: EdgeRequest,
  ) {
    return this.createSchema.execute({
      actorId: actorId(req),
      code: body.code,
      name: body.name,
      description: body.description,
      productId: body.productId,
      schemaVersion: body.schemaVersion,
      jsonSchema: body.jsonSchema,
      metadata: body.metadata,
    });
  }

  // --- templates ----------------------------------------------------------

  @Get('edge/configuration/templates')
  @RequireEdgePermissions('platform:configuration:read')
  async listTemplates(@Query() query: ConfigurationPaginationQueryDto) {
    return this.lists.templates({
      limit: query.limit,
      offset: query.offset,
      status: query.status,
      q: query.q,
    });
  }

  @Get('edge/configuration/templates/:id')
  @RequireEdgePermissions('platform:configuration:read')
  async getTemplate(@Param('id') id: string) {
    return this.lists.template(id);
  }

  @Post('edge/configuration/templates')
  @RequireEdgePermissions('platform:configuration:manage')
  async createTemplateEndpoint(
    @Body() body: CreateConfigurationTemplateDto,
    @Req() req: EdgeRequest,
  ) {
    return this.createTemplate.execute({
      actorId: actorId(req),
      code: body.code,
      name: body.name,
      description: body.description,
      productId: body.productId,
      schemaId: body.schemaId,
      runtimeProfileCode: body.runtimeProfileCode,
      deploymentProfileCode: body.deploymentProfileCode,
      draftPayload: body.draftPayload,
      metadata: body.metadata,
    });
  }

  @Post('edge/configuration/templates/:id/publish')
  @RequireEdgePermissions('platform:configuration:manage')
  async publishTemplateEndpoint(
    @Param('id') id: string,
    @Body() body: PublishConfigurationVersionDto,
    @Req() req: EdgeRequest,
  ) {
    return this.publishTemplate.execute({
      actorId: actorId(req),
      templateId: id,
      versionNumber: body.versionNumber ?? 1,
      expectedVersion: body.expectedVersion,
    });
  }

  // --- bundles ------------------------------------------------------------

  @Get('edge/configuration/bundles')
  @RequireEdgePermissions('platform:configuration:read')
  async listBundles(@Query() query: ConfigurationPaginationQueryDto) {
    return this.lists.bundles({
      limit: query.limit,
      offset: query.offset,
      status: query.status,
      q: query.q,
    });
  }

  @Get('edge/configuration/bundles/:id')
  @RequireEdgePermissions('platform:configuration:read')
  async getBundle(@Param('id') id: string) {
    return this.lists.bundle(id);
  }

  @Post('edge/configuration/bundles')
  @RequireEdgePermissions('platform:configuration:manage')
  async createBundleEndpoint(
    @Body() body: CreateConfigurationBundleDto,
    @Req() req: EdgeRequest,
  ) {
    return this.createBundle.execute({
      actorId: actorId(req),
      code: body.code,
      name: body.name,
      description: body.description,
      productId: body.productId,
      templateRefs: body.templateRefs,
      dependencyRefs: body.dependencyRefs,
      payload: body.payload,
      rolloutPolicy: body.rolloutPolicy,
      metadata: body.metadata,
    });
  }

  @Post('edge/configuration/bundles/:id/publish')
  @RequireEdgePermissions('platform:configuration:manage')
  async publishBundleEndpoint(
    @Param('id') id: string,
    @Body() body: PublishConfigurationVersionDto,
    @Req() req: EdgeRequest,
  ) {
    return this.publishBundle.execute({
      actorId: actorId(req),
      bundleId: id,
      versionNumber: body.versionNumber ?? 1,
      expectedVersion: body.expectedVersion,
    });
  }

  // --- assignments / deploy / rollback ------------------------------------

  @Get('edge/configuration/assignments')
  @RequireEdgePermissions('platform:configuration:read')
  async listAssignments(@Query() query: ConfigurationPaginationQueryDto) {
    return this.lists.assignments({
      tenantId: query.tenantId,
      productId: query.productId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('edge/configuration/assignments/:id')
  @RequireEdgePermissions('platform:configuration:read')
  async getAssignment(@Param('id') id: string) {
    const assignment = await this.lists.assignment(id);
    if (!assignment) return null;
    const [runs, evidence, entitlements] = await Promise.all([
      this.lists.runs(id, 20),
      this.lists.evidence(id, 50),
      this.lists.entitlements(id, 20),
    ]);
    return { assignment, runs, evidence, entitlements };
  }

  @Post('edge/configuration/assignments')
  @RequireEdgePermissions('platform:configuration:deploy')
  @ApiOperation({
    summary: 'Assign a published bundle to a tenant (P7.1 revalidation, no entitlement expansion)',
  })
  async assignEndpoint(@Body() body: AssignTenantConfigurationDto, @Req() req: EdgeRequest) {
    return this.assign.execute({
      actorId: actorId(req),
      tenantId: body.tenantId,
      productId: body.productId,
      provisioningRequestId: body.provisioningRequestId,
      bundleId: body.bundleId,
      bundleVersion: body.bundleVersion,
      desiredConfig: body.desiredConfig,
      grantedEntitlements: body.grantedEntitlements,
      subscriptionId: body.subscriptionId,
      accountId: body.accountId,
      entitlementSnapshotRef: body.entitlementSnapshotRef,
      entitlementVersion: body.entitlementVersion,
      deploymentStrategy: body.deploymentStrategy,
      metadata: body.metadata,
    });
  }

  @Post('edge/configuration/assignments/:id/deploy')
  @RequireEdgePermissions('platform:configuration:deploy')
  @ApiOperation({ summary: 'Launch p78.configuration.deploy workflow' })
  async deployEndpoint(
    @Param('id') id: string,
    @Body() body: RequestConfigurationDeploymentDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestDeploy.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p78-deploy-${id}-${Date.now()}`,
      assignmentId: id,
      provisioningRequestId: body.provisioningRequestId ?? null,
    });
  }

  @Post('edge/configuration/assignments/:id/rollback')
  @RequireEdgePermissions('platform:configuration:rollback')
  @ApiOperation({ summary: 'Launch p78.configuration.rollback (rejects revoked entitlements)' })
  async rollbackEndpoint(
    @Param('id') id: string,
    @Body() body: RequestConfigurationRollbackDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestRollback.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p78-rollback-${id}-${Date.now()}`,
      assignmentId: id,
      reason: body.reason ?? null,
    });
  }

  @Get('edge/configuration/assignments/:id/runs')
  @RequireEdgePermissions('platform:configuration:history:read')
  async listRuns(@Param('id') id: string) {
    const items = await this.lists.runs(id);
    return { items, total: items.length };
  }

  @Get('edge/configuration/assignments/:id/evidence')
  @RequireEdgePermissions('platform:configuration:history:read')
  async listEvidence(@Param('id') id: string) {
    const items = await this.lists.evidence(id);
    return { items, total: items.length };
  }

  // --- entitlements -------------------------------------------------------

  @Get('edge/entitlements/assignments/:assignmentId')
  @RequireEdgePermissions('platform:entitlement:read')
  @ApiOperation({ summary: 'List entitlement deployments for an assignment' })
  async listEntitlements(@Param('assignmentId') assignmentId: string) {
    const items = await this.lists.entitlements(assignmentId);
    return { items, total: items.length };
  }

  @Post('edge/entitlements/assignments/:assignmentId/reconcile')
  @RequireEdgePermissions('platform:entitlement:reconcile')
  @ApiOperation({ summary: 'Launch p78.configuration.reconcile workflow (P7.1 revalidated)' })
  async reconcileEntitlements(
    @Param('assignmentId') assignmentId: string,
    @Body() body: RequestConfigurationRollbackDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestReconcile.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p78-reconcile-${assignmentId}-${Date.now()}`,
      assignmentId,
    });
  }
}

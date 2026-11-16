import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
  AddTenantNoteUseCase,
  ApproveExceptionUseCase,
  ApproveLifecycleActionUseCase,
  ApproveMigrationUseCase,
  ApproveRecoveryUseCase,
  ApproveTerminationUseCase,
  AssignTenantOwnerUseCase,
  ExpireExceptionsUseCase,
  GetPortfolioAnalyticsUseCase,
  GetTenant360UseCase,
  GetTenantUseCase,
  ListActivityUseCase,
  ListExceptionsUseCase,
  ListFindingsUseCase,
  ListLifecycleRequestsUseCase,
  ListMigrationRequestsUseCase,
  ListRecoveryRequestsUseCase,
  ListTerminationRequestsUseCase,
  ListTenantsUseCase,
  ManageTenantTagsUseCase,
  RegisterTenantUseCase,
  RejectLifecycleActionUseCase,
  RejectMigrationUseCase,
  RejectRecoveryUseCase,
  RejectTerminationUseCase,
  RequestExceptionUseCase,
  RequestLifecycleActionUseCase,
  RequestMigrationUseCase,
  RequestRecoveryUseCase,
  RequestTerminationUseCase,
  RevokeExceptionUseCase,
  RunReconciliationUseCase,
  SyncTenantsFromP7UseCase,
  UpdateTenantMetadataUseCase,
} from '../../application/tenant-management/tenant-management.use-cases.js';
import {
  AddTenantNoteDto,
  ApproveLifecycleActionDto,
  AssignTenantOwnerDto,
  GovernanceListQueryDto,
  ManageTenantTagDto,
  RegisterTenantDto,
  ReconciliationFindingsQueryDto,
  RejectGovernanceRequestDto,
  RejectLifecycleActionDto,
  RemoveTenantTagQueryDto,
  RequestExceptionDto,
  RequestLifecycleActionDto,
  RequestMigrationDto,
  RequestRecoveryDto,
  RequestTerminationDto,
  RevokeExceptionDto,
  RunReconciliationDto,
  TenantActivityQueryDto,
  TenantSearchQueryDto,
  UpdateTenantMetadataDto,
} from '../dto/tenant-management.dto.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

/**
 * P8 — Advanced Tenant Management & Governance API.
 */
@ApiTags('edge-p8-tenant-management')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller()
export class EdgeTenantManagementController {
  constructor(
    private readonly listTenants: ListTenantsUseCase,
    private readonly getTenant: GetTenantUseCase,
    private readonly getTenant360: GetTenant360UseCase,
    private readonly portfolioAnalytics: GetPortfolioAnalyticsUseCase,
    private readonly registerTenant: RegisterTenantUseCase,
    private readonly syncFromP7: SyncTenantsFromP7UseCase,
    private readonly updateMetadata: UpdateTenantMetadataUseCase,
    private readonly assignOwner: AssignTenantOwnerUseCase,
    private readonly manageTags: ManageTenantTagsUseCase,
    private readonly addNote: AddTenantNoteUseCase,
    private readonly listActivity: ListActivityUseCase,
    private readonly requestLifecycle: RequestLifecycleActionUseCase,
    private readonly listLifecycleRequests: ListLifecycleRequestsUseCase,
    private readonly approveLifecycle: ApproveLifecycleActionUseCase,
    private readonly rejectLifecycle: RejectLifecycleActionUseCase,
    private readonly requestException: RequestExceptionUseCase,
    private readonly listExceptions: ListExceptionsUseCase,
    private readonly approveException: ApproveExceptionUseCase,
    private readonly revokeException: RevokeExceptionUseCase,
    private readonly expireExceptions: ExpireExceptionsUseCase,
    private readonly requestMigration: RequestMigrationUseCase,
    private readonly listMigrations: ListMigrationRequestsUseCase,
    private readonly approveMigration: ApproveMigrationUseCase,
    private readonly rejectMigration: RejectMigrationUseCase,
    private readonly requestRecovery: RequestRecoveryUseCase,
    private readonly listRecoveries: ListRecoveryRequestsUseCase,
    private readonly approveRecovery: ApproveRecoveryUseCase,
    private readonly rejectRecovery: RejectRecoveryUseCase,
    private readonly requestTermination: RequestTerminationUseCase,
    private readonly listTerminations: ListTerminationRequestsUseCase,
    private readonly approveTermination: ApproveTerminationUseCase,
    private readonly rejectTermination: RejectTerminationUseCase,
    private readonly runReconciliation: RunReconciliationUseCase,
    private readonly listFindings: ListFindingsUseCase,
  ) {}

  @Get('edge/tenants')
  @RequireEdgePermissions('platform:tenant_management:search')
  @ApiOperation({ summary: 'Search tenant registry' })
  async searchTenants(@Query() query: TenantSearchQueryDto) {
    return this.listTenants.execute(query);
  }

  @Get('edge/tenants/analytics/portfolio')
  @RequireEdgePermissions('platform:tenant_management:analytics:read')
  async portfolioUnderTenants() {
    return this.portfolioAnalytics.execute();
  }

  @Get('edge/tenant-management/analytics/portfolio')
  @RequireEdgePermissions('platform:tenant_management:analytics:read')
  async portfolioUnderManagement() {
    return this.portfolioAnalytics.execute();
  }

  @Post('edge/tenants')
  @RequireEdgePermissions('platform:tenant_management:register')
  async register(@Body() body: RegisterTenantDto, @Req() req: EdgeRequest) {
    return this.registerTenant.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/tenants/sync-from-p7')
  @RequireEdgePermissions('platform:tenant_management:register')
  async syncP7(@Req() req: EdgeRequest) {
    return this.syncFromP7.execute({ actorId: actorId(req) });
  }

  @Get('edge/tenant-management/lifecycle-requests')
  @RequireEdgePermissions('platform:tenant_management:lifecycle:request')
  async listGlobalLifecycleRequests(@Query() query: GovernanceListQueryDto) {
    return this.listLifecycleRequests.execute(query);
  }

  @Post('edge/tenant-management/lifecycle-requests/:id/approve')
  @RequireEdgePermissions('platform:tenant_management:lifecycle:approve')
  async approveLifecycleRequest(
    @Param('id') id: string,
    @Body() body: ApproveLifecycleActionDto,
    @Req() req: EdgeRequest,
  ) {
    return this.approveLifecycle.execute({
      actorId: actorId(req),
      requestId: id,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/tenant-management/lifecycle-requests/:id/reject')
  @RequireEdgePermissions('platform:tenant_management:lifecycle:approve')
  async rejectLifecycleRequest(
    @Param('id') id: string,
    @Body() body: RejectLifecycleActionDto,
    @Req() req: EdgeRequest,
  ) {
    return this.rejectLifecycle.execute({
      actorId: actorId(req),
      requestId: id,
      rejectedReason: body.rejectedReason,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/tenant-management/exceptions')
  @RequireEdgePermissions('platform:tenant_management:exception:request')
  async listGlobalExceptions(@Query() query: GovernanceListQueryDto) {
    return this.listExceptions.execute(query);
  }

  @Post('edge/tenant-management/exceptions')
  @RequireEdgePermissions('platform:tenant_management:exception:request')
  async createException(@Body() body: RequestExceptionDto, @Req() req: EdgeRequest) {
    return this.requestException.execute({
      actorId: actorId(req),
      tenantRegistryId: body.tenantRegistryId,
      exceptionType: body.exceptionType,
      description: body.description,
      businessJustification: body.businessJustification,
      startsAt: new Date(body.startsAt),
      expiresAt: new Date(body.expiresAt),
      idempotencyKey: body.idempotencyKey,
      riskAssessment: body.riskAssessment ?? null,
      scope: body.scope,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/tenant-management/exceptions/:id/approve')
  @RequireEdgePermissions('platform:tenant_management:exception:approve')
  async approveExceptionEndpoint(@Param('id') id: string, @Req() req: EdgeRequest) {
    return this.approveException.execute({
      actorId: actorId(req),
      exceptionId: id,
      correlationId: randomUUID(),
    });
  }

  @Post('edge/tenant-management/exceptions/:id/revoke')
  @RequireEdgePermissions('platform:tenant_management:exception:approve')
  async revokeExceptionEndpoint(
    @Param('id') id: string,
    @Body() body: RevokeExceptionDto,
    @Req() req: EdgeRequest,
  ) {
    return this.revokeException.execute({
      actorId: actorId(req),
      exceptionId: id,
      revokeReason: body.revokeReason,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/tenant-management/exceptions/expire-due')
  @RequireEdgePermissions('platform:tenant_management:exception:approve')
  async expireDueExceptions() {
    return this.expireExceptions.execute();
  }

  @Get('edge/tenant-management/migrations')
  @RequireEdgePermissions('platform:tenant_management:migration:request')
  async listGlobalMigrations(@Query() query: GovernanceListQueryDto) {
    return this.listMigrations.execute(query);
  }

  @Post('edge/tenant-management/migrations')
  @RequireEdgePermissions('platform:tenant_management:migration:request')
  async createMigration(@Body() body: RequestMigrationDto, @Req() req: EdgeRequest) {
    return this.requestMigration.execute({
      actorId: actorId(req),
      tenantRegistryId: body.tenantRegistryId,
      migrationType: body.migrationType,
      justification: body.justification,
      idempotencyKey: body.idempotencyKey,
      impactAssessment: body.impactAssessment ?? null,
      compatibilityAssessment: body.compatibilityAssessment ?? null,
      dataResidencyReview: body.dataResidencyReview ?? null,
      downtimeAssessment: body.downtimeAssessment ?? null,
      targetRef: body.targetRef,
      scheduleAt: body.scheduleAt ? new Date(body.scheduleAt) : null,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/tenant-management/migrations/:id/approve')
  @RequireEdgePermissions('platform:tenant_management:migration:approve')
  async approveMigrationEndpoint(@Param('id') id: string, @Req() req: EdgeRequest) {
    return this.approveMigration.execute({
      actorId: actorId(req),
      requestId: id,
      correlationId: randomUUID(),
    });
  }

  @Post('edge/tenant-management/migrations/:id/reject')
  @RequireEdgePermissions('platform:tenant_management:migration:approve')
  async rejectMigrationEndpoint(
    @Param('id') id: string,
    @Body() body: RejectGovernanceRequestDto,
    @Req() req: EdgeRequest,
  ) {
    return this.rejectMigration.execute({
      actorId: actorId(req),
      requestId: id,
      rejectedReason: body.rejectedReason,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/tenant-management/recoveries')
  @RequireEdgePermissions('platform:tenant_management:recovery:request')
  async listGlobalRecoveries(@Query() query: GovernanceListQueryDto) {
    return this.listRecoveries.execute(query);
  }

  @Post('edge/tenant-management/recoveries')
  @RequireEdgePermissions('platform:tenant_management:recovery:request')
  async createRecovery(@Body() body: RequestRecoveryDto, @Req() req: EdgeRequest) {
    return this.requestRecovery.execute({
      actorId: actorId(req),
      tenantRegistryId: body.tenantRegistryId,
      recoveryType: body.recoveryType,
      justification: body.justification,
      idempotencyKey: body.idempotencyKey,
      priority: body.priority,
      scope: body.scope,
      backupRef: body.backupRef ?? null,
      restorePointRef: body.restorePointRef ?? null,
      rpoAssessment: body.rpoAssessment ?? null,
      rtoMeasurement: body.rtoMeasurement ?? null,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/tenant-management/recoveries/:id/approve')
  @RequireEdgePermissions('platform:tenant_management:recovery:approve')
  async approveRecoveryEndpoint(@Param('id') id: string, @Req() req: EdgeRequest) {
    return this.approveRecovery.execute({
      actorId: actorId(req),
      requestId: id,
    });
  }

  @Post('edge/tenant-management/recoveries/:id/reject')
  @RequireEdgePermissions('platform:tenant_management:recovery:approve')
  async rejectRecoveryEndpoint(
    @Param('id') id: string,
    @Body() body: RejectGovernanceRequestDto,
    @Req() req: EdgeRequest,
  ) {
    return this.rejectRecovery.execute({
      actorId: actorId(req),
      requestId: id,
      rejectedReason: body.rejectedReason,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/tenant-management/terminations')
  @RequireEdgePermissions('platform:tenant_management:termination:request')
  async listGlobalTerminations(@Query() query: GovernanceListQueryDto) {
    return this.listTerminations.execute(query);
  }

  @Post('edge/tenant-management/terminations')
  @RequireEdgePermissions('platform:tenant_management:termination:request')
  async createTermination(@Body() body: RequestTerminationDto, @Req() req: EdgeRequest) {
    return this.requestTermination.execute({
      actorId: actorId(req),
      tenantRegistryId: body.tenantRegistryId,
      justification: body.justification,
      idempotencyKey: body.idempotencyKey,
      dataExportRef: body.dataExportRef ?? null,
      graceUntil: body.graceUntil ? new Date(body.graceUntil) : null,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/tenant-management/terminations/:id/approve')
  @RequireEdgePermissions('platform:tenant_management:termination:approve')
  async approveTerminationEndpoint(@Param('id') id: string, @Req() req: EdgeRequest) {
    return this.approveTermination.execute({
      actorId: actorId(req),
      requestId: id,
    });
  }

  @Post('edge/tenant-management/terminations/:id/reject')
  @RequireEdgePermissions('platform:tenant_management:termination:approve')
  async rejectTerminationEndpoint(
    @Param('id') id: string,
    @Body() body: RejectGovernanceRequestDto,
    @Req() req: EdgeRequest,
  ) {
    return this.rejectTermination.execute({
      actorId: actorId(req),
      requestId: id,
      rejectedReason: body.rejectedReason,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/tenant-management/reconciliation/runs')
  @RequireEdgePermissions('platform:tenant_management:reconciliation:execute')
  async reconciliationRun(@Body() body: RunReconciliationDto, @Req() req: EdgeRequest) {
    return this.runReconciliation.execute({
      actorId: actorId(req),
      mode: body.mode,
      dryRun: body.dryRun,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/tenant-management/reconciliation/findings')
  @RequireEdgePermissions('platform:tenant_management:reconciliation:execute')
  async reconciliationFindings(@Query() query: ReconciliationFindingsQueryDto) {
    return this.listFindings.execute(query);
  }

  @Get('edge/tenants/:id')
  @RequireEdgePermissions('platform:tenant_management:read')
  async getTenantById(@Param('id') id: string) {
    return this.getTenant.execute(id);
  }

  @Get('edge/tenants/:id/360')
  @RequireEdgePermissions('platform:tenant_management:read')
  async getTenant360ById(@Param('id') id: string) {
    return this.getTenant360.execute(id);
  }

  @Patch('edge/tenants/:id')
  @RequireEdgePermissions('platform:tenant_management:update_metadata')
  async patchTenant(
    @Param('id') id: string,
    @Body() body: UpdateTenantMetadataDto,
    @Req() req: EdgeRequest,
  ) {
    return this.updateMetadata.execute({
      actorId: actorId(req),
      id,
      expectedVersion: body.expectedVersion,
      displayName: body.displayName,
      classification: body.classification,
      segment: body.segment,
      region: body.region,
      locale: body.locale,
      timezone: body.timezone,
      defaultLanguage: body.defaultLanguage,
      supportClassification: body.supportClassification,
      deploymentProfile: body.deploymentProfile,
      environmentClassification: body.environmentClassification,
      metadata: body.metadata,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/tenants/:id/owner')
  @RequireEdgePermissions('platform:tenant_management:assign_owner')
  async assignTenantOwner(
    @Param('id') id: string,
    @Body() body: AssignTenantOwnerDto,
    @Req() req: EdgeRequest,
  ) {
    return this.assignOwner.execute({
      actorId: actorId(req),
      id,
      expectedVersion: body.expectedVersion,
      internalOwnerId: body.internalOwnerId,
      operationalTeam: body.operationalTeam,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/tenants/:id/tags')
  @RequireEdgePermissions('platform:tenant_management:manage_tags')
  async addTag(
    @Param('id') id: string,
    @Body() body: ManageTenantTagDto,
    @Req() req: EdgeRequest,
  ) {
    return this.manageTags.execute({
      actorId: actorId(req),
      tenantRegistryId: id,
      mode: 'add',
      tagKey: body.tagKey,
      tagValue: body.tagValue,
    });
  }

  @Delete('edge/tenants/:id/tags')
  @RequireEdgePermissions('platform:tenant_management:manage_tags')
  async removeTag(
    @Param('id') id: string,
    @Query() query: RemoveTenantTagQueryDto,
    @Req() req: EdgeRequest,
  ) {
    return this.manageTags.execute({
      actorId: actorId(req),
      tenantRegistryId: id,
      mode: 'remove',
      tagKey: query.tagKey,
      tagValue: query.tagValue,
    });
  }

  @Post('edge/tenants/:id/notes')
  @RequireEdgePermissions('platform:tenant_management:update_metadata')
  async addTenantNote(
    @Param('id') id: string,
    @Body() body: AddTenantNoteDto,
    @Req() req: EdgeRequest,
  ) {
    return this.addNote.execute({
      actorId: actorId(req),
      tenantRegistryId: id,
      noteType: body.noteType ?? 'GENERAL',
      body: body.body,
    });
  }

  @Get('edge/tenants/:id/activity')
  @RequireEdgePermissions('platform:tenant_management:audit:read')
  async tenantActivity(@Param('id') id: string, @Query() query: TenantActivityQueryDto) {
    return this.listActivity.execute({
      tenantRegistryId: id,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Post('edge/tenants/:id/lifecycle-requests')
  @RequireEdgePermissions('platform:tenant_management:lifecycle:request')
  async tenantLifecycleRequest(
    @Param('id') id: string,
    @Body() body: RequestLifecycleActionDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestLifecycle.execute({
      actorId: actorId(req),
      tenantRegistryId: id,
      requestType: body.requestType,
      justification: body.justification,
      idempotencyKey: body.idempotencyKey,
      riskAssessment: body.riskAssessment ?? null,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }
}
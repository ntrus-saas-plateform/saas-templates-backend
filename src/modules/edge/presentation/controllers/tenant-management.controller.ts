import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
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
  AcknowledgeFindingUseCase,
  AddTenantNoteUseCase,
  ApproveExceptionUseCase,
  ApproveLifecycleActionUseCase,
  ApproveMigrationUseCase,
  ApproveRecoveryUseCase,
  ApproveTerminationUseCase,
  AssignTenantOwnerUseCase,
  EvaluateTenantRiskUseCase,
  ExecuteBulkOperationUseCase,
  ExpireExceptionsUseCase,
  ExportTenantsUseCase,
  GetPortfolioAnalyticsUseCase,
  GetTenant360UseCase,
  GetTenantUseCase,
  ListActivityUseCase,
  ListBulkOperationsUseCase,
  ListExceptionsUseCase,
  ListFindingsUseCase,
  ListHealthSnapshotsUseCase,
  ListLifecycleRequestsUseCase,
  ListMigrationRequestsUseCase,
  ListTenantReconciliationRunsUseCase,
  ListRecoveryRequestsUseCase,
  ListRiskAssessmentsUseCase,
  ListTerminationRequestsUseCase,
  ListTenantsUseCase,
  ManageTenantTagsUseCase,
  PreviewBulkOperationUseCase,
  RecordHealthSnapshotUseCase,
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
  UpdateLegalHoldUseCase,
  UpdateTenantMetadataUseCase,
  UpdateTenantPoliciesUseCase,
} from '../../application/tenant-management/tenant-management.use-cases.js';
import {
  AcknowledgeFindingDto,
  AddTenantNoteDto,
  ApproveLifecycleActionDto,
  AssignTenantOwnerDto,
  ExecuteBulkOperationDto,
  GovernanceListQueryDto,
  ManageTenantTagDto,
  PreviewBulkOperationDto,
  RecordHealthSnapshotDto,
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
  UpdateLegalHoldDto,
  UpdateTenantMetadataDto,
  UpdateTenantPoliciesDto,
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
    private readonly exportTenants: ExportTenantsUseCase,
    private readonly previewBulk: PreviewBulkOperationUseCase,
    private readonly executeBulk: ExecuteBulkOperationUseCase,
    private readonly listBulk: ListBulkOperationsUseCase,
    private readonly recordHealth: RecordHealthSnapshotUseCase,
    private readonly listHealth: ListHealthSnapshotsUseCase,
    private readonly evaluateRisk: EvaluateTenantRiskUseCase,
    private readonly listRisk: ListRiskAssessmentsUseCase,
    private readonly updatePolicies: UpdateTenantPoliciesUseCase,
    private readonly updateLegalHold: UpdateLegalHoldUseCase,
    private readonly listReconciliationRuns: ListTenantReconciliationRunsUseCase,
    private readonly acknowledgeFinding: AcknowledgeFindingUseCase,
  ) {}

  @Get('edge/tenants')
  @RequireEdgePermissions('platform:tenant_management:search')
  @ApiOperation({ summary: 'Search tenant registry' })
  async searchTenants(@Query() query: TenantSearchQueryDto) {
    return this.listTenants.execute(query);
  }

  @Get('edge/tenants/export')
  @RequireEdgePermissions('platform:tenant_management:export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportTenantRegistry(@Query() query: TenantSearchQueryDto, @Req() req: EdgeRequest) {
    const result = await this.exportTenants.execute({
      actorId: actorId(req),
      filter: query,
      correlationId: randomUUID(),
    });
    return result.csv;
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

  @Get('edge/tenant-management/reconciliation/runs')
  @RequireEdgePermissions('platform:tenant_management:reconciliation:execute')
  async reconciliationRuns(@Query() query: GovernanceListQueryDto) {
    return this.listReconciliationRuns.execute({ limit: query.limit, offset: query.offset });
  }

  @Post('edge/tenant-management/reconciliation/findings/:id/acknowledge')
  @RequireEdgePermissions('platform:tenant_management:reconciliation:remediate')
  async acknowledgeReconciliationFinding(
    @Param('id') id: string,
    @Body() body: AcknowledgeFindingDto,
    @Req() req: EdgeRequest,
  ) {
    return this.acknowledgeFinding.execute({
      actorId: actorId(req),
      findingId: id,
      status: body.status,
      reason: body.reason ?? null,
    });
  }

  @Post('edge/tenant-management/bulk/preview')
  @RequireEdgePermissions('platform:tenant_management:bulk:execute')
  async bulkPreview(@Body() body: PreviewBulkOperationDto, @Req() req: EdgeRequest) {
    return this.previewBulk.execute({
      actorId: actorId(req),
      operationType: body.operationType,
      filter: body.filter as TenantSearchQueryDto,
      payload: body.payload,
      idempotencyKey: body.idempotencyKey,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/tenant-management/bulk/:id/execute')
  @RequireEdgePermissions('platform:tenant_management:bulk:execute')
  async bulkExecute(
    @Param('id') id: string,
    @Body() body: ExecuteBulkOperationDto,
    @Req() req: EdgeRequest,
  ) {
    return this.executeBulk.execute({
      actorId: actorId(req),
      bulkOperationId: id,
      expectedPreviewCount: body.expectedPreviewCount,
    });
  }

  @Get('edge/tenant-management/bulk')
  @RequireEdgePermissions('platform:tenant_management:bulk:execute')
  async listBulkOps(@Query() query: GovernanceListQueryDto) {
    return this.listBulk.execute({ status: query.status, limit: query.limit, offset: query.offset });
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

  @Post('edge/tenants/:id/health-snapshots')
  @RequireEdgePermissions('platform:tenant_management:update_metadata')
  async postHealthSnapshot(
    @Param('id') id: string,
    @Body() body: RecordHealthSnapshotDto,
    @Req() req: EdgeRequest,
  ) {
    return this.recordHealth.execute({
      actorId: actorId(req),
      tenantRegistryId: id,
      overallStatus: body.overallStatus,
      indicators: body.indicators,
      sourceSystem: body.sourceSystem,
      observedAt: new Date(body.observedAt),
      staleAfter: body.staleAfter ? new Date(body.staleAfter) : undefined,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/tenants/:id/health-snapshots')
  @RequireEdgePermissions('platform:tenant_management:read')
  async getHealthSnapshots(@Param('id') id: string, @Query() query: TenantActivityQueryDto) {
    return this.listHealth.execute(id, query.limit);
  }

  @Post('edge/tenants/:id/risk-assessments')
  @RequireEdgePermissions('platform:tenant_management:update_metadata')
  async postRiskAssessment(@Param('id') id: string, @Req() req: EdgeRequest) {
    return this.evaluateRisk.execute({
      actorId: actorId(req),
      tenantRegistryId: id,
      correlationId: randomUUID(),
    });
  }

  @Get('edge/tenants/:id/risk-assessments')
  @RequireEdgePermissions('platform:tenant_management:read')
  async getRiskAssessments(@Param('id') id: string, @Query() query: TenantActivityQueryDto) {
    return this.listRisk.execute(id, query.limit);
  }

  @Patch('edge/tenants/:id/policies')
  @RequireEdgePermissions('platform:tenant_management:update_metadata')
  async patchTenantPolicies(
    @Param('id') id: string,
    @Body() body: UpdateTenantPoliciesDto,
    @Req() req: EdgeRequest,
  ) {
    return this.updatePolicies.execute({
      actorId: actorId(req),
      tenantRegistryId: id,
      expectedVersion: body.expectedVersion,
      retentionPolicyRef: body.retentionPolicyRef,
      securityPolicyRef: body.securityPolicyRef,
      dataResidencyRef: body.dataResidencyRef,
      deletionProtection: body.deletionProtection,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/tenants/:id/legal-hold')
  @RequireEdgePermissions('platform:tenant_management:legal_hold:manage')
  async postTenantLegalHold(
    @Param('id') id: string,
    @Body() body: UpdateLegalHoldDto,
    @Req() req: EdgeRequest,
  ) {
    return this.updateLegalHold.execute({
      actorId: actorId(req),
      tenantRegistryId: id,
      expectedVersion: body.expectedVersion,
      legalHold: body.legalHold,
      justification: body.justification,
      legalHoldPermissionGranted: true,
      correlationId: body.correlationId?.trim() || randomUUID(),
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
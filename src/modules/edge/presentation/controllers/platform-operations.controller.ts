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
  AcknowledgeAlertUseCase,
  ApproveAutomationExecutionUseCase,
  ApproveChangeUseCase,
  ApproveStatusPublicationUseCase,
  ConfirmProblemRootCauseUseCase,
  ConnectMonitoringSourceUseCase,
  CreateAutomationUseCase,
  CreateChangeUseCase,
  CreateIncidentUseCase,
  CreateOnCallRotationUseCase,
  CreateOperationalExceptionUseCase,
  CreateOperationalRiskUseCase,
  CreateOperationalTaskUseCase,
  CreateProblemUseCase,
  CreateReleaseUseCase,
  CreateRunbookUseCase,
  CreateServiceRequestUseCase,
  CreateSloUseCase,
  DeclareMajorIncidentUseCase,
  ExecuteAutomationUseCase,
  FlagExpiredExceptionsUseCase,
  GetIncidentUseCase,
  GetOperationsOverviewUseCase,
  IngestOperationalAlertUseCase,
  LinkProblemIncidentUseCase,
  ListAlertsUseCase,
  ListAutomationsUseCase,
  ListCapacityUseCase,
  ListChangesUseCase,
  ListIncidentsUseCase,
  ListMaintenanceUseCase,
  ListMonitoringProbeResultsUseCase,
  ListNotificationDeliveriesUseCase,
  ListOnCallRotationsUseCase,
  ListOperationalExceptionsUseCase,
  ListProblemsUseCase,
  ListRecoveryUseCase,
  ListReleasesUseCase,
  ListRisksUseCase,
  ListRunbooksUseCase,
  ListServiceRequestsUseCase,
  ListSlosUseCase,
  ListStatusComponentsUseCase,
  ListTasksUseCase,
  PublishStatusUpdateUseCase,
  RecordCapacityMeasurementUseCase,
  RecordMonitoringProbeResultUseCase,
  RecordNotificationDeliveryUseCase,
  RecordServiceHealthSnapshotUseCase,
  RecordSloMeasurementUseCase,
  RejectChangeUseCase,
  RequestAutomationExecutionUseCase,
  RequestRecoveryUseCase,
  ResolveAlertUseCase,
  ScheduleMaintenanceUseCase,
  SubmitChangeUseCase,
  TransitionIncidentUseCase,
  TransitionReleaseUseCase,
  UpdateNotificationDeliveryStatusUseCase,
  VerifyRecoveryUseCase,
} from '../../application/platform-operations/operations.use-cases.js';
import {
  AddServiceDependencyUseCase,
  GetPlatformServiceUseCase,
  ListPlatformServicesUseCase,
  RegisterPlatformServiceUseCase,
  RemoveServiceDependencyUseCase,
  UpdatePlatformServiceUseCase,
} from '../../application/platform-operations/service-catalog.use-cases.js';
import {
  ConfirmRootCauseDto,
  ConnectMonitoringSourceDto,
  CreateAutomationDto,
  CreateChangeDto,
  CreateExceptionDto,
  CreateIncidentDto,
  CreateOnCallRotationDto,
  CreateProblemDto,
  CreateReleaseDto,
  CreateRiskDto,
  CreateRunbookDto,
  CreateServiceRequestDto,
  CreateSloDto,
  CreateTaskDto,
  IngestAlertDto,
  LinkProblemIncidentDto,
  OperationsListQueryDto,
  PublishStatusDto,
  RecordCapacityDto,
  RecordHealthSnapshotDto,
  RecordMonitoringProbeDto,
  RecordNotificationDeliveryDto,
  RecordSloMeasurementDto,
  RejectChangeDto,
  RequestAutomationExecutionDto,
  RequestRecoveryDto,
  ScheduleMaintenanceDto,
  TransitionIncidentDto,
  TransitionReleaseDto,
  UpdateNotificationDeliveryStatusDto,
  VerifyRecoveryDto,
} from '../dto/operations.dto.js';
import {
  AddServiceDependencyDto,
  RegisterPlatformServiceDto,
  RemoveServiceDependencyQueryDto,
  ServiceCatalogSearchQueryDto,
  UpdatePlatformServiceDto,
} from '../dto/service-catalog.dto.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

@ApiTags('edge-p9-platform-operations')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller()
export class EdgePlatformOperationsController {
  constructor(
    private readonly listServices: ListPlatformServicesUseCase,
    private readonly getService: GetPlatformServiceUseCase,
    private readonly registerService: RegisterPlatformServiceUseCase,
    private readonly updateService: UpdatePlatformServiceUseCase,
    private readonly addDependency: AddServiceDependencyUseCase,
    private readonly removeDependency: RemoveServiceDependencyUseCase,
    private readonly overview: GetOperationsOverviewUseCase,
    private readonly recordHealth: RecordServiceHealthSnapshotUseCase,
    private readonly ingestAlert: IngestOperationalAlertUseCase,
    private readonly ackAlert: AcknowledgeAlertUseCase,
    private readonly resolveAlert: ResolveAlertUseCase,
    private readonly listAlerts: ListAlertsUseCase,
    private readonly createIncident: CreateIncidentUseCase,
    private readonly getIncident: GetIncidentUseCase,
    private readonly listIncidents: ListIncidentsUseCase,
    private readonly transitionIncident: TransitionIncidentUseCase,
    private readonly declareMajor: DeclareMajorIncidentUseCase,
    private readonly createProblem: CreateProblemUseCase,
    private readonly listProblems: ListProblemsUseCase,
    private readonly confirmRootCause: ConfirmProblemRootCauseUseCase,
    private readonly linkProblemIncident: LinkProblemIncidentUseCase,
    private readonly createChange: CreateChangeUseCase,
    private readonly submitChange: SubmitChangeUseCase,
    private readonly approveChange: ApproveChangeUseCase,
    private readonly rejectChange: RejectChangeUseCase,
    private readonly listChanges: ListChangesUseCase,
    private readonly scheduleMaintenance: ScheduleMaintenanceUseCase,
    private readonly listMaintenance: ListMaintenanceUseCase,
    private readonly createServiceRequest: CreateServiceRequestUseCase,
    private readonly listServiceRequests: ListServiceRequestsUseCase,
    private readonly createTask: CreateOperationalTaskUseCase,
    private readonly listTasks: ListTasksUseCase,
    private readonly createOnCallRotation: CreateOnCallRotationUseCase,
    private readonly listOnCallRotations: ListOnCallRotationsUseCase,
    private readonly createSlo: CreateSloUseCase,
    private readonly recordSloMeasurement: RecordSloMeasurementUseCase,
    private readonly listSlos: ListSlosUseCase,
    private readonly recordCapacity: RecordCapacityMeasurementUseCase,
    private readonly listCapacity: ListCapacityUseCase,
    private readonly requestRecovery: RequestRecoveryUseCase,
    private readonly verifyRecovery: VerifyRecoveryUseCase,
    private readonly listRecovery: ListRecoveryUseCase,
    private readonly createRunbook: CreateRunbookUseCase,
    private readonly listRunbooks: ListRunbooksUseCase,
    private readonly publishStatus: PublishStatusUpdateUseCase,
    private readonly approveStatus: ApproveStatusPublicationUseCase,
    private readonly listStatusComponents: ListStatusComponentsUseCase,
    private readonly createRisk: CreateOperationalRiskUseCase,
    private readonly listRisks: ListRisksUseCase,
    private readonly createException: CreateOperationalExceptionUseCase,
    private readonly listExceptions: ListOperationalExceptionsUseCase,
    private readonly flagExpiredExceptions: FlagExpiredExceptionsUseCase,
    private readonly createAutomation: CreateAutomationUseCase,
    private readonly listAutomations: ListAutomationsUseCase,
    private readonly requestAutomationExecution: RequestAutomationExecutionUseCase,
    private readonly approveAutomationExecution: ApproveAutomationExecutionUseCase,
    private readonly executeAutomation: ExecuteAutomationUseCase,
    private readonly recordNotificationDelivery: RecordNotificationDeliveryUseCase,
    private readonly updateNotificationDeliveryStatus: UpdateNotificationDeliveryStatusUseCase,
    private readonly listNotificationDeliveries: ListNotificationDeliveriesUseCase,
    private readonly createRelease: CreateReleaseUseCase,
    private readonly transitionRelease: TransitionReleaseUseCase,
    private readonly listReleases: ListReleasesUseCase,
    private readonly connectMonitoringSource: ConnectMonitoringSourceUseCase,
    private readonly recordMonitoringProbe: RecordMonitoringProbeResultUseCase,
    private readonly listMonitoringProbes: ListMonitoringProbeResultsUseCase,
  ) {}

  // --- P9.1 service catalog ----------------------------------------------------

  @Get('edge/operations/services')
  @RequireEdgePermissions('platform:service_catalog:read')
  @ApiOperation({ summary: 'Search platform service catalog' })
  async searchServices(@Query() query: ServiceCatalogSearchQueryDto) {
    return this.listServices.execute(query);
  }

  @Post('edge/operations/services')
  @RequireEdgePermissions('platform:service_catalog:manage')
  async createService(@Body() body: RegisterPlatformServiceDto, @Req() req: EdgeRequest) {
    return this.registerService.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/operations/services/:id')
  @RequireEdgePermissions('platform:service_catalog:read')
  async getServiceById(@Param('id') id: string) {
    return this.getService.execute(id);
  }

  @Patch('edge/operations/services/:id')
  @RequireEdgePermissions('platform:service_catalog:manage')
  async patchService(
    @Param('id') id: string,
    @Body() body: UpdatePlatformServiceDto,
    @Req() req: EdgeRequest,
  ) {
    return this.updateService.execute({
      actorId: actorId(req),
      id,
      ...body,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/operations/services/:id/dependencies')
  @RequireEdgePermissions('platform:service_catalog:manage')
  async postDependency(
    @Param('id') id: string,
    @Body() body: AddServiceDependencyDto,
    @Req() req: EdgeRequest,
  ) {
    return this.addDependency.execute({
      actorId: actorId(req),
      serviceId: id,
      dependsOnServiceId: body.dependsOnServiceId,
      dependencyType: body.dependencyType,
      criticality: body.criticality,
      description: body.description,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Delete('edge/operations/services/:id/dependencies')
  @RequireEdgePermissions('platform:service_catalog:manage')
  async deleteDependency(
    @Param('id') id: string,
    @Query() query: RemoveServiceDependencyQueryDto,
    @Req() req: EdgeRequest,
  ) {
    await this.removeDependency.execute({
      actorId: actorId(req),
      serviceId: id,
      dependsOnServiceId: query.dependsOnServiceId,
      dependencyType: query.dependencyType,
      correlationId: randomUUID(),
    });
    return { ok: true };
  }

  @Get('edge/operations/overview')
  @RequireEdgePermissions('platform:operations:overview:read')
  @ApiOperation({ summary: 'Operations overview — real DB counts; monitoring UNAVAILABLE if not configured' })
  async operationsOverview() {
    return this.overview.execute();
  }

  /** Mandate alias — health surface = honest overview (no fabricated green). */
  @Get('edge/operations/health')
  @RequireEdgePermissions('platform:operations:overview:read')
  @ApiOperation({ summary: 'Alias of overview (honest health; UNKNOWN≠HEALTHY)' })
  async operationsHealth() {
    return this.overview.execute();
  }

  @Get('edge/operations/analytics')
  @RequireEdgePermissions('platform:operations:analytics:read')
  async operationsAnalytics() {
    return this.overview.execute();
  }

  // --- Health / Alerts ---------------------------------------------------------

  @Post('edge/operations/health/snapshots')
  @RequireEdgePermissions('platform:operations:alerts:manage')
  async postHealthSnapshot(@Body() body: RecordHealthSnapshotDto, @Req() req: EdgeRequest) {
    return this.recordHealth.execute({
      actorId: actorId(req),
      serviceId: body.serviceId,
      overallStatus: body.overallStatus,
      sourceSystem: body.sourceSystem,
      indicators: body.indicators,
      observedAt: body.observedAt ? new Date(body.observedAt) : undefined,
      correlationId: body.correlationId,
    });
  }

  @Get('edge/operations/alerts')
  @RequireEdgePermissions('platform:operations:alerts:read')
  async getAlerts(@Query() query: OperationsListQueryDto) {
    return this.listAlerts.execute(query);
  }

  @Post('edge/operations/alerts')
  @RequireEdgePermissions('platform:operations:alerts:manage')
  async postAlert(@Body() body: IngestAlertDto, @Req() req: EdgeRequest) {
    return this.ingestAlert.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId,
    });
  }

  @Post('edge/operations/alerts/:id/acknowledge')
  @RequireEdgePermissions('platform:operations:alerts:manage')
  async postAckAlert(@Param('id') id: string, @Req() req: EdgeRequest) {
    return this.ackAlert.execute({ actorId: actorId(req), alertId: id });
  }

  @Post('edge/operations/alerts/:id/resolve')
  @RequireEdgePermissions('platform:operations:alerts:manage')
  async postResolveAlert(@Param('id') id: string, @Req() req: EdgeRequest) {
    return this.resolveAlert.execute({ actorId: actorId(req), alertId: id });
  }

  // --- Incidents ---------------------------------------------------------------

  @Get('edge/operations/incidents')
  @RequireEdgePermissions('platform:operations:incidents:read')
  async getIncidents(@Query() query: OperationsListQueryDto) {
    return this.listIncidents.execute({
      status: query.status,
      serviceId: query.serviceId,
      isMajor: query.isMajor,
      limit: query.limit,
      offset: query.offset,
    });
  }

  /** Mandate alias — major incidents filter. */
  @Get('edge/operations/major-incidents')
  @RequireEdgePermissions('platform:operations:incidents:read')
  async getMajorIncidents(@Query() query: OperationsListQueryDto) {
    return this.listIncidents.execute({
      status: query.status,
      serviceId: query.serviceId,
      isMajor: true,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Post('edge/operations/incidents')
  @RequireEdgePermissions('platform:operations:incidents:manage')
  async postIncident(@Body() body: CreateIncidentDto, @Req() req: EdgeRequest) {
    return this.createIncident.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId,
    });
  }

  @Get('edge/operations/incidents/:id')
  @RequireEdgePermissions('platform:operations:incidents:read')
  async getIncidentById(@Param('id') id: string) {
    return this.getIncident.execute(id);
  }

  @Post('edge/operations/incidents/:id/transition')
  @RequireEdgePermissions('platform:operations:incidents:manage')
  async postIncidentTransition(
    @Param('id') id: string,
    @Body() body: TransitionIncidentDto,
    @Req() req: EdgeRequest,
  ) {
    return this.transitionIncident.execute({
      actorId: actorId(req),
      incidentId: id,
      toStatus: body.toStatus,
      resolutionSummary: body.resolutionSummary,
      correlationId: body.correlationId,
    });
  }

  @Post('edge/operations/incidents/:id/major')
  @RequireEdgePermissions('platform:operations:incidents:approve')
  async postMajorIncident(@Param('id') id: string, @Req() req: EdgeRequest) {
    return this.declareMajor.execute({ actorId: actorId(req), incidentId: id });
  }

  // --- Problems ----------------------------------------------------------------

  @Get('edge/operations/problems')
  @RequireEdgePermissions('platform:operations:problems:read')
  async getProblems(@Query() query: OperationsListQueryDto) {
    return this.listProblems.execute(query);
  }

  @Post('edge/operations/problems')
  @RequireEdgePermissions('platform:operations:problems:manage')
  async postProblem(@Body() body: CreateProblemDto, @Req() req: EdgeRequest) {
    return this.createProblem.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId,
    });
  }

  @Post('edge/operations/problems/:id/root-cause')
  @RequireEdgePermissions('platform:operations:problems:manage')
  async postRootCause(
    @Param('id') id: string,
    @Body() body: ConfirmRootCauseDto,
    @Req() req: EdgeRequest,
  ) {
    return this.confirmRootCause.execute({
      actorId: actorId(req),
      problemId: id,
      rootCauseSummary: body.rootCauseSummary,
      evidence: body.evidence,
      correlationId: body.correlationId,
    });
  }

  @Post('edge/operations/problems/:id/incidents')
  @RequireEdgePermissions('platform:operations:problems:manage')
  async postProblemIncidentLink(
    @Param('id') id: string,
    @Body() body: LinkProblemIncidentDto,
    @Req() req: EdgeRequest,
  ) {
    return this.linkProblemIncident.execute({
      actorId: actorId(req),
      problemId: id,
      incidentId: body.incidentId,
      correlationId: body.correlationId,
    });
  }

  // --- Changes / maintenance ---------------------------------------------------

  @Get('edge/operations/changes')
  @RequireEdgePermissions('platform:operations:changes:read')
  async getChanges(@Query() query: OperationsListQueryDto) {
    return this.listChanges.execute(query);
  }

  /** Release registry (real table). Kept at historical path; wired to ListReleases. */
  @Get('edge/operations/releases')
  @RequireEdgePermissions('platform:operations:releases:read')
  @ApiOperation({ summary: 'List release registry records (honest deploy evidence required for DEPLOYED)' })
  async getReleases(@Query() query: OperationsListQueryDto) {
    return this.listReleases.execute(query);
  }

  @Post('edge/operations/releases')
  @RequireEdgePermissions('platform:operations:releases:manage')
  async postRelease(@Body() body: CreateReleaseDto, @Req() req: EdgeRequest) {
    return this.createRelease.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId,
    });
  }

  @Post('edge/operations/releases/:id/transition')
  @RequireEdgePermissions('platform:operations:releases:manage')
  async postTransitionRelease(
    @Param('id') id: string,
    @Body() body: TransitionReleaseDto,
    @Req() req: EdgeRequest,
  ) {
    return this.transitionRelease.execute({
      actorId: actorId(req),
      releaseId: id,
      toStatus: body.toStatus,
      artifactDigest: body.artifactDigest,
      externalEvidenceRef: body.externalEvidenceRef,
      healthGateStatus: body.healthGateStatus,
      correlationId: body.correlationId,
    });
  }

  @Post('edge/operations/changes')
  @RequireEdgePermissions('platform:operations:changes:manage')
  async postChange(@Body() body: CreateChangeDto, @Req() req: EdgeRequest) {
    return this.createChange.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId,
    });
  }

  @Post('edge/operations/changes/:id/submit')
  @RequireEdgePermissions('platform:operations:changes:manage')
  async postSubmitChange(@Param('id') id: string, @Req() req: EdgeRequest) {
    return this.submitChange.execute({ actorId: actorId(req), changeId: id });
  }

  @Post('edge/operations/changes/:id/approve')
  @RequireEdgePermissions('platform:operations:changes:approve')
  async postApproveChange(@Param('id') id: string, @Req() req: EdgeRequest) {
    return this.approveChange.execute({ actorId: actorId(req), changeId: id });
  }

  @Post('edge/operations/changes/:id/reject')
  @RequireEdgePermissions('platform:operations:changes:approve')
  async postRejectChange(
    @Param('id') id: string,
    @Body() body: RejectChangeDto,
    @Req() req: EdgeRequest,
  ) {
    return this.rejectChange.execute({
      actorId: actorId(req),
      changeId: id,
      reason: body.reason,
      correlationId: body.correlationId,
    });
  }

  @Get('edge/operations/maintenance')
  @RequireEdgePermissions('platform:operations:maintenance:read')
  async getMaintenance(@Query() query: OperationsListQueryDto) {
    return this.listMaintenance.execute(query);
  }

  @Post('edge/operations/maintenance')
  @RequireEdgePermissions('platform:operations:maintenance:manage')
  async postMaintenance(@Body() body: ScheduleMaintenanceDto, @Req() req: EdgeRequest) {
    return this.scheduleMaintenance.execute({
      actorId: actorId(req),
      title: body.title,
      reason: body.reason,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
      serviceId: body.serviceId,
      maintenanceType: body.maintenanceType,
      correlationId: body.correlationId,
    });
  }

  // --- Requests / tasks / on-call ----------------------------------------------

  @Get('edge/operations/requests')
  @RequireEdgePermissions('platform:operations:requests:read')
  async getRequests(@Query() query: OperationsListQueryDto) {
    return this.listServiceRequests.execute(query);
  }

  @Post('edge/operations/requests')
  @RequireEdgePermissions('platform:operations:requests:manage')
  async postRequest(@Body() body: CreateServiceRequestDto, @Req() req: EdgeRequest) {
    return this.createServiceRequest.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId,
    });
  }

  @Get('edge/operations/tasks')
  @RequireEdgePermissions('platform:operations:tasks:read')
  async getTasks(@Query() query: OperationsListQueryDto) {
    return this.listTasks.execute(query);
  }

  @Post('edge/operations/tasks')
  @RequireEdgePermissions('platform:operations:tasks:manage')
  async postTask(@Body() body: CreateTaskDto, @Req() req: EdgeRequest) {
    return this.createTask.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId,
    });
  }

  @Get('edge/operations/on-call/rotations')
  @RequireEdgePermissions('platform:operations:oncall:read')
  async getOnCallRotations(@Query('teamId') teamId?: string) {
    return this.listOnCallRotations.execute(teamId);
  }

  @Post('edge/operations/on-call/rotations')
  @RequireEdgePermissions('platform:operations:oncall:manage')
  async postOnCallRotation(@Body() body: CreateOnCallRotationDto, @Req() req: EdgeRequest) {
    return this.createOnCallRotation.execute({
      actorId: actorId(req),
      teamId: body.teamId,
      teamCode: body.teamCode,
      teamDisplayName: body.teamDisplayName,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
      primaryResponderId: body.primaryResponderId,
      secondaryResponderId: body.secondaryResponderId,
      correlationId: body.correlationId,
    });
  }

  // --- SLO / capacity ----------------------------------------------------------

  @Get('edge/operations/slo')
  @RequireEdgePermissions('platform:operations:slo:read')
  async getSlos(@Query('serviceId') serviceId?: string) {
    return this.listSlos.execute(serviceId);
  }

  @Post('edge/operations/slo')
  @RequireEdgePermissions('platform:operations:slo:manage')
  async postSlo(@Body() body: CreateSloDto, @Req() req: EdgeRequest) {
    return this.createSlo.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId,
    });
  }

  @Post('edge/operations/slo/measurements')
  @RequireEdgePermissions('platform:operations:slo:manage')
  async postSloMeasurement(@Body() body: RecordSloMeasurementDto, @Req() req: EdgeRequest) {
    return this.recordSloMeasurement.execute({
      actorId: actorId(req),
      sloId: body.sloId,
      measuredValue: body.measuredValue,
      errorBudgetRemaining: body.errorBudgetRemaining,
      windowStart: new Date(body.windowStart),
      windowEnd: new Date(body.windowEnd),
      sourceSystem: body.sourceSystem,
      correlationId: body.correlationId,
    });
  }

  @Get('edge/operations/capacity')
  @RequireEdgePermissions('platform:operations:capacity:read')
  async getCapacity(@Query('serviceId') serviceId?: string) {
    return this.listCapacity.execute(serviceId);
  }

  @Post('edge/operations/capacity')
  @RequireEdgePermissions('platform:operations:capacity:manage')
  async postCapacity(@Body() body: RecordCapacityDto, @Req() req: EdgeRequest) {
    return this.recordCapacity.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId,
    });
  }

  // --- Recovery / runbooks / status --------------------------------------------

  @Get('edge/operations/recovery')
  @RequireEdgePermissions('platform:operations:recovery:read')
  async getRecovery(@Query() query: OperationsListQueryDto) {
    return this.listRecovery.execute(query);
  }

  @Post('edge/operations/recovery')
  @RequireEdgePermissions('platform:operations:recovery:manage')
  async postRecovery(@Body() body: RequestRecoveryDto, @Req() req: EdgeRequest) {
    return this.requestRecovery.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId,
    });
  }

  @Post('edge/operations/recovery/:id/verify')
  @RequireEdgePermissions('platform:operations:recovery:manage')
  async postVerifyRecovery(
    @Param('id') id: string,
    @Body() body: VerifyRecoveryDto,
    @Req() req: EdgeRequest,
  ) {
    return this.verifyRecovery.execute({
      actorId: actorId(req),
      recoveryId: id,
      externalEvidenceRef: body.externalEvidenceRef,
      evidenceKind: body.evidenceKind,
      evidenceJustification: body.evidenceJustification,
      outcome: body.outcome,
      correlationId: body.correlationId,
    });
  }

  @Get('edge/operations/runbooks')
  @RequireEdgePermissions('platform:operations:runbooks:read')
  async getRunbooks(@Query('serviceId') serviceId?: string) {
    return this.listRunbooks.execute(serviceId);
  }

  @Post('edge/operations/runbooks')
  @RequireEdgePermissions('platform:operations:runbooks:manage')
  async postRunbook(@Body() body: CreateRunbookDto, @Req() req: EdgeRequest) {
    return this.createRunbook.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId,
    });
  }

  @Get('edge/operations/status/components')
  @RequireEdgePermissions('platform:operations:status:read')
  async getStatusComponents(@Query() query: OperationsListQueryDto) {
    return this.listStatusComponents.execute(query);
  }

  /** Mandate alias — status-pages → status components registry. */
  @Get('edge/operations/status-pages')
  @RequireEdgePermissions('platform:operations:status:read')
  @ApiOperation({ summary: 'Alias of status/components' })
  async getStatusPages(@Query() query: OperationsListQueryDto) {
    return this.listStatusComponents.execute(query);
  }

  @Post('edge/operations/status/publications')
  @RequireEdgePermissions('platform:operations:status:publish')
  async postStatusPublication(@Body() body: PublishStatusDto, @Req() req: EdgeRequest) {
    return this.publishStatus.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId,
    });
  }

  @Post('edge/operations/status/publications/:id/approve')
  @RequireEdgePermissions('platform:operations:status:publish')
  async postApproveStatus(@Param('id') id: string, @Req() req: EdgeRequest) {
    return this.approveStatus.execute({
      actorId: actorId(req),
      publicationId: id,
      approved: true,
    });
  }

  // --- Risks / automation ------------------------------------------------------

  @Get('edge/operations/risks')
  @RequireEdgePermissions('platform:operations:risks:read')
  async getRisks(@Query() query: OperationsListQueryDto) {
    return this.listRisks.execute(query);
  }

  @Post('edge/operations/risks')
  @RequireEdgePermissions('platform:operations:risks:manage')
  async postRisk(@Body() body: CreateRiskDto, @Req() req: EdgeRequest) {
    return this.createRisk.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId,
    });
  }

  @Get('edge/operations/exceptions')
  @RequireEdgePermissions('platform:operations:risks:read')
  async getExceptions(@Query() query: OperationsListQueryDto) {
    return this.listExceptions.execute(query);
  }

  @Post('edge/operations/exceptions')
  @RequireEdgePermissions('platform:operations:risks:manage')
  async postException(@Body() body: CreateExceptionDto, @Req() req: EdgeRequest) {
    return this.createException.execute({
      actorId: actorId(req),
      title: body.title,
      scope: body.scope,
      justification: body.justification,
      expiresAt: new Date(body.expiresAt),
      compensatingControls: body.compensatingControls,
      correlationId: body.correlationId,
    });
  }

  @Post('edge/operations/exceptions/flag-expired')
  @RequireEdgePermissions('platform:operations:risks:manage')
  async postFlagExpiredExceptions(@Req() req: EdgeRequest) {
    return this.flagExpiredExceptions.execute({ actorId: actorId(req) });
  }

  @Get('edge/operations/automation')
  @RequireEdgePermissions('platform:operations:automation:read')
  async getAutomations(@Query() query: OperationsListQueryDto) {
    return this.listAutomations.execute(query);
  }

  @Post('edge/operations/automation')
  @RequireEdgePermissions('platform:operations:automation:manage')
  async postAutomation(@Body() body: CreateAutomationDto, @Req() req: EdgeRequest) {
    return this.createAutomation.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId,
    });
  }

  @Post('edge/operations/automation/executions')
  @RequireEdgePermissions('platform:operations:automation:execute')
  async postAutomationExecution(
    @Body() body: RequestAutomationExecutionDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestAutomationExecution.execute({
      actorId: actorId(req),
      automationId: body.automationId,
      idempotencyKey: body.idempotencyKey,
      correlationId: body.correlationId,
    });
  }

  @Post('edge/operations/automation/executions/:id/approve')
  @RequireEdgePermissions('platform:operations:automation:manage')
  async postApproveAutomationExecution(@Param('id') id: string, @Req() req: EdgeRequest) {
    return this.approveAutomationExecution.execute({
      actorId: actorId(req),
      executionId: id,
      approved: true,
    });
  }

  @Post('edge/operations/automation/executions/:id/execute')
  @RequireEdgePermissions('platform:operations:automation:execute')
  async postExecuteAutomation(@Param('id') id: string, @Req() req: EdgeRequest) {
    return this.executeAutomation.execute({
      actorId: actorId(req),
      executionId: id,
    });
  }

  // --- Notifications / monitoring probes (P9 P1 remediation) --------------------

  @Get('edge/operations/notifications')
  @RequireEdgePermissions('platform:operations:notifications:read')
  async getNotifications(@Query() query: OperationsListQueryDto) {
    return this.listNotificationDeliveries.execute(query);
  }

  @Post('edge/operations/notifications')
  @RequireEdgePermissions('platform:operations:notifications:manage')
  async postNotification(@Body() body: RecordNotificationDeliveryDto, @Req() req: EdgeRequest) {
    return this.recordNotificationDelivery.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId,
    });
  }

  @Post('edge/operations/notifications/:id/status')
  @RequireEdgePermissions('platform:operations:notifications:manage')
  async postNotificationStatus(
    @Param('id') id: string,
    @Body() body: UpdateNotificationDeliveryStatusDto,
    @Req() req: EdgeRequest,
  ) {
    return this.updateNotificationDeliveryStatus.execute({
      actorId: actorId(req),
      deliveryId: id,
      toStatus: body.toStatus,
      providerRef: body.providerRef,
      lastError: body.lastError,
      correlationId: body.correlationId,
    });
  }

  @Post('edge/operations/monitoring/sources')
  @RequireEdgePermissions('platform:operations:alerts:manage')
  @ApiOperation({ summary: 'Configure monitoring source (CONFIGURED only — CONNECTED after UP probe)' })
  async postMonitoringSource(@Body() body: ConnectMonitoringSourceDto, @Req() req: EdgeRequest) {
    return this.connectMonitoringSource.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId,
    });
  }

  @Post('edge/operations/monitoring/probes')
  @RequireEdgePermissions('platform:operations:alerts:manage')
  async postMonitoringProbe(@Body() body: RecordMonitoringProbeDto, @Req() req: EdgeRequest) {
    return this.recordMonitoringProbe.execute({
      actorId: actorId(req),
      sourceId: body.sourceId,
      probeType: body.probeType,
      outcome: body.outcome,
      latencyMs: body.latencyMs,
      evidence: body.evidence,
      correlationId: body.correlationId,
    });
  }

  @Get('edge/operations/monitoring/probes')
  @RequireEdgePermissions('platform:operations:alerts:read')
  async getMonitoringProbes(
    @Query('sourceId') sourceId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.listMonitoringProbes.execute(
      sourceId,
      limit ? Number(limit) : undefined,
    );
  }
}

import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EdgeRoute, RequireEdgePermissions } from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import {
  AcknowledgeBusinessAlertUseCase,
  AppendBusinessAuditUseCase,
  ApproveCommissionUseCase,
  CalculateCommissionUseCase,
  ComputeCashRevenueUseCase,
  ComputeChurnRatesUseCase,
  ComputeMrrMovementUseCase,
  CreateBusinessAlertPolicyUseCase,
  CreateBusinessDecisionUseCase,
  CreateCommissionPlanUseCase,
  BuildNamedForecastScenariosUseCase,
  CreateForecastScenarioUseCase,
  CreateLeakageCaseUseCase,
  CreateRevenueForecastUseCase,
  CreateRevenueTargetUseCase,
  EvaluateBusinessAlertUseCase,
  GenerateBusinessReportUseCase,
  GetBusinessAuditUseCase,
  GetRenewalIntelligenceOverviewUseCase,
  GetRetentionOverviewUseCase,
  GetRevenueOverviewUseCase,
  ListBusinessAlertsUseCase,
  ListBusinessReportsUseCase,
  ListMetricDefinitionsUseCase,
  ListRevenueTargetsUseCase,
  PublishMetricDefinitionUseCase,
  RecordMetricSnapshotUseCase,
  RecordProductProfitabilitySnapshotUseCase,
  RecordRetentionSnapshotUseCase,
  RecordUnitEconomicsSnapshotUseCase,
  RegisterMetricDefinitionUseCase,
  RunAssuranceScanUseCase,
  TransitionLeakageCaseUseCase,
} from '../../application/revenue-operations/revenue.use-cases.js';
import type { AssuranceCaseDraft } from '../../domain/revenue-operations/revenue-assurance.js';
import { P5P6AssuranceAdapter } from '../../infrastructure/revenue-operations/p5-p6-assurance.adapter.js';
import {
  AppendBusinessAuditDto,
  ApproveCommissionDto,
  BusinessAuditQueryDto,
  CalculateCommissionDto,
  ComputeCashRevenueDto,
  ComputeChurnRatesDto,
  ComputeMrrMovementDto,
  CreateBusinessAlertPolicyDto,
  CreateBusinessDecisionDto,
  CreateCommissionPlanDto,
  CreateForecastScenarioDto,
  CreateLeakageCaseDto,
  CreateRevenueForecastDto,
  CreateRevenueTargetDto,
  EvaluateBusinessAlertDto,
  GenerateBusinessReportDto,
  RecordMetricSnapshotDto,
  RecordProductProfitabilitySnapshotDto,
  RecordRetentionSnapshotDto,
  RecordUnitEconomicsSnapshotDto,
  RegisterMetricDefinitionDto,
  RenewalIntelligenceQueryDto,
  RetentionOverviewQueryDto,
  RevenueListQueryDto,
  RevenueOverviewQueryDto,
  RunAssuranceScanDto,
  TransitionLeakageCaseDto,
} from '../dto/revenue.dto.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

/**
 * P11 SaaS Business & Revenue Operations.
 * Routes under edge/revenue/**, edge/business/**, and edge/commission/**.
 * READ/ANALYTICS + commission/forecast/leakage workflows — never creates invoices/payments/subscriptions/tenants.
 */
@ApiTags('edge-p11-revenue-operations')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller()
export class EdgeRevenueOperationsController {
  constructor(
    private readonly registerMetric: RegisterMetricDefinitionUseCase,
    private readonly publishMetric: PublishMetricDefinitionUseCase,
    private readonly listMetrics: ListMetricDefinitionsUseCase,
    private readonly recordSnapshot: RecordMetricSnapshotUseCase,
    private readonly overview: GetRevenueOverviewUseCase,
    private readonly computeMrr: ComputeMrrMovementUseCase,
    private readonly computeCash: ComputeCashRevenueUseCase,
    private readonly computeChurn: ComputeChurnRatesUseCase,
    private readonly createForecast: CreateRevenueForecastUseCase,
    private readonly createScenario: CreateForecastScenarioUseCase,
    private readonly namedForecastScenarios: BuildNamedForecastScenariosUseCase,
    private readonly createLeakage: CreateLeakageCaseUseCase,
    private readonly transitionLeakage: TransitionLeakageCaseUseCase,
    private readonly createCommissionPlan: CreateCommissionPlanUseCase,
    private readonly calculateCommission: CalculateCommissionUseCase,
    private readonly approveCommission: ApproveCommissionUseCase,
    private readonly getRetentionOverview: GetRetentionOverviewUseCase,
    private readonly recordRetention: RecordRetentionSnapshotUseCase,
    private readonly recordProductProfit: RecordProductProfitabilitySnapshotUseCase,
    private readonly runAssuranceScan: RunAssuranceScanUseCase,
    private readonly assuranceAdapter: P5P6AssuranceAdapter,
    private readonly getAudit: GetBusinessAuditUseCase,
    private readonly appendAudit: AppendBusinessAuditUseCase,
    private readonly recordUnitEconomics: RecordUnitEconomicsSnapshotUseCase,
    private readonly renewalIntelligence: GetRenewalIntelligenceOverviewUseCase,
    private readonly createAlertPolicy: CreateBusinessAlertPolicyUseCase,
    private readonly evaluateAlert: EvaluateBusinessAlertUseCase,
    private readonly listAlerts: ListBusinessAlertsUseCase,
    private readonly acknowledgeAlert: AcknowledgeBusinessAlertUseCase,
    private readonly createTarget: CreateRevenueTargetUseCase,
    private readonly listTargets: ListRevenueTargetsUseCase,
    private readonly createDecision: CreateBusinessDecisionUseCase,
    private readonly listReports: ListBusinessReportsUseCase,
    private readonly generateReport: GenerateBusinessReportUseCase,
  ) {}

  // --- Metrics / revenue overview -----------------------------------------

  @Get('edge/revenue/metrics/definitions')
  @RequireEdgePermissions('platform:revenue:read')
  @ApiOperation({ summary: 'List revenue metric definitions' })
  listMetricDefinitions(@Query() query: RevenueListQueryDto) {
    return this.listMetrics.execute(query);
  }

  @Post('edge/revenue/metrics/definitions')
  @RequireEdgePermissions('platform:business:metrics:manage')
  @ApiOperation({ summary: 'Register a metric definition (DRAFT)' })
  registerMetricDefinition(@Req() req: EdgeRequest, @Body() body: RegisterMetricDefinitionDto) {
    return this.registerMetric.execute({ actorId: actorId(req), ...body });
  }

  @Post('edge/revenue/metrics/definitions/:id/publish')
  @RequireEdgePermissions('platform:business:metrics:manage')
  @ApiOperation({ summary: 'Publish metric definition (immutable version copy)' })
  publishMetricDefinition(@Req() req: EdgeRequest, @Param('id') id: string) {
    return this.publishMetric.execute({ actorId: actorId(req), definitionId: id });
  }

  @Post('edge/revenue/metrics/snapshots')
  @RequireEdgePermissions('platform:business:metrics:manage')
  @ApiOperation({ summary: 'Record a metric snapshot (definition must be PUBLISHED)' })
  recordMetricSnapshot(@Req() req: EdgeRequest, @Body() body: RecordMetricSnapshotDto) {
    return this.recordSnapshot.execute({
      actorId: actorId(req),
      ...body,
      value: body.value ?? null,
    });
  }

  @Get('edge/revenue/overview')
  @RequireEdgePermissions('platform:revenue:read')
  @ApiOperation({
    summary: 'Revenue overview from stored snapshots only (UNAVAILABLE when missing)',
  })
  revenueOverview(@Query() query: RevenueOverviewQueryDto) {
    return this.overview.execute({
      businessUnitId: query.businessUnitId,
      asOf: query.asOf,
    });
  }

  @Post('edge/revenue/mrr/compute')
  @RequireEdgePermissions('platform:revenue:read')
  @ApiOperation({
    summary: 'Compute MRR movements from lines or projection stub (no fabricated collected cash)',
  })
  computeMrrMovement(@Req() req: EdgeRequest, @Body() body: ComputeMrrMovementDto) {
    return this.computeMrr.execute({ actorId: actorId(req), ...body });
  }

  @Post('edge/revenue/cash/compute')
  @RequireEdgePermissions('platform:revenue:read')
  @ApiOperation({
    summary:
      'Compute INVOICED/COLLECTED/RECEIVABLES from P6 invoice & payment refs (F-P11-001 engine)',
  })
  computeCashRevenue(@Req() req: EdgeRequest, @Body() body: ComputeCashRevenueDto) {
    return this.computeCash.execute({ actorId: actorId(req), ...body });
  }

  @Post('edge/revenue/churn/compute')
  @RequireEdgePermissions('platform:revenue:read')
  @ApiOperation({
    summary: 'Compute LOGO_CHURN / SUBSCRIPTION_CHURN (F-P11-009 — never invent denominators)',
  })
  computeChurnRates(@Req() req: EdgeRequest, @Body() body: ComputeChurnRatesDto) {
    return this.computeChurn.execute({ actorId: actorId(req), ...body });
  }

  // --- Retention ----------------------------------------------------------

  @Get('edge/revenue/retention')
  @RequireEdgePermissions('platform:revenue:read')
  @ApiOperation({ summary: 'Retention overview (GRR/NRR from stored snapshots)' })
  retentionOverview(@Query() query: RetentionOverviewQueryDto) {
    return this.getRetentionOverview.execute({
      cohortId: query.cohortId,
      asOf: query.asOf,
    });
  }

  @Post('edge/revenue/retention/snapshots')
  @RequireEdgePermissions('platform:business:metrics:manage')
  @ApiOperation({ summary: 'Record GRR/NRR retention snapshots for a cohort' })
  recordRetentionSnapshot(@Req() req: EdgeRequest, @Body() body: RecordRetentionSnapshotDto) {
    return this.recordRetention.execute({
      actorId: actorId(req),
      cohortId: body.cohortId,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      asOf: body.asOf,
      startingMrr: body.startingMrr ?? null,
      contraction: body.contraction ?? null,
      churned: body.churned ?? null,
      expansion: body.expansion ?? null,
      reactivation: body.reactivation,
      includeReactivationInNrr: body.includeReactivationInNrr,
      currency: body.currency,
      sourceProvenance: body.sourceProvenance,
      metadata: body.metadata,
    });
  }

  // --- Unit economics -----------------------------------------------------

  @Post('edge/revenue/unit-economics/snapshots')
  @RequireEdgePermissions('platform:business:metrics:manage')
  @ApiOperation({
    summary: 'Record unit-economics snapshot (CAC/LTV — never invents costs)',
  })
  recordUnitEconomicsSnapshot(
    @Req() req: EdgeRequest,
    @Body() body: RecordUnitEconomicsSnapshotDto,
  ) {
    return this.recordUnitEconomics.execute({
      actorId: actorId(req),
      ...body,
      acquisitionSpend: body.acquisitionSpend ?? null,
      newCustomers: body.newCustomers ?? null,
      avgRecurringRevenue: body.avgRecurringRevenue ?? null,
      grossMarginPct: body.grossMarginPct ?? null,
      churnRate: body.churnRate ?? null,
      monthlyContribution: body.monthlyContribution ?? null,
    });
  }

  // --- Renewal intelligence (read-only) -----------------------------------

  @Get('edge/revenue/renewals/intelligence')
  @RequireEdgePermissions('platform:revenue:read')
  @ApiOperation({
    summary: 'Upcoming renewal risk scores (read-only P5; PARTIAL when fields missing)',
  })
  renewalsIntelligence(@Query() query: RenewalIntelligenceQueryDto) {
    return this.renewalIntelligence.execute({
      withinDays: query.withinDays,
      limit: query.limit,
    });
  }

  // --- Product profitability ----------------------------------------------

  @Post('edge/revenue/product-profitability/snapshots')
  @RequireEdgePermissions('platform:business:metrics:manage')
  @ApiOperation({
    summary: 'Record product profitability (revenue MEASURED; margin null if costs UNAVAILABLE)',
  })
  recordProductProfitabilitySnapshot(
    @Req() req: EdgeRequest,
    @Body() body: RecordProductProfitabilitySnapshotDto,
  ) {
    return this.recordProductProfit.execute({
      actorId: actorId(req),
      ...body,
      costAmount: body.costAmount ?? null,
    });
  }

  // --- Forecasts ----------------------------------------------------------

  @Post('edge/revenue/forecasts')
  @RequireEdgePermissions('platform:revenue:forecast')
  @ApiOperation({ summary: 'Create a revenue forecast (DRAFT)' })
  createRevenueForecast(@Req() req: EdgeRequest, @Body() body: CreateRevenueForecastDto) {
    return this.createForecast.execute({ actorId: actorId(req), ...body });
  }

  @Post('edge/revenue/forecasts/:id/scenarios')
  @RequireEdgePermissions('platform:revenue:forecast')
  @ApiOperation({ summary: 'Add forecast scenario (blocked after publish)' })
  createForecastScenario(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: CreateForecastScenarioDto,
  ) {
    return this.createScenario.execute({
      actorId: actorId(req),
      forecastId: id,
      ...body,
    });
  }

  @Post('edge/revenue/forecasts/named-scenarios')
  @RequireEdgePermissions('platform:revenue:forecast')
  @ApiOperation({
    summary:
      'Build PRUDENT / CENTRAL / AMBITIEUX scenario copies from actuals (ESTIMATED; never mutates MEASURED)',
  })
  buildNamedForecastScenarios(@Body() body: { actuals: number[] }) {
    return this.namedForecastScenarios.execute({ actuals: body.actuals ?? [] });
  }

  // --- Leakage / assurance / reconcile ------------------------------------

  @Post('edge/revenue/leakage-cases')
  @RequireEdgePermissions('platform:revenue:reconcile')
  @ApiOperation({ summary: 'Create a revenue leakage case (DETECTED)' })
  createLeakageCase(@Req() req: EdgeRequest, @Body() body: CreateLeakageCaseDto) {
    return this.createLeakage.execute({ actorId: actorId(req), ...body });
  }

  @Post('edge/revenue/leakage-cases/:id/transition')
  @RequireEdgePermissions('platform:revenue:reconcile')
  @ApiOperation({ summary: 'Transition leakage case status' })
  transitionLeakageCase(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: TransitionLeakageCaseDto,
  ) {
    return this.transitionLeakage.execute({
      actorId: actorId(req),
      caseId: id,
      ...body,
    });
  }

  @Post('edge/revenue/assurance/scan')
  @RequireEdgePermissions('platform:revenue:reconcile')
  @ApiOperation({
    summary: 'Run revenue assurance scan (adapter findings and/or supplied drafts)',
  })
  async assuranceScan(@Req() req: EdgeRequest, @Body() body: RunAssuranceScanDto) {
    let findings: AssuranceCaseDraft[] = [];
    let adapterMeta: { dataQuality?: string; notes?: string[] } = {};

    if (body.findings?.length) {
      findings = body.findings as unknown as AssuranceCaseDraft[];
    } else if (body.useAdapter !== false) {
      const collected = await this.assuranceAdapter.collectFindings({ limit: body.limit });
      findings = collected.findings;
      adapterMeta = { dataQuality: collected.dataQuality, notes: collected.notes };
    }

    const result = await this.runAssuranceScan.execute({
      actorId: actorId(req),
      findings,
      persist: body.persist,
    });
    return { ...result, adapter: adapterMeta };
  }

  // --- Commission ---------------------------------------------------------

  @Post('edge/revenue/commission/plans')
  @RequireEdgePermissions('platform:commission:calculate')
  @ApiOperation({ summary: 'Create a commission plan (+ optional rules)' })
  postCommissionPlan(@Req() req: EdgeRequest, @Body() body: CreateCommissionPlanDto) {
    return this.createCommissionPlan.execute({ actorId: actorId(req), ...body });
  }

  @Post('edge/revenue/commission/calculations')
  @RequireEdgePermissions('platform:commission:calculate')
  @ApiOperation({ summary: 'Calculate immutable commission snapshot (percentage + fixed)' })
  postCommissionCalculation(@Req() req: EdgeRequest, @Body() body: CalculateCommissionDto) {
    return this.calculateCommission.execute({
      actorId: actorId(req),
      ...body,
      basisAmount: body.basisAmount ?? null,
    });
  }

  @Post('edge/commission/calculations/:id/approve')
  @RequireEdgePermissions('platform:commission:approve')
  @ApiOperation({ summary: 'Approve immutable commission calculation (SoD enforced)' })
  approveCommissionCalculation(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: ApproveCommissionDto,
  ) {
    return this.approveCommission.execute({
      actorId: actorId(req),
      calculationId: id,
      notes: body.notes,
      expectedVersion: body.expectedVersion,
    });
  }

  @Get('edge/revenue/commission/plans')
  @RequireEdgePermissions('platform:commission:read')
  @ApiOperation({ summary: 'Commission read placeholder — use plan id endpoints later' })
  commissionReadPlaceholder() {
    return {
      availability: 'PARTIAL',
      note: 'List endpoint deferred; create + calculate + approve available. No fabricated commission totals.',
    };
  }

  // --- Business alerts ----------------------------------------------------

  @Post('edge/business/alerts/policies')
  @RequireEdgePermissions('platform:business:manage')
  @ApiOperation({ summary: 'Create a business alert policy (threshold)' })
  createBusinessAlertPolicy(
    @Req() req: EdgeRequest,
    @Body() body: CreateBusinessAlertPolicyDto,
  ) {
    return this.createAlertPolicy.execute({ actorId: actorId(req), ...body });
  }

  @Get('edge/business/alerts')
  @RequireEdgePermissions('platform:business:read')
  @ApiOperation({ summary: 'List business alerts' })
  listBusinessAlerts(@Query() query: RevenueListQueryDto) {
    return this.listAlerts.execute(query);
  }

  @Post('edge/business/alerts/:id/acknowledge')
  @RequireEdgePermissions('platform:business:manage')
  @ApiOperation({ summary: 'Acknowledge a business alert' })
  acknowledgeBusinessAlert(@Req() req: EdgeRequest, @Param('id') id: string) {
    return this.acknowledgeAlert.execute({ actorId: actorId(req), alertId: id });
  }

  @Post('edge/business/alerts/evaluate')
  @RequireEdgePermissions('platform:business:manage')
  @ApiOperation({ summary: 'Evaluate policy threshold vs snapshot value' })
  evaluateBusinessAlert(@Req() req: EdgeRequest, @Body() body: EvaluateBusinessAlertDto) {
    return this.evaluateAlert.execute({
      actorId: actorId(req),
      ...body,
      observedValue: body.observedValue ?? null,
    });
  }

  // --- Targets ------------------------------------------------------------

  @Post('edge/business/targets')
  @RequireEdgePermissions('platform:business:targets:manage')
  @ApiOperation({ summary: 'Create a revenue target' })
  createBusinessTarget(@Req() req: EdgeRequest, @Body() body: CreateRevenueTargetDto) {
    return this.createTarget.execute({ actorId: actorId(req), ...body });
  }

  @Get('edge/business/targets')
  @RequireEdgePermissions('platform:business:read')
  @ApiOperation({ summary: 'List revenue targets' })
  listBusinessTargets(@Query() query: RevenueListQueryDto) {
    return this.listTargets.execute(query);
  }

  // --- Decisions / reports ------------------------------------------------

  @Post('edge/business/decisions')
  @RequireEdgePermissions('platform:business:manage')
  @ApiOperation({ summary: 'Record a business decision' })
  createBusinessDecision(@Req() req: EdgeRequest, @Body() body: CreateBusinessDecisionDto) {
    return this.createDecision.execute({ actorId: actorId(req), ...body });
  }

  @Get('edge/business/reports')
  @RequireEdgePermissions('platform:business:read')
  @ApiOperation({ summary: 'List business reports' })
  listBusinessReports(@Query() query: RevenueListQueryDto) {
    return this.listReports.execute(query);
  }

  @Post('edge/business/reports/generate')
  @RequireEdgePermissions('platform:business:reports:manage')
  @ApiOperation({ summary: 'Generate immutable report snapshot metadata only' })
  generateBusinessReport(@Req() req: EdgeRequest, @Body() body: GenerateBusinessReportDto) {
    return this.generateReport.execute({ actorId: actorId(req), ...body });
  }

  // --- Business audit / governance ----------------------------------------

  @Get('edge/business/audit')
  @RequireEdgePermissions('platform:business:governance:manage')
  @ApiOperation({ summary: 'List P11 business audit events' })
  listBusinessAudit(@Query() query: BusinessAuditQueryDto) {
    return this.getAudit.execute(query);
  }

  @Post('edge/business/audit')
  @RequireEdgePermissions('platform:business:governance:manage')
  @ApiOperation({ summary: 'Append a business audit event' })
  postBusinessAudit(@Req() req: EdgeRequest, @Body() body: AppendBusinessAuditDto) {
    return this.appendAudit.execute({ actorId: actorId(req), ...body });
  }

  @Get('edge/business/overview')
  @RequireEdgePermissions('platform:business:read')
  @ApiOperation({ summary: 'Business overview — delegates to revenue overview snapshots' })
  businessOverview(@Query() query: RevenueOverviewQueryDto) {
    return this.overview.execute({
      businessUnitId: query.businessUnitId,
      asOf: query.asOf,
    });
  }
}

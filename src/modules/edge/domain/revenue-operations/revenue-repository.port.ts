import type {
  BusinessAlert,
  BusinessAlertPolicy,
  BusinessAuditEvent,
  BusinessDecision,
  BusinessReport,
  CommissionApproval,
  CommissionCalculation,
  CommissionPlan,
  CommissionRule,
  ListFilter,
  MetricDefinition,
  MetricDefinitionVersion,
  MetricSnapshot,
  ProductProfitabilitySnapshot,
  RetentionOverview,
  RetentionSnapshot,
  RevenueCohort,
  RevenueForecast,
  RevenueForecastScenario,
  RevenueLeakageCase,
  RevenueOverview,
  RevenueTarget,
  UnitEconomicsSnapshot,
} from './revenue.types.js';

export const REVENUE_OPERATIONS_REPOSITORY_PORT = Symbol('REVENUE_OPERATIONS_REPOSITORY_PORT');

/** Optional projection input for MRR computation when lines are not supplied by the caller. */
export const REVENUE_PROJECTION_INPUT_PORT = Symbol('REVENUE_PROJECTION_INPUT_PORT');

/** Alias preferred by P11 extension wiring (same token as REVENUE_PROJECTION_INPUT_PORT). */
export const REVENUE_PROJECTION_PORT = REVENUE_PROJECTION_INPUT_PORT;

export interface RevenueProjectionInputPort {
  /**
   * Load normalized subscription revenue lines for a period.
   * Stub may return [] — callers must treat empty as UNAVAILABLE, not zero.
   */
  loadNormalizedSubscriptionRevenueLines(input: {
    periodStart: Date;
    periodEnd: Date;
    currency?: string;
    businessUnitId?: string | null;
  }): Promise<
    Array<{
      subscriptionRefId: string;
      customerRefId?: string | null;
      amount: number;
      currency: string;
      billingPeriod: string;
      isFreeTrial?: boolean;
      paymentStatus?: string;
      movementType: string;
      activeAtPeriodEnd?: boolean;
      activeAtPeriodStart?: boolean;
    }>
  >;
}

export interface RevenueOperationsRepositoryPort {
  // --- Metric definitions -------------------------------------------------
  createMetricDefinition(
    input: {
      code: string;
      name: string;
      description: string;
      formula: string;
      sources?: unknown[];
      currencyTreatment?: string;
      timeBasis?: string;
      metadata?: Record<string, unknown>;
      createdBy: string;
    },
    client?: unknown,
  ): Promise<MetricDefinition>;

  getMetricDefinitionByCode(code: string): Promise<MetricDefinition | null>;

  getMetricDefinitionById(id: string): Promise<MetricDefinition | null>;

  listMetricDefinitions(filter?: ListFilter): Promise<{ items: MetricDefinition[]; total: number }>;

  publishMetricDefinition(
    id: string,
    publishedBy: string,
    client?: unknown,
  ): Promise<{ definition: MetricDefinition; version: MetricDefinitionVersion }>;

  // --- Metric snapshots ---------------------------------------------------
  recordMetricSnapshot(
    input: {
      metricCode: string;
      definitionVersion: number;
      definitionVersionId?: string | null;
      businessUnitId?: string | null;
      revenueStreamId?: string | null;
      periodStart: Date;
      periodEnd: Date;
      asOf: Date;
      value: number | null;
      currency: string;
      dataQuality: string;
      sourceProvenance: Record<string, unknown>;
      notes?: string | null;
      metadata?: Record<string, unknown>;
      createdBy: string;
    },
    client?: unknown,
  ): Promise<MetricSnapshot>;

  listMetricSnapshots(filter?: {
    metricCode?: string;
    businessUnitId?: string;
    periodStart?: Date;
    periodEnd?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ items: MetricSnapshot[]; total: number }>;

  getLatestSnapshotsByCodes(
    metricCodes: string[],
    opts?: { businessUnitId?: string | null; asOf?: Date },
  ): Promise<MetricSnapshot[]>;

  getRevenueOverview(opts?: {
    businessUnitId?: string | null;
    metricCodes?: string[];
    asOf?: Date;
  }): Promise<RevenueOverview>;

  // --- Forecasts ----------------------------------------------------------
  createRevenueForecast(
    input: {
      code: string;
      name: string;
      businessUnitId?: string | null;
      horizonStart: Date;
      horizonEnd: Date;
      currency: string;
      assumptions?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      createdBy: string;
    },
    client?: unknown,
  ): Promise<RevenueForecast>;

  getRevenueForecast(id: string): Promise<RevenueForecast | null>;

  createForecastScenario(
    input: {
      forecastId: string;
      code: string;
      name: string;
      scenarioType?: string;
      assumptions?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      createdBy: string;
    },
    client?: unknown,
  ): Promise<RevenueForecastScenario>;

  // --- Leakage ------------------------------------------------------------
  createLeakageCase(
    input: {
      caseNumber?: string;
      title: string;
      description?: string | null;
      businessUnitId?: string | null;
      revenueStreamId?: string | null;
      subscriptionRefId?: string | null;
      invoiceRefId?: string | null;
      detectedAmount?: number | null;
      currency?: string | null;
      dataQuality?: string;
      detectionSource: string;
      sourceProvenance?: Record<string, unknown>;
      assignedTo?: string | null;
      metadata?: Record<string, unknown>;
      createdBy: string;
    },
    client?: unknown,
  ): Promise<RevenueLeakageCase>;

  getLeakageCase(id: string): Promise<RevenueLeakageCase | null>;

  transitionLeakageCase(
    id: string,
    toStatus: string,
    patch: {
      assignedTo?: string | null;
      resolutionNotes?: string | null;
      resolvedAt?: Date | null;
      expectedVersion?: number;
      updatedBy: string;
    },
    client?: unknown,
  ): Promise<RevenueLeakageCase>;

  // --- Commission ---------------------------------------------------------
  createCommissionPlan(
    input: {
      code: string;
      name: string;
      description?: string | null;
      effectiveFrom: Date;
      effectiveTo?: Date | null;
      currency?: string;
      metadata?: Record<string, unknown>;
      createdBy: string;
      rules?: Array<{
        code: string;
        name: string;
        ruleType?: string;
        rate?: number | null;
        definition?: Record<string, unknown>;
      }>;
    },
    client?: unknown,
  ): Promise<{ plan: CommissionPlan; rules: CommissionRule[] }>;

  getCommissionPlan(id: string): Promise<CommissionPlan | null>;

  listCommissionRules(planId: string): Promise<CommissionRule[]>;

  createCommissionCalculation(
    input: {
      planId: string;
      calculationKey: string;
      periodStart: Date;
      periodEnd: Date;
      asOf: Date;
      inputSnapshot: Record<string, unknown>;
      resultSnapshot: Record<string, unknown>;
      totalAmount: number | null;
      currency: string;
      dataQuality: string;
      definitionVersion?: number;
      sourceProvenance: Record<string, unknown>;
      calculatedBy: string;
      metadata?: Record<string, unknown>;
    },
    client?: unknown,
  ): Promise<CommissionCalculation>;

  getCommissionCalculation(id: string): Promise<CommissionCalculation | null>;

  getCommissionCalculationByKey(calculationKey: string): Promise<CommissionCalculation | null>;

  approveCommissionCalculation(
    id: string,
    input: {
      decidedBy: string;
      notes?: string | null;
      metadata?: Record<string, unknown>;
      expectedVersion?: number;
    },
    client?: unknown,
  ): Promise<{ calculation: CommissionCalculation; approval: CommissionApproval }>;

  // --- Retention / cohorts ------------------------------------------------
  createRevenueCohort(
    input: {
      code: string;
      name: string;
      cohortMonth: Date | string;
      businessUnitId?: string | null;
      definition?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      createdBy: string;
    },
    client?: unknown,
  ): Promise<RevenueCohort>;

  getRevenueCohort(id: string): Promise<RevenueCohort | null>;

  createRetentionSnapshot(
    input: {
      cohortId: string;
      periodStart: Date;
      periodEnd: Date;
      asOf: Date;
      metricCode: string;
      value: number | null;
      currency?: string;
      dataQuality: string;
      definitionVersion?: number;
      sourceProvenance: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      createdBy: string;
    },
    client?: unknown,
  ): Promise<RetentionSnapshot>;

  listRetentionSnapshots(filter?: {
    cohortId?: string;
    metricCode?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: RetentionSnapshot[]; total: number }>;

  getRetentionOverview(opts?: {
    cohortId?: string | null;
    asOf?: Date;
  }): Promise<RetentionOverview>;

  // --- Product profitability ----------------------------------------------
  createProductProfitabilitySnapshot(
    input: {
      productRefId?: string | null;
      commercialPlanRefId?: string | null;
      businessUnitId?: string | null;
      periodStart: Date;
      periodEnd: Date;
      asOf: Date;
      revenueAmount: number | null;
      costAmount: number | null;
      marginAmount: number | null;
      currency: string;
      dataQuality: string;
      definitionVersion?: number;
      sourceProvenance: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      createdBy: string;
    },
    client?: unknown,
  ): Promise<ProductProfitabilitySnapshot>;

  // --- Unit economics -----------------------------------------------------
  createUnitEconomicsSnapshot(
    input: {
      businessUnitId?: string | null;
      periodStart: Date;
      periodEnd: Date;
      asOf: Date;
      currency: string;
      cacValue: number | null;
      cacDataQuality: string;
      ltvValue: number | null;
      ltvDataQuality: string;
      ltvCacValue: number | null;
      ltvCacDataQuality: string;
      paybackMonthsValue: number | null;
      paybackMonthsDataQuality: string;
      inputSnapshot?: Record<string, unknown>;
      definitionVersion?: number;
      sourceProvenance: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      createdBy: string;
    },
    client?: unknown,
  ): Promise<UnitEconomicsSnapshot>;

  // --- Targets ------------------------------------------------------------
  createRevenueTarget(
    input: {
      code: string;
      name: string;
      businessUnitId?: string | null;
      revenueStreamId?: string | null;
      metricCode: string;
      periodStart: Date;
      periodEnd: Date;
      targetValue: number;
      currency: string;
      metadata?: Record<string, unknown>;
      createdBy: string;
    },
    client?: unknown,
  ): Promise<RevenueTarget>;

  listRevenueTargets(filter?: ListFilter): Promise<{ items: RevenueTarget[]; total: number }>;

  // --- Business alerts ----------------------------------------------------
  createBusinessAlertPolicy(
    input: {
      code: string;
      name: string;
      description?: string | null;
      metricCode: string;
      businessUnitId?: string | null;
      comparator?: string;
      thresholdValue: number;
      severity?: string;
      metadata?: Record<string, unknown>;
      createdBy: string;
    },
    client?: unknown,
  ): Promise<BusinessAlertPolicy>;

  getBusinessAlertPolicy(id: string): Promise<BusinessAlertPolicy | null>;

  createBusinessAlert(
    input: {
      code?: string;
      title: string;
      policyId?: string | null;
      severity?: string;
      metricCode?: string | null;
      observedValue?: number | null;
      thresholdValue?: number | null;
      businessUnitId?: string | null;
      asOf: Date;
      dataQuality?: string;
      sourceProvenance?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      createdBy: string;
    },
    client?: unknown,
  ): Promise<BusinessAlert>;

  listBusinessAlerts(filter?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: BusinessAlert[]; total: number }>;

  acknowledgeBusinessAlert(
    id: string,
    input: { acknowledgedBy: string; expectedVersion?: number },
    client?: unknown,
  ): Promise<BusinessAlert>;

  // --- Business decisions / reports ---------------------------------------
  createBusinessDecision(
    input: {
      code: string;
      title: string;
      decisionType?: string;
      rationale?: string | null;
      relatedReportId?: string | null;
      metadata?: Record<string, unknown>;
      createdBy: string;
    },
    client?: unknown,
  ): Promise<BusinessDecision>;

  listBusinessReports(filter?: ListFilter): Promise<{ items: BusinessReport[]; total: number }>;

  generateBusinessReport(
    input: {
      code: string;
      title: string;
      reportType?: string;
      businessUnitId?: string | null;
      periodId?: string | null;
      asOf: Date;
      content?: Record<string, unknown>;
      dataQuality?: string;
      sourceProvenance?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      createdBy: string;
    },
    client?: unknown,
  ): Promise<BusinessReport>;

  // --- Audit --------------------------------------------------------------
  appendBusinessAudit(
    input: {
      eventType: string;
      aggregateType: string;
      aggregateId: string;
      actorId?: string | null;
      correlationId?: string | null;
      details?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    },
    client?: unknown,
  ): Promise<BusinessAuditEvent>;

  listBusinessAudit(filter?: {
    aggregateType?: string;
    aggregateId?: string;
    eventType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: BusinessAuditEvent[]; total: number }>;
}

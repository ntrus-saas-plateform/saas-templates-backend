/** P11.0–P11.1 SaaS Business & Revenue Operations — domain types.
 * READ/ANALYTICS + commission/forecast/risk workflows.
 * Never creates invoices, payments, subscriptions, or tenants.
 */

export const EDGE_P11_OUTBOX_TENANT = 'edge-p11-revenue-operations';

export type DataQuality = 'MEASURED' | 'ESTIMATED' | 'UNAVAILABLE';

export type MetricDefinitionStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';

export type CurrencyTreatment = 'NATIVE' | 'CONVERT_TO_REPORTING' | 'UNITLESS';

export type TimeBasis =
  | 'PERIOD_END'
  | 'PERIOD_START'
  | 'PERIOD_AVERAGE'
  | 'POINT_IN_TIME'
  | 'TRAILING';

export type ForecastStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'SUPERSEDED' | 'ARCHIVED';

export type ForecastScenarioType = 'BASE' | 'UPSIDE' | 'DOWNSIDE' | 'STRESS' | 'CUSTOM';

export type LeakageCaseStatus =
  | 'DETECTED'
  | 'TRIAGED'
  | 'INVESTIGATING'
  | 'CONFIRMED'
  | 'REMEDIATING'
  | 'RESOLVED'
  | 'WRITTEN_OFF'
  | 'FALSE_POSITIVE'
  | 'CLOSED';

export type CommissionPlanStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED';

export type CommissionCalculationStatus =
  | 'CALCULATED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUPERSEDED';

export type BusinessUnitStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type RevenueStreamType = 'SUBSCRIPTION' | 'USAGE' | 'SERVICES' | 'PARTNER' | 'OTHER';

export type BusinessUnit = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentUnitId: string | null;
  status: BusinessUnitStatus | string;
  ownerRef: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type RevenueStream = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  businessUnitId: string | null;
  streamType: RevenueStreamType | string;
  productRefId: string | null;
  commercialPlanRefId: string | null;
  currency: string;
  status: string;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type MetricDefinition = {
  id: string;
  code: string;
  name: string;
  description: string;
  formula: string;
  sources: unknown[];
  currencyTreatment: CurrencyTreatment | string;
  timeBasis: TimeBasis | string;
  status: MetricDefinitionStatus | string;
  version: number;
  currentPublishedVersionId: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MetricDefinitionVersion = {
  id: string;
  definitionId: string;
  versionNumber: number;
  code: string;
  name: string;
  description: string;
  formula: string;
  sources: unknown[];
  currencyTreatment: string;
  timeBasis: string;
  publishedAt: Date;
  publishedBy: string;
  immutable: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type MetricSnapshot = {
  id: string;
  metricCode: string;
  definitionVersion: number;
  definitionVersionId: string | null;
  businessUnitId: string | null;
  revenueStreamId: string | null;
  periodStart: Date;
  periodEnd: Date;
  asOf: Date;
  value: number | null;
  currency: string;
  dataQuality: DataQuality | string;
  sourceProvenance: Record<string, unknown>;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type RevenueTarget = {
  id: string;
  code: string;
  name: string;
  businessUnitId: string | null;
  revenueStreamId: string | null;
  metricCode: string;
  periodStart: Date;
  periodEnd: Date;
  targetValue: number;
  currency: string;
  status: string;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type RevenueForecast = {
  id: string;
  code: string;
  name: string;
  businessUnitId: string | null;
  verticalId: string | null;
  horizonStart: Date;
  horizonEnd: Date;
  currency: string;
  status: ForecastStatus | string;
  publishedAt: Date | null;
  publishedBy: string | null;
  immutableAfterPublish: boolean;
  assumptions: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type RevenueForecastScenario = {
  id: string;
  forecastId: string;
  code: string;
  name: string;
  scenarioType: ForecastScenarioType | string;
  assumptions: Record<string, unknown>;
  status: string;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type RevenueForecastSnapshot = {
  id: string;
  forecastId: string;
  scenarioId: string | null;
  metricCode: string;
  periodStart: Date;
  periodEnd: Date;
  asOf: Date;
  value: number | null;
  currency: string;
  dataQuality: DataQuality | string;
  definitionVersion: number;
  sourceProvenance: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  version: number;
};

export type RevenueRisk = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  businessUnitId: string | null;
  riskCategory: string;
  probability: string;
  impact: string;
  estimatedExposure: number | null;
  currency: string | null;
  dataQuality: DataQuality | string;
  status: string;
  ownerRef: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type RevenueLeakageCase = {
  id: string;
  caseNumber: string;
  title: string;
  description: string | null;
  businessUnitId: string | null;
  revenueStreamId: string | null;
  subscriptionRefId: string | null;
  invoiceRefId: string | null;
  detectedAmount: number | null;
  currency: string | null;
  dataQuality: DataQuality | string;
  status: LeakageCaseStatus | string;
  detectionSource: string;
  sourceProvenance: Record<string, unknown>;
  assignedTo: string | null;
  resolvedAt: Date | null;
  resolutionNotes: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type CommissionPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: CommissionPlanStatus | string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  currency: string;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type CommissionRule = {
  id: string;
  planId: string;
  code: string;
  name: string;
  ruleType: string;
  rate: number | null;
  definition: Record<string, unknown>;
  status: string;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type CommissionCalculation = {
  id: string;
  planId: string;
  calculationKey: string;
  periodStart: Date;
  periodEnd: Date;
  asOf: Date;
  inputSnapshot: Record<string, unknown>;
  resultSnapshot: Record<string, unknown>;
  totalAmount: number | null;
  currency: string;
  dataQuality: DataQuality | string;
  definitionVersion: number;
  sourceProvenance: Record<string, unknown>;
  status: CommissionCalculationStatus | string;
  immutable: boolean;
  calculatedBy: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type BusinessAuditEvent = {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  actorId: string | null;
  correlationId: string | null;
  details: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  version: number;
};

/** Overview metric cell — never fabricate; UNAVAILABLE when missing. */
export type RevenueOverviewMetric = {
  metricCode: string;
  value: number | null;
  currency: string | null;
  dataQuality: DataQuality;
  definitionVersion: number | null;
  asOf: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  sourceProvenance: Record<string, unknown> | null;
  note?: string;
};

export type RevenueOverview = {
  availability: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE';
  asOf: string;
  metrics: RevenueOverviewMetric[];
  note?: string;
};

export type ListFilter = {
  status?: string;
  businessUnitId?: string;
  metricCode?: string;
  verticalId?: string;
  limit?: number;
  offset?: number;
};

export type RevenueCohort = {
  id: string;
  code: string;
  name: string;
  cohortMonth: string;
  businessUnitId: string | null;
  verticalId: string | null;
  definition: Record<string, unknown>;
  status: string;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type RetentionSnapshot = {
  id: string;
  cohortId: string;
  periodStart: Date;
  periodEnd: Date;
  asOf: Date;
  metricCode: string;
  value: number | null;
  currency: string;
  dataQuality: DataQuality | string;
  definitionVersion: number;
  sourceProvenance: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  version: number;
};

export type ProductProfitabilitySnapshot = {
  id: string;
  productRefId: string | null;
  commercialPlanRefId: string | null;
  businessUnitId: string | null;
  periodStart: Date;
  periodEnd: Date;
  asOf: Date;
  revenueAmount: number | null;
  costAmount: number | null;
  marginAmount: number | null;
  currency: string;
  dataQuality: DataQuality | string;
  definitionVersion: number;
  sourceProvenance: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  version: number;
};

export type CommissionApproval = {
  id: string;
  calculationId: string;
  decision: 'APPROVED' | 'REJECTED' | string;
  decidedBy: string;
  decidedAt: Date;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  version: number;
};

export type RetentionOverview = {
  availability: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE';
  asOf: string;
  grr: RevenueOverviewMetric | null;
  nrr: RevenueOverviewMetric | null;
  snapshots: RetentionSnapshot[];
  note?: string;
};

export type UnitEconomicsSnapshot = {
  id: string;
  businessUnitId: string | null;
  periodStart: Date;
  periodEnd: Date;
  asOf: Date;
  currency: string;
  cacValue: number | null;
  cacDataQuality: DataQuality | string;
  ltvValue: number | null;
  ltvDataQuality: DataQuality | string;
  ltvCacValue: number | null;
  ltvCacDataQuality: DataQuality | string;
  paybackMonthsValue: number | null;
  paybackMonthsDataQuality: DataQuality | string;
  inputSnapshot: Record<string, unknown>;
  definitionVersion: number;
  sourceProvenance: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  version: number;
};

export type BusinessAlertPolicy = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  metricCode: string;
  businessUnitId: string | null;
  comparator: 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ' | string;
  thresholdValue: number;
  severity: string;
  status: string;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type BusinessAlert = {
  id: string;
  code: string;
  title: string;
  policyId: string | null;
  severity: string;
  status: string;
  metricCode: string | null;
  observedValue: number | null;
  thresholdValue: number | null;
  businessUnitId: string | null;
  asOf: Date;
  dataQuality: DataQuality | string;
  sourceProvenance: Record<string, unknown>;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type BusinessDecision = {
  id: string;
  code: string;
  title: string;
  decisionType: string;
  status: string;
  rationale: string | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  relatedReportId: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type BusinessReport = {
  id: string;
  code: string;
  title: string;
  reportType: string;
  businessUnitId: string | null;
  periodId: string | null;
  status: string;
  asOf: Date;
  content: Record<string, unknown>;
  dataQuality: DataQuality | string;
  definitionVersion: number;
  sourceProvenance: Record<string, unknown>;
  immutable: boolean;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type RenewalIntelligenceItem = {
  subscriptionRefId: string;
  renewalAt: string | null;
  daysToRenewal: number | null;
  mrrAtRisk: number | null;
  currency: string | null;
  score: number;
  severity: string;
  reasons: string[];
  dataQuality: DataQuality;
};

export type RenewalIntelligenceOverview = {
  availability: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE';
  asOf: string;
  items: RenewalIntelligenceItem[];
  note?: string;
};

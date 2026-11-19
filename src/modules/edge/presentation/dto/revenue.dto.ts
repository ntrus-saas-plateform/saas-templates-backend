import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RevenueListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiPropertyOptional({
    description: 'Scope to a vertical — omit for platform-wide (dual-mode)',
  })
  @IsOptional()
  @IsUUID()
  verticalId?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class RegisterMetricDefinitionDto {
  @ApiProperty({ example: 'MRR_ENDING' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  formula?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  sources?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currencyTreatment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timeBasis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RecordMetricSnapshotDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  metricCode!: string;

  @ApiProperty()
  @IsDateString()
  periodStart!: string;

  @ApiProperty()
  @IsDateString()
  periodEnd!: string;

  @ApiProperty()
  @IsDateString()
  asOf!: string;

  @ApiPropertyOptional({ nullable: true, description: 'null when dataQuality=UNAVAILABLE' })
  @IsOptional()
  @IsNumber()
  value?: number | null;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @MinLength(3)
  currency!: string;

  @ApiProperty({ enum: ['MEASURED', 'ESTIMATED', 'UNAVAILABLE'] })
  @IsString()
  dataQuality!: string;

  @ApiProperty({ description: 'Provenance of the measurement — required' })
  @IsObject()
  sourceProvenance!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  revenueStreamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RevenueOverviewQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @ApiPropertyOptional({
    description:
      'Workspace switch scope — when set, MRR metrics are live-computed from subscriptions of this vertical (ESTIMATED); stored snapshots carry no vertical link',
  })
  @IsOptional()
  @IsUUID()
  verticalId?: string;
}

export class MrrLineDto {
  @ApiProperty()
  @IsString()
  subscriptionRefId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerRefId?: string;

  @ApiProperty()
  @IsNumber()
  amount!: number;

  @ApiProperty()
  @IsString()
  currency!: string;

  @ApiProperty({ example: 'MONTHLY' })
  @IsString()
  billingPeriod!: string;

  @ApiPropertyOptional()
  @IsOptional()
  isFreeTrial?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @ApiProperty()
  @IsString()
  movementType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  activeAtPeriodEnd?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  activeAtPeriodStart?: boolean;
}

export class ComputeCashRevenueDto {
  @ApiProperty()
  @IsDateString()
  periodStart!: string;

  @ApiProperty()
  @IsDateString()
  periodEnd!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiPropertyOptional({
    description: 'Persist INVOICED/COLLECTED/RECEIVABLES snapshots with source=engine',
  })
  @IsOptional()
  persistSnapshots?: boolean;
}

export class ComputeChurnRatesDto {
  @ApiProperty()
  @IsDateString()
  periodStart!: string;

  @ApiProperty()
  @IsDateString()
  periodEnd!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  startingLogos?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  churnedLogos?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  startingSubscriptions?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  churnedSubscriptions?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  persistSnapshots?: boolean;
}

export class ComputeMrrMovementDto {
  @ApiProperty()
  @IsDateString()
  periodStart!: string;

  @ApiProperty()
  @IsDateString()
  periodEnd!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiPropertyOptional({
    description: 'Workspace switch scope — compute MRR from subscriptions of this vertical only',
  })
  @IsOptional()
  @IsUUID()
  verticalId?: string;

  @ApiPropertyOptional({ type: [MrrLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MrrLineDto)
  lines?: MrrLineDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  excludeFreeTrials?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Persist snapshots only when metric definitions are PUBLISHED',
  })
  @IsOptional()
  persistSnapshots?: boolean;
}

export class CreateRevenueForecastDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiPropertyOptional({
    description: 'Vertical scope for this forecast — omit for platform-wide',
  })
  @IsOptional()
  @IsUUID()
  verticalId?: string;

  @ApiProperty()
  @IsDateString()
  horizonStart!: string;

  @ApiProperty()
  @IsDateString()
  horizonEnd!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  currency!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  assumptions?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateForecastScenarioDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scenarioType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  assumptions?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateLeakageCaseDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  detectionSource!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subscriptionRefId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  invoiceRefId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  detectedAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dataQuality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  sourceProvenance?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caseNumber?: string;
}

export class TransitionLeakageCaseDto {
  @ApiProperty({ example: 'TRIAGED' })
  @IsString()
  @MinLength(2)
  toStatus!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolutionNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}

export class CommissionRuleDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ruleType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  definition?: Record<string, unknown>;
}

export class CreateCommissionPlanDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsDateString()
  effectiveFrom!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ type: [CommissionRuleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommissionRuleDto)
  rules?: CommissionRuleDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CalculateCommissionDto {
  @ApiProperty()
  @IsUUID()
  planId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  calculationKey!: string;

  @ApiProperty()
  @IsDateString()
  periodStart!: string;

  @ApiProperty()
  @IsDateString()
  periodEnd!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'null + UNAVAILABLE when basis is unknown — never invent',
  })
  @IsOptional()
  @IsNumber()
  basisAmount?: number | null;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  currency!: string;

  @ApiProperty({ enum: ['MEASURED', 'ESTIMATED', 'UNAVAILABLE'] })
  @IsString()
  dataQuality!: string;

  @ApiProperty()
  @IsObject()
  sourceProvenance!: Record<string, unknown>;
}

export class BusinessAuditQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aggregateType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  aggregateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class AppendBusinessAuditDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  eventType!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  aggregateType!: string;

  @ApiProperty()
  @IsUUID()
  aggregateId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;
}

export class RetentionOverviewQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @ApiPropertyOptional({
    description: 'Scope GRR/NRR to cohorts of this vertical — omit for platform-wide',
  })
  @IsOptional()
  @IsUUID()
  verticalId?: string;
}

export class RecordRetentionSnapshotDto {
  @ApiProperty()
  @IsUUID()
  cohortId!: string;

  @ApiProperty()
  @IsDateString()
  periodStart!: string;

  @ApiProperty()
  @IsDateString()
  periodEnd!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @ApiPropertyOptional({ nullable: true, description: 'null → GRR/NRR pct UNAVAILABLE' })
  @IsOptional()
  @IsNumber()
  startingMrr?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  contraction?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  churned?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  expansion?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  reactivation?: number | null;

  @ApiPropertyOptional({
    description: 'Default true — include reactivation in NRR as expansion-like',
  })
  @IsOptional()
  @IsBoolean()
  includeReactivationInNrr?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  sourceProvenance?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RecordProductProfitabilitySnapshotDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productRefId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  commercialPlanRefId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiProperty()
  @IsDateString()
  periodStart!: string;

  @ApiProperty()
  @IsDateString()
  periodEnd!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @ApiProperty({ description: 'Must be MEASURED revenue' })
  @IsNumber()
  revenueAmount!: number;

  @ApiPropertyOptional({ enum: ['MEASURED'], default: 'MEASURED' })
  @IsOptional()
  @IsString()
  revenueDataQuality?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  costAmount?: number | null;

  @ApiProperty({ enum: ['MEASURED', 'ESTIMATED', 'UNAVAILABLE'] })
  @IsString()
  costDataQuality!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  currency!: string;

  @ApiProperty()
  @IsObject()
  sourceProvenance!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RunAssuranceScanDto {
  @ApiPropertyOptional({
    description: 'Optional precomputed findings; when omitted, P5/P6 adapter is used',
    type: 'array',
  })
  @IsOptional()
  @IsArray()
  findings?: Array<Record<string, unknown>>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  persist?: boolean;

  @ApiPropertyOptional({ default: true, description: 'Collect findings via P5/P6 adapter' })
  @IsOptional()
  @IsBoolean()
  useAdapter?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class ApproveCommissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  expectedVersion?: number;
}

export class RecordUnitEconomicsSnapshotDto {
  @ApiProperty()
  @IsDateString()
  periodStart!: string;

  @ApiProperty()
  @IsDateString()
  periodEnd!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  currency!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  acquisitionSpend?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  newCustomers?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  avgRecurringRevenue?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  grossMarginPct?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  churnRate?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  monthlyContribution?: number | null;

  @ApiPropertyOptional({ description: 'Also write CAC/LTV/LTV_CAC metric snapshots when published' })
  @IsOptional()
  @IsBoolean()
  mirrorMetricSnapshots?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  sourceProvenance?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RenewalIntelligenceQueryDto {
  @ApiPropertyOptional({ default: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  withinDays?: number;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Scope renewals to subscriptions of this vertical — omit for platform-wide',
  })
  @IsOptional()
  @IsUUID()
  verticalId?: string;
}

export class CreateBusinessAlertPolicyDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'MRR_CHURNED' })
  @IsString()
  @MinLength(2)
  metricCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiPropertyOptional({ enum: ['GT', 'GTE', 'LT', 'LTE', 'EQ'], default: 'GT' })
  @IsOptional()
  @IsString()
  comparator?: string;

  @ApiProperty()
  @IsNumber()
  thresholdValue!: number;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class EvaluateBusinessAlertDto {
  @ApiProperty()
  @IsUUID()
  policyId!: string;

  @ApiPropertyOptional({ nullable: true, description: 'If omitted, latest metric snapshot is used' })
  @IsOptional()
  @IsNumber()
  observedValue?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;
}

export class CreateRevenueTargetDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  metricCode!: string;

  @ApiProperty()
  @IsDateString()
  periodStart!: string;

  @ApiProperty()
  @IsDateString()
  periodEnd!: string;

  @ApiProperty()
  @IsNumber()
  targetValue!: number;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  currency!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  revenueStreamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateBusinessDecisionDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  decisionType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rationale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  relatedReportId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class GenerateBusinessReportDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reportType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  periodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @ApiPropertyOptional({ description: 'Metadata only — do not fabricate financials' })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dataQuality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  sourceProvenance?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

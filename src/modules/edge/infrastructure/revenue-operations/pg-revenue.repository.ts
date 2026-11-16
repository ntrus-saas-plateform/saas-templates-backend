import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import { CANONICAL_METRIC_CODES } from '../../domain/revenue-operations/revenue-metric-registry.js';
import type { RevenueOperationsRepositoryPort } from '../../domain/revenue-operations/revenue-repository.port.js';
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
  RevenueOverviewMetric,
  RevenueTarget,
  UnitEconomicsSnapshot,
} from '../../domain/revenue-operations/revenue.types.js';

type Row = Record<string, unknown>;

function str(v: unknown): string {
  return v == null ? '' : String(v);
}
function strOrNull(v: unknown): string | null {
  return v == null ? null : String(v);
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function bool(v: unknown): boolean {
  return v === true || v === 't' || v === 'true';
}
function asDate(v: unknown): Date {
  return v instanceof Date ? v : new Date(String(v));
}
function asDateOrNull(v: unknown): Date | null {
  return v == null ? null : asDate(v);
}
function asJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === 'object') return v as T;
  try {
    return JSON.parse(String(v)) as T;
  } catch {
    return fallback;
  }
}

function caseNumber(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const suffix = randomBytes(2).toString('hex').toUpperCase();
  return `LK-${y}${m}${day}-${suffix}`;
}

@Injectable()
export class PgRevenueRepository implements RevenueOperationsRepositoryPort {
  constructor(private readonly db: ControlPlaneDatabaseService) {}

  private async q<T extends Row = Row>(
    sql: string,
    params: unknown[] = [],
    client?: unknown,
  ): Promise<T[]> {
    if (client) {
      const result = await (client as PoolClient).query(sql, params);
      return result.rows as T[];
    }
    const pool = this.db.getPool();
    const result = await pool.query(sql, params);
    return result.rows as T[];
  }

  private mapDefinition(row: Row): MetricDefinition {
    return {
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      description: str(row.description),
      formula: str(row.formula),
      sources: asJson(row.sources, []),
      currencyTreatment: str(row.currency_treatment),
      timeBasis: str(row.time_basis),
      status: str(row.status),
      version: num(row.version),
      currentPublishedVersionId: strOrNull(row.current_published_version_id),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapDefinitionVersion(row: Row): MetricDefinitionVersion {
    return {
      id: str(row.id),
      definitionId: str(row.definition_id),
      versionNumber: num(row.version_number),
      code: str(row.code),
      name: str(row.name),
      description: str(row.description),
      formula: str(row.formula),
      sources: asJson(row.sources, []),
      currencyTreatment: str(row.currency_treatment),
      timeBasis: str(row.time_basis),
      publishedAt: asDate(row.published_at),
      publishedBy: str(row.published_by),
      immutable: bool(row.immutable),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
    };
  }

  private mapSnapshot(row: Row): MetricSnapshot {
    return {
      id: str(row.id),
      metricCode: str(row.metric_code),
      definitionVersion: num(row.definition_version),
      definitionVersionId: strOrNull(row.definition_version_id),
      businessUnitId: strOrNull(row.business_unit_id),
      revenueStreamId: strOrNull(row.revenue_stream_id),
      periodStart: asDate(row.period_start),
      periodEnd: asDate(row.period_end),
      asOf: asDate(row.as_of),
      value: numOrNull(row.value),
      currency: str(row.currency),
      dataQuality: str(row.data_quality),
      sourceProvenance: asJson(row.source_provenance, {}),
      notes: strOrNull(row.notes),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapForecast(row: Row): RevenueForecast {
    return {
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      businessUnitId: strOrNull(row.business_unit_id),
      horizonStart: asDate(row.horizon_start),
      horizonEnd: asDate(row.horizon_end),
      currency: str(row.currency),
      status: str(row.status),
      publishedAt: asDateOrNull(row.published_at),
      publishedBy: strOrNull(row.published_by),
      immutableAfterPublish: bool(row.immutable_after_publish),
      assumptions: asJson(row.assumptions, {}),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapScenario(row: Row): RevenueForecastScenario {
    return {
      id: str(row.id),
      forecastId: str(row.forecast_id),
      code: str(row.code),
      name: str(row.name),
      scenarioType: str(row.scenario_type),
      assumptions: asJson(row.assumptions, {}),
      status: str(row.status),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapLeakage(row: Row): RevenueLeakageCase {
    return {
      id: str(row.id),
      caseNumber: str(row.case_number),
      title: str(row.title),
      description: strOrNull(row.description),
      businessUnitId: strOrNull(row.business_unit_id),
      revenueStreamId: strOrNull(row.revenue_stream_id),
      subscriptionRefId: strOrNull(row.subscription_ref_id),
      invoiceRefId: strOrNull(row.invoice_ref_id),
      detectedAmount: numOrNull(row.detected_amount),
      currency: strOrNull(row.currency),
      dataQuality: str(row.data_quality),
      status: str(row.status),
      detectionSource: str(row.detection_source),
      sourceProvenance: asJson(row.source_provenance, {}),
      assignedTo: strOrNull(row.assigned_to),
      resolvedAt: asDateOrNull(row.resolved_at),
      resolutionNotes: strOrNull(row.resolution_notes),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapPlan(row: Row): CommissionPlan {
    return {
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      description: strOrNull(row.description),
      status: str(row.status),
      effectiveFrom: asDate(row.effective_from),
      effectiveTo: asDateOrNull(row.effective_to),
      currency: str(row.currency),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapRule(row: Row): CommissionRule {
    return {
      id: str(row.id),
      planId: str(row.plan_id),
      code: str(row.code),
      name: str(row.name),
      ruleType: str(row.rule_type),
      rate: numOrNull(row.rate),
      definition: asJson(row.definition, {}),
      status: str(row.status),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapCalculation(row: Row): CommissionCalculation {
    return {
      id: str(row.id),
      planId: str(row.plan_id),
      calculationKey: str(row.calculation_key),
      periodStart: asDate(row.period_start),
      periodEnd: asDate(row.period_end),
      asOf: asDate(row.as_of),
      inputSnapshot: asJson(row.input_snapshot, {}),
      resultSnapshot: asJson(row.result_snapshot, {}),
      totalAmount: numOrNull(row.total_amount),
      currency: str(row.currency),
      dataQuality: str(row.data_quality),
      definitionVersion: num(row.definition_version),
      sourceProvenance: asJson(row.source_provenance, {}),
      status: str(row.status),
      immutable: bool(row.immutable),
      calculatedBy: str(row.calculated_by),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapAudit(row: Row): BusinessAuditEvent {
    return {
      id: str(row.id),
      eventType: str(row.event_type),
      aggregateType: str(row.aggregate_type),
      aggregateId: str(row.aggregate_id),
      actorId: strOrNull(row.actor_id),
      correlationId: strOrNull(row.correlation_id),
      details: asJson(row.details, {}),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
      version: num(row.version),
    };
  }

  private mapCohort(row: Row): RevenueCohort {
    const cohortMonth = row.cohort_month;
    const cohortMonthStr =
      cohortMonth instanceof Date
        ? cohortMonth.toISOString().slice(0, 10)
        : String(cohortMonth).slice(0, 10);
    return {
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      cohortMonth: cohortMonthStr,
      businessUnitId: strOrNull(row.business_unit_id),
      definition: asJson(row.definition, {}),
      status: str(row.status),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapRetention(row: Row): RetentionSnapshot {
    return {
      id: str(row.id),
      cohortId: str(row.cohort_id),
      periodStart: asDate(row.period_start),
      periodEnd: asDate(row.period_end),
      asOf: asDate(row.as_of),
      metricCode: str(row.metric_code),
      value: numOrNull(row.value),
      currency: str(row.currency),
      dataQuality: str(row.data_quality),
      definitionVersion: num(row.definition_version),
      sourceProvenance: asJson(row.source_provenance, {}),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
      version: num(row.version),
    };
  }

  private mapProductProfit(row: Row): ProductProfitabilitySnapshot {
    return {
      id: str(row.id),
      productRefId: strOrNull(row.product_ref_id),
      commercialPlanRefId: strOrNull(row.commercial_plan_ref_id),
      businessUnitId: strOrNull(row.business_unit_id),
      periodStart: asDate(row.period_start),
      periodEnd: asDate(row.period_end),
      asOf: asDate(row.as_of),
      revenueAmount: numOrNull(row.revenue_amount),
      costAmount: numOrNull(row.cost_amount),
      marginAmount: numOrNull(row.margin_amount),
      currency: str(row.currency),
      dataQuality: str(row.data_quality),
      definitionVersion: num(row.definition_version),
      sourceProvenance: asJson(row.source_provenance, {}),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
      version: num(row.version),
    };
  }

  private mapCommissionApproval(row: Row): CommissionApproval {
    return {
      id: str(row.id),
      calculationId: str(row.calculation_id),
      decision: str(row.decision),
      decidedBy: str(row.decided_by),
      decidedAt: asDate(row.decided_at),
      notes: strOrNull(row.notes),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
      version: num(row.version),
    };
  }

  async createMetricDefinition(
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
  ): Promise<MetricDefinition> {
    const rows = await this.q(
      `INSERT INTO edge_p11_metric_definitions
        (code, name, description, formula, sources, currency_treatment, time_basis, metadata, created_by)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb,$9)
       RETURNING *`,
      [
        input.code,
        input.name,
        input.description,
        input.formula,
        JSON.stringify(input.sources ?? []),
        input.currencyTreatment ?? 'NATIVE',
        input.timeBasis ?? 'PERIOD_END',
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
      client,
    );
    return this.mapDefinition(rows[0]!);
  }

  async getMetricDefinitionByCode(code: string): Promise<MetricDefinition | null> {
    const rows = await this.q(`SELECT * FROM edge_p11_metric_definitions WHERE code = $1`, [
      code,
    ]);
    return rows[0] ? this.mapDefinition(rows[0]) : null;
  }

  async getMetricDefinitionById(id: string): Promise<MetricDefinition | null> {
    const rows = await this.q(`SELECT * FROM edge_p11_metric_definitions WHERE id = $1`, [id]);
    return rows[0] ? this.mapDefinition(rows[0]) : null;
  }

  async listMetricDefinitions(
    filter?: ListFilter,
  ): Promise<{ items: MetricDefinition[]; total: number }> {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const params: unknown[] = [];
    let where = '';
    if (filter?.status) {
      params.push(filter.status);
      where = `WHERE status = $${params.length}`;
    }
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS total FROM edge_p11_metric_definitions ${where}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p11_metric_definitions ${where}
       ORDER BY code ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapDefinition(r)), total: num(countRows[0]?.total) };
  }

  async publishMetricDefinition(
    id: string,
    publishedBy: string,
    client?: unknown,
  ): Promise<{ definition: MetricDefinition; version: MetricDefinitionVersion }> {
    const current = await this.getMetricDefinitionById(id);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Metric definition not found');
    const nextVersion =
      current.status === 'PUBLISHED' ? current.version + 1 : Math.max(1, current.version);

    const verRows = await this.q(
      `INSERT INTO edge_p11_metric_definition_versions
        (definition_id, version_number, code, name, description, formula, sources,
         currency_treatment, time_basis, published_by, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11::jsonb)
       RETURNING *`,
      [
        id,
        nextVersion,
        current.code,
        current.name,
        current.description,
        current.formula,
        JSON.stringify(current.sources),
        current.currencyTreatment,
        current.timeBasis,
        publishedBy,
        JSON.stringify(current.metadata),
      ],
      client,
    );
    const version = this.mapDefinitionVersion(verRows[0]!);
    const defRows = await this.q(
      `UPDATE edge_p11_metric_definitions
       SET status = 'PUBLISHED',
           version = $2,
           current_published_version_id = $3,
           updated_by = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, nextVersion, version.id, publishedBy],
      client,
    );
    return { definition: this.mapDefinition(defRows[0]!), version };
  }

  async recordMetricSnapshot(
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
  ): Promise<MetricSnapshot> {
    const rows = await this.q(
      `INSERT INTO edge_p11_metric_snapshots
        (metric_code, definition_version, definition_version_id, business_unit_id, revenue_stream_id,
         period_start, period_end, as_of, value, currency, data_quality, source_provenance, notes, metadata, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14::jsonb,$15)
       RETURNING *`,
      [
        input.metricCode,
        input.definitionVersion,
        input.definitionVersionId ?? null,
        input.businessUnitId ?? null,
        input.revenueStreamId ?? null,
        input.periodStart,
        input.periodEnd,
        input.asOf,
        input.value,
        input.currency,
        input.dataQuality,
        JSON.stringify(input.sourceProvenance),
        input.notes ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
      client,
    );
    return this.mapSnapshot(rows[0]!);
  }

  async listMetricSnapshots(filter?: {
    metricCode?: string;
    businessUnitId?: string;
    periodStart?: Date;
    periodEnd?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ items: MetricSnapshot[]; total: number }> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter?.metricCode) {
      params.push(filter.metricCode);
      clauses.push(`metric_code = $${params.length}`);
    }
    if (filter?.businessUnitId) {
      params.push(filter.businessUnitId);
      clauses.push(`business_unit_id = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS total FROM edge_p11_metric_snapshots ${where}`,
      params,
    );
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p11_metric_snapshots ${where}
       ORDER BY as_of DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapSnapshot(r)), total: num(countRows[0]?.total) };
  }

  async getLatestSnapshotsByCodes(
    metricCodes: string[],
    opts?: { businessUnitId?: string | null; asOf?: Date },
  ): Promise<MetricSnapshot[]> {
    if (metricCodes.length === 0) return [];
    const params: unknown[] = [metricCodes];
    let buClause = '';
    let asOfClause = '';
    if (opts?.businessUnitId) {
      params.push(opts.businessUnitId);
      buClause = `AND business_unit_id = $${params.length}`;
    }
    if (opts?.asOf) {
      params.push(opts.asOf);
      asOfClause = `AND as_of <= $${params.length}`;
    }
    const rows = await this.q(
      `SELECT DISTINCT ON (metric_code) *
       FROM edge_p11_metric_snapshots
       WHERE metric_code = ANY($1::text[]) ${buClause} ${asOfClause}
       ORDER BY metric_code, as_of DESC, created_at DESC`,
      params,
    );
    return rows.map((r) => this.mapSnapshot(r));
  }

  async getRevenueOverview(opts?: {
    businessUnitId?: string | null;
    metricCodes?: string[];
    asOf?: Date;
  }): Promise<RevenueOverview> {
    const codes = opts?.metricCodes?.length ? opts.metricCodes : [...CANONICAL_METRIC_CODES];
    const snaps = await this.getLatestSnapshotsByCodes(codes, {
      businessUnitId: opts?.businessUnitId,
      asOf: opts?.asOf,
    });
    const byCode = new Map(snaps.map((s) => [s.metricCode, s]));
    const metrics: RevenueOverviewMetric[] = codes.map((code) => {
      const snap = byCode.get(code);
      if (!snap) {
        return {
          metricCode: code,
          value: null,
          currency: null,
          dataQuality: 'UNAVAILABLE',
          definitionVersion: null,
          asOf: null,
          periodStart: null,
          periodEnd: null,
          sourceProvenance: null,
          note: 'No snapshot recorded — not fabricated as zero',
        };
      }
      return {
        metricCode: snap.metricCode,
        value: snap.value,
        currency: snap.currency,
        dataQuality: snap.dataQuality as RevenueOverviewMetric['dataQuality'],
        definitionVersion: snap.definitionVersion,
        asOf: snap.asOf.toISOString(),
        periodStart: snap.periodStart.toISOString(),
        periodEnd: snap.periodEnd.toISOString(),
        sourceProvenance: snap.sourceProvenance,
      };
    });
    const measured = metrics.filter((m) => m.dataQuality !== 'UNAVAILABLE').length;
    const availability =
      measured === 0 ? 'UNAVAILABLE' : measured === metrics.length ? 'AVAILABLE' : 'PARTIAL';
    return {
      availability,
      asOf: (opts?.asOf ?? new Date()).toISOString(),
      metrics,
      note:
        availability === 'UNAVAILABLE'
          ? 'No measured/estimated snapshots available — values not invented'
          : undefined,
    };
  }

  async createRevenueForecast(
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
  ): Promise<RevenueForecast> {
    const rows = await this.q(
      `INSERT INTO edge_p11_revenue_forecasts
        (code, name, business_unit_id, horizon_start, horizon_end, currency, assumptions, metadata, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)
       RETURNING *`,
      [
        input.code,
        input.name,
        input.businessUnitId ?? null,
        input.horizonStart,
        input.horizonEnd,
        input.currency,
        JSON.stringify(input.assumptions ?? {}),
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
      client,
    );
    return this.mapForecast(rows[0]!);
  }

  async getRevenueForecast(id: string): Promise<RevenueForecast | null> {
    const rows = await this.q(`SELECT * FROM edge_p11_revenue_forecasts WHERE id = $1`, [id]);
    return rows[0] ? this.mapForecast(rows[0]) : null;
  }

  async createForecastScenario(
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
  ): Promise<RevenueForecastScenario> {
    const rows = await this.q(
      `INSERT INTO edge_p11_revenue_forecast_scenarios
        (forecast_id, code, name, scenario_type, assumptions, metadata, created_by)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)
       RETURNING *`,
      [
        input.forecastId,
        input.code,
        input.name,
        input.scenarioType ?? 'BASE',
        JSON.stringify(input.assumptions ?? {}),
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
      client,
    );
    return this.mapScenario(rows[0]!);
  }

  async createLeakageCase(
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
  ): Promise<RevenueLeakageCase> {
    const rows = await this.q(
      `INSERT INTO edge_p11_revenue_leakage_cases
        (case_number, title, description, business_unit_id, revenue_stream_id,
         subscription_ref_id, invoice_ref_id, detected_amount, currency, data_quality,
         detection_source, source_provenance, assigned_to, metadata, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14::jsonb,$15)
       RETURNING *`,
      [
        input.caseNumber?.trim() || caseNumber(),
        input.title,
        input.description ?? null,
        input.businessUnitId ?? null,
        input.revenueStreamId ?? null,
        input.subscriptionRefId ?? null,
        input.invoiceRefId ?? null,
        input.detectedAmount ?? null,
        input.currency ?? null,
        input.dataQuality ?? 'ESTIMATED',
        input.detectionSource,
        JSON.stringify(input.sourceProvenance ?? {}),
        input.assignedTo ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
      client,
    );
    return this.mapLeakage(rows[0]!);
  }

  async getLeakageCase(id: string): Promise<RevenueLeakageCase | null> {
    const rows = await this.q(`SELECT * FROM edge_p11_revenue_leakage_cases WHERE id = $1`, [id]);
    return rows[0] ? this.mapLeakage(rows[0]) : null;
  }

  async transitionLeakageCase(
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
  ): Promise<RevenueLeakageCase> {
    const bindParams: unknown[] = [
      id,
      toStatus,
      patch.updatedBy,
      patch.assignedTo ?? null,
      patch.resolutionNotes ?? null,
      patch.resolvedAt ?? null,
    ];
    let sql = `UPDATE edge_p11_revenue_leakage_cases
       SET status = $2,
           updated_by = $3,
           updated_at = NOW(),
           version = version + 1,
           assigned_to = COALESCE($4, assigned_to),
           resolution_notes = COALESCE($5, resolution_notes),
           resolved_at = COALESCE($6, resolved_at)
       WHERE id = $1`;
    if (patch.expectedVersion != null) {
      bindParams.push(patch.expectedVersion);
      sql += ` AND version = $7`;
    }
    sql += ' RETURNING *';
    const result = await this.q(sql, bindParams, client);
    if (!result[0]) {
      throw new DomainError(ErrorCode.CONFLICT, 'Leakage case update failed (version conflict?)');
    }
    return this.mapLeakage(result[0]);
  }

  async createCommissionPlan(
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
  ): Promise<{ plan: CommissionPlan; rules: CommissionRule[] }> {
    const planRows = await this.q(
      `INSERT INTO edge_p11_commission_plans
        (code, name, description, effective_from, effective_to, currency, metadata, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'ACTIVE')
       RETURNING *`,
      [
        input.code,
        input.name,
        input.description ?? null,
        input.effectiveFrom,
        input.effectiveTo ?? null,
        input.currency ?? 'USD',
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
      client,
    );
    const plan = this.mapPlan(planRows[0]!);
    const rules: CommissionRule[] = [];
    for (const rule of input.rules ?? []) {
      const ruleRows = await this.q(
        `INSERT INTO edge_p11_commission_rules
          (plan_id, code, name, rule_type, rate, definition, created_by)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
         RETURNING *`,
        [
          plan.id,
          rule.code,
          rule.name,
          rule.ruleType ?? 'PERCENT_OF_MRR',
          rule.rate ?? null,
          JSON.stringify(rule.definition ?? {}),
          input.createdBy,
        ],
        client,
      );
      rules.push(this.mapRule(ruleRows[0]!));
    }
    return { plan, rules };
  }

  async getCommissionPlan(id: string): Promise<CommissionPlan | null> {
    const rows = await this.q(`SELECT * FROM edge_p11_commission_plans WHERE id = $1`, [id]);
    return rows[0] ? this.mapPlan(rows[0]) : null;
  }

  async listCommissionRules(planId: string): Promise<CommissionRule[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p11_commission_rules WHERE plan_id = $1 ORDER BY code`,
      [planId],
    );
    return rows.map((r) => this.mapRule(r));
  }

  async createCommissionCalculation(
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
  ): Promise<CommissionCalculation> {
    const rows = await this.q(
      `INSERT INTO edge_p11_commission_calculations
        (plan_id, calculation_key, period_start, period_end, as_of, input_snapshot, result_snapshot,
         total_amount, currency, data_quality, definition_version, source_provenance, calculated_by, metadata, immutable, status)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12::jsonb,$13,$14::jsonb,TRUE,'CALCULATED')
       RETURNING *`,
      [
        input.planId,
        input.calculationKey,
        input.periodStart,
        input.periodEnd,
        input.asOf,
        JSON.stringify(input.inputSnapshot),
        JSON.stringify(input.resultSnapshot),
        input.totalAmount,
        input.currency,
        input.dataQuality,
        input.definitionVersion ?? 1,
        JSON.stringify(input.sourceProvenance),
        input.calculatedBy,
        JSON.stringify(input.metadata ?? {}),
      ],
      client,
    );
    return this.mapCalculation(rows[0]!);
  }

  async getCommissionCalculation(id: string): Promise<CommissionCalculation | null> {
    const rows = await this.q(`SELECT * FROM edge_p11_commission_calculations WHERE id = $1`, [
      id,
    ]);
    return rows[0] ? this.mapCalculation(rows[0]) : null;
  }

  async getCommissionCalculationByKey(
    calculationKey: string,
  ): Promise<CommissionCalculation | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p11_commission_calculations WHERE calculation_key = $1`,
      [calculationKey],
    );
    return rows[0] ? this.mapCalculation(rows[0]) : null;
  }

  async approveCommissionCalculation(
    id: string,
    input: {
      decidedBy: string;
      notes?: string | null;
      metadata?: Record<string, unknown>;
      expectedVersion?: number;
    },
    client?: unknown,
  ): Promise<{ calculation: CommissionCalculation; approval: CommissionApproval }> {
    const bindParams: unknown[] = [id, input.decidedBy];
    let sql = `UPDATE edge_p11_commission_calculations
       SET status = 'APPROVED',
           updated_at = NOW(),
           version = version + 1
       WHERE id = $1
         AND status IN ('CALCULATED', 'PENDING_APPROVAL')
         AND immutable = TRUE`;
    if (input.expectedVersion != null) {
      bindParams.push(input.expectedVersion);
      sql += ` AND version = $${bindParams.length}`;
    }
    sql += ' RETURNING *';
    const calcRows = await this.q(sql, bindParams, client);
    if (!calcRows[0]) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'Commission calculation cannot be approved (status/version conflict)',
      );
    }
    const approvalRows = await this.q(
      `INSERT INTO edge_p11_commission_approvals
        (calculation_id, decision, decided_by, notes, metadata)
       VALUES ($1,'APPROVED',$2,$3,$4::jsonb)
       RETURNING *`,
      [
        id,
        input.decidedBy,
        input.notes ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
      client,
    );
    return {
      calculation: this.mapCalculation(calcRows[0]),
      approval: this.mapCommissionApproval(approvalRows[0]!),
    };
  }

  async createRevenueCohort(
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
  ): Promise<RevenueCohort> {
    const month =
      input.cohortMonth instanceof Date
        ? input.cohortMonth.toISOString().slice(0, 10)
        : String(input.cohortMonth).slice(0, 10);
    const rows = await this.q(
      `INSERT INTO edge_p11_revenue_cohorts
        (code, name, cohort_month, business_unit_id, definition, metadata, created_by)
       VALUES ($1,$2,$3::date,$4,$5::jsonb,$6::jsonb,$7)
       RETURNING *`,
      [
        input.code,
        input.name,
        month,
        input.businessUnitId ?? null,
        JSON.stringify(input.definition ?? {}),
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
      client,
    );
    return this.mapCohort(rows[0]!);
  }

  async getRevenueCohort(id: string): Promise<RevenueCohort | null> {
    const rows = await this.q(`SELECT * FROM edge_p11_revenue_cohorts WHERE id = $1`, [id]);
    return rows[0] ? this.mapCohort(rows[0]) : null;
  }

  async createRetentionSnapshot(
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
  ): Promise<RetentionSnapshot> {
    const rows = await this.q(
      `INSERT INTO edge_p11_retention_snapshots
        (cohort_id, period_start, period_end, as_of, metric_code, value, currency,
         data_quality, definition_version, source_provenance, metadata, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12)
       RETURNING *`,
      [
        input.cohortId,
        input.periodStart,
        input.periodEnd,
        input.asOf,
        input.metricCode,
        input.value,
        input.currency ?? 'USD',
        input.dataQuality,
        input.definitionVersion ?? 1,
        JSON.stringify(input.sourceProvenance),
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
      client,
    );
    return this.mapRetention(rows[0]!);
  }

  async listRetentionSnapshots(filter?: {
    cohortId?: string;
    metricCode?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: RetentionSnapshot[]; total: number }> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter?.cohortId) {
      params.push(filter.cohortId);
      clauses.push(`cohort_id = $${params.length}`);
    }
    if (filter?.metricCode) {
      params.push(filter.metricCode);
      clauses.push(`metric_code = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS total FROM edge_p11_retention_snapshots ${where}`,
      params,
    );
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p11_retention_snapshots ${where}
       ORDER BY as_of DESC, created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapRetention(r)), total: num(countRows[0]?.total) };
  }

  async getRetentionOverview(opts?: {
    cohortId?: string | null;
    asOf?: Date;
  }): Promise<RetentionOverview> {
    const codes = ['GRR', 'NRR'];
    const params: unknown[] = [codes];
    let clauses = `metric_code = ANY($1::text[])`;
    if (opts?.cohortId) {
      params.push(opts.cohortId);
      clauses += ` AND cohort_id = $${params.length}`;
    }
    if (opts?.asOf) {
      params.push(opts.asOf);
      clauses += ` AND as_of <= $${params.length}`;
    }
    const rows = await this.q(
      `SELECT DISTINCT ON (metric_code) *
       FROM edge_p11_retention_snapshots
       WHERE ${clauses}
       ORDER BY metric_code, as_of DESC, created_at DESC`,
      params,
    );
    const snaps = rows.map((r) => this.mapRetention(r));
    const byCode = new Map(snaps.map((s) => [s.metricCode, s]));

    const toMetric = (code: string): RevenueOverviewMetric | null => {
      const snap = byCode.get(code);
      if (!snap) {
        return {
          metricCode: code,
          value: null,
          currency: null,
          dataQuality: 'UNAVAILABLE',
          definitionVersion: null,
          asOf: null,
          periodStart: null,
          periodEnd: null,
          sourceProvenance: null,
          note: 'No retention snapshot — not fabricated',
        };
      }
      return {
        metricCode: snap.metricCode,
        value: snap.value,
        currency: snap.currency,
        dataQuality: snap.dataQuality as RevenueOverviewMetric['dataQuality'],
        definitionVersion: snap.definitionVersion,
        asOf: snap.asOf.toISOString(),
        periodStart: snap.periodStart.toISOString(),
        periodEnd: snap.periodEnd.toISOString(),
        sourceProvenance: snap.sourceProvenance,
      };
    };

    const grr = toMetric('GRR');
    const nrr = toMetric('NRR');
    const measured = [grr, nrr].filter((m) => m && m.dataQuality !== 'UNAVAILABLE').length;
    const availability =
      measured === 0 ? 'UNAVAILABLE' : measured === 2 ? 'AVAILABLE' : 'PARTIAL';

    return {
      availability,
      asOf: (opts?.asOf ?? new Date()).toISOString(),
      grr,
      nrr,
      snapshots: snaps,
      note:
        availability === 'UNAVAILABLE'
          ? 'No GRR/NRR retention snapshots — values not invented'
          : undefined,
    };
  }

  async createProductProfitabilitySnapshot(
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
  ): Promise<ProductProfitabilitySnapshot> {
    const rows = await this.q(
      `INSERT INTO edge_p11_product_profitability_snapshots
        (product_ref_id, commercial_plan_ref_id, business_unit_id, period_start, period_end, as_of,
         revenue_amount, cost_amount, margin_amount, currency, data_quality, definition_version,
         source_provenance, metadata, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15)
       RETURNING *`,
      [
        input.productRefId ?? null,
        input.commercialPlanRefId ?? null,
        input.businessUnitId ?? null,
        input.periodStart,
        input.periodEnd,
        input.asOf,
        input.revenueAmount,
        input.costAmount,
        input.marginAmount,
        input.currency,
        input.dataQuality,
        input.definitionVersion ?? 1,
        JSON.stringify(input.sourceProvenance),
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
      client,
    );
    return this.mapProductProfit(rows[0]!);
  }

  async appendBusinessAudit(
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
  ): Promise<BusinessAuditEvent> {
    const rows = await this.q(
      `INSERT INTO edge_p11_business_audit_events
        (event_type, aggregate_type, aggregate_id, actor_id, correlation_id, details, metadata)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)
       RETURNING *`,
      [
        input.eventType,
        input.aggregateType,
        input.aggregateId,
        input.actorId ?? null,
        input.correlationId ?? null,
        JSON.stringify(input.details ?? {}),
        JSON.stringify(input.metadata ?? {}),
      ],
      client,
    );
    return this.mapAudit(rows[0]!);
  }

  async listBusinessAudit(filter?: {
    aggregateType?: string;
    aggregateId?: string;
    eventType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: BusinessAuditEvent[]; total: number }> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter?.aggregateType) {
      params.push(filter.aggregateType);
      clauses.push(`aggregate_type = $${params.length}`);
    }
    if (filter?.aggregateId) {
      params.push(filter.aggregateId);
      clauses.push(`aggregate_id = $${params.length}`);
    }
    if (filter?.eventType) {
      params.push(filter.eventType);
      clauses.push(`event_type = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS total FROM edge_p11_business_audit_events ${where}`,
      params,
    );
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p11_business_audit_events ${where}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapAudit(r)), total: num(countRows[0]?.total) };
  }

  // --- Unit economics / targets / alerts / decisions / reports (mig 123) ---

  private mapUnitEconomics(row: Row): UnitEconomicsSnapshot {
    return {
      id: str(row.id),
      businessUnitId: strOrNull(row.business_unit_id),
      periodStart: asDate(row.period_start),
      periodEnd: asDate(row.period_end),
      asOf: asDate(row.as_of),
      currency: str(row.currency),
      cacValue: numOrNull(row.cac_value),
      cacDataQuality: str(row.cac_data_quality),
      ltvValue: numOrNull(row.ltv_value),
      ltvDataQuality: str(row.ltv_data_quality),
      ltvCacValue: numOrNull(row.ltv_cac_value),
      ltvCacDataQuality: str(row.ltv_cac_data_quality),
      paybackMonthsValue: numOrNull(row.payback_months_value),
      paybackMonthsDataQuality: str(row.payback_months_data_quality),
      inputSnapshot: asJson(row.input_snapshot, {}),
      definitionVersion: num(row.definition_version),
      sourceProvenance: asJson(row.source_provenance, {}),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
      version: num(row.version),
    };
  }

  private mapTarget(row: Row): RevenueTarget {
    return {
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      businessUnitId: strOrNull(row.business_unit_id),
      revenueStreamId: strOrNull(row.revenue_stream_id),
      metricCode: str(row.metric_code),
      periodStart: asDate(row.period_start),
      periodEnd: asDate(row.period_end),
      targetValue: num(row.target_value),
      currency: str(row.currency),
      status: str(row.status),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapAlertPolicy(row: Row): BusinessAlertPolicy {
    return {
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      description: strOrNull(row.description),
      metricCode: str(row.metric_code),
      businessUnitId: strOrNull(row.business_unit_id),
      comparator: str(row.comparator),
      thresholdValue: num(row.threshold_value),
      severity: str(row.severity),
      status: str(row.status),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapBusinessAlert(row: Row): BusinessAlert {
    return {
      id: str(row.id),
      code: str(row.code),
      title: str(row.title),
      policyId: strOrNull(row.policy_id),
      severity: str(row.severity),
      status: str(row.status),
      metricCode: strOrNull(row.metric_code),
      observedValue: numOrNull(row.observed_value),
      thresholdValue: numOrNull(row.threshold_value),
      businessUnitId: strOrNull(row.business_unit_id),
      asOf: asDate(row.as_of),
      dataQuality: str(row.data_quality),
      sourceProvenance: asJson(row.source_provenance, {}),
      acknowledgedBy: strOrNull(row.acknowledged_by),
      acknowledgedAt: asDateOrNull(row.acknowledged_at),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapDecision(row: Row): BusinessDecision {
    return {
      id: str(row.id),
      code: str(row.code),
      title: str(row.title),
      decisionType: str(row.decision_type),
      status: str(row.status),
      rationale: strOrNull(row.rationale),
      decidedBy: strOrNull(row.decided_by),
      decidedAt: asDateOrNull(row.decided_at),
      relatedReportId: strOrNull(row.related_report_id),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapBusinessReport(row: Row): BusinessReport {
    return {
      id: str(row.id),
      code: str(row.code),
      title: str(row.title),
      reportType: str(row.report_type),
      businessUnitId: strOrNull(row.business_unit_id),
      periodId: strOrNull(row.period_id),
      status: str(row.status),
      asOf: asDate(row.as_of),
      content: asJson(row.content, {}),
      dataQuality: str(row.data_quality),
      definitionVersion: num(row.definition_version),
      sourceProvenance: asJson(row.source_provenance, {}),
      immutable: bool(row.immutable ?? true),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  async createUnitEconomicsSnapshot(
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
  ): Promise<UnitEconomicsSnapshot> {
    const rows = await this.q(
      `INSERT INTO edge_revenue_unit_economics_snapshots
        (business_unit_id, period_start, period_end, as_of, currency,
         cac_value, cac_data_quality, ltv_value, ltv_data_quality,
         ltv_cac_value, ltv_cac_data_quality, payback_months_value, payback_months_data_quality,
         input_snapshot, definition_version, source_provenance, metadata, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16::jsonb,$17::jsonb,$18)
       RETURNING *`,
      [
        input.businessUnitId ?? null,
        input.periodStart,
        input.periodEnd,
        input.asOf,
        input.currency,
        input.cacValue,
        input.cacDataQuality,
        input.ltvValue,
        input.ltvDataQuality,
        input.ltvCacValue,
        input.ltvCacDataQuality,
        input.paybackMonthsValue,
        input.paybackMonthsDataQuality,
        JSON.stringify(input.inputSnapshot ?? {}),
        input.definitionVersion ?? 1,
        JSON.stringify(input.sourceProvenance),
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
      client,
    );
    return this.mapUnitEconomics(rows[0]!);
  }

  async createRevenueTarget(
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
  ): Promise<RevenueTarget> {
    const rows = await this.q(
      `INSERT INTO edge_p11_revenue_targets
        (code, name, business_unit_id, revenue_stream_id, metric_code,
         period_start, period_end, target_value, currency, metadata, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
       RETURNING *`,
      [
        input.code,
        input.name,
        input.businessUnitId ?? null,
        input.revenueStreamId ?? null,
        input.metricCode,
        input.periodStart,
        input.periodEnd,
        input.targetValue,
        input.currency,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
      client,
    );
    return this.mapTarget(rows[0]!);
  }

  async listRevenueTargets(
    filter?: ListFilter,
  ): Promise<{ items: RevenueTarget[]; total: number }> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      clauses.push(`status = $${params.length}`);
    }
    if (filter?.businessUnitId) {
      params.push(filter.businessUnitId);
      clauses.push(`business_unit_id = $${params.length}`);
    }
    if (filter?.metricCode) {
      params.push(filter.metricCode);
      clauses.push(`metric_code = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS total FROM edge_p11_revenue_targets ${where}`,
      params,
    );
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p11_revenue_targets ${where}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapTarget(r)), total: num(countRows[0]?.total) };
  }

  async createBusinessAlertPolicy(
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
  ): Promise<BusinessAlertPolicy> {
    const rows = await this.q(
      `INSERT INTO edge_revenue_business_alert_policies
        (code, name, description, metric_code, business_unit_id, comparator,
         threshold_value, severity, metadata, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
       RETURNING *`,
      [
        input.code,
        input.name,
        input.description ?? null,
        input.metricCode,
        input.businessUnitId ?? null,
        input.comparator ?? 'GT',
        input.thresholdValue,
        input.severity ?? 'MEDIUM',
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
      client,
    );
    return this.mapAlertPolicy(rows[0]!);
  }

  async getBusinessAlertPolicy(id: string): Promise<BusinessAlertPolicy | null> {
    const rows = await this.q(
      `SELECT * FROM edge_revenue_business_alert_policies WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapAlertPolicy(rows[0]) : null;
  }

  async createBusinessAlert(
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
  ): Promise<BusinessAlert> {
    const code =
      input.code?.trim() ||
      `ALT-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
    const rows = await this.q(
      `INSERT INTO edge_revenue_business_alerts
        (code, title, policy_id, severity, metric_code, observed_value, threshold_value,
         business_unit_id, as_of, data_quality, source_provenance, metadata, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13)
       RETURNING *`,
      [
        code,
        input.title,
        input.policyId ?? null,
        input.severity ?? 'MEDIUM',
        input.metricCode ?? null,
        input.observedValue ?? null,
        input.thresholdValue ?? null,
        input.businessUnitId ?? null,
        input.asOf,
        input.dataQuality ?? 'ESTIMATED',
        JSON.stringify(input.sourceProvenance ?? {}),
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
      client,
    );
    return this.mapBusinessAlert(rows[0]!);
  }

  async listBusinessAlerts(filter?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: BusinessAlert[]; total: number }> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      clauses.push(`status = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS total FROM edge_revenue_business_alerts ${where}`,
      params,
    );
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_revenue_business_alerts ${where}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapBusinessAlert(r)), total: num(countRows[0]?.total) };
  }

  async acknowledgeBusinessAlert(
    id: string,
    input: { acknowledgedBy: string; expectedVersion?: number },
    client?: unknown,
  ): Promise<BusinessAlert> {
    const params: unknown[] = [input.acknowledgedBy, id];
    let versionClause = '';
    if (input.expectedVersion != null) {
      params.push(input.expectedVersion);
      versionClause = ` AND version = $${params.length}`;
    }
    const rows = await this.q(
      `UPDATE edge_revenue_business_alerts
       SET status = 'ACKNOWLEDGED',
           acknowledged_by = $1,
           acknowledged_at = NOW(),
           updated_by = $1,
           updated_at = NOW(),
           version = version + 1
       WHERE id = $2${versionClause}
       RETURNING *`,
      params,
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Business alert not found or version conflict');
    }
    return this.mapBusinessAlert(rows[0]);
  }

  async createBusinessDecision(
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
  ): Promise<BusinessDecision> {
    const rows = await this.q(
      `INSERT INTO edge_revenue_business_decisions
        (code, title, decision_type, rationale, related_report_id, metadata, created_by)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
       RETURNING *`,
      [
        input.code,
        input.title,
        input.decisionType ?? 'OPERATIONAL',
        input.rationale ?? null,
        input.relatedReportId ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
      client,
    );
    return this.mapDecision(rows[0]!);
  }

  async listBusinessReports(
    filter?: ListFilter,
  ): Promise<{ items: BusinessReport[]; total: number }> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      clauses.push(`status = $${params.length}`);
    }
    if (filter?.businessUnitId) {
      params.push(filter.businessUnitId);
      clauses.push(`business_unit_id = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS total FROM edge_revenue_business_reports ${where}`,
      params,
    );
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_revenue_business_reports ${where}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      items: rows.map((r) => this.mapBusinessReport(r)),
      total: num(countRows[0]?.total),
    };
  }

  async generateBusinessReport(
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
  ): Promise<BusinessReport> {
    const rows = await this.q(
      `INSERT INTO edge_revenue_business_reports
        (code, title, report_type, business_unit_id, period_id, status, as_of,
         content, data_quality, source_provenance, immutable, metadata, created_by)
       VALUES ($1,$2,$3,$4,$5,'GENERATED',$6,$7::jsonb,$8,$9::jsonb,TRUE,$10::jsonb,$11)
       RETURNING *`,
      [
        input.code,
        input.title,
        input.reportType ?? 'REVENUE_OVERVIEW',
        input.businessUnitId ?? null,
        input.periodId ?? null,
        input.asOf,
        JSON.stringify(input.content ?? {}),
        input.dataQuality ?? 'ESTIMATED',
        JSON.stringify(input.sourceProvenance ?? {}),
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
      client,
    );
    return this.mapBusinessReport(rows[0]!);
  }
}

import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import {
  computeMrrMovements,
  type NormalizedSubscriptionRevenueLine,
} from '../../domain/revenue-operations/mrr-calculator.js';
import type { AssuranceCaseDraft } from '../../domain/revenue-operations/revenue-assurance.js';
import {
  computeGrr,
  computeNrr,
} from '../../domain/revenue-operations/retention-calculator.js';
import {
  getMetricRegistryEntry,
  isCanonicalMetricCode,
} from '../../domain/revenue-operations/revenue-metric-registry.js';
import {
  assertForecastMutable,
  assertLeakageCaseTransition,
  assertMetricDefinitionPublishedForSnapshot,
  assertSeparationOfDuties,
} from '../../domain/revenue-operations/revenue-policy.js';
import {
  buildRevenueOutboxEvent,
  EDGE_P11_OUTBOX_TENANT,
  RevenueEventTypes,
} from '../../domain/revenue-operations/revenue.events.js';
import type {
  RevenueOperationsRepositoryPort,
  RevenueProjectionInputPort,
} from '../../domain/revenue-operations/revenue-repository.port.js';
import { CANONICAL_METRIC_CODES } from '../../domain/revenue-operations/revenue-metric-registry.js';
import type {
  RetentionOverview,
  RenewalIntelligenceOverview,
  RevenueOverview,
} from '../../domain/revenue-operations/revenue.types.js';
import {
  computeCac,
  computeLtv,
  computeLtvCac,
  computePaybackMonths,
} from '../../domain/revenue-operations/unit-economics-calculator.js';
import type { SubscriptionRepositoryPort } from '../../domain/ports/subscription-repository.port.js';
import { scoreRenewalRisk } from '../../domain/revenue-operations/renewal-intelligence.js';
import { normalizeToMonthlyMrr } from '../../domain/revenue-operations/mrr-calculator.js';

type OutboxEnqueue = (event: ReturnType<typeof buildRevenueOutboxEvent>) => Promise<unknown>;

async function withOutbox<T>(
  outbox: ControlPlaneOutboxTransactionService | undefined,
  fn: (client: unknown, enqueue: OutboxEnqueue) => Promise<T>,
): Promise<T> {
  if (!outbox) {
    const noopEnqueue: OutboxEnqueue = async () => undefined;
    return fn(undefined, noopEnqueue);
  }
  return outbox.runWithOutbox(EDGE_P11_OUTBOX_TENANT, async (client, enqueue) =>
    fn(client, enqueue as OutboxEnqueue),
  );
}

async function appendAudit(
  repo: RevenueOperationsRepositoryPort,
  input: {
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    actorId: string;
    correlationId?: string | null;
    details?: Record<string, unknown>;
  },
  client?: unknown,
): Promise<void> {
  await repo.appendBusinessAudit(
    {
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      actorId: input.actorId,
      correlationId: input.correlationId ?? null,
      details: input.details ?? {},
    },
    client,
  );
}

// ---------------------------------------------------------------------------
// Metric definitions
// ---------------------------------------------------------------------------

export class RegisterMetricDefinitionUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name?: string;
    description?: string;
    formula?: string;
    sources?: unknown[];
    currencyTreatment?: string;
    timeBasis?: string;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    const code = input.code?.trim().toUpperCase();
    if (!code) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'code required');
    }
    const registry = isCanonicalMetricCode(code) ? getMetricRegistryEntry(code) : null;
    const name = (input.name?.trim() || registry?.name || code).trim();
    const description = (input.description?.trim() || registry?.definition || '').trim();
    const formula = (input.formula?.trim() || registry?.formula || '').trim();
    if (!description || !formula) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'description and formula required (or use a canonical metric code)',
      );
    }
    const existing = await this.repo.getMetricDefinitionByCode(code);
    if (existing) {
      throw new DomainError(ErrorCode.CONFLICT, `Metric definition ${code} already exists`);
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const definition = await this.repo.createMetricDefinition(
        {
          code,
          name,
          description,
          formula,
          sources: input.sources ?? registry?.sources ?? [],
          currencyTreatment: input.currencyTreatment ?? registry?.currencyTreatment ?? 'NATIVE',
          timeBasis: input.timeBasis ?? registry?.timeBasis ?? 'PERIOD_END',
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.METRIC_DEFINITION_REGISTERED,
          aggregateId: definition.id,
          correlationId,
          actorId: input.actorId,
          payload: { code: definition.code, status: definition.status },
        }),
      );
      await appendAudit(
        this.repo,
        {
          eventType: RevenueEventTypes.METRIC_DEFINITION_REGISTERED,
          aggregateType: 'METRIC_DEFINITION',
          aggregateId: definition.id,
          actorId: input.actorId,
          correlationId,
          details: { code: definition.code },
        },
        client,
      );
      return definition;
    });
  }
}

export class PublishMetricDefinitionUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: { actorId: string; definitionId: string; correlationId?: string | null }) {
    const current = await this.repo.getMetricDefinitionById(input.definitionId);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Metric definition not found');
    if (String(current.status).toUpperCase() === 'DEPRECATED') {
      throw new DomainError(ErrorCode.CONFLICT, 'Cannot publish DEPRECATED metric definition');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const result = await this.repo.publishMetricDefinition(
        input.definitionId,
        input.actorId,
        client,
      );
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.METRIC_DEFINITION_PUBLISHED,
          aggregateId: result.definition.id,
          correlationId,
          actorId: input.actorId,
          payload: {
            code: result.definition.code,
            versionNumber: result.version.versionNumber,
          },
        }),
      );
      await appendAudit(
        this.repo,
        {
          eventType: RevenueEventTypes.METRIC_DEFINITION_PUBLISHED,
          aggregateType: 'METRIC_DEFINITION',
          aggregateId: result.definition.id,
          actorId: input.actorId,
          correlationId,
          details: { versionNumber: result.version.versionNumber },
        },
        client,
      );
      return result;
    });
  }
}

export class ListMetricDefinitionsUseCase {
  constructor(private readonly repo: RevenueOperationsRepositoryPort) {}

  execute(filter?: { status?: string; limit?: number; offset?: number }) {
    return this.repo.listMetricDefinitions(filter);
  }
}

export class RecordMetricSnapshotUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    metricCode: string;
    periodStart: Date | string;
    periodEnd: Date | string;
    asOf: Date | string;
    value: number | null;
    currency: string;
    dataQuality: string;
    sourceProvenance: Record<string, unknown>;
    businessUnitId?: string | null;
    revenueStreamId?: string | null;
    notes?: string | null;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    const code = input.metricCode?.trim().toUpperCase();
    if (!code) throw new DomainError(ErrorCode.VALIDATION_ERROR, 'metricCode required');
    if (!input.currency?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'currency required');
    }
    if (!input.sourceProvenance || typeof input.sourceProvenance !== 'object') {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'sourceProvenance required');
    }
    const quality = String(input.dataQuality).toUpperCase();
    if (!['MEASURED', 'ESTIMATED', 'UNAVAILABLE'].includes(quality)) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'dataQuality must be MEASURED|ESTIMATED|UNAVAILABLE');
    }
    if (quality === 'UNAVAILABLE' && input.value != null) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'UNAVAILABLE snapshots must have null value (no fabricated amounts)',
      );
    }
    if (quality !== 'UNAVAILABLE' && (input.value == null || Number.isNaN(Number(input.value)))) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'MEASURED/ESTIMATED snapshots require a numeric value',
      );
    }

    const definition = await this.repo.getMetricDefinitionByCode(code);
    if (!definition) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, `Metric definition ${code} not found`);
    }
    assertMetricDefinitionPublishedForSnapshot(definition.status);

    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const snap = await this.repo.recordMetricSnapshot(
        {
          metricCode: code,
          definitionVersion: definition.version,
          definitionVersionId: definition.currentPublishedVersionId,
          businessUnitId: input.businessUnitId ?? null,
          revenueStreamId: input.revenueStreamId ?? null,
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
          asOf: new Date(input.asOf),
          value: quality === 'UNAVAILABLE' ? null : Number(input.value),
          currency: input.currency.trim().toUpperCase(),
          dataQuality: quality,
          sourceProvenance: input.sourceProvenance,
          notes: input.notes ?? null,
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.METRIC_SNAPSHOT_RECORDED,
          aggregateId: snap.id,
          correlationId,
          actorId: input.actorId,
          payload: {
            metricCode: snap.metricCode,
            dataQuality: snap.dataQuality,
            definitionVersion: snap.definitionVersion,
          },
        }),
      );
      await appendAudit(
        this.repo,
        {
          eventType: RevenueEventTypes.METRIC_SNAPSHOT_RECORDED,
          aggregateType: 'METRIC_SNAPSHOT',
          aggregateId: snap.id,
          actorId: input.actorId,
          correlationId,
          details: { metricCode: snap.metricCode, dataQuality: snap.dataQuality },
        },
        client,
      );
      return snap;
    });
  }
}

export class GetRevenueOverviewUseCase {
  constructor(private readonly repo: RevenueOperationsRepositoryPort) {}

  /**
   * Reads stored snapshots only — never fabricates financial amounts.
   * Missing metrics surface as UNAVAILABLE.
   */
  async execute(input?: {
    businessUnitId?: string | null;
    metricCodes?: string[];
    asOf?: Date | string;
  }): Promise<RevenueOverview> {
    return this.repo.getRevenueOverview({
      businessUnitId: input?.businessUnitId ?? null,
      metricCodes: input?.metricCodes ?? [...CANONICAL_METRIC_CODES],
      asOf: input?.asOf ? new Date(input.asOf) : undefined,
    });
  }
}

export class ComputeMrrMovementUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly projection?: RevenueProjectionInputPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    periodStart: Date | string;
    periodEnd: Date | string;
    currency?: string;
    businessUnitId?: string | null;
    lines?: NormalizedSubscriptionRevenueLine[];
    excludeFreeTrials?: boolean;
    persistSnapshots?: boolean;
    correlationId?: string | null;
  }) {
    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    let lines = input.lines ?? [];
    if ((!lines || lines.length === 0) && this.projection) {
      lines = await this.projection.loadNormalizedSubscriptionRevenueLines({
        periodStart,
        periodEnd,
        currency: input.currency,
        businessUnitId: input.businessUnitId,
      });
    }
    const result = computeMrrMovements(lines, {
      excludeFreeTrials: input.excludeFreeTrials,
      currency: input.currency,
    });
    const correlationId = input.correlationId?.trim() || randomUUID();

    if (!input.persistSnapshots) {
      return { result, snapshots: [] as unknown[] };
    }

    const asOf = periodEnd;
    const provenance = {
      calculator: 'mrr-calculator',
      lineCount: lines.length,
      skippedLineCount: result.skippedLineCount,
      notes: result.notes,
    };
    const currency = result.currency ?? input.currency ?? 'USD';

    return withOutbox(this.outbox, async (client, enqueue) => {
      const pairs: Array<{ code: string; bucket: typeof result.mrrEnding }> = [
        { code: 'MRR_ENDING', bucket: result.mrrEnding },
        { code: 'MRR_NEW', bucket: result.mrrNew },
        { code: 'MRR_EXPANSION', bucket: result.mrrExpansion },
        { code: 'MRR_CONTRACTION', bucket: result.mrrContraction },
        { code: 'MRR_CHURNED', bucket: result.mrrChurned },
        { code: 'MRR_REACTIVATION', bucket: result.mrrReactivation },
        { code: 'MRR_NET_NEW', bucket: result.mrrNetNew },
        { code: 'ARR_ENDING', bucket: result.arrEnding },
      ];
      const snapshots = [];
      for (const { code, bucket } of pairs) {
        const def = await this.repo.getMetricDefinitionByCode(code);
        if (!def || String(def.status).toUpperCase() !== 'PUBLISHED') {
          continue;
        }
        const snap = await this.repo.recordMetricSnapshot(
          {
            metricCode: code,
            definitionVersion: def.version,
            definitionVersionId: def.currentPublishedVersionId,
            businessUnitId: input.businessUnitId ?? null,
            periodStart,
            periodEnd,
            asOf,
            value: bucket.amount,
            currency,
            dataQuality: bucket.dataQuality,
            sourceProvenance: provenance,
            createdBy: input.actorId,
          },
          client,
        );
        snapshots.push(snap);
      }
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.MRR_MOVEMENT_COMPUTED,
          aggregateId: randomUUID(),
          correlationId,
          actorId: input.actorId,
          payload: {
            currency: result.currency,
            mrrNetNew: result.mrrNetNew,
            snapshotCount: snapshots.length,
          },
        }),
      );
      return { result, snapshots };
    });
  }
}

// ---------------------------------------------------------------------------
// Forecasts
// ---------------------------------------------------------------------------

export class CreateRevenueForecastUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    businessUnitId?: string | null;
    horizonStart: Date | string;
    horizonEnd: Date | string;
    currency: string;
    assumptions?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.code?.trim() || !input.name?.trim() || !input.currency?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'code, name, currency required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const forecast = await this.repo.createRevenueForecast(
        {
          code: input.code.trim(),
          name: input.name.trim(),
          businessUnitId: input.businessUnitId ?? null,
          horizonStart: new Date(input.horizonStart),
          horizonEnd: new Date(input.horizonEnd),
          currency: input.currency.trim().toUpperCase(),
          assumptions: input.assumptions ?? {},
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.FORECAST_CREATED,
          aggregateId: forecast.id,
          correlationId,
          actorId: input.actorId,
          payload: { code: forecast.code, status: forecast.status },
        }),
      );
      await appendAudit(
        this.repo,
        {
          eventType: RevenueEventTypes.FORECAST_CREATED,
          aggregateType: 'REVENUE_FORECAST',
          aggregateId: forecast.id,
          actorId: input.actorId,
          correlationId,
          details: { code: forecast.code },
        },
        client,
      );
      return forecast;
    });
  }
}

export class CreateForecastScenarioUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    forecastId: string;
    code: string;
    name: string;
    scenarioType?: string;
    assumptions?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    const forecast = await this.repo.getRevenueForecast(input.forecastId);
    if (!forecast) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Forecast not found');
    assertForecastMutable(forecast.status, forecast.immutableAfterPublish);
    if (!input.code?.trim() || !input.name?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'code and name required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const scenario = await this.repo.createForecastScenario(
        {
          forecastId: input.forecastId,
          code: input.code.trim(),
          name: input.name.trim(),
          scenarioType: input.scenarioType,
          assumptions: input.assumptions ?? {},
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.FORECAST_SCENARIO_CREATED,
          aggregateId: scenario.id,
          correlationId,
          actorId: input.actorId,
          payload: { forecastId: scenario.forecastId, code: scenario.code },
        }),
      );
      await appendAudit(
        this.repo,
        {
          eventType: RevenueEventTypes.FORECAST_SCENARIO_CREATED,
          aggregateType: 'FORECAST_SCENARIO',
          aggregateId: scenario.id,
          actorId: input.actorId,
          correlationId,
          details: { forecastId: scenario.forecastId },
        },
        client,
      );
      return scenario;
    });
  }
}

// ---------------------------------------------------------------------------
// Leakage
// ---------------------------------------------------------------------------

export class CreateLeakageCaseUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    title: string;
    detectionSource: string;
    description?: string | null;
    businessUnitId?: string | null;
    revenueStreamId?: string | null;
    subscriptionRefId?: string | null;
    invoiceRefId?: string | null;
    detectedAmount?: number | null;
    currency?: string | null;
    dataQuality?: string;
    sourceProvenance?: Record<string, unknown>;
    assignedTo?: string | null;
    caseNumber?: string;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.title?.trim() || !input.detectionSource?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'title and detectionSource required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const leakage = await this.repo.createLeakageCase(
        {
          caseNumber: input.caseNumber,
          title: input.title.trim(),
          description: input.description ?? null,
          businessUnitId: input.businessUnitId ?? null,
          revenueStreamId: input.revenueStreamId ?? null,
          subscriptionRefId: input.subscriptionRefId ?? null,
          invoiceRefId: input.invoiceRefId ?? null,
          detectedAmount: input.detectedAmount ?? null,
          currency: input.currency ?? null,
          dataQuality: input.dataQuality ?? 'ESTIMATED',
          detectionSource: input.detectionSource.trim(),
          sourceProvenance: input.sourceProvenance ?? {},
          assignedTo: input.assignedTo ?? null,
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.LEAKAGE_CASE_CREATED,
          aggregateId: leakage.id,
          correlationId,
          actorId: input.actorId,
          payload: { caseNumber: leakage.caseNumber, status: leakage.status },
        }),
      );
      await appendAudit(
        this.repo,
        {
          eventType: RevenueEventTypes.LEAKAGE_CASE_CREATED,
          aggregateType: 'LEAKAGE_CASE',
          aggregateId: leakage.id,
          actorId: input.actorId,
          correlationId,
          details: { caseNumber: leakage.caseNumber },
        },
        client,
      );
      return leakage;
    });
  }
}

export class TransitionLeakageCaseUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    caseId: string;
    toStatus: string;
    resolutionNotes?: string | null;
    assignedTo?: string | null;
    expectedVersion?: number;
    correlationId?: string | null;
  }) {
    const current = await this.repo.getLeakageCase(input.caseId);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Leakage case not found');
    const toStatus = input.toStatus.trim().toUpperCase();
    assertLeakageCaseTransition(String(current.status).toUpperCase(), toStatus);
    const terminal = ['RESOLVED', 'WRITTEN_OFF', 'FALSE_POSITIVE', 'CLOSED'].includes(toStatus);
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const updated = await this.repo.transitionLeakageCase(
        input.caseId,
        toStatus,
        {
          assignedTo: input.assignedTo,
          resolutionNotes: input.resolutionNotes,
          resolvedAt: terminal ? new Date() : null,
          expectedVersion: input.expectedVersion,
          updatedBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.LEAKAGE_CASE_TRANSITIONED,
          aggregateId: updated.id,
          correlationId,
          actorId: input.actorId,
          payload: { from: current.status, to: updated.status },
        }),
      );
      await appendAudit(
        this.repo,
        {
          eventType: RevenueEventTypes.LEAKAGE_CASE_TRANSITIONED,
          aggregateType: 'LEAKAGE_CASE',
          aggregateId: updated.id,
          actorId: input.actorId,
          correlationId,
          details: { from: current.status, to: updated.status },
        },
        client,
      );
      return updated;
    });
  }
}

// ---------------------------------------------------------------------------
// Commission
// ---------------------------------------------------------------------------

export class CreateCommissionPlanUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    effectiveFrom: Date | string;
    effectiveTo?: Date | string | null;
    currency?: string;
    metadata?: Record<string, unknown>;
    rules?: Array<{
      code: string;
      name: string;
      ruleType?: string;
      rate?: number | null;
      definition?: Record<string, unknown>;
    }>;
    correlationId?: string | null;
  }) {
    if (!input.code?.trim() || !input.name?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'code and name required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const created = await this.repo.createCommissionPlan(
        {
          code: input.code.trim(),
          name: input.name.trim(),
          description: input.description ?? null,
          effectiveFrom: new Date(input.effectiveFrom),
          effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
          currency: input.currency ?? 'USD',
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
          rules: input.rules,
        },
        client,
      );
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.COMMISSION_PLAN_CREATED,
          aggregateId: created.plan.id,
          correlationId,
          actorId: input.actorId,
          payload: { code: created.plan.code, ruleCount: created.rules.length },
        }),
      );
      await appendAudit(
        this.repo,
        {
          eventType: RevenueEventTypes.COMMISSION_PLAN_CREATED,
          aggregateType: 'COMMISSION_PLAN',
          aggregateId: created.plan.id,
          actorId: input.actorId,
          correlationId,
          details: { code: created.plan.code },
        },
        client,
      );
      return created;
    });
  }
}

export class CalculateCommissionUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  /**
   * Creates an immutable commission calculation snapshot.
   * Supports percentage rules (PERCENT_*) and fixed/FLAT amounts.
   * Re-calculation requires a new calculationKey — never mutates prior snapshots.
   */
  async execute(input: {
    actorId: string;
    planId: string;
    calculationKey: string;
    periodStart: Date | string;
    periodEnd: Date | string;
    asOf?: Date | string;
    /** Basis amount (e.g. measured MRR) — never invent; pass null + UNAVAILABLE if unknown */
    basisAmount: number | null;
    currency: string;
    dataQuality: string;
    sourceProvenance: Record<string, unknown>;
    definitionVersion?: number;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.calculationKey?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'calculationKey required');
    }
    const existing = await this.repo.getCommissionCalculationByKey(input.calculationKey.trim());
    if (existing) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'Commission calculation_key already exists (immutable); use a new key',
        [{ code: 'COMMISSION_CALCULATION_IMMUTABLE', calculationKey: input.calculationKey }],
      );
    }
    const plan = await this.repo.getCommissionPlan(input.planId);
    if (!plan) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Commission plan not found');
    const rules = await this.repo.listCommissionRules(input.planId);
    const quality = String(input.dataQuality).toUpperCase();
    if (!['MEASURED', 'ESTIMATED', 'UNAVAILABLE'].includes(quality)) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid dataQuality');
    }

    let totalAmount: number | null = null;
    const ruleResults: Array<Record<string, unknown>> = [];
    const activeRules = rules.filter((r) => String(r.status).toUpperCase() === 'ACTIVE');

    if (quality === 'UNAVAILABLE') {
      totalAmount = null;
    } else {
      let sum = 0;
      let needsBasis = false;
      for (const rule of activeRules) {
        const ruleType = String(rule.ruleType ?? '').toUpperCase();
        const isFixed =
          ruleType === 'FLAT' ||
          ruleType === 'FIXED' ||
          ruleType === 'FIXED_AMOUNT';
        const isPercent =
          ruleType.startsWith('PERCENT') ||
          ruleType === '' ||
          ruleType === 'PERCENT_OF_MRR' ||
          ruleType === 'PERCENT_OF_ARR';

        if (isFixed) {
          const fixedFromDef = Number(
            (rule.definition?.fixedAmount as number | undefined) ??
              (rule.definition?.amount as number | undefined),
          );
          const amount = Number.isFinite(fixedFromDef)
            ? fixedFromDef
            : rule.rate != null
              ? Number(rule.rate)
              : NaN;
          if (!Number.isFinite(amount)) {
            throw new DomainError(
              ErrorCode.VALIDATION_ERROR,
              `Fixed commission rule ${rule.code} requires rate or definition.fixedAmount`,
            );
          }
          sum += amount;
          ruleResults.push({
            ruleId: rule.id,
            ruleCode: rule.code,
            ruleType: rule.ruleType,
            mode: 'FIXED',
            rate: rule.rate,
            amount,
          });
        } else if (isPercent) {
          needsBasis = true;
          if (input.basisAmount == null) {
            ruleResults.push({
              ruleId: rule.id,
              ruleCode: rule.code,
              ruleType: rule.ruleType,
              mode: 'PERCENTAGE',
              rate: rule.rate,
              amount: null,
              note: 'basisAmount missing — percentage rule skipped',
            });
            continue;
          }
          const rate = rule.rate ?? 0;
          const amount = Number(input.basisAmount) * Number(rate);
          sum += amount;
          ruleResults.push({
            ruleId: rule.id,
            ruleCode: rule.code,
            ruleType: rule.ruleType,
            mode: 'PERCENTAGE',
            rate,
            amount,
          });
        } else {
          // TIERED / CUSTOM — require explicit definition.amount; never invent
          const customAmount = Number(rule.definition?.amount);
          if (!Number.isFinite(customAmount)) {
            ruleResults.push({
              ruleId: rule.id,
              ruleCode: rule.code,
              ruleType: rule.ruleType,
              mode: 'UNSUPPORTED',
              amount: null,
              note: 'TIERED/CUSTOM without definition.amount — skipped (not invented)',
            });
            continue;
          }
          sum += customAmount;
          ruleResults.push({
            ruleId: rule.id,
            ruleCode: rule.code,
            ruleType: rule.ruleType,
            mode: 'CUSTOM',
            amount: customAmount,
          });
        }
      }

      if (needsBasis && input.basisAmount == null && ruleResults.every((r) => r.amount == null)) {
        totalAmount = null;
      } else {
        totalAmount = Math.round(sum * 1e8) / 1e8;
      }
    }

    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const calc = await this.repo.createCommissionCalculation(
        {
          planId: input.planId,
          calculationKey: input.calculationKey.trim(),
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
          asOf: input.asOf ? new Date(input.asOf) : new Date(input.periodEnd),
          inputSnapshot: {
            basisAmount: input.basisAmount,
            ruleCount: rules.length,
          },
          resultSnapshot: { rules: ruleResults, totalAmount },
          totalAmount: quality === 'UNAVAILABLE' ? null : totalAmount,
          currency: input.currency.trim().toUpperCase(),
          dataQuality: quality === 'UNAVAILABLE' ? 'UNAVAILABLE' : quality,
          definitionVersion: input.definitionVersion ?? 1,
          sourceProvenance: input.sourceProvenance,
          calculatedBy: input.actorId,
          metadata: input.metadata ?? {},
        },
        client,
      );
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.COMMISSION_CALCULATED,
          aggregateId: calc.id,
          correlationId,
          actorId: input.actorId,
          payload: {
            calculationKey: calc.calculationKey,
            dataQuality: calc.dataQuality,
            immutable: calc.immutable,
          },
        }),
      );
      await appendAudit(
        this.repo,
        {
          eventType: RevenueEventTypes.COMMISSION_CALCULATED,
          aggregateType: 'COMMISSION_CALCULATION',
          aggregateId: calc.id,
          actorId: input.actorId,
          correlationId,
          details: { calculationKey: calc.calculationKey },
        },
        client,
      );
      return calc;
    });
  }
}

export class ApproveCommissionUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  /**
   * Approves an immutable calculation snapshot (status only — amounts never rewritten).
   * Enforces separation of duties vs calculatedBy.
   */
  async execute(input: {
    actorId: string;
    calculationId: string;
    notes?: string | null;
    expectedVersion?: number;
    correlationId?: string | null;
  }) {
    const current = await this.repo.getCommissionCalculation(input.calculationId);
    if (!current) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Commission calculation not found');
    }
    const status = String(current.status).toUpperCase();
    if (status === 'APPROVED') {
      throw new DomainError(ErrorCode.CONFLICT, 'Commission calculation already approved');
    }
    if (!['CALCULATED', 'PENDING_APPROVAL'].includes(status)) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        `Commission calculation status ${current.status} cannot be approved`,
      );
    }
    assertSeparationOfDuties(current.calculatedBy, input.actorId);

    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const result = await this.repo.approveCommissionCalculation(
        input.calculationId,
        {
          decidedBy: input.actorId,
          notes: input.notes ?? null,
          expectedVersion: input.expectedVersion,
        },
        client,
      );
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.COMMISSION_APPROVED,
          aggregateId: result.calculation.id,
          correlationId,
          actorId: input.actorId,
          payload: {
            calculationKey: result.calculation.calculationKey,
            status: result.calculation.status,
            approvalId: result.approval.id,
          },
        }),
      );
      await appendAudit(
        this.repo,
        {
          eventType: RevenueEventTypes.COMMISSION_APPROVED,
          aggregateType: 'COMMISSION_CALCULATION',
          aggregateId: result.calculation.id,
          actorId: input.actorId,
          correlationId,
          details: { approvalId: result.approval.id },
        },
        client,
      );
      return result;
    });
  }
}

// ---------------------------------------------------------------------------
// Retention
// ---------------------------------------------------------------------------

export class RecordRetentionSnapshotUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    cohortId: string;
    periodStart: Date | string;
    periodEnd: Date | string;
    asOf?: Date | string;
    startingMrr: number | null;
    contraction: number | null;
    churned: number | null;
    expansion: number | null;
    reactivation?: number | null;
    includeReactivationInNrr?: boolean;
    currency?: string;
    sourceProvenance?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    const cohort = await this.repo.getRevenueCohort(input.cohortId);
    if (!cohort) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Revenue cohort not found');

    const grr = computeGrr({
      startingMrr: input.startingMrr,
      contraction: input.contraction,
      churned: input.churned,
    });
    const nrr = computeNrr({
      startingMrr: input.startingMrr,
      expansion: input.expansion,
      contraction: input.contraction,
      churned: input.churned,
      reactivation: input.reactivation,
      includeReactivationInNrr: input.includeReactivationInNrr,
    });

    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    const asOf = input.asOf ? new Date(input.asOf) : periodEnd;
    const currency = (input.currency ?? 'USD').trim().toUpperCase();
    const provenance = {
      calculator: 'retention-calculator',
      inputs: {
        startingMrr: input.startingMrr,
        contraction: input.contraction,
        churned: input.churned,
        expansion: input.expansion,
        reactivation: input.reactivation ?? null,
        includeReactivationInNrr: input.includeReactivationInNrr !== false,
      },
      grrNotes: grr.notes,
      nrrNotes: nrr.notes,
      ...(input.sourceProvenance ?? {}),
    };
    const correlationId = input.correlationId?.trim() || randomUUID();

    return withOutbox(this.outbox, async (client, enqueue) => {
      const grrSnap = await this.repo.createRetentionSnapshot(
        {
          cohortId: input.cohortId,
          periodStart,
          periodEnd,
          asOf,
          metricCode: 'GRR',
          value: grr.grrPct,
          currency,
          dataQuality: grr.grrPct == null ? 'UNAVAILABLE' : 'MEASURED',
          sourceProvenance: { ...provenance, endingRetained: grr.endingRetained },
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
        },
        client,
      );
      const nrrSnap = await this.repo.createRetentionSnapshot(
        {
          cohortId: input.cohortId,
          periodStart,
          periodEnd,
          asOf,
          metricCode: 'NRR',
          value: nrr.nrrPct,
          currency,
          dataQuality: nrr.nrrPct == null ? 'UNAVAILABLE' : 'MEASURED',
          sourceProvenance: {
            ...provenance,
            ending: nrr.ending,
            reactivationIncluded: nrr.reactivationIncluded,
          },
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.RETENTION_SNAPSHOT_RECORDED,
          aggregateId: grrSnap.id,
          correlationId,
          actorId: input.actorId,
          payload: {
            cohortId: input.cohortId,
            grrPct: grr.grrPct,
            nrrPct: nrr.nrrPct,
            nrrSnapshotId: nrrSnap.id,
          },
        }),
      );
      await appendAudit(
        this.repo,
        {
          eventType: RevenueEventTypes.RETENTION_SNAPSHOT_RECORDED,
          aggregateType: 'RETENTION_SNAPSHOT',
          aggregateId: grrSnap.id,
          actorId: input.actorId,
          correlationId,
          details: { cohortId: input.cohortId, grrId: grrSnap.id, nrrId: nrrSnap.id },
        },
        client,
      );
      return { grr: grrSnap, nrr: nrrSnap, computed: { grr, nrr } };
    });
  }
}

export class GetRetentionOverviewUseCase {
  constructor(private readonly repo: RevenueOperationsRepositoryPort) {}

  execute(input?: {
    cohortId?: string | null;
    asOf?: Date | string;
  }): Promise<RetentionOverview> {
    return this.repo.getRetentionOverview({
      cohortId: input?.cohortId ?? null,
      asOf: input?.asOf ? new Date(input.asOf) : undefined,
    });
  }
}

// ---------------------------------------------------------------------------
// Product profitability
// ---------------------------------------------------------------------------

export class RecordProductProfitabilitySnapshotUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  /**
   * Revenue must be MEASURED. Costs may be ESTIMATED or UNAVAILABLE.
   * Contribution margin is null when costs are UNAVAILABLE.
   */
  async execute(input: {
    actorId: string;
    productRefId?: string | null;
    commercialPlanRefId?: string | null;
    businessUnitId?: string | null;
    periodStart: Date | string;
    periodEnd: Date | string;
    asOf?: Date | string;
    revenueAmount: number;
    revenueDataQuality?: string;
    costAmount?: number | null;
    costDataQuality: string;
    currency: string;
    sourceProvenance: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    const revenueQuality = String(input.revenueDataQuality ?? 'MEASURED').toUpperCase();
    if (revenueQuality !== 'MEASURED') {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Product profitability requires MEASURED revenue',
      );
    }
    if (input.revenueAmount == null || !Number.isFinite(Number(input.revenueAmount))) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'revenueAmount required (MEASURED)');
    }
    const costQuality = String(input.costDataQuality).toUpperCase();
    if (!['MEASURED', 'ESTIMATED', 'UNAVAILABLE'].includes(costQuality)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'costDataQuality must be MEASURED|ESTIMATED|UNAVAILABLE',
      );
    }
    if (costQuality !== 'UNAVAILABLE' && (input.costAmount == null || !Number.isFinite(Number(input.costAmount)))) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'costAmount required when costDataQuality is MEASURED or ESTIMATED',
      );
    }
    if (costQuality === 'UNAVAILABLE' && input.costAmount != null) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'UNAVAILABLE costs must have null costAmount (no fabricated costs)',
      );
    }

    const revenueAmount = Number(input.revenueAmount);
    const costAmount = costQuality === 'UNAVAILABLE' ? null : Number(input.costAmount);
    const marginAmount =
      costQuality === 'UNAVAILABLE' || costAmount == null
        ? null
        : Math.round((revenueAmount - costAmount) * 1e8) / 1e8;

    const rowQuality =
      costQuality === 'UNAVAILABLE'
        ? 'MEASURED'
        : costQuality === 'ESTIMATED'
          ? 'ESTIMATED'
          : 'MEASURED';

    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const snap = await this.repo.createProductProfitabilitySnapshot(
        {
          productRefId: input.productRefId ?? null,
          commercialPlanRefId: input.commercialPlanRefId ?? null,
          businessUnitId: input.businessUnitId ?? null,
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
          asOf: input.asOf ? new Date(input.asOf) : new Date(input.periodEnd),
          revenueAmount,
          costAmount,
          marginAmount,
          currency: input.currency.trim().toUpperCase(),
          dataQuality: rowQuality,
          sourceProvenance: {
            ...input.sourceProvenance,
            revenueDataQuality: revenueQuality,
            costDataQuality: costQuality,
            contributionMarginNullBecauseCostsUnavailable: costQuality === 'UNAVAILABLE',
          },
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.PRODUCT_PROFITABILITY_SNAPSHOT_RECORDED,
          aggregateId: snap.id,
          correlationId,
          actorId: input.actorId,
          payload: {
            productRefId: snap.productRefId,
            dataQuality: snap.dataQuality,
            marginAmount: snap.marginAmount,
            costDataQuality: costQuality,
          },
        }),
      );
      await appendAudit(
        this.repo,
        {
          eventType: RevenueEventTypes.PRODUCT_PROFITABILITY_SNAPSHOT_RECORDED,
          aggregateType: 'PRODUCT_PROFITABILITY_SNAPSHOT',
          aggregateId: snap.id,
          actorId: input.actorId,
          correlationId,
          details: { productRefId: snap.productRefId, costDataQuality: costQuality },
        },
        client,
      );
      return snap;
    });
  }
}

// ---------------------------------------------------------------------------
// Revenue assurance
// ---------------------------------------------------------------------------

export class RunAssuranceScanUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  /**
   * Accepts detector findings (from adapters or callers) and persists leakage cases.
   * Does not invent findings — empty input → empty created list.
   */
  async execute(input: {
    actorId: string;
    findings: AssuranceCaseDraft[];
    persist?: boolean;
    correlationId?: string | null;
  }) {
    const findings = (input.findings ?? []).filter(Boolean);
    const persist = input.persist !== false;
    const correlationId = input.correlationId?.trim() || randomUUID();

    if (!persist || findings.length === 0) {
      return {
        scanned: findings.length,
        created: [] as unknown[],
        skipped: findings.length === 0 ? 0 : findings.length,
        note:
          findings.length === 0
            ? 'No findings supplied — nothing invented'
            : 'persist=false — findings returned without creating cases',
        findings: persist ? undefined : findings,
      };
    }

    return withOutbox(this.outbox, async (client, enqueue) => {
      const created = [];
      for (const finding of findings) {
        const leakage = await this.repo.createLeakageCase(
          {
            title: finding.title,
            description: finding.description,
            subscriptionRefId: finding.subscriptionRefId,
            invoiceRefId: finding.invoiceRefId,
            detectedAmount: finding.detectedAmount,
            currency: finding.currency,
            dataQuality: finding.dataQuality,
            detectionSource: finding.detectionSource,
            sourceProvenance: {
              ...finding.sourceProvenance,
              confidence: finding.confidence,
            },
            metadata: { assuranceConfidence: finding.confidence },
            createdBy: input.actorId,
          },
          client,
        );
        created.push(leakage);
      }
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.ASSURANCE_SCAN_COMPLETED,
          aggregateId: randomUUID(),
          correlationId,
          actorId: input.actorId,
          payload: { findingCount: findings.length, createdCount: created.length },
        }),
      );
      await appendAudit(
        this.repo,
        {
          eventType: RevenueEventTypes.ASSURANCE_SCAN_COMPLETED,
          aggregateType: 'ASSURANCE_SCAN',
          aggregateId: correlationId,
          actorId: input.actorId,
          correlationId,
          details: { findingCount: findings.length, createdCount: created.length },
        },
        client,
      );
      return { scanned: findings.length, created, skipped: 0 };
    });
  }
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export class GetBusinessAuditUseCase {
  constructor(private readonly repo: RevenueOperationsRepositoryPort) {}

  execute(filter?: {
    aggregateType?: string;
    aggregateId?: string;
    eventType?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listBusinessAudit(filter);
  }
}

export class AppendBusinessAuditUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    details?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.eventType?.trim() || !input.aggregateType?.trim() || !input.aggregateId?.trim()) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'eventType, aggregateType, aggregateId required',
      );
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const event = await this.repo.appendBusinessAudit(
        {
          eventType: input.eventType.trim(),
          aggregateType: input.aggregateType.trim(),
          aggregateId: input.aggregateId.trim(),
          actorId: input.actorId,
          correlationId,
          details: input.details ?? {},
        },
        client,
      );
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.BUSINESS_AUDIT_APPENDED,
          aggregateId: event.id,
          correlationId,
          actorId: input.actorId,
          payload: {
            auditedEventType: event.eventType,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
          },
        }),
      );
      return event;
    });
  }
}

// ---------------------------------------------------------------------------
// Unit economics
// ---------------------------------------------------------------------------

export class RecordUnitEconomicsSnapshotUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  /**
   * Computes CAC/LTV/LTV:CAC/payback from supplied inputs — never invents costs.
   * Persists dedicated unit-economics snapshot (mig 123) and optionally mirrors
   * CAC/LTV/LTV_CAC into metric snapshots when published definitions exist.
   */
  async execute(input: {
    actorId: string;
    periodStart: Date | string;
    periodEnd: Date | string;
    asOf?: Date | string;
    currency: string;
    businessUnitId?: string | null;
    acquisitionSpend?: number | null;
    newCustomers?: number | null;
    avgRecurringRevenue?: number | null;
    grossMarginPct?: number | null;
    churnRate?: number | null;
    monthlyContribution?: number | null;
    mirrorMetricSnapshots?: boolean;
    sourceProvenance?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.currency?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'currency required');
    }

    const cac = computeCac({
      acquisitionSpend: input.acquisitionSpend,
      newCustomers: input.newCustomers,
    });
    const ltv = computeLtv({
      avgRecurringRevenue: input.avgRecurringRevenue,
      grossMarginPct: input.grossMarginPct,
      churnRate: input.churnRate,
    });
    const ltvCac = computeLtvCac({ ltv: ltv.value, cac: cac.value });
    const payback = computePaybackMonths({
      cac: cac.value,
      monthlyContribution: input.monthlyContribution,
    });

    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    const asOf = input.asOf ? new Date(input.asOf) : periodEnd;
    const currency = input.currency.trim().toUpperCase();
    const provenance = {
      calculator: 'unit-economics-calculator',
      cacNotes: cac.notes ?? [],
      ltvNotes: ltv.notes ?? [],
      ltvCacNotes: ltvCac.notes ?? [],
      paybackNotes: payback.notes ?? [],
      ...(input.sourceProvenance ?? {}),
    };
    const inputSnapshot = {
      acquisitionSpend: input.acquisitionSpend ?? null,
      newCustomers: input.newCustomers ?? null,
      avgRecurringRevenue: input.avgRecurringRevenue ?? null,
      grossMarginPct: input.grossMarginPct ?? null,
      churnRate: input.churnRate ?? null,
      monthlyContribution: input.monthlyContribution ?? null,
    };
    const correlationId = input.correlationId?.trim() || randomUUID();

    return withOutbox(this.outbox, async (client, enqueue) => {
      const snap = await this.repo.createUnitEconomicsSnapshot(
        {
          businessUnitId: input.businessUnitId ?? null,
          periodStart,
          periodEnd,
          asOf,
          currency,
          cacValue: cac.value,
          cacDataQuality: cac.dataQuality,
          ltvValue: ltv.value,
          ltvDataQuality: ltv.dataQuality,
          ltvCacValue: ltvCac.value,
          ltvCacDataQuality: ltvCac.dataQuality,
          paybackMonthsValue: payback.value,
          paybackMonthsDataQuality: payback.dataQuality,
          inputSnapshot,
          sourceProvenance: provenance,
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
        },
        client,
      );

      const mirrored: unknown[] = [];
      if (input.mirrorMetricSnapshots) {
        const pairs: Array<{ code: string; value: number | null; quality: string }> = [
          { code: 'CAC', value: cac.value, quality: cac.dataQuality },
          { code: 'LTV', value: ltv.value, quality: ltv.dataQuality },
          { code: 'LTV_CAC', value: ltvCac.value, quality: ltvCac.dataQuality },
        ];
        for (const { code, value, quality } of pairs) {
          const def = await this.repo.getMetricDefinitionByCode(code);
          if (!def || String(def.status).toUpperCase() !== 'PUBLISHED') continue;
          mirrored.push(
            await this.repo.recordMetricSnapshot(
              {
                metricCode: code,
                definitionVersion: def.version,
                definitionVersionId: def.currentPublishedVersionId,
                businessUnitId: input.businessUnitId ?? null,
                periodStart,
                periodEnd,
                asOf,
                value,
                currency,
                dataQuality: quality,
                sourceProvenance: provenance,
                createdBy: input.actorId,
              },
              client,
            ),
          );
        }
      }

      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.UNIT_ECONOMICS_SNAPSHOT_RECORDED,
          aggregateId: snap.id,
          correlationId,
          actorId: input.actorId,
          payload: {
            cacDataQuality: snap.cacDataQuality,
            ltvDataQuality: snap.ltvDataQuality,
            mirroredCount: mirrored.length,
          },
        }),
      );
      await appendAudit(
        this.repo,
        {
          eventType: RevenueEventTypes.UNIT_ECONOMICS_SNAPSHOT_RECORDED,
          aggregateType: 'UNIT_ECONOMICS_SNAPSHOT',
          aggregateId: snap.id,
          actorId: input.actorId,
          correlationId,
          details: { cac: cac.value, ltv: ltv.value },
        },
        client,
      );
      return { snapshot: snap, computed: { cac, ltv, ltvCac, payback }, mirrored };
    });
  }
}

// ---------------------------------------------------------------------------
// Renewal intelligence (read-only)
// ---------------------------------------------------------------------------

function extractAmount(snapshot: Record<string, unknown> | null | undefined): number | null {
  if (!snapshot) return null;
  for (const key of ['totalAmount', 'mrr', 'amount', 'total', 'recurringAmount']) {
    const v = snapshot[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

export class GetRenewalIntelligenceOverviewUseCase {
  constructor(private readonly subscriptions?: SubscriptionRepositoryPort) {}

  /**
   * Read-only overview of upcoming renewals from P5 SubscriptionRepositoryPort.
   * Never mutates subscriptions. Honest PARTIAL when renewalAt/MRR fields missing.
   */
  async execute(input?: {
    withinDays?: number;
    limit?: number;
  }): Promise<RenewalIntelligenceOverview> {
    const asOf = new Date();
    if (!this.subscriptions) {
      return {
        availability: 'UNAVAILABLE',
        asOf: asOf.toISOString(),
        items: [],
        note: 'SubscriptionRepositoryPort not wired — renewal intelligence UNAVAILABLE',
      };
    }

    const withinDays = input?.withinDays ?? 90;
    const limit = input?.limit ?? 100;
    const { items: subs } = await this.subscriptions.listSubscriptions({
      status: 'ACTIVE',
      limit: Math.min(limit, 500),
      offset: 0,
    });

    const items = [];
    let partialSignals = 0;

    for (const sub of subs) {
      const renewalAt = sub.renewalAt ?? sub.currentPeriodEnd ?? null;
      let daysToRenewal: number | null = null;
      if (renewalAt) {
        daysToRenewal = Math.ceil((renewalAt.getTime() - asOf.getTime()) / 86_400_000);
      } else {
        partialSignals += 1;
      }

      if (daysToRenewal != null && (daysToRenewal < 0 || daysToRenewal > withinDays)) {
        continue;
      }
      if (daysToRenewal == null && renewalAt == null) {
        // Include a sample of unknowns as PARTIAL only when within scan window intent
        // Skip completely undated unless caller wants all — keep overview focused
        continue;
      }

      const rawAmount = extractAmount(sub.commercialSnapshot);
      let mrrAtRisk: number | null = null;
      if (rawAmount != null) {
        const freq = String(sub.billingFrequency ?? 'MONTHLY').toUpperCase();
        const monthly = normalizeToMonthlyMrr(rawAmount, freq);
        mrrAtRisk = Number.isFinite(monthly) ? monthly : null;
      } else {
        partialSignals += 1;
      }

      const priorContraction =
        sub.metadata?.priorContraction === true
          ? true
          : sub.metadata?.priorContraction === false
            ? false
            : null;
      const delinquency =
        sub.metadata?.paymentDelinquencyFlag === true
          ? true
          : sub.metadata?.paymentDelinquencyFlag === false
            ? false
            : null;
      if (priorContraction == null) partialSignals += 1;
      if (delinquency == null) partialSignals += 1;

      const risk = scoreRenewalRisk({
        daysToRenewal,
        mrrAtRisk,
        priorContraction,
        paymentDelinquencyFlag: delinquency,
      });

      items.push({
        subscriptionRefId: sub.id,
        renewalAt: renewalAt?.toISOString() ?? null,
        daysToRenewal,
        mrrAtRisk,
        currency: sub.currency ?? null,
        score: risk.score,
        severity: risk.severity,
        reasons: risk.reasons,
        dataQuality: (mrrAtRisk == null || daysToRenewal == null
          ? 'ESTIMATED'
          : 'MEASURED') as 'MEASURED' | 'ESTIMATED' | 'UNAVAILABLE',
      });
    }

    items.sort((a, b) => b.score - a.score);

    const availability =
      items.length === 0
        ? 'UNAVAILABLE'
        : partialSignals > 0
          ? 'PARTIAL'
          : 'AVAILABLE';

    return {
      availability,
      asOf: asOf.toISOString(),
      items: items.slice(0, limit),
      note:
        availability === 'PARTIAL'
          ? 'Some renewalAt / MRR / contraction / delinquency fields missing — scored from known signals only'
          : availability === 'UNAVAILABLE'
            ? 'No upcoming renewals with renewalAt/currentPeriodEnd in window'
            : undefined,
    };
  }
}

// ---------------------------------------------------------------------------
// Business alerts
// ---------------------------------------------------------------------------

function thresholdBreached(
  comparator: string,
  observed: number,
  threshold: number,
): boolean {
  switch (String(comparator).toUpperCase()) {
    case 'GT':
      return observed > threshold;
    case 'GTE':
      return observed >= threshold;
    case 'LT':
      return observed < threshold;
    case 'LTE':
      return observed <= threshold;
    case 'EQ':
      return observed === threshold;
    default:
      return observed > threshold;
  }
}

export class CreateBusinessAlertPolicyUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    metricCode: string;
    businessUnitId?: string | null;
    comparator?: string;
    thresholdValue: number;
    severity?: string;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.code?.trim() || !input.name?.trim() || !input.metricCode?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'code, name, metricCode required');
    }
    if (input.thresholdValue == null || !Number.isFinite(Number(input.thresholdValue))) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'thresholdValue required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const policy = await this.repo.createBusinessAlertPolicy(
        {
          code: input.code.trim(),
          name: input.name.trim(),
          description: input.description ?? null,
          metricCode: input.metricCode.trim().toUpperCase(),
          businessUnitId: input.businessUnitId ?? null,
          comparator: input.comparator ?? 'GT',
          thresholdValue: Number(input.thresholdValue),
          severity: input.severity ?? 'MEDIUM',
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.BUSINESS_ALERT_POLICY_CREATED,
          aggregateId: policy.id,
          correlationId,
          actorId: input.actorId,
          payload: { code: policy.code, metricCode: policy.metricCode },
        }),
      );
      return policy;
    });
  }
}

export class EvaluateBusinessAlertUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  /**
   * Compares policy threshold vs a supplied snapshot value (or latest metric snapshot).
   * Creates an alert only when threshold is breached — never invents observed values.
   */
  async execute(input: {
    actorId: string;
    policyId: string;
    observedValue?: number | null;
    asOf?: Date | string;
    title?: string;
    correlationId?: string | null;
  }) {
    const policy = await this.repo.getBusinessAlertPolicy(input.policyId);
    if (!policy) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Alert policy not found');
    if (String(policy.status).toUpperCase() !== 'ACTIVE') {
      throw new DomainError(ErrorCode.CONFLICT, 'Alert policy is not ACTIVE');
    }

    let observed = input.observedValue;
    let dataQuality: string = 'MEASURED';
    if (observed == null || !Number.isFinite(Number(observed))) {
      const snaps = await this.repo.getLatestSnapshotsByCodes([policy.metricCode], {
        businessUnitId: policy.businessUnitId,
      });
      const snap = snaps[0];
      if (!snap || snap.value == null || String(snap.dataQuality).toUpperCase() === 'UNAVAILABLE') {
        return {
          breached: false,
          alert: null,
          note: 'No MEASURED/ESTIMATED snapshot value — alert not invented',
          observedValue: null,
          dataQuality: 'UNAVAILABLE' as const,
        };
      }
      observed = snap.value;
      dataQuality = String(snap.dataQuality);
    }

    const breached = thresholdBreached(policy.comparator, Number(observed), policy.thresholdValue);
    if (!breached) {
      return {
        breached: false,
        alert: null,
        note: 'Threshold not breached',
        observedValue: Number(observed),
        dataQuality,
      };
    }

    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const alert = await this.repo.createBusinessAlert(
        {
          title:
            input.title?.trim() ||
            `${policy.metricCode} ${policy.comparator} ${policy.thresholdValue}`,
          policyId: policy.id,
          severity: policy.severity,
          metricCode: policy.metricCode,
          observedValue: Number(observed),
          thresholdValue: policy.thresholdValue,
          businessUnitId: policy.businessUnitId,
          asOf: input.asOf ? new Date(input.asOf) : new Date(),
          dataQuality,
          sourceProvenance: {
            policyId: policy.id,
            comparator: policy.comparator,
            evaluator: 'EvaluateBusinessAlertUseCase',
          },
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.BUSINESS_ALERT_EVALUATED,
          aggregateId: alert.id,
          correlationId,
          actorId: input.actorId,
          payload: {
            policyId: policy.id,
            breached: true,
            observedValue: alert.observedValue,
          },
        }),
      );
      return { breached: true, alert, observedValue: Number(observed), dataQuality };
    });
  }
}

export class ListBusinessAlertsUseCase {
  constructor(private readonly repo: RevenueOperationsRepositoryPort) {}

  execute(filter?: { status?: string; limit?: number; offset?: number }) {
    return this.repo.listBusinessAlerts(filter);
  }
}

export class AcknowledgeBusinessAlertUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    alertId: string;
    expectedVersion?: number;
    correlationId?: string | null;
  }) {
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const alert = await this.repo.acknowledgeBusinessAlert(
        input.alertId,
        { acknowledgedBy: input.actorId, expectedVersion: input.expectedVersion },
        client,
      );
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.BUSINESS_ALERT_ACKNOWLEDGED,
          aggregateId: alert.id,
          correlationId,
          actorId: input.actorId,
          payload: { status: alert.status },
        }),
      );
      return alert;
    });
  }
}

// ---------------------------------------------------------------------------
// Targets / decisions / reports
// ---------------------------------------------------------------------------

export class CreateRevenueTargetUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    metricCode: string;
    periodStart: Date | string;
    periodEnd: Date | string;
    targetValue: number;
    currency: string;
    businessUnitId?: string | null;
    revenueStreamId?: string | null;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.code?.trim() || !input.name?.trim() || !input.metricCode?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'code, name, metricCode required');
    }
    if (!input.currency?.trim() || input.targetValue == null || !Number.isFinite(Number(input.targetValue))) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'currency and targetValue required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const target = await this.repo.createRevenueTarget(
        {
          code: input.code.trim(),
          name: input.name.trim(),
          businessUnitId: input.businessUnitId ?? null,
          revenueStreamId: input.revenueStreamId ?? null,
          metricCode: input.metricCode.trim().toUpperCase(),
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
          targetValue: Number(input.targetValue),
          currency: input.currency.trim().toUpperCase(),
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.REVENUE_TARGET_CREATED,
          aggregateId: target.id,
          correlationId,
          actorId: input.actorId,
          payload: { code: target.code, metricCode: target.metricCode },
        }),
      );
      return target;
    });
  }
}

export class ListRevenueTargetsUseCase {
  constructor(private readonly repo: RevenueOperationsRepositoryPort) {}

  execute(filter?: {
    status?: string;
    businessUnitId?: string;
    metricCode?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listRevenueTargets(filter);
  }
}

export class CreateBusinessDecisionUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    title: string;
    decisionType?: string;
    rationale?: string | null;
    relatedReportId?: string | null;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.code?.trim() || !input.title?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'code and title required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const decision = await this.repo.createBusinessDecision(
        {
          code: input.code.trim(),
          title: input.title.trim(),
          decisionType: input.decisionType,
          rationale: input.rationale ?? null,
          relatedReportId: input.relatedReportId ?? null,
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.BUSINESS_DECISION_RECORDED,
          aggregateId: decision.id,
          correlationId,
          actorId: input.actorId,
          payload: { code: decision.code },
        }),
      );
      return decision;
    });
  }
}

export class ListBusinessReportsUseCase {
  constructor(private readonly repo: RevenueOperationsRepositoryPort) {}

  execute(filter?: { status?: string; businessUnitId?: string; limit?: number; offset?: number }) {
    return this.repo.listBusinessReports(filter);
  }
}

export class GenerateBusinessReportUseCase {
  constructor(
    private readonly repo: RevenueOperationsRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  /**
   * Creates immutable report snapshot metadata only — does not fabricate financial body.
   */
  async execute(input: {
    actorId: string;
    code: string;
    title: string;
    reportType?: string;
    businessUnitId?: string | null;
    periodId?: string | null;
    asOf?: Date | string;
    content?: Record<string, unknown>;
    dataQuality?: string;
    sourceProvenance?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.code?.trim() || !input.title?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'code and title required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const report = await this.repo.generateBusinessReport(
        {
          code: input.code.trim(),
          title: input.title.trim(),
          reportType: input.reportType,
          businessUnitId: input.businessUnitId ?? null,
          periodId: input.periodId ?? null,
          asOf: input.asOf ? new Date(input.asOf) : new Date(),
          content: {
            kind: 'SNAPSHOT_METADATA',
            note: 'Immutable metadata only — financial figures must come from measured snapshots',
            ...(input.content ?? {}),
          },
          dataQuality: input.dataQuality ?? 'ESTIMATED',
          sourceProvenance: input.sourceProvenance ?? { generator: 'GenerateBusinessReportUseCase' },
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildRevenueOutboxEvent({
          eventType: RevenueEventTypes.BUSINESS_REPORT_GENERATED,
          aggregateId: report.id,
          correlationId,
          actorId: input.actorId,
          payload: { code: report.code, immutable: report.immutable },
        }),
      );
      return report;
    });
  }
}

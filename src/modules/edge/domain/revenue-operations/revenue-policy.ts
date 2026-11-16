import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { LeakageCaseStatus } from './revenue.types.js';

const LEAKAGE_TRANSITIONS: Record<string, readonly string[]> = {
  DETECTED: ['TRIAGED', 'FALSE_POSITIVE', 'CLOSED'],
  TRIAGED: ['INVESTIGATING', 'FALSE_POSITIVE', 'CLOSED'],
  INVESTIGATING: ['CONFIRMED', 'FALSE_POSITIVE', 'CLOSED'],
  CONFIRMED: ['REMEDIATING', 'WRITTEN_OFF', 'CLOSED'],
  REMEDIATING: ['RESOLVED', 'WRITTEN_OFF', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  WRITTEN_OFF: ['CLOSED'],
  FALSE_POSITIVE: ['CLOSED'],
  CLOSED: [],
};

export function assertLeakageCaseTransition(from: string, to: string): void {
  const allowed = LEAKAGE_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Leakage case transition ${from} → ${to} is not allowed`,
      [{ code: 'LEAKAGE_TRANSITION_FORBIDDEN', from, to }],
    );
  }
}

export function allowedLeakageTransitions(from: LeakageCaseStatus | string): readonly string[] {
  return LEAKAGE_TRANSITIONS[from] ?? [];
}

/** Published forecasts are immutable — no assumption/horizon edits. */
export function assertForecastMutable(status: string, immutableAfterPublish = true): void {
  const upper = String(status).toUpperCase();
  if (immutableAfterPublish && upper === 'PUBLISHED') {
    throw new DomainError(
      ErrorCode.CONFLICT,
      'Published revenue forecast is immutable',
      [{ code: 'FORECAST_IMMUTABLE_AFTER_PUBLISH', status }],
    );
  }
  if (upper === 'SUPERSEDED' || upper === 'ARCHIVED') {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Forecast in status ${status} cannot be modified`,
      [{ code: 'FORECAST_NOT_MUTABLE', status }],
    );
  }
}

/** Commission calculation snapshots are immutable once persisted as CALCULATED+. */
export function assertCommissionCalculationMutable(status: string, immutable: boolean): void {
  if (!immutable) return;
  const upper = String(status).toUpperCase();
  if (
    upper === 'CALCULATED' ||
    upper === 'PENDING_APPROVAL' ||
    upper === 'APPROVED' ||
    upper === 'REJECTED' ||
    upper === 'SUPERSEDED'
  ) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      'Commission calculation snapshot is immutable; create a new calculation_key instead',
      [{ code: 'COMMISSION_CALCULATION_IMMUTABLE', status }],
    );
  }
}

/** Snapshots may only be recorded against PUBLISHED metric definitions. */
export function assertMetricDefinitionPublishedForSnapshot(status: string): void {
  if (String(status).toUpperCase() !== 'PUBLISHED') {
    throw new DomainError(
      ErrorCode.CONFLICT,
      'Metric snapshot requires a PUBLISHED metric definition',
      [{ code: 'METRIC_DEFINITION_NOT_PUBLISHED', status }],
    );
  }
}

export function assertSeparationOfDuties(requesterId: string, approverId: string): void {
  if (requesterId.trim().toLowerCase() === approverId.trim().toLowerCase()) {
    throw new DomainError(
      ErrorCode.FORBIDDEN,
      'Separation of duties: actor cannot approve their own request',
      [{ code: 'SELF_APPROVAL_FORBIDDEN' }],
    );
  }
}

const ENGINE_GATED_CASH_METRICS = new Set([
  'INVOICED_REVENUE',
  'COLLECTED_REVENUE',
  'RECEIVABLES',
]);

/**
 * COLLECTED / INVOICED / RECEIVABLES snapshots must carry engine provenance
 * (F-P11-001) — blocks executive misuse of injected MEASURED cash without P6 lineage.
 */
export function assertCashMetricSnapshotProvenance(
  metricCode: string,
  sourceProvenance: Record<string, unknown>,
): void {
  const code = String(metricCode ?? '').trim().toUpperCase();
  if (!ENGINE_GATED_CASH_METRICS.has(code)) return;

  const source = String(sourceProvenance?.source ?? '').trim().toLowerCase();
  const calculator = String(sourceProvenance?.calculator ?? '').trim().toLowerCase();
  const engineOk =
    source === 'engine' || calculator === 'cash-revenue-calculator';

  if (!engineOk) {
    throw new DomainError(
      ErrorCode.FORBIDDEN,
      `${code} snapshots require sourceProvenance.source=engine (use POST /edge/revenue/cash/compute)`,
      [
        {
          code: 'CASH_METRIC_ENGINE_PROVENANCE_REQUIRED',
          metricCode: code,
        },
      ],
    );
  }
}

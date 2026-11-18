import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  findAhaMomentDefinition,
  listAhaMomentsForSegment,
  type AhaProductSegment,
} from './aha-moments.js';

/**
 * RGOM-E9 — BB → Edge adoption / Aha event ingestion (fail-closed on unknown codes).
 */

export type AdoptionEventSource = 'BB' | 'EDGE_OPS' | 'MANUAL';

export type AdoptionEventRecord = {
  readonly id: string;
  readonly subscriptionId: string;
  readonly productTenantRef: string | null;
  readonly eventCode: string;
  readonly productSegment: AhaProductSegment;
  readonly occurredAt: Date;
  readonly source: AdoptionEventSource;
  readonly correlationId: string | null;
  readonly payload: Record<string, unknown>;
  readonly createdAt: Date;
};

export type IngestAdoptionEventInput = {
  readonly subscriptionId: string;
  readonly productTenantRef?: string | null;
  readonly eventCode: string;
  readonly occurredAt?: Date | string | null;
  readonly source?: AdoptionEventSource;
  readonly correlationId?: string | null;
  readonly payload?: Record<string, unknown>;
};

export function assertIngestableAdoptionEvent(input: IngestAdoptionEventInput): {
  eventCode: string;
  productSegment: AhaProductSegment;
  occurredAt: Date;
  source: AdoptionEventSource;
} {
  const code = String(input.eventCode ?? '').trim();
  if (!code) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'eventCode is required');
  }
  const def = findAhaMomentDefinition(code);
  if (!def) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Unknown adoption/Aha eventCode: ${code}`,
    );
  }
  if (!input.subscriptionId?.trim()) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'subscriptionId is required');
  }
  const occurredAt =
    input.occurredAt == null
      ? new Date()
      : input.occurredAt instanceof Date
        ? input.occurredAt
        : new Date(input.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'occurredAt is invalid');
  }
  const source = input.source ?? 'BB';
  if (source !== 'BB' && source !== 'EDGE_OPS' && source !== 'MANUAL') {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, `Invalid adoption event source: ${source}`);
  }
  return {
    eventCode: code,
    productSegment: def.productSegment,
    occurredAt,
    source,
  };
}

export type AhaCompletionSnapshot = {
  readonly segment: AhaProductSegment;
  readonly requiredCodes: readonly string[];
  readonly completedCodes: readonly string[];
  readonly completionPct: number;
  readonly dataQuality: 'MEASURED' | 'UNAVAILABLE';
  readonly note: string;
};

export function computeAhaCompletion(
  segment: AhaProductSegment,
  events: readonly Pick<AdoptionEventRecord, 'eventCode'>[],
): AhaCompletionSnapshot {
  const required = listAhaMomentsForSegment(segment).map((m) => m.code);
  if (required.length === 0) {
    return {
      segment,
      requiredCodes: [],
      completedCodes: [],
      completionPct: 0,
      dataQuality: 'UNAVAILABLE',
      note: 'No Aha definitions for segment',
    };
  }
  const seen = new Set(events.map((e) => e.eventCode));
  const completed = required.filter((c) => seen.has(c));
  return {
    segment,
    requiredCodes: required,
    completedCodes: completed,
    completionPct: Math.round((completed.length / required.length) * 1000) / 10,
    dataQuality: 'MEASURED',
    note:
      events.length === 0
        ? 'No adoption events ingested yet — completion 0% is MEASURED empty, not UNAVAILABLE.'
        : `${completed.length}/${required.length} beachhead Aha moments observed.`,
  };
}

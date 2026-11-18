import {
  assertIngestableAdoptionEvent,
  computeAhaCompletion,
  type IngestAdoptionEventInput,
} from '../../domain/customer-success/adoption-events.js';
import { listAhaMomentsForSegment, type AhaProductSegment } from '../../domain/customer-success/aha-moments.js';
import { computeCustomerHealthScore } from '../../domain/customer-success/customer-health-score.js';
import { computeChurnRisk } from '../../domain/customer-success/churn-risk.js';
import {
  buildExpansionRecommendation,
  type ExpansionSignalInput,
} from '../../domain/customer-success/expansion-signals.js';
import type { CustomerSuccessRepositoryPort } from '../../domain/ports/customer-success-repository.port.js';

export class ListAhaMomentsUseCase {
  execute(segment?: AhaProductSegment) {
    const seg = segment ?? 'RETAIL_PHARMACY';
    return {
      data: {
        segment: seg,
        moments: listAhaMomentsForSegment(seg),
      },
    };
  }
}

export class ComputeCustomerHealthScoreUseCase {
  execute(input: {
    adoptionScore?: number | null;
    ahaCompletionPct?: number | null;
    supportLoadInverseScore?: number | null;
    paymentHealthScore?: number | null;
    delinquent?: boolean;
    suspended?: boolean;
  }) {
    return { data: computeCustomerHealthScore(input) };
  }
}

export class IngestAdoptionEventUseCase {
  constructor(private readonly cs: CustomerSuccessRepositoryPort) {}

  async execute(input: IngestAdoptionEventInput) {
    const normalized = assertIngestableAdoptionEvent(input);
    const event = await this.cs.insertAdoptionEvent({
      subscriptionId: input.subscriptionId,
      productTenantRef: input.productTenantRef ?? null,
      eventCode: normalized.eventCode,
      productSegment: normalized.productSegment,
      occurredAt: normalized.occurredAt,
      source: normalized.source,
      correlationId: input.correlationId ?? null,
      payload: input.payload ?? {},
    });
    return { data: event };
  }
}

export class ListAdoptionEventsUseCase {
  constructor(private readonly cs: CustomerSuccessRepositoryPort) {}

  async execute(input: {
    subscriptionId: string;
    segment?: AhaProductSegment;
    limit?: number;
  }) {
    const events = await this.cs.listAdoptionEvents({
      subscriptionId: input.subscriptionId,
      limit: input.limit,
    });
    const segment =
      input.segment ??
      events[0]?.productSegment ??
      ('RETAIL_PHARMACY' as AhaProductSegment);
    const completion = computeAhaCompletion(segment, events);
    return {
      data: {
        subscriptionId: input.subscriptionId,
        events,
        ahaCompletion: completion,
      },
    };
  }
}

export class EvaluateExpansionSignalsUseCase {
  execute(input: { signals: ExpansionSignalInput[] }) {
    return { data: buildExpansionRecommendation(input.signals ?? []) };
  }
}

export class ComputeChurnRiskUseCase {
  execute(input: {
    healthBand?: 'HIGH' | 'MID' | 'LOW' | 'UNKNOWN' | null;
    healthScore?: number | null;
    delinquent?: boolean | null;
    suspended?: boolean | null;
    daysToRenewal?: number | null;
    ahaCompletionPct?: number | null;
  }) {
    return { data: computeChurnRisk(input) };
  }
}

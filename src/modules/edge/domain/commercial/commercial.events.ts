import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';

/** Control-plane sentinel for Edge commercial outbox routing (not a tenant DB). */
export const EDGE_COMMERCIAL_OUTBOX_TENANT = 'edge-control-plane';

export type CommercialOfferPublishedPayload = {
  readonly offerType: string;
  readonly offerId: string;
  readonly productId: string;
  readonly snapshotId: string;
  readonly readinessEvaluationId: string | null;
  readonly planCode?: string | null;
  readonly planTier?: string | null;
};

export function createCommercialOfferPublishedEvent(params: {
  actorId: string;
  correlationId: string;
  traceId?: string | null;
  payload: CommercialOfferPublishedPayload;
}): IntegrationEvent<CommercialOfferPublishedPayload> {
  return {
    eventId: randomUUID(),
    eventType: 'commercial.offer.published.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: EDGE_COMMERCIAL_OUTBOX_TENANT,
    organizationId: null,
    correlationId: params.correlationId,
    causationId: null,
    traceId: params.traceId ?? null,
    actor: { type: 'user', id: params.actorId },
    source: 'okapi-edge',
    aggregateType: params.payload.offerType,
    aggregateId: params.payload.offerId,
    payload: params.payload,
  };
}

export function createCommercialOfferReadinessEvaluatedEvent(params: {
  actorId: string;
  correlationId: string;
  offerType: string;
  offerId: string;
  productId: string;
  result: string;
  evaluationId: string;
}): IntegrationEvent<{
  offerType: string;
  offerId: string;
  productId: string;
  result: string;
  evaluationId: string;
}> {
  return {
    eventId: randomUUID(),
    eventType: 'commercial.offer.readiness.evaluated.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: EDGE_COMMERCIAL_OUTBOX_TENANT,
    organizationId: null,
    correlationId: params.correlationId,
    causationId: null,
    traceId: null,
    actor: { type: 'user', id: params.actorId },
    source: 'okapi-edge',
    aggregateType: params.offerType,
    aggregateId: params.offerId,
    payload: {
      offerType: params.offerType,
      offerId: params.offerId,
      productId: params.productId,
      result: params.result,
      evaluationId: params.evaluationId,
    },
  };
}

function commercialEvent<T>(params: {
  eventType: string;
  actorId: string;
  correlationId: string;
  aggregateType: string;
  aggregateId: string;
  payload: T;
}): IntegrationEvent<T> {
  return {
    eventId: randomUUID(),
    eventType: params.eventType,
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: EDGE_COMMERCIAL_OUTBOX_TENANT,
    organizationId: null,
    correlationId: params.correlationId,
    causationId: null,
    traceId: null,
    actor: { type: 'user', id: params.actorId },
    source: 'okapi-edge',
    aggregateType: params.aggregateType,
    aggregateId: params.aggregateId,
    payload: params.payload,
  };
}

export function createMarketCreatedEvent(params: {
  actorId: string;
  correlationId: string;
  marketId: string;
  code: string;
  verticalId: string;
}) {
  return commercialEvent({
    eventType: 'commercial.market.created.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'MARKET',
    aggregateId: params.marketId,
    payload: {
      marketId: params.marketId,
      code: params.code,
      verticalId: params.verticalId,
    },
  });
}

export function createSegmentPrioritizedEvent(params: {
  actorId: string;
  correlationId: string;
  segmentId: string;
  overallPriorityScore: string | null;
  lifecycleStatus: string;
}) {
  return commercialEvent({
    eventType: 'commercial.segment.prioritized.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SEGMENT',
    aggregateId: params.segmentId,
    payload: {
      segmentId: params.segmentId,
      overallPriorityScore: params.overallPriorityScore,
      lifecycleStatus: params.lifecycleStatus,
    },
  });
}

export function createIcpCreatedEvent(params: {
  actorId: string;
  correlationId: string;
  icpId: string;
  productId: string;
  code: string;
}) {
  return commercialEvent({
    eventType: 'commercial.icp.created.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'ICP',
    aggregateId: params.icpId,
    payload: {
      icpId: params.icpId,
      productId: params.productId,
      code: params.code,
    },
  });
}

export function createPriceBookPublishedEvent(params: {
  actorId: string;
  correlationId: string;
  priceBookId: string;
  productId: string;
  currency: string;
  version: number;
}) {
  return commercialEvent({
    eventType: 'commercial.pricebook.published.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'PRICE_BOOK',
    aggregateId: params.priceBookId,
    payload: {
      priceBookId: params.priceBookId,
      productId: params.productId,
      currency: params.currency,
      version: params.version,
    },
  });
}

export function createSolutionPackagePublishedEvent(params: {
  actorId: string;
  correlationId: string;
  packageId: string;
  productId: string;
  version: number;
}) {
  return commercialEvent({
    eventType: 'commercial.package.published.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'PACKAGE',
    aggregateId: params.packageId,
    payload: {
      packageId: params.packageId,
      productId: params.productId,
      version: params.version,
    },
  });
}

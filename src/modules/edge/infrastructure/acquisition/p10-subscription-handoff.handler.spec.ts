import { describe, expect, it, vi } from 'vitest';
import { AcquisitionEventTypes } from '../../domain/acquisition/acquisition.events.js';
import { P10SubscriptionHandoffHandler } from './p10-subscription-handoff.handler.js';

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: 'e1',
    eventType: AcquisitionEventTypes.SUBSCRIPTION_HANDOFF_REQUESTED,
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: 'edge-p10-acquisition',
    organizationId: null,
    correlationId: 'corr-1',
    causationId: null,
    traceId: null,
    actor: { type: 'user', id: 'actor-1' },
    source: 'okapi.edge.p10',
    aggregateType: 'subscription_handoff',
    aggregateId: 'handoff-1',
    payload: {},
    ...overrides,
  };
}

describe('P10SubscriptionHandoffHandler', () => {
  it('supports SUBSCRIPTION_HANDOFF_REQUESTED only', () => {
    const handler = new P10SubscriptionHandoffHandler(
      {} as never,
      {} as never,
      {} as never,
    );
    expect(handler.supports(AcquisitionEventTypes.SUBSCRIPTION_HANDOFF_REQUESTED)).toBe(
      true,
    );
    expect(handler.supports('sales.handoff.requested.v1')).toBe(false);
  });

  it('skips idempotently when already COMPLETED with subscriptionRef', async () => {
    const acquisition = {
      getSubscriptionHandoff: vi.fn().mockResolvedValue({
        id: 'handoff-1',
        status: 'COMPLETED',
        subscriptionRef: 'sub-existing',
        commercialAccountId: 'acc-1',
        commercialPlanId: 'plan-1',
        metadata: {},
        prospectId: 'prospect-1',
      }),
      transitionSubscriptionHandoff: vi.fn(),
    };
    const createSubscription = { execute: vi.fn() };
    const completeHandoff = { execute: vi.fn() };
    const handler = new P10SubscriptionHandoffHandler(
      acquisition as never,
      createSubscription as never,
      completeHandoff as never,
    );

    await handler.handle(baseEvent() as never);

    expect(createSubscription.execute).not.toHaveBeenCalled();
    expect(completeHandoff.execute).not.toHaveBeenCalled();
    expect(acquisition.transitionSubscriptionHandoff).not.toHaveBeenCalled();
  });

  it('creates subscription then completes handoff', async () => {
    const acquisition = {
      getSubscriptionHandoff: vi.fn().mockResolvedValue({
        id: 'handoff-1',
        status: 'REQUESTED',
        subscriptionRef: null,
        commercialAccountId: 'acc-1',
        commercialPlanId: 'plan-1',
        applicationId: 'app-1',
        prospectId: 'prospect-1',
        metadata: {},
      }),
      getApplication: vi.fn().mockResolvedValue({
        id: 'app-1',
        productId: 'prod-1',
        commercialPlanId: 'plan-1',
        metadata: {},
      }),
      getProspect: vi.fn(),
      transitionSubscriptionHandoff: vi.fn(),
      beginIdempotency: vi.fn().mockResolvedValue({
        status: 'STARTED',
        responseRef: null,
      }),
      completeIdempotency: vi.fn().mockResolvedValue({}),
      getIdempotency: vi.fn(),
    };
    const createSubscription = {
      execute: vi.fn().mockResolvedValue({ id: 'sub-new' }),
    };
    const completeHandoff = { execute: vi.fn().mockResolvedValue({}) };
    const handler = new P10SubscriptionHandoffHandler(
      acquisition as never,
      createSubscription as never,
      completeHandoff as never,
    );

    await handler.handle(baseEvent() as never);

    expect(createSubscription.execute).toHaveBeenCalledWith({
      actorId: 'actor-1',
      accountId: 'acc-1',
      productId: 'prod-1',
      planId: 'plan-1',
      correlationId: 'corr-1',
    });
    expect(completeHandoff.execute).toHaveBeenCalledWith({
      actorId: 'actor-1',
      handoffId: 'handoff-1',
      subscriptionId: 'sub-new',
      externalEvidenceRef: 'p5:sub-new',
      correlationId: 'corr-1',
    });
    expect(acquisition.beginIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'p10_subscription_handoff',
        idempotencyKey: 'handoff-1',
      }),
    );
    expect(acquisition.completeIdempotency).toHaveBeenCalledWith(
      'p10_subscription_handoff',
      'handoff-1',
      'sub-new',
      'COMPLETED',
    );
  });

  it('skips createSubscription when inbox-style idempotency already COMPLETED', async () => {
    const acquisition = {
      getSubscriptionHandoff: vi.fn().mockResolvedValue({
        id: 'handoff-1',
        status: 'REQUESTED',
        subscriptionRef: null,
        commercialAccountId: 'acc-1',
        commercialPlanId: 'plan-1',
        applicationId: 'app-1',
        prospectId: 'prospect-1',
        metadata: {},
      }),
      getApplication: vi.fn().mockResolvedValue({
        id: 'app-1',
        productId: 'prod-1',
        commercialPlanId: 'plan-1',
        metadata: {},
      }),
      getProspect: vi.fn(),
      transitionSubscriptionHandoff: vi.fn(),
      beginIdempotency: vi.fn().mockResolvedValue({
        status: 'COMPLETED',
        responseRef: 'sub-existing',
      }),
      completeIdempotency: vi.fn(),
    };
    const createSubscription = { execute: vi.fn() };
    const completeHandoff = { execute: vi.fn() };
    const handler = new P10SubscriptionHandoffHandler(
      acquisition as never,
      createSubscription as never,
      completeHandoff as never,
    );

    await handler.handle(baseEvent() as never);

    expect(createSubscription.execute).not.toHaveBeenCalled();
    expect(completeHandoff.execute).not.toHaveBeenCalled();
    expect(acquisition.completeIdempotency).not.toHaveBeenCalled();
  });

  it('marks idempotency FAILED when createSubscription throws', async () => {
    const acquisition = {
      getSubscriptionHandoff: vi.fn().mockResolvedValue({
        id: 'handoff-1',
        status: 'REQUESTED',
        subscriptionRef: null,
        commercialAccountId: 'acc-1',
        commercialPlanId: 'plan-1',
        applicationId: null,
        prospectId: 'prospect-1',
        metadata: { productId: 'prod-1' },
      }),
      getProspect: vi.fn(),
      transitionSubscriptionHandoff: vi.fn().mockResolvedValue({}),
      beginIdempotency: vi.fn().mockResolvedValue({
        status: 'STARTED',
        responseRef: null,
      }),
      completeIdempotency: vi.fn().mockResolvedValue({}),
    };
    const createSubscription = {
      execute: vi.fn().mockRejectedValue(new Error('P5 unavailable')),
    };
    const completeHandoff = { execute: vi.fn() };
    const handler = new P10SubscriptionHandoffHandler(
      acquisition as never,
      createSubscription as never,
      completeHandoff as never,
    );

    await handler.handle(baseEvent() as never);

    expect(acquisition.completeIdempotency).toHaveBeenCalledWith(
      'p10_subscription_handoff',
      'handoff-1',
      null,
      'FAILED',
    );
    expect(acquisition.transitionSubscriptionHandoff).toHaveBeenCalledWith(
      'handoff-1',
      'FAILED',
      expect.objectContaining({ failureReason: 'P5 unavailable' }),
    );
  });

  it('fails honestly without commercial account (does not invent)', async () => {
    const acquisition = {
      getSubscriptionHandoff: vi.fn().mockResolvedValue({
        id: 'handoff-1',
        status: 'REQUESTED',
        subscriptionRef: null,
        commercialAccountId: null,
        commercialPlanId: 'plan-1',
        applicationId: null,
        prospectId: 'prospect-1',
        metadata: { productId: 'prod-1' },
      }),
      getProspect: vi.fn().mockResolvedValue({
        id: 'prospect-1',
        productId: 'prod-1',
        commercialAccountId: null,
        commercialPlanId: 'plan-1',
      }),
      transitionSubscriptionHandoff: vi.fn().mockResolvedValue({}),
    };
    const createSubscription = { execute: vi.fn() };
    const completeHandoff = { execute: vi.fn() };
    const handler = new P10SubscriptionHandoffHandler(
      acquisition as never,
      createSubscription as never,
      completeHandoff as never,
    );

    await handler.handle(baseEvent() as never);

    expect(createSubscription.execute).not.toHaveBeenCalled();
    expect(completeHandoff.execute).not.toHaveBeenCalled();
    expect(acquisition.transitionSubscriptionHandoff).toHaveBeenCalledWith(
      'handoff-1',
      'FAILED',
      expect.objectContaining({
        failureReason: expect.stringContaining('commercialAccountId'),
      }),
    );
  });
});

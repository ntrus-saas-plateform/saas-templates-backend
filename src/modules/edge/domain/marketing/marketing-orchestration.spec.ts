import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import { ConsentState, DataQuality } from './marketing.entity.js';
import {
  assertContentPublishable,
  assertDeliveryTransition,
  assertWithinFrequencyCap,
  calculateAttributionCredits,
  DeliveryStatus,
  evaluateJourneyGate,
  resolveNextJourneyStep,
  utcDayStart,
  utcWeekStart,
} from './marketing-orchestration.js';

describe('delivery transitions', () => {
  it('blocks DELIVERED without verified receipt', () => {
    expect(() =>
      assertDeliveryTransition(DeliveryStatus.SUBMITTED, DeliveryStatus.DELIVERED, {
        hasVerifiedReceipt: false,
      }),
    ).toThrow(DomainError);
  });

  it('allows DELIVERED with verified receipt', () => {
    expect(() =>
      assertDeliveryTransition(DeliveryStatus.SUBMITTED, DeliveryStatus.DELIVERED, {
        hasVerifiedReceipt: true,
      }),
    ).not.toThrow();
  });
});

describe('journey gates', () => {
  it('exits on missing consent', () => {
    expect(
      evaluateJourneyGate({
        suppressed: false,
        consents: [],
        purpose: 'marketing_email',
        channel: 'EMAIL',
      }),
    ).toBe('EXIT_UNSUBSCRIBE');
  });

  it('continues when consent granted', () => {
    expect(
      evaluateJourneyGate({
        suppressed: false,
        consents: [
          {
            purpose: 'marketing_email',
            channel: 'EMAIL',
            state: ConsentState.GRANTED,
          },
        ],
        purpose: 'marketing_email',
        channel: 'EMAIL',
      }),
    ).toBe('CONTINUE');
  });

  it('resolves linear next step', () => {
    const next = resolveNextJourneyStep(
      {
        entryStepKey: 'a',
        steps: [
          { key: 'a', type: 'UPDATE_STATUS', toStatus: 'ENGAGED', next: 'b' },
          { key: 'b', type: 'STOP' },
        ],
      },
      'a',
    );
    expect(next?.key).toBe('b');
  });
});

describe('attribution', () => {
  const touches = [
    {
      id: 't1',
      campaignId: 'c1',
      channel: 'EMAIL',
      occurredAt: new Date('2026-01-01T00:00:00Z'),
    },
    {
      id: 't2',
      campaignId: 'c2',
      channel: 'WEB_FORM',
      occurredAt: new Date('2026-01-02T00:00:00Z'),
    },
  ];

  it('first/last/linear are deterministic', () => {
    expect(calculateAttributionCredits({ modelType: 'FIRST_TOUCH', touches }).credits[0].touchpointId).toBe(
      't1',
    );
    expect(calculateAttributionCredits({ modelType: 'LAST_TOUCH', touches }).credits[0].touchpointId).toBe(
      't2',
    );
    const linear = calculateAttributionCredits({ modelType: 'LINEAR', touches });
    expect(linear.credits).toHaveLength(2);
    expect(linear.credits[0].credit).toBe(0.5);
    expect(linear.dataQuality).toBe(DataQuality.MEASURED);
  });

  it('returns UNAVAILABLE when no touches', () => {
    expect(calculateAttributionCredits({ modelType: 'LINEAR', touches: [] }).dataQuality).toBe(
      DataQuality.UNAVAILABLE,
    );
  });
});

describe('content publish gate', () => {
  it('requires APPROVED', () => {
    expect(() => assertContentPublishable({ status: 'DRAFT' })).toThrow(DomainError);
  });
});

describe('frequency caps', () => {
  it('blocks when day cap reached', () => {
    expect(() =>
      assertWithinFrequencyCap({
        policy: { channel: 'EMAIL', maxPerDay: 3, maxPerWeek: 10 },
        counters: { dayCount: 3, weekCount: 3 },
      }),
    ).toThrow(DomainError);
  });

  it('allows under cap', () => {
    expect(() =>
      assertWithinFrequencyCap({
        policy: { channel: 'EMAIL', maxPerDay: 3, maxPerWeek: 10 },
        counters: { dayCount: 2, weekCount: 5 },
      }),
    ).not.toThrow();
  });

  it('computes stable UTC day/week starts', () => {
    const d = new Date('2026-11-09T15:00:00Z'); // Monday
    expect(utcDayStart(d)).toBe('2026-11-09');
    expect(utcWeekStart(d)).toBe('2026-11-09');
  });
});

describe('channel adapter honesty contract', () => {
  it('unavailable adapter never invents delivery', async () => {
    const { UnavailableMarketingChannelAdapter } = await import(
      '../../infrastructure/marketing/unavailable-channel.adapter.js'
    );
    const adapter = new UnavailableMarketingChannelAdapter();
    const result = await adapter.send({
      channelType: 'EMAIL',
      providerRef: null,
      secretRef: null,
      settings: {},
      toEmailNormalized: 'a@b.co',
      toPhoneE164: null,
      leadId: 'l1',
      templateId: null,
      idempotencyKey: 'k1',
      deliveryAttemptId: 'attempt-1',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
    expect(['ACCEPTED', 'REJECTED', 'UNAVAILABLE']).toContain(result.outcome);
  });
});

describe('performance snapshot CAC gate', () => {
  it('blocks MEASURED CAC without revenueReconciled', async () => {
    const { CreateMarketingPerformanceSnapshotUseCase } = await import(
      '../../application/marketing/marketing-orchestration.use-cases.js'
    );
    const marketing = {
      createPerformanceSnapshot: () => ({ id: 's1' }),
    };
    const uc = new CreateMarketingPerformanceSnapshotUseCase(marketing as never);
    expect(() =>
      uc.execute({
        scopeType: 'GLOBAL',
        periodStart: '2026-11-01',
        periodEnd: '2026-11-09',
        metrics: { cac: 42 },
        metricQuality: { cac: 'MEASURED' },
      }),
    ).toThrow(DomainError);
  });

  it('allows UNAVAILABLE CAC', async () => {
    const { CreateMarketingPerformanceSnapshotUseCase } = await import(
      '../../application/marketing/marketing-orchestration.use-cases.js'
    );
    const marketing = {
      createPerformanceSnapshot: () => ({ id: 's1' }),
    };
    const uc = new CreateMarketingPerformanceSnapshotUseCase(marketing as never);
    expect(
      uc.execute({
        scopeType: 'GLOBAL',
        periodStart: '2026-11-01',
        periodEnd: '2026-11-09',
        metrics: { cac: null },
        metricQuality: { cac: 'UNAVAILABLE' },
      }),
    ).toEqual({ id: 's1' });
  });
});

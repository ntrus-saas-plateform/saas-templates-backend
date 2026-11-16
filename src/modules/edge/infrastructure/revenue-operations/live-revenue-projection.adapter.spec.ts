import { describe, expect, it, vi } from 'vitest';
import { LiveRevenueProjectionAdapter } from './live-revenue-projection.adapter.js';

describe('LiveRevenueProjectionAdapter', () => {
  it('F-P11-004: payment UNKNOWN → dataQuality ESTIMATED (not MEASURED)', async () => {
    const subscriptions = {
      listSubscriptions: vi.fn().mockResolvedValue({
        items: [
          {
            id: 'sub-1',
            accountId: 'acc-1',
            status: 'ACTIVE',
            currency: 'USD',
            billingFrequency: 'MONTHLY',
            commercialSnapshot: { amount: 100 },
            startAt: new Date('2025-01-01T00:00:00.000Z'),
            endAt: null,
            trialStartAt: null,
            trialEndAt: null,
          },
        ],
        total: 1,
      }),
    };
    const adapter = new LiveRevenueProjectionAdapter(subscriptions as never);
    const lines = await adapter.loadNormalizedSubscriptionRevenueLines({
      periodStart: new Date('2026-01-01T00:00:00.000Z'),
      periodEnd: new Date('2026-02-01T00:00:00.000Z'),
      currency: 'USD',
    });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => l.paymentStatus === 'UNKNOWN')).toBe(true);
    expect(lines.every((l) => l.dataQuality === 'ESTIMATED')).toBe(true);
    expect(lines.some((l) => l.dataQuality === 'MEASURED')).toBe(false);
  });

  it('F-P11-006: priorPeriodAmount 100→150 yields EXPANSION line', async () => {
    const subscriptions = {
      listSubscriptions: vi.fn().mockResolvedValue({
        items: [
          {
            id: 'sub-exp',
            accountId: 'acc-1',
            status: 'ACTIVE',
            currency: 'USD',
            billingFrequency: 'MONTHLY',
            commercialSnapshot: { amount: 150, priorPeriodAmount: 100 },
            startAt: new Date('2025-01-01T00:00:00.000Z'),
            endAt: null,
            trialStartAt: null,
            trialEndAt: null,
          },
        ],
        total: 1,
      }),
    };
    const adapter = new LiveRevenueProjectionAdapter(subscriptions as never);
    const lines = await adapter.loadNormalizedSubscriptionRevenueLines({
      periodStart: new Date('2026-01-01T00:00:00.000Z'),
      periodEnd: new Date('2026-02-01T00:00:00.000Z'),
    });
    expect(lines.some((l) => l.movementType === 'EXPANSION' && l.amount === 50)).toBe(true);
  });
});

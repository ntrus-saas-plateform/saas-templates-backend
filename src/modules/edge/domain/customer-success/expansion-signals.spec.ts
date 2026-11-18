import { describe, expect, it } from 'vitest';
import {
  buildExpansionRecommendation,
  evaluateExpansionSignal,
} from './expansion-signals.js';
import { computeChurnRisk } from './churn-risk.js';
import { computeAhaCompletion } from './adoption-events.js';
import { listAhaMomentsForSegment } from './aha-moments.js';

describe('expansion-signals', () => {
  it('never recommends silent entitlement bump', () => {
    const rec = buildExpansionRecommendation([
      { kind: 'USERS', observed: 48, granted: 50 },
      { kind: 'MODULES', observed: 3, granted: 3 },
    ]);
    expect(rec.actionable).toBe(true);
    expect(rec.path).toBe('ADDON');
    expect(rec.forbidden.some((f) => f.toLowerCase().includes('silent'))).toBe(true);
  });

  it('returns UNKNOWN when grant missing', () => {
    const s = evaluateExpansionSignal({ kind: 'VOLUME', observed: 100, granted: null });
    expect(s.status).toBe('UNKNOWN');
    expect(s.recommendsExpansion).toBe(false);
  });
});

describe('churn-risk', () => {
  it('links LOW health + delinquency to elevated risk', () => {
    const r = computeChurnRisk({
      healthBand: 'LOW',
      healthScore: 20,
      delinquent: true,
      daysToRenewal: 10,
      ahaCompletionPct: 25,
    });
    expect(r.level === 'HIGH' || r.level === 'CRITICAL').toBe(true);
    expect(r.score).not.toBeNull();
  });

  it('returns UNAVAILABLE when no signals', () => {
    const r = computeChurnRisk({ healthBand: 'UNKNOWN' });
    expect(r.dataQuality).toBe('UNAVAILABLE');
    expect(r.score).toBeNull();
  });
});

describe('aha multi-segment + completion', () => {
  it('lists wholesale and restaurant moments', () => {
    expect(listAhaMomentsForSegment('WHOLESALE').some((m) => m.code === 'wholesale.first_order')).toBe(
      true,
    );
    expect(
      listAhaMomentsForSegment('RESTAURANT').some((m) => m.code === 'restaurant.first_ticket'),
    ).toBe(true);
  });

  it('computes completion pct from ingested events', () => {
    const snap = computeAhaCompletion('RETAIL_PHARMACY', [
      { eventCode: 'pharmacy.first_login' },
      { eventCode: 'pharmacy.first_sale' },
    ]);
    expect(snap.dataQuality).toBe('MEASURED');
    expect(snap.completionPct).toBe(50);
  });
});

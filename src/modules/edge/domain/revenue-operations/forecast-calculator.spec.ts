import { describe, expect, it } from 'vitest';
import {
  buildNamedForecastScenarios,
  historicalTrendForecast,
  scenarioApplyAssumptions,
} from './forecast-calculator.js';
import {
  assertCommissionCalcIsNotPayout,
  evaluateCommissionPayoutGate,
} from './commission-payout-boundary.js';

describe('historicalTrendForecast', () => {
  it('projects next value from linear series', () => {
    const r = historicalTrendForecast([10, 20, 30]);
    expect(r.dataQuality).toBe('ESTIMATED');
    expect(r.projectedNext).toBe(40);
    expect(r.slope).toBe(10);
  });

  it('returns UNAVAILABLE with fewer than 2 finite points', () => {
    expect(historicalTrendForecast([10]).dataQuality).toBe('UNAVAILABLE');
    expect(historicalTrendForecast([null, undefined]).projectedNext).toBeNull();
  });

  it('ignores null gaps and still fits when ≥2 finite', () => {
    const r = historicalTrendForecast([10, null, 30]);
    expect(r.dataQuality).toBe('ESTIMATED');
    expect(r.projectedNext).not.toBeNull();
  });
});

describe('scenarioApplyAssumptions', () => {
  it('does not mutate actuals', () => {
    const actuals = [100, 200];
    const r = scenarioApplyAssumptions(actuals, { growthMultiplier: 1.1 });
    expect(actuals).toEqual([100, 200]);
    expect(r.scenarioValues).toEqual([110, 220]);
  });

  it('supports additive delta and absolute override isolation', () => {
    const base = [50, 50];
    const withDelta = scenarioApplyAssumptions(base, { additiveDelta: 10 });
    expect(withDelta.scenarioValues).toEqual([60, 60]);

    const overridden = scenarioApplyAssumptions(base, { absoluteOverride: 999 });
    expect(overridden.scenarioValues).toEqual([999, 999]);
    expect(base).toEqual([50, 50]);
  });
});

describe('named forecast scenarios', () => {
  it('builds prudent / central / ambitieux without mutating actuals', () => {
    const actuals = [100, 200];
    const r = buildNamedForecastScenarios(actuals);
    expect(actuals).toEqual([100, 200]);
    expect(r.scenarios.PRUDENT.scenarioValues).toEqual([95, 190]);
    expect(r.scenarios.CENTRAL.scenarioValues).toEqual([100, 200]);
    expect(r.scenarios.AMBITIEUX.scenarioValues).toEqual([110, 220]);
    expect(r.scenarios.PRUDENT.dataQuality).toBe('ESTIMATED');
  });
});

describe('commission calc ≠ payout', () => {
  it('forbids calc path from claiming paid stages', () => {
    expect(() => assertCommissionCalcIsNotPayout('PAID')).toThrow(/not mark payout/i);
    expect(() => assertCommissionCalcIsNotPayout('CALCULATED')).not.toThrow();
  });

  it('requires APPROVED + payout permission for payout gate', () => {
    const blocked = evaluateCommissionPayoutGate({
      stage: 'CALCULATED',
      payoutPermissionGranted: true,
    });
    expect(blocked.mayInitiatePayout).toBe(false);
    const ok = evaluateCommissionPayoutGate({
      stage: 'APPROVED',
      payoutPermissionGranted: true,
    });
    expect(ok.mayInitiatePayout).toBe(true);
  });
});

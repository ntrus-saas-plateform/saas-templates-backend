import { describe, expect, it } from 'vitest';
import { computeGrr, computeNrr } from './retention-calculator.js';

describe('computeGrr', () => {
  it('excludes expansion and computes endingRetained / pct', () => {
    const result = computeGrr({ startingMrr: 100, contraction: 10, churned: 15 });
    expect(result.endingRetained).toBe(75);
    expect(result.grrPct).toBe(0.75);
    expect(result.notes.some((n) => /excludes expansion/i.test(n))).toBe(true);
  });

  it('returns null pct when startingMrr is null/undefined (never invents)', () => {
    expect(computeGrr({ startingMrr: null, contraction: 1, churned: 1 }).grrPct).toBeNull();
    expect(computeGrr({ startingMrr: undefined, contraction: 1, churned: 1 }).grrPct).toBeNull();
    expect(computeGrr({ startingMrr: null, contraction: 1, churned: 1 }).endingRetained).toBeNull();
  });

  it('allows startingMrr 0 but returns null pct (no division by zero)', () => {
    const result = computeGrr({ startingMrr: 0, contraction: 0, churned: 0 });
    expect(result.endingRetained).toBe(0);
    expect(result.grrPct).toBeNull();
  });

  it('does not invent zeros for missing contraction/churned', () => {
    const result = computeGrr({ startingMrr: 100, contraction: null, churned: 5 });
    expect(result.endingRetained).toBeNull();
    expect(result.grrPct).toBeNull();
  });
});

describe('computeNrr', () => {
  it('includes expansion and reactivation by default', () => {
    const result = computeNrr({
      startingMrr: 100,
      expansion: 20,
      contraction: 5,
      churned: 10,
      reactivation: 15,
    });
    expect(result.ending).toBe(120);
    expect(result.nrrPct).toBe(1.2);
    expect(result.reactivationIncluded).toBe(true);
  });

  it('can exclude reactivation via flag', () => {
    const result = computeNrr({
      startingMrr: 100,
      expansion: 20,
      contraction: 5,
      churned: 10,
      reactivation: 15,
      includeReactivationInNrr: false,
    });
    expect(result.ending).toBe(105);
    expect(result.nrrPct).toBe(1.05);
    expect(result.reactivationIncluded).toBe(false);
  });

  it('treats omitted reactivation as 0 when included, but null as unavailable', () => {
    const omitted = computeNrr({
      startingMrr: 100,
      expansion: 0,
      contraction: 0,
      churned: 0,
    });
    expect(omitted.nrrPct).toBe(1);
    expect(omitted.ending).toBe(100);

    const nullRe = computeNrr({
      startingMrr: 100,
      expansion: 0,
      contraction: 0,
      churned: 0,
      reactivation: null,
    });
    expect(nullRe.nrrPct).toBeNull();
    expect(nullRe.ending).toBeNull();
  });

  it('returns null pct when startingMrr missing', () => {
    const result = computeNrr({
      startingMrr: undefined,
      expansion: 1,
      contraction: 1,
      churned: 1,
    });
    expect(result.nrrPct).toBeNull();
    expect(result.ending).toBeNull();
  });
});

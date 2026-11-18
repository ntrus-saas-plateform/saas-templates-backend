import { describe, expect, it } from 'vitest';
import {
  isBantComplete,
  LOST_REASONS_TAXONOMY,
  scoreLead,
  SALES_PIPELINE_STAGES,
} from './sales-engine-beachhead.js';

describe('sales engine beachhead', () => {
  it('defines pipeline stages with exit criteria', () => {
    expect(SALES_PIPELINE_STAGES.some((s) => s.code === 'WON')).toBe(true);
    expect(SALES_PIPELINE_STAGES.every((s) => s.exitCriteria.length > 0)).toBe(true);
  });

  it('scores lead without inventing zero', () => {
    expect(scoreLead({}).dataQuality).toBe('UNAVAILABLE');
    expect(scoreLead({}).total).toBeNull();
    expect(scoreLead({ fitScore: 80, intentScore: 60 }).dataQuality).toBe('PARTIAL');
  });

  it('requires full BANT', () => {
    expect(isBantComplete({ budget: true, authority: true, need: true, timeline: true })).toBe(
      true,
    );
    expect(isBantComplete({ budget: true, authority: true, need: true, timeline: false })).toBe(
      false,
    );
  });

  it('exports lost reasons taxonomy', () => {
    expect(LOST_REASONS_TAXONOMY.some((r) => r.code === 'PRICE')).toBe(true);
  });
});

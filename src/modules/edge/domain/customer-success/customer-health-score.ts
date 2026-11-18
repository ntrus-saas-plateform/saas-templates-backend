/**
 * RGOM-E9 — Customer Health Score v1 (honest, fail-closed).
 * Missing inputs → UNAVAILABLE components — never invent 100.
 */

export type HealthDataQuality = 'MEASURED' | 'UNAVAILABLE';

export type HealthComponent = {
  readonly code: string;
  readonly weight: number;
  readonly score: number | null;
  readonly dataQuality: HealthDataQuality;
  readonly note: string;
};

export type CustomerHealthScoreResult = {
  readonly score: number | null;
  readonly dataQuality: HealthDataQuality;
  readonly band: 'HIGH' | 'MID' | 'LOW' | 'UNKNOWN';
  readonly touchModel: 'HIGH_TOUCH' | 'MID_TOUCH' | 'LOW_TOUCH' | 'UNKNOWN';
  readonly components: readonly HealthComponent[];
  readonly notes: string[];
};

function bandFromScore(score: number | null): CustomerHealthScoreResult['band'] {
  if (score == null) return 'UNKNOWN';
  if (score >= 75) return 'HIGH';
  if (score >= 45) return 'MID';
  return 'LOW';
}

function touchFromBand(
  band: CustomerHealthScoreResult['band'],
): CustomerHealthScoreResult['touchModel'] {
  if (band === 'LOW') return 'HIGH_TOUCH';
  if (band === 'MID') return 'MID_TOUCH';
  if (band === 'HIGH') return 'LOW_TOUCH';
  return 'UNKNOWN';
}

/**
 * Inputs are 0–100 when MEASURED; null → UNAVAILABLE component.
 * Delinquency / suspension hard-caps score when true.
 */
export function computeCustomerHealthScore(input: {
  adoptionScore?: number | null;
  ahaCompletionPct?: number | null;
  supportLoadInverseScore?: number | null;
  paymentHealthScore?: number | null;
  delinquent?: boolean;
  suspended?: boolean;
}): CustomerHealthScoreResult {
  const notes: string[] = [];
  const components: HealthComponent[] = [
    {
      code: 'ADOPTION',
      weight: 0.35,
      score: input.adoptionScore ?? null,
      dataQuality: input.adoptionScore == null ? 'UNAVAILABLE' : 'MEASURED',
      note: 'Product usage / module adoption',
    },
    {
      code: 'AHA',
      weight: 0.25,
      score: input.ahaCompletionPct ?? null,
      dataQuality: input.ahaCompletionPct == null ? 'UNAVAILABLE' : 'MEASURED',
      note: 'Share of beachhead Aha moments completed',
    },
    {
      code: 'SUPPORT',
      weight: 0.15,
      score: input.supportLoadInverseScore ?? null,
      dataQuality: input.supportLoadInverseScore == null ? 'UNAVAILABLE' : 'MEASURED',
      note: 'Inverse of open high-severity tickets',
    },
    {
      code: 'PAYMENT',
      weight: 0.25,
      score: input.paymentHealthScore ?? null,
      dataQuality: input.paymentHealthScore == null ? 'UNAVAILABLE' : 'MEASURED',
      note: 'No delinquency / PAST_DUE / SUSPENDED',
    },
  ];

  if (input.delinquent) {
    notes.push('Account delinquent — payment component forced toward risk.');
  }
  if (input.suspended) {
    notes.push('Subscription suspended — hard health cap applied.');
  }

  const measured = components.filter((c) => c.dataQuality === 'MEASURED' && c.score != null);
  if (measured.length === 0) {
    notes.push('No MEASURED components — health UNAVAILABLE (not zero).');
    return {
      score: null,
      dataQuality: 'UNAVAILABLE',
      band: 'UNKNOWN',
      touchModel: 'UNKNOWN',
      components,
      notes,
    };
  }

  const weightSum = measured.reduce((s, c) => s + c.weight, 0);
  let score =
    measured.reduce((s, c) => s + (c.score as number) * c.weight, 0) / weightSum;

  if (input.delinquent) score = Math.min(score, 40);
  if (input.suspended) score = Math.min(score, 25);

  const band = bandFromScore(score);
  notes.push(
    measured.length < components.length
      ? 'Partial MEASURED inputs — score weighted on available components only.'
      : 'All components MEASURED.',
  );

  return {
    score: Math.round(score * 10) / 10,
    dataQuality: 'MEASURED',
    band,
    touchModel: touchFromBand(band),
    components,
    notes,
  };
}

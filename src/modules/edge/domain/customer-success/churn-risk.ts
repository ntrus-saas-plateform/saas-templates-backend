import type { CustomerHealthScoreResult } from './customer-health-score.js';

/**
 * RGOM-E9 — Churn risk linked to health band + delinquency (honest PARTIAL).
 */

export type ChurnRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';

export type ChurnRiskInput = {
  readonly healthBand?: CustomerHealthScoreResult['band'] | null | undefined;
  readonly healthScore?: number | null | undefined;
  readonly delinquent?: boolean | null;
  readonly suspended?: boolean | null;
  readonly daysToRenewal?: number | null;
  readonly ahaCompletionPct?: number | null;
};

export type ChurnRiskResult = {
  readonly level: ChurnRiskLevel;
  readonly score: number | null;
  readonly dataQuality: 'MEASURED' | 'PARTIAL' | 'UNAVAILABLE';
  readonly reasons: string[];
  readonly recommendedActions: string[];
};

export function computeChurnRisk(input: ChurnRiskInput): ChurnRiskResult {
  const reasons: string[] = [];
  const actions: string[] = [];
  let score = 0;
  let signals = 0;

  if (input.healthBand == null || input.healthBand === 'UNKNOWN') {
    reasons.push('Health band UNKNOWN — health signal skipped.');
  } else {
    signals += 1;
    if (input.healthBand === 'LOW') {
      score += 40;
      reasons.push('Health band LOW (+40).');
      actions.push('High-touch CS outreach + adoption review');
    } else if (input.healthBand === 'MID') {
      score += 20;
      reasons.push('Health band MID (+20).');
      actions.push('Mid-touch check-in before renewal');
    } else {
      reasons.push('Health band HIGH — low health-driven churn pressure.');
    }
  }

  if (input.healthScore != null && Number.isFinite(input.healthScore)) {
    signals += 1;
    if (input.healthScore < 30) {
      score += 15;
      reasons.push(`Health score ${input.healthScore} < 30 (+15).`);
    }
  }

  if (input.delinquent === true) {
    signals += 1;
    score += 25;
    reasons.push('Delinquent / PAST_DUE (+25).');
    actions.push('Collections + dunning policy before retention offer');
  } else if (input.delinquent == null) {
    reasons.push('delinquent unknown — skipped (PARTIAL).');
  }

  if (input.suspended === true) {
    signals += 1;
    score += 30;
    reasons.push('Subscription SUSPENDED (+30).');
    actions.push('Resolve billing suspension before churn save play');
  }

  if (input.daysToRenewal != null && Number.isFinite(input.daysToRenewal)) {
    signals += 1;
    if (input.daysToRenewal <= 14) {
      score += 15;
      reasons.push(`Renewal in ${input.daysToRenewal} days (+15).`);
      actions.push('Execute renewal playbook pré-échéance');
    } else if (input.daysToRenewal <= 45) {
      score += 8;
      reasons.push(`Renewal in ${input.daysToRenewal} days (+8).`);
    }
  } else {
    reasons.push('daysToRenewal missing — proximity skipped (PARTIAL).');
  }

  if (input.ahaCompletionPct != null && Number.isFinite(input.ahaCompletionPct)) {
    signals += 1;
    if (input.ahaCompletionPct < 50) {
      score += 15;
      reasons.push(`Aha completion ${input.ahaCompletionPct}% < 50 (+15).`);
      actions.push('Drive remaining beachhead Aha moments');
    }
  } else {
    reasons.push('ahaCompletionPct missing — activation signal skipped (PARTIAL).');
  }

  if (signals === 0) {
    return {
      level: 'UNKNOWN',
      score: null,
      dataQuality: 'UNAVAILABLE',
      reasons: [...reasons, 'No usable churn signals — UNAVAILABLE (not zero).'],
      recommendedActions: [],
    };
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  let level: ChurnRiskLevel = 'LOW';
  if (score >= 75) level = 'CRITICAL';
  else if (score >= 50) level = 'HIGH';
  else if (score >= 25) level = 'MEDIUM';

  const dataQuality =
    reasons.some((r) => r.includes('PARTIAL') || r.includes('unknown') || r.includes('missing'))
      ? 'PARTIAL'
      : 'MEASURED';

  if (actions.length === 0 && level === 'LOW') {
    actions.push('Maintain low-touch cadence; monitor health');
  }

  return {
    level,
    score,
    dataQuality,
    reasons,
    recommendedActions: [...new Set(actions)],
  };
}

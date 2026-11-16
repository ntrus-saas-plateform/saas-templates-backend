/**
 * Read-only renewal risk scoring. Never mutates P5 subscriptions.
 */

export type RenewalRiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RenewalRiskInput = {
  daysToRenewal: number | null | undefined;
  mrrAtRisk: number | null | undefined;
  priorContraction: boolean | null | undefined;
  paymentDelinquencyFlag: boolean | null | undefined;
};

export type RenewalRiskResult = {
  score: number;
  severity: RenewalRiskSeverity;
  reasons: string[];
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Heuristic score 0–100 from renewal proximity, MRR at risk, contraction history, delinquency.
 * Missing fields are skipped (not invented) and documented in reasons; score still produced from known signals.
 */
export function scoreRenewalRisk(input: RenewalRiskInput): RenewalRiskResult {
  let score = 0;
  const reasons: string[] = [];

  if (input.daysToRenewal == null || !Number.isFinite(input.daysToRenewal)) {
    reasons.push('daysToRenewal missing — proximity signal skipped (PARTIAL).');
  } else if (input.daysToRenewal <= 7) {
    score += 40;
    reasons.push(`Renewal within ${input.daysToRenewal} days (+40).`);
  } else if (input.daysToRenewal <= 30) {
    score += 25;
    reasons.push(`Renewal within ${input.daysToRenewal} days (+25).`);
  } else if (input.daysToRenewal <= 60) {
    score += 10;
    reasons.push(`Renewal within ${input.daysToRenewal} days (+10).`);
  } else {
    reasons.push(`Renewal in ${input.daysToRenewal} days — low proximity pressure.`);
  }

  if (input.mrrAtRisk == null || !Number.isFinite(input.mrrAtRisk)) {
    reasons.push('mrrAtRisk missing — magnitude signal skipped (PARTIAL).');
  } else if (input.mrrAtRisk >= 10000) {
    score += 25;
    reasons.push(`High MRR at risk (${input.mrrAtRisk}) (+25).`);
  } else if (input.mrrAtRisk >= 2000) {
    score += 15;
    reasons.push(`Material MRR at risk (${input.mrrAtRisk}) (+15).`);
  } else if (input.mrrAtRisk > 0) {
    score += 5;
    reasons.push(`Some MRR at risk (${input.mrrAtRisk}) (+5).`);
  }

  if (input.priorContraction === true) {
    score += 15;
    reasons.push('Prior contraction observed (+15).');
  } else if (input.priorContraction == null) {
    reasons.push('priorContraction unknown — skipped (PARTIAL).');
  }

  if (input.paymentDelinquencyFlag === true) {
    score += 20;
    reasons.push('Payment delinquency flag (+20).');
  } else if (input.paymentDelinquencyFlag == null) {
    reasons.push('paymentDelinquencyFlag unknown — skipped (PARTIAL).');
  }

  score = clamp(Math.round(score), 0, 100);

  let severity: RenewalRiskSeverity = 'LOW';
  if (score >= 75) severity = 'CRITICAL';
  else if (score >= 50) severity = 'HIGH';
  else if (score >= 25) severity = 'MEDIUM';

  return { score, severity, reasons };
}

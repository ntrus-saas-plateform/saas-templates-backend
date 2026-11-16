/**
 * Logo / subscription churn rates — never invent denominators.
 * Missing counts → UNAVAILABLE (not silent 0%).
 */

import { unavailableUnlessPresent } from './revenue-metric-registry.js';

export type ChurnRateBucket = {
  rate: number | null;
  dataQuality: 'MEASURED' | 'UNAVAILABLE';
  startingCount: number | null;
  churnedCount: number | null;
  notes: string[];
};

/**
 * LOGO_CHURN = churned_logos / starting_logos.
 * Requires measured positive starting count; otherwise UNAVAILABLE.
 */
export function computeLogoChurn(input: {
  startingLogos: number | null | undefined;
  churnedLogos: number | null | undefined;
}): ChurnRateBucket {
  const notes: string[] = [];
  const starting = input.startingLogos;
  const churned = input.churnedLogos;

  if (starting == null || Number.isNaN(Number(starting))) {
    notes.push('startingLogos missing — LOGO_CHURN UNAVAILABLE (not 0%).');
    return { rate: null, dataQuality: 'UNAVAILABLE', startingCount: null, churnedCount: churned ?? null, notes };
  }
  if (churned == null || Number.isNaN(Number(churned))) {
    notes.push('churnedLogos missing — LOGO_CHURN UNAVAILABLE.');
    return {
      rate: null,
      dataQuality: 'UNAVAILABLE',
      startingCount: Number(starting),
      churnedCount: null,
      notes,
    };
  }
  if (Number(starting) <= 0) {
    notes.push('startingLogos <= 0 — LOGO_CHURN UNAVAILABLE (no silent 0%).');
    return {
      rate: null,
      dataQuality: 'UNAVAILABLE',
      startingCount: Number(starting),
      churnedCount: Number(churned),
      notes,
    };
  }
  if (Number(churned) < 0) {
    notes.push('churnedLogos negative rejected.');
    return {
      rate: null,
      dataQuality: 'UNAVAILABLE',
      startingCount: Number(starting),
      churnedCount: Number(churned),
      notes,
    };
  }

  const rate = Number(churned) / Number(starting);
  const measured = unavailableUnlessPresent(rate);
  return {
    rate: measured.value,
    dataQuality: measured.dataQuality,
    startingCount: Number(starting),
    churnedCount: Number(churned),
    notes: ['LOGO_CHURN = churned_logos / starting_logos.'],
  };
}

/** SUBSCRIPTION_CHURN = churned_subscriptions / starting_subscriptions. */
export function computeSubscriptionChurn(input: {
  startingSubscriptions: number | null | undefined;
  churnedSubscriptions: number | null | undefined;
}): ChurnRateBucket {
  const base = computeLogoChurn({
    startingLogos: input.startingSubscriptions,
    churnedLogos: input.churnedSubscriptions,
  });
  return {
    ...base,
    notes: base.notes.map((n) =>
      n.replace(/LOGO_CHURN/g, 'SUBSCRIPTION_CHURN').replace(/logos/g, 'subscriptions'),
    ),
  };
}

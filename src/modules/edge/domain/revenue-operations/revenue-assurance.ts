/**
 * Revenue assurance detectors — evidence-driven only.
 * Never invent missing billing/subscription fields; return null when evidence is insufficient,
 * or a case draft with explicit confidence / PARTIAL dataQuality when fields are incomplete.
 */

import type { DataQuality } from './revenue.types.js';

export type AssuranceCaseDraft = {
  title: string;
  description: string | null;
  detectionSource: string;
  subscriptionRefId: string | null;
  invoiceRefId: string | null;
  detectedAmount: number | null;
  currency: string | null;
  dataQuality: DataQuality;
  /** 0–1 confidence based on evidence completeness */
  confidence: number;
  sourceProvenance: Record<string, unknown>;
};

export type SubscriptionBillingEvidence = {
  subscriptionId: string;
  status?: string | null;
  billingRequired?: boolean | null;
  billingConfirmed?: boolean | null;
  /** null = unknown / not loaded */
  hasBillingSchedule?: boolean | null;
  hasBillingAccountLink?: boolean | null;
  currency?: string | null;
};

export type BillingWithoutSubscriptionEvidence = {
  billingEntityType: 'SCHEDULE' | 'INVOICE' | 'PERIOD' | string;
  billingEntityId: string;
  subscriptionRefId?: string | null;
  invoiceId?: string | null;
  amount?: number | null;
  currency?: string | null;
};

export type PriceMismatchEvidence = {
  subscriptionId?: string | null;
  invoiceId?: string | null;
  /** Expected recurring / commercial amount (subscription side) */
  expectedAmount?: number | null;
  /** Observed billed / invoiced amount */
  actualAmount?: number | null;
  currency?: string | null;
  /** Absolute tolerance; default 0.01 */
  tolerance?: number | null;
};

function clampConfidence(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}

/**
 * Active (or billing-required) subscription without billing setup evidence.
 */
export function detectSubscriptionWithoutBillingSetup(
  evidence: SubscriptionBillingEvidence,
): AssuranceCaseDraft | null {
  if (!evidence.subscriptionId?.trim()) return null;

  const status = String(evidence.status ?? '').toUpperCase();
  const looksActive =
    !status ||
    ['ACTIVE', 'TRIALING', 'PAST_DUE', 'PENDING_ACTIVATION'].includes(status);

  if (!looksActive && evidence.billingRequired !== true) {
    return null;
  }

  const billingRequired = evidence.billingRequired;
  const billingConfirmed = evidence.billingConfirmed;
  const hasSchedule = evidence.hasBillingSchedule;
  const hasLink = evidence.hasBillingAccountLink;

  const knownGaps: string[] = [];
  const unknownFields: string[] = [];

  if (billingRequired === true && billingConfirmed === false) {
    knownGaps.push('billingRequired=true but billingConfirmed=false');
  } else if (billingRequired == null) {
    unknownFields.push('billingRequired');
  } else if (billingConfirmed == null && billingRequired === true) {
    unknownFields.push('billingConfirmed');
  }

  if (hasSchedule === false) {
    knownGaps.push('no billing schedule');
  } else if (hasSchedule == null) {
    unknownFields.push('hasBillingSchedule');
  }

  if (hasLink === false) {
    knownGaps.push('no billing account link');
  } else if (hasLink == null) {
    unknownFields.push('hasBillingAccountLink');
  }

  // Need at least one concrete gap; unknowns alone → insufficient to assert leakage
  if (knownGaps.length === 0) {
    return null;
  }

  const missingPenalty = unknownFields.length * 0.15;
  const confidence = clampConfidence(0.9 - missingPenalty);
  const dataQuality: DataQuality = unknownFields.length > 0 ? 'ESTIMATED' : 'MEASURED';

  return {
    title: `Subscription ${evidence.subscriptionId} missing billing setup`,
    description: `Detected gaps: ${knownGaps.join('; ')}${
      unknownFields.length ? `. Partial fields: ${unknownFields.join(', ')}` : ''
    }`,
    detectionSource: 'assurance.subscription_without_billing_setup',
    subscriptionRefId: evidence.subscriptionId,
    invoiceRefId: null,
    detectedAmount: null,
    currency: evidence.currency ?? null,
    dataQuality,
    confidence,
    sourceProvenance: {
      detector: 'detectSubscriptionWithoutBillingSetup',
      evidence: {
        status: evidence.status ?? null,
        billingRequired,
        billingConfirmed,
        hasBillingSchedule: hasSchedule ?? null,
        hasBillingAccountLink: hasLink ?? null,
      },
      knownGaps,
      unknownFields,
      dataQualityNote:
        unknownFields.length > 0
          ? 'PARTIAL evidence — missing fields not invented'
          : 'All setup fields present for assertion',
    },
  };
}

/**
 * Billing artifact that lacks a subscription reference.
 */
export function detectBillingWithoutSubscriptionRef(
  evidence: BillingWithoutSubscriptionEvidence,
): AssuranceCaseDraft | null {
  if (!evidence.billingEntityId?.trim()) return null;

  const ref = evidence.subscriptionRefId;
  if (ref != null && String(ref).trim() !== '') {
    return null;
  }

  // Explicit null/empty/undefined subscription ref with a known billing entity
  const refKnownMissing = ref === null || ref === '' || ref === undefined;
  if (!refKnownMissing) return null;

  const amountKnown = evidence.amount != null && Number.isFinite(evidence.amount);
  const confidence = clampConfidence(amountKnown ? 0.85 : 0.7);

  return {
    title: `Billing ${evidence.billingEntityType} ${evidence.billingEntityId} without subscription ref`,
    description: 'Billing artifact has null/empty subscription reference — soft ref expected for P11.',
    detectionSource: 'assurance.billing_without_subscription_ref',
    subscriptionRefId: null,
    invoiceRefId: evidence.invoiceId ?? (evidence.billingEntityType === 'INVOICE' ? evidence.billingEntityId : null),
    detectedAmount: amountKnown ? Number(evidence.amount) : null,
    currency: evidence.currency ?? null,
    dataQuality: amountKnown ? 'MEASURED' : 'ESTIMATED',
    confidence,
    sourceProvenance: {
      detector: 'detectBillingWithoutSubscriptionRef',
      billingEntityType: evidence.billingEntityType,
      billingEntityId: evidence.billingEntityId,
      subscriptionRefId: ref ?? null,
      amountPresent: amountKnown,
    },
  };
}

/**
 * Price mismatch between expected commercial amount and billed/invoiced amount.
 * Returns null when either side is missing (never invents amounts).
 */
export function detectPriceMismatch(evidence: PriceMismatchEvidence): AssuranceCaseDraft | null {
  if (!isFiniteNumber(evidence.expectedAmount) || !isFiniteNumber(evidence.actualAmount)) {
    return null;
  }

  const tolerance =
    evidence.tolerance != null && Number.isFinite(evidence.tolerance)
      ? Math.abs(evidence.tolerance)
      : 0.01;

  const delta = Math.abs(evidence.expectedAmount - evidence.actualAmount);
  if (delta <= tolerance) {
    return null;
  }

  const confidence = clampConfidence(
    evidence.subscriptionId || evidence.invoiceId ? 0.95 : 0.8,
  );

  return {
    title: 'Price mismatch between commercial and billed amount',
    description: `Expected ${evidence.expectedAmount} vs actual ${evidence.actualAmount} (delta ${delta}, tolerance ${tolerance})`,
    detectionSource: 'assurance.price_mismatch',
    subscriptionRefId: evidence.subscriptionId ?? null,
    invoiceRefId: evidence.invoiceId ?? null,
    detectedAmount: roundMoney(delta),
    currency: evidence.currency ?? null,
    dataQuality: 'MEASURED',
    confidence,
    sourceProvenance: {
      detector: 'detectPriceMismatch',
      expectedAmount: evidence.expectedAmount,
      actualAmount: evidence.actualAmount,
      delta,
      tolerance,
    },
  };
}

function isFiniteNumber(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n);
}

function roundMoney(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

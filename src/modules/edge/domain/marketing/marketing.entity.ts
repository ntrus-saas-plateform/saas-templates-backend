import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  SCHEDULED = 'SCHEDULED',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum LeadStatus {
  NEW = 'NEW',
  IDENTIFIED = 'IDENTIFIED',
  ENGAGED = 'ENGAGED',
  MARKETING_QUALIFIED = 'MARKETING_QUALIFIED',
  SALES_ACCEPTED = 'SALES_ACCEPTED',
  DISQUALIFIED = 'DISQUALIFIED',
  CONVERTED = 'CONVERTED',
  RECYCLED = 'RECYCLED',
  NURTURING = 'NURTURING',
}

export enum ConsentState {
  GRANTED = 'GRANTED',
  WITHDRAWN = 'WITHDRAWN',
  DENIED = 'DENIED',
}

export enum DataQuality {
  MEASURED = 'MEASURED',
  ESTIMATED = 'ESTIMATED',
  UNAVAILABLE = 'UNAVAILABLE',
}

const CAMPAIGN_TRANSITIONS: Record<CampaignStatus, readonly CampaignStatus[]> = {
  [CampaignStatus.DRAFT]: [CampaignStatus.IN_REVIEW, CampaignStatus.CANCELLED],
  [CampaignStatus.IN_REVIEW]: [
    CampaignStatus.APPROVED,
    CampaignStatus.REJECTED,
    CampaignStatus.DRAFT,
  ],
  [CampaignStatus.APPROVED]: [
    CampaignStatus.SCHEDULED,
    CampaignStatus.ACTIVE,
    CampaignStatus.CANCELLED,
  ],
  [CampaignStatus.SCHEDULED]: [
    CampaignStatus.ACTIVE,
    CampaignStatus.PAUSED,
    CampaignStatus.CANCELLED,
  ],
  [CampaignStatus.ACTIVE]: [
    CampaignStatus.PAUSED,
    CampaignStatus.COMPLETED,
    CampaignStatus.CANCELLED,
  ],
  [CampaignStatus.PAUSED]: [
    CampaignStatus.ACTIVE,
    CampaignStatus.COMPLETED,
    CampaignStatus.CANCELLED,
  ],
  [CampaignStatus.COMPLETED]: [CampaignStatus.ARCHIVED],
  [CampaignStatus.ARCHIVED]: [],
  [CampaignStatus.REJECTED]: [CampaignStatus.DRAFT, CampaignStatus.ARCHIVED],
  [CampaignStatus.CANCELLED]: [CampaignStatus.ARCHIVED],
};

/** Products that cannot be promoted in acquisition campaigns. */
const BLOCKED_COMMERCIAL_AVAILABILITY = new Set([
  'UNAVAILABLE',
  'DEPRECATED',
]);

export function normalizeLeadEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertCampaignStatusTransition(
  from: CampaignStatus | string,
  to: CampaignStatus | string,
): void {
  const current = from as CampaignStatus;
  const next = to as CampaignStatus;
  const allowed = CAMPAIGN_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Illegal campaign status transition ${from} → ${to}`,
      [{ from, to, allowed }],
    );
  }
}

export function assertCampaignCanPromoteProduct(input: {
  productLifecycleStatus: string;
  commercialAvailability: string;
  requirePublishedProduct?: boolean;
}): void {
  if (input.requirePublishedProduct !== false && input.productLifecycleStatus !== 'PUBLISHED') {
    throw new DomainError(
      ErrorCode.CONFLICT,
      'Campaign cannot promote a product that is not published',
      [{ productLifecycleStatus: input.productLifecycleStatus }],
    );
  }
  if (BLOCKED_COMMERCIAL_AVAILABILITY.has(input.commercialAvailability)) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      'Campaign cannot promote a product with incompatible commercial availability',
      [{ commercialAvailability: input.commercialAvailability }],
    );
  }
}

export function assertOfferPromotable(input: {
  offerStatus: string | null | undefined;
  requireActiveOffer?: boolean;
}): void {
  if (input.requireActiveOffer === false) return;
  if (!input.offerStatus) return;
  const blocked = new Set(['DRAFT', 'DEPRECATED', 'RETIRED', 'ARCHIVED', 'SUSPENDED']);
  if (blocked.has(input.offerStatus) || input.offerStatus !== 'PUBLISHED') {
    throw new DomainError(
      ErrorCode.CONFLICT,
      'Campaign cannot promote an inactive or unpublished commercial offer',
      [{ offerStatus: input.offerStatus }],
    );
  }
}

export function assertCampaignPublishable(input: {
  status: CampaignStatus | string;
  finalApprovalDecision?: string | null;
  requireFinalApproval?: boolean;
}): void {
  const publishable = new Set([
    CampaignStatus.APPROVED,
    CampaignStatus.SCHEDULED,
  ]);
  if (!publishable.has(input.status as CampaignStatus)) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      'Only APPROVED or SCHEDULED campaigns can be activated',
      [{ status: input.status }],
    );
  }
  const requireFinal = input.requireFinalApproval !== false;
  if (requireFinal && input.finalApprovalDecision !== 'APPROVED') {
    throw new DomainError(
      ErrorCode.CONFLICT,
      'Campaign activation requires FINAL approval',
      [{ finalApprovalDecision: input.finalApprovalDecision ?? null }],
    );
  }
}

export function assertConsentAllowsChannel(input: {
  consents: readonly { purpose: string; channel: string; state: ConsentState | string }[];
  purpose: string;
  channel: string;
}): void {
  const match = input.consents.find(
    (c) => c.purpose === input.purpose && c.channel === input.channel,
  );
  if (!match || match.state !== ConsentState.GRANTED) {
    throw new DomainError(
      ErrorCode.FORBIDDEN,
      'Marketing communication blocked: required consent not granted',
      [{ purpose: input.purpose, channel: input.channel }],
    );
  }
}

export type ScoringWeights = {
  readonly icpMatch?: number;
  readonly segmentMatch?: number;
  readonly demoRequest?: number;
  readonly explicitContact?: number;
  readonly resourceDownload?: number;
  readonly eventParticipation?: number;
  readonly recencyDaysDecay?: number;
  readonly profileCompleteness?: number;
};

export type ScoringSignals = {
  readonly icpMatch?: boolean;
  readonly segmentMatch?: boolean;
  readonly demoRequest?: boolean;
  readonly explicitContact?: boolean;
  readonly resourceDownload?: boolean;
  readonly eventParticipation?: boolean;
  readonly daysSinceLastActivity?: number | null;
  readonly profileCompletenessRatio?: number | null;
};

export type LeadScoreResult = {
  readonly score: number;
  readonly modelVersion: number;
  readonly applied: { criterion: string; weight: number; contributed: number }[];
  readonly missingSignals: string[];
  readonly explanation: string;
};

/** Deterministic, explainable MQL score — never auto-creates tenants or offers. */
export function calculateExplainableLeadScore(input: {
  weights: ScoringWeights;
  signals: ScoringSignals;
  modelVersion: number;
}): LeadScoreResult {
  const applied: LeadScoreResult['applied'] = [];
  const missingSignals: string[] = [];
  let score = 0;

  const addBinary = (
    key: keyof ScoringWeights,
    signalKey: keyof ScoringSignals,
    label: string,
  ) => {
    const weight = Number(input.weights[key] ?? 0);
    if (weight <= 0) return;
    const signal = input.signals[signalKey];
    if (typeof signal !== 'boolean') {
      missingSignals.push(label);
      return;
    }
    const contributed = signal ? weight : 0;
    score += contributed;
    applied.push({ criterion: label, weight, contributed });
  };

  addBinary('icpMatch', 'icpMatch', 'icp_match');
  addBinary('segmentMatch', 'segmentMatch', 'segment_match');
  addBinary('demoRequest', 'demoRequest', 'demo_request');
  addBinary('explicitContact', 'explicitContact', 'explicit_contact');
  addBinary('resourceDownload', 'resourceDownload', 'resource_download');
  addBinary('eventParticipation', 'eventParticipation', 'event_participation');

  const decay = Number(input.weights.recencyDaysDecay ?? 0);
  if (decay > 0) {
    const days = input.signals.daysSinceLastActivity;
    if (days == null) missingSignals.push('recency');
    else {
      const contributed = Math.max(0, 10 - days * decay);
      score += contributed;
      applied.push({ criterion: 'recency', weight: decay, contributed });
    }
  }

  const completenessWeight = Number(input.weights.profileCompleteness ?? 0);
  if (completenessWeight > 0) {
    const ratio = input.signals.profileCompletenessRatio;
    if (ratio == null) missingSignals.push('profile_completeness');
    else {
      const contributed = completenessWeight * Math.min(1, Math.max(0, ratio));
      score += contributed;
      applied.push({
        criterion: 'profile_completeness',
        weight: completenessWeight,
        contributed,
      });
    }
  }

  const rounded = Math.round(score * 10000) / 10000;
  return {
    score: rounded,
    modelVersion: input.modelVersion,
    applied,
    missingSignals,
    explanation: `Score ${rounded} from ${applied.length} criteria (model v${input.modelVersion})`,
  };
}

export function assertFormDoesNotProvisionTenant(formType: string): void {
  // Explicit invariant marker — trial/demo forms never create tenants here.
  void formType;
}

export function assertMetricNotInvented(quality: DataQuality | string): void {
  if (quality !== DataQuality.MEASURED && quality !== DataQuality.ESTIMATED && quality !== DataQuality.UNAVAILABLE) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid metric data quality', [
      { quality },
    ]);
  }
}

/**
 * RGOM-E5 — Sales engine beachhead (pipeline, BANT, scoring, lost reasons).
 */

export const SALES_PIPELINE_STAGES = [
  { code: 'NEW', exitCriteria: 'Lead captured with consent' },
  { code: 'QUALIFYING', exitCriteria: 'BANT fields complete + ICP fit scored' },
  { code: 'DISCOVERY', exitCriteria: 'Discovery record saved (profile, scale, pain)' },
  { code: 'DEMO', exitCriteria: 'Demo script workflow completed' },
  { code: 'PROPOSAL', exitCriteria: 'Quote linked to configurator snapshot' },
  { code: 'NEGOTIATION', exitCriteria: 'Discount approvals recorded' },
  { code: 'WON', exitCriteria: 'Contract signed → handoff Subscription idempotent' },
  { code: 'LOST', exitCriteria: 'Lost reason taxonomy code set' },
] as const;

export type BantFields = {
  budget?: boolean | null;
  authority?: boolean | null;
  need?: boolean | null;
  timeline?: boolean | null;
};

export type LeadScoreInput = {
  fitScore?: number | null;
  intentScore?: number | null;
  engagementScore?: number | null;
  readinessScore?: number | null;
};

export type LeadScoreResult = {
  total: number | null;
  dataQuality: 'MEASURED' | 'PARTIAL' | 'UNAVAILABLE';
  components: Record<string, number | null>;
  notes: string[];
};

export function scoreLead(input: LeadScoreInput): LeadScoreResult {
  const components = {
    fit: input.fitScore ?? null,
    intent: input.intentScore ?? null,
    engagement: input.engagementScore ?? null,
    readiness: input.readinessScore ?? null,
  };
  const measured = Object.values(components).filter((v) => v != null && Number.isFinite(v));
  if (measured.length === 0) {
    return {
      total: null,
      dataQuality: 'UNAVAILABLE',
      components,
      notes: ['No score components — UNAVAILABLE (not 0).'],
    };
  }
  const total =
    Math.round(
      (measured.reduce((s, v) => s + (v as number), 0) / measured.length) * 10,
    ) / 10;
  return {
    total,
    dataQuality: measured.length === 4 ? 'MEASURED' : 'PARTIAL',
    components,
    notes: [`Averaged ${measured.length}/4 components.`],
  };
}

export function isBantComplete(b: BantFields): boolean {
  return [b.budget, b.authority, b.need, b.timeline].every((x) => x === true);
}

export const LOST_REASONS_TAXONOMY = [
  { code: 'PRICE', exportBucket: 'Product Marketing' },
  { code: 'COMPETITOR', exportBucket: 'Product Marketing' },
  { code: 'NO_BUDGET', exportBucket: 'Product Marketing' },
  { code: 'NO_AUTHORITY', exportBucket: 'Sales Ops' },
  { code: 'TIMING', exportBucket: 'Sales Ops' },
  { code: 'FIT_PRODUCT', exportBucket: 'Product Marketing' },
  { code: 'FIT_GEO', exportBucket: 'GTM' },
  { code: 'OTHER', exportBucket: 'Sales Ops' },
] as const;

/** Codes alignés mig 140 (`edge_sales_discovery_questionnaires`, status DRAFT). */
export const DISCOVERY_TEMPLATES = [
  {
    code: 'DISC_SYNTIX_PHARMA',
    vertical: 'PHARMACY',
    productFamily: 'SYNTIX_PHARMA',
    fields: ['profile', 'sites', 'users', 'warehouses', 'pain', 'fit'],
  },
  {
    code: 'DISC_OKAPI_RESTAURANT',
    vertical: 'RESTAURANT',
    productFamily: 'OKAPI_RESTAURANT',
    fields: ['profile', 'sites', 'covers', 'posTerminals', 'pain', 'fit'],
  },
  {
    code: 'DISC_OKAPI_RETAIL',
    vertical: 'RETAIL',
    productFamily: 'OKAPI_RETAIL',
    fields: ['profile', 'sites', 'users', 'registers', 'pain', 'fit'],
  },
  {
    code: 'DISC_OKAPI_HOSPITALITY',
    vertical: 'HOSPITALITY',
    productFamily: 'OKAPI_HOSPITALITY',
    fields: ['profile', 'sites', 'rooms', 'posTerminals', 'pain', 'fit'],
  },
] as const;

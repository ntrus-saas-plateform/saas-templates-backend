/**
 * Canonical P11 revenue metric registry.
 * Human definitions are authoritative — never silently treat missing data as zero.
 */

export const CANONICAL_METRIC_CODES = [
  'MRR_ENDING',
  'MRR_NEW',
  'MRR_EXPANSION',
  'MRR_CONTRACTION',
  'MRR_CHURNED',
  'MRR_REACTIVATION',
  'MRR_NET_NEW',
  'ARR_ENDING',
  'GRR',
  'NRR',
  'LOGO_CHURN',
  'SUBSCRIPTION_CHURN',
  'INVOICED_REVENUE',
  'COLLECTED_REVENUE',
  'RECEIVABLES',
] as const;

export type CanonicalMetricCode = (typeof CANONICAL_METRIC_CODES)[number];

export type MetricRegistryEntry = {
  code: CanonicalMetricCode;
  name: string;
  /** Human-readable definition — must never imply silent zero for missing sources. */
  definition: string;
  formula: string;
  currencyTreatment: 'NATIVE' | 'CONVERT_TO_REPORTING' | 'UNITLESS';
  timeBasis: 'PERIOD_END' | 'PERIOD_START' | 'PERIOD_AVERAGE' | 'POINT_IN_TIME' | 'TRAILING';
  sources: string[];
};

export const REVENUE_METRIC_REGISTRY: Readonly<Record<CanonicalMetricCode, MetricRegistryEntry>> = {
  MRR_ENDING: {
    code: 'MRR_ENDING',
    name: 'Ending MRR',
    definition:
      'Sum of normalized monthly recurring revenue for subscriptions active at period end. ' +
      'Annual contracts contribute contract_amount/12. Free trials flagged as trial are excluded when policy says so. ' +
      'Missing source lines → data_quality UNAVAILABLE; never report 0 as measured truth.',
    formula: 'SUM(normalized_monthly_amount WHERE active_at_period_end AND NOT excluded_trial)',
    currencyTreatment: 'NATIVE',
    timeBasis: 'PERIOD_END',
    sources: ['p5.subscription_revenue_lines', 'projection.normalized_mrr'],
  },
  MRR_NEW: {
    code: 'MRR_NEW',
    name: 'New MRR',
    definition:
      'MRR from brand-new paying subscriptions that started in the period (first paid activation). ' +
      'Does not include expansions or reactivations. Unavailable sources must not become 0.',
    formula: 'SUM(mrr WHERE movement_type = NEW)',
    currencyTreatment: 'NATIVE',
    timeBasis: 'PERIOD_END',
    sources: ['p5.subscription_revenue_lines'],
  },
  MRR_EXPANSION: {
    code: 'MRR_EXPANSION',
    name: 'Expansion MRR',
    definition:
      'Positive MRR change on existing active subscriptions (upsell, seat add, plan upgrade) within the period. ' +
      'Missing movement feed → UNAVAILABLE; never invent expansion as zero measured truth.',
    formula: 'SUM(mrr_delta WHERE movement_type = EXPANSION AND mrr_delta > 0)',
    currencyTreatment: 'NATIVE',
    timeBasis: 'PERIOD_END',
    sources: ['p5.subscription_revenue_lines'],
  },
  MRR_CONTRACTION: {
    code: 'MRR_CONTRACTION',
    name: 'Contraction MRR',
    definition:
      'Absolute value of negative MRR change on still-active subscriptions (downgrade, seat remove) within the period. ' +
      'Reported as a positive magnitude of contraction. Missing feed → UNAVAILABLE (never silent zero).',
    formula: 'ABS(SUM(mrr_delta WHERE movement_type = CONTRACTION AND mrr_delta < 0))',
    currencyTreatment: 'NATIVE',
    timeBasis: 'PERIOD_END',
    sources: ['p5.subscription_revenue_lines'],
  },
  MRR_CHURNED: {
    code: 'MRR_CHURNED',
    name: 'Churned MRR',
    definition:
      'MRR lost because subscriptions cancelled/expired during the period (full logo or subscription churn of recurring amount). ' +
      'Missing churn events → UNAVAILABLE; never report 0 as measured without evidence.',
    formula: 'SUM(mrr WHERE movement_type = CHURNED)',
    currencyTreatment: 'NATIVE',
    timeBasis: 'PERIOD_END',
    sources: ['p5.subscription_revenue_lines'],
  },
  MRR_REACTIVATION: {
    code: 'MRR_REACTIVATION',
    name: 'Reactivation MRR',
    definition:
      'MRR from previously churned customers/subscriptions that resumed paying during the period. ' +
      'Missing reactivation events → UNAVAILABLE; never invent reactivations.',
    formula: 'SUM(mrr WHERE movement_type = REACTIVATION)',
    currencyTreatment: 'NATIVE',
    timeBasis: 'PERIOD_END',
    sources: ['p5.subscription_revenue_lines'],
  },
  MRR_NET_NEW: {
    code: 'MRR_NET_NEW',
    name: 'Net New MRR',
    definition:
      'MRR_NEW + MRR_EXPANSION + MRR_REACTIVATION − MRR_CONTRACTION − MRR_CHURNED. ' +
      'If any component is UNAVAILABLE, net new is UNAVAILABLE (no silent zero).',
    formula: 'MRR_NEW + MRR_EXPANSION + MRR_REACTIVATION - MRR_CONTRACTION - MRR_CHURNED',
    currencyTreatment: 'NATIVE',
    timeBasis: 'PERIOD_END',
    sources: ['derived.from_mrr_movements'],
  },
  ARR_ENDING: {
    code: 'ARR_ENDING',
    name: 'Ending ARR',
    definition:
      'Annualized recurring revenue at period end: MRR_ENDING × 12. ' +
      'If MRR_ENDING is UNAVAILABLE, ARR_ENDING is UNAVAILABLE.',
    formula: 'MRR_ENDING * 12',
    currencyTreatment: 'NATIVE',
    timeBasis: 'PERIOD_END',
    sources: ['derived.from_mrr_ending'],
  },
  GRR: {
    code: 'GRR',
    name: 'Gross Revenue Retention',
    definition:
      'Retained recurring revenue before expansion, as a ratio of starting MRR. ' +
      'Typically (starting_mrr − contraction − churned) / starting_mrr. Missing starting MRR → UNAVAILABLE.',
    formula: '(MRR_START - MRR_CONTRACTION - MRR_CHURNED) / MRR_START',
    currencyTreatment: 'UNITLESS',
    timeBasis: 'PERIOD_END',
    sources: ['derived.from_mrr_movements'],
  },
  NRR: {
    code: 'NRR',
    name: 'Net Revenue Retention',
    definition:
      'Net retained recurring revenue including expansion/reactivation relative to starting MRR. ' +
      'Missing components → UNAVAILABLE, never invent 100%.',
    formula: '(MRR_START + MRR_EXPANSION + MRR_REACTIVATION - MRR_CONTRACTION - MRR_CHURNED) / MRR_START',
    currencyTreatment: 'UNITLESS',
    timeBasis: 'PERIOD_END',
    sources: ['derived.from_mrr_movements'],
  },
  LOGO_CHURN: {
    code: 'LOGO_CHURN',
    name: 'Logo Churn Rate',
    definition:
      'Count of distinct customer logos that fully churned in the period ÷ logos at period start. ' +
      'Requires measured logo counts; otherwise UNAVAILABLE.',
    formula: 'churned_logos / starting_logos',
    currencyTreatment: 'UNITLESS',
    timeBasis: 'PERIOD_END',
    sources: ['p5.customer_accounts', 'p5.subscription_lifecycle'],
  },
  SUBSCRIPTION_CHURN: {
    code: 'SUBSCRIPTION_CHURN',
    name: 'Subscription Churn Rate',
    definition:
      'Count of subscriptions cancelled/expired in the period ÷ subscriptions at period start. ' +
      'Distinct from logo churn when one logo holds multiple subscriptions. ' +
      'Missing subscription lifecycle counts → UNAVAILABLE; never invent a churn rate.',
    formula: 'churned_subscriptions / starting_subscriptions',
    currencyTreatment: 'UNITLESS',
    timeBasis: 'PERIOD_END',
    sources: ['p5.subscription_lifecycle'],
  },
  INVOICED_REVENUE: {
    code: 'INVOICED_REVENUE',
    name: 'Invoiced Revenue',
    definition:
      'Sum of issued invoice totals (P6 invoice refs) in the period, in reporting currency policy. ' +
      'Not collected cash. Unpaid invoices still count as invoiced. Missing P6 feed → UNAVAILABLE.',
    formula: 'SUM(invoice.issued_total WHERE issued_at IN period)',
    currencyTreatment: 'NATIVE',
    timeBasis: 'PERIOD_END',
    sources: ['p6.invoice_refs'],
  },
  COLLECTED_REVENUE: {
    code: 'COLLECTED_REVENUE',
    name: 'Collected Revenue',
    definition:
      'Sum of succeeded payment collections (P6 payment refs) in the period. ' +
      'Never counts unpaid invoices or pending authorizations as collected.',
    formula: 'SUM(payment.succeeded_amount WHERE collected_at IN period)',
    currencyTreatment: 'NATIVE',
    timeBasis: 'PERIOD_END',
    sources: ['p6.payment_refs'],
  },
  RECEIVABLES: {
    code: 'RECEIVABLES',
    name: 'Open Receivables',
    definition:
      'Outstanding invoiced but uncollected balances as of as_of. ' +
      'Requires P6 AR open-items feed; otherwise UNAVAILABLE (not zero).',
    formula: 'SUM(open_invoice_balance AS OF as_of)',
    currencyTreatment: 'NATIVE',
    timeBasis: 'POINT_IN_TIME',
    sources: ['p6.accounts_receivable'],
  },
};

export function isCanonicalMetricCode(code: string): code is CanonicalMetricCode {
  return (CANONICAL_METRIC_CODES as readonly string[]).includes(code);
}

export function getMetricRegistryEntry(code: string): MetricRegistryEntry | null {
  if (!isCanonicalMetricCode(code)) return null;
  return REVENUE_METRIC_REGISTRY[code];
}

export function listCanonicalMetricDefinitions(): MetricRegistryEntry[] {
  return CANONICAL_METRIC_CODES.map((c) => REVENUE_METRIC_REGISTRY[c]);
}

/**
 * Missing measured values must surface as UNAVAILABLE — never coerce to 0.
 */
export function unavailableUnlessPresent(value: number | null | undefined): {
  value: number | null;
  dataQuality: 'MEASURED' | 'UNAVAILABLE';
} {
  if (value == null || Number.isNaN(value)) {
    return { value: null, dataQuality: 'UNAVAILABLE' };
  }
  return { value, dataQuality: 'MEASURED' };
}

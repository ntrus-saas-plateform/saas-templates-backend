/**
 * Pure unit-economics calculators (CAC, LTV, LTV:CAC, payback).
 * Never invent costs or rates — missing/invalid inputs → value null + UNAVAILABLE.
 */

import type { DataQuality } from './revenue.types.js';

export type UnitEconResult = {
  value: number | null;
  dataQuality: DataQuality;
  notes?: string[];
};

function isPresent(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n);
}

function round(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

/**
 * CAC = acquisitionSpend / newCustomers.
 * Null spend or null/0 customers → UNAVAILABLE (never invent spend or customers).
 */
export function computeCac(input: {
  acquisitionSpend: number | null | undefined;
  newCustomers: number | null | undefined;
}): UnitEconResult {
  const notes: string[] = [];
  if (!isPresent(input.acquisitionSpend)) {
    notes.push('acquisitionSpend missing — CAC UNAVAILABLE (cost not invented).');
    return { value: null, dataQuality: 'UNAVAILABLE', notes };
  }
  if (!isPresent(input.newCustomers) || input.newCustomers === 0) {
    notes.push(
      'newCustomers null/0 — CAC UNAVAILABLE (no division by zero; customers not invented).',
    );
    return { value: null, dataQuality: 'UNAVAILABLE', notes };
  }
  return {
    value: round(input.acquisitionSpend / input.newCustomers),
    dataQuality: 'MEASURED',
    notes,
  };
}

/**
 * Classic SaaS LTV ≈ avgRecurringRevenue * grossMarginPct / churnRate.
 * churnRate null/0 or missing AR/margin → UNAVAILABLE.
 * grossMarginPct is a fraction (0–1) or percent (>1 treated as percent/100 when > 1).
 */
export function computeLtv(input: {
  avgRecurringRevenue: number | null | undefined;
  grossMarginPct: number | null | undefined;
  churnRate: number | null | undefined;
}): UnitEconResult {
  const notes: string[] = [];
  if (!isPresent(input.churnRate) || input.churnRate === 0) {
    notes.push('churnRate null/0 — LTV UNAVAILABLE (churn not invented).');
    return { value: null, dataQuality: 'UNAVAILABLE', notes };
  }
  if (!isPresent(input.avgRecurringRevenue)) {
    notes.push('avgRecurringRevenue missing — LTV UNAVAILABLE.');
    return { value: null, dataQuality: 'UNAVAILABLE', notes };
  }
  if (!isPresent(input.grossMarginPct)) {
    notes.push('grossMarginPct missing — LTV UNAVAILABLE (margin not invented).');
    return { value: null, dataQuality: 'UNAVAILABLE', notes };
  }

  let margin = input.grossMarginPct;
  if (margin > 1) {
    margin = margin / 100;
    notes.push('grossMarginPct > 1 interpreted as percent (÷100).');
  }

  let churn = input.churnRate;
  if (churn > 1) {
    churn = churn / 100;
    notes.push('churnRate > 1 interpreted as percent (÷100).');
  }

  return {
    value: round((input.avgRecurringRevenue * margin) / churn),
    dataQuality: 'MEASURED',
    notes,
  };
}

/** LTV:CAC ratio. Either side null → UNAVAILABLE. */
export function computeLtvCac(input: {
  ltv: number | null | undefined;
  cac: number | null | undefined;
}): UnitEconResult {
  const notes: string[] = [];
  if (!isPresent(input.ltv) || !isPresent(input.cac)) {
    notes.push('ltv and/or cac missing — LTV_CAC UNAVAILABLE.');
    return { value: null, dataQuality: 'UNAVAILABLE', notes };
  }
  if (input.cac === 0) {
    notes.push('cac is 0 — LTV_CAC UNAVAILABLE (no division by zero).');
    return { value: null, dataQuality: 'UNAVAILABLE', notes };
  }
  return { value: round(input.ltv / input.cac), dataQuality: 'MEASURED', notes };
}

/** Payback months = CAC / monthlyContribution. Missing/0 contribution → UNAVAILABLE. */
export function computePaybackMonths(input: {
  cac: number | null | undefined;
  monthlyContribution: number | null | undefined;
}): UnitEconResult {
  const notes: string[] = [];
  if (!isPresent(input.cac)) {
    notes.push('cac missing — payback UNAVAILABLE.');
    return { value: null, dataQuality: 'UNAVAILABLE', notes };
  }
  if (!isPresent(input.monthlyContribution) || input.monthlyContribution === 0) {
    notes.push(
      'monthlyContribution null/0 — payback UNAVAILABLE (contribution not invented).',
    );
    return { value: null, dataQuality: 'UNAVAILABLE', notes };
  }
  return {
    value: round(input.cac / input.monthlyContribution),
    dataQuality: 'MEASURED',
    notes,
  };
}

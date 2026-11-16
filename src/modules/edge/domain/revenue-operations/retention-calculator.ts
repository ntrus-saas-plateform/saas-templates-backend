/**
 * Pure GRR / NRR retention calculators.
 *
 * GRR (Gross Revenue Retention) — expansion EXCLUDED:
 *   endingRetained = startingMrr − contraction − churned
 *   grrPct = endingRetained / startingMrr
 *
 * NRR (Net Revenue Retention) — includes expansion:
 *   ending = startingMrr + expansion − contraction − churned [+ reactivation]
 *   nrrPct = ending / startingMrr
 *
 * Reactivation treatment (documented):
 * - By default, reactivation is included in NRR as expansion-like
 *   (`includeReactivationInNrr` defaults to true).
 * - Pass `includeReactivationInNrr: false` to exclude reactivation from NRR.
 * - GRR never includes expansion or reactivation.
 *
 * Missing inputs:
 * - Never invent zeros for missing numeric inputs when they are null/undefined.
 * - If `startingMrr` is null/undefined → pct is null (UNAVAILABLE).
 * - `startingMrr === 0` is valid; pct is null (division by zero avoided) but
 *   ending amounts are still computed from known components when present.
 */

export type GrrInput = {
  startingMrr: number | null | undefined;
  contraction: number | null | undefined;
  churned: number | null | undefined;
};

export type GrrResult = {
  endingRetained: number | null;
  grrPct: number | null;
  notes: string[];
};

export type NrrInput = {
  startingMrr: number | null | undefined;
  expansion: number | null | undefined;
  contraction: number | null | undefined;
  churned: number | null | undefined;
  /** Optional reactivation MRR — treated as expansion-like when included */
  reactivation?: number | null | undefined;
  /**
   * When true (default), reactivation is added into NRR ending like expansion.
   * When false, reactivation is ignored for NRR (still documented in notes).
   */
  includeReactivationInNrr?: boolean;
};

export type NrrResult = {
  ending: number | null;
  nrrPct: number | null;
  notes: string[];
  reactivationIncluded: boolean;
};

function isPresent(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n);
}

function roundRatio(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

function roundMoney(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

/**
 * Gross Revenue Retention — expansion excluded.
 */
export function computeGrr(input: GrrInput): GrrResult {
  const notes: string[] = [
    'GRR excludes expansion and reactivation by definition.',
  ];

  if (!isPresent(input.startingMrr)) {
    notes.push('startingMrr missing — grrPct UNAVAILABLE (not invented as 0 or 100%).');
    return { endingRetained: null, grrPct: null, notes };
  }

  if (!isPresent(input.contraction) || !isPresent(input.churned)) {
    notes.push(
      'contraction and/or churned missing — endingRetained/grrPct UNAVAILABLE (no silent zeros).',
    );
    return { endingRetained: null, grrPct: null, notes };
  }

  const endingRetained = roundMoney(
    input.startingMrr - Math.abs(input.contraction) - Math.abs(input.churned),
  );

  if (input.startingMrr === 0) {
    notes.push('startingMrr is 0 — grrPct undefined (no division by zero); endingRetained computed.');
    return { endingRetained, grrPct: null, notes };
  }

  return {
    endingRetained,
    grrPct: roundRatio(endingRetained / input.startingMrr),
    notes,
  };
}

/**
 * Net Revenue Retention — includes expansion; reactivation expansion-like by default.
 */
export function computeNrr(input: NrrInput): NrrResult {
  const includeReactivation = input.includeReactivationInNrr !== false;
  const notes: string[] = [
    includeReactivation
      ? 'NRR includes reactivation as expansion-like (includeReactivationInNrr=true default).'
      : 'NRR excludes reactivation (includeReactivationInNrr=false).',
  ];

  if (!isPresent(input.startingMrr)) {
    notes.push('startingMrr missing — nrrPct UNAVAILABLE (not invented).');
    return { ending: null, nrrPct: null, notes, reactivationIncluded: includeReactivation };
  }

  if (
    !isPresent(input.expansion) ||
    !isPresent(input.contraction) ||
    !isPresent(input.churned)
  ) {
    notes.push(
      'expansion, contraction, and/or churned missing — ending/nrrPct UNAVAILABLE (no silent zeros).',
    );
    return { ending: null, nrrPct: null, notes, reactivationIncluded: includeReactivation };
  }

  let reactivation = 0;
  if (includeReactivation) {
    if (input.reactivation === undefined) {
      // Optional omitted → treat as 0 only when the key is absent (caller chose not to supply).
      reactivation = 0;
      notes.push('reactivation omitted — treated as 0 for NRR (explicit optional input).');
    } else if (input.reactivation === null) {
      notes.push('reactivation is null — ending/nrrPct UNAVAILABLE (null ≠ invented zero).');
      return { ending: null, nrrPct: null, notes, reactivationIncluded: includeReactivation };
    } else if (!Number.isFinite(input.reactivation)) {
      notes.push('reactivation is non-finite — ending/nrrPct UNAVAILABLE.');
      return { ending: null, nrrPct: null, notes, reactivationIncluded: includeReactivation };
    } else {
      reactivation = Math.abs(input.reactivation);
    }
  } else if (input.reactivation != null) {
    notes.push('reactivation supplied but excluded from NRR by flag.');
  }

  const ending = roundMoney(
    input.startingMrr +
      Math.abs(input.expansion) +
      reactivation -
      Math.abs(input.contraction) -
      Math.abs(input.churned),
  );

  if (input.startingMrr === 0) {
    notes.push('startingMrr is 0 — nrrPct undefined (no division by zero); ending computed.');
    return { ending, nrrPct: null, notes, reactivationIncluded: includeReactivation };
  }

  return {
    ending,
    nrrPct: roundRatio(ending / input.startingMrr),
    notes,
    reactivationIncluded: includeReactivation,
  };
}

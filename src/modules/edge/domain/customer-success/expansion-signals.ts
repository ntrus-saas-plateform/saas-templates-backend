/**
 * RGOM-E9 — Expansion signals → recommendation / quote (never silent entitlement bump).
 */

export type ExpansionSignalKind =
  | 'ORGS'
  | 'USERS'
  | 'MODULES'
  | 'VOLUME'
  | 'SITES';

export type ExpansionSignalInput = {
  readonly kind: ExpansionSignalKind;
  /** Observed usage / count */
  readonly observed: number | null;
  /** Current entitlement grant / limit (null = unknown) */
  readonly granted: number | null;
  /** Soft threshold ratio vs grant (default 0.8) */
  readonly softThresholdRatio?: number;
};

export type ExpansionSignalResult = {
  readonly kind: ExpansionSignalKind;
  readonly observed: number | null;
  readonly granted: number | null;
  readonly utilizationPct: number | null;
  readonly status: 'CLEAR' | 'APPROACHING' | 'AT_LIMIT' | 'OVER' | 'UNKNOWN';
  readonly recommendsExpansion: boolean;
  readonly note: string;
};

export type ExpansionRecommendation = {
  readonly actionable: boolean;
  readonly path: 'QUOTE' | 'PLAN_CHANGE' | 'ADDON' | 'NONE';
  readonly signals: readonly ExpansionSignalResult[];
  readonly forbidden: readonly string[];
  readonly summary: string;
};

function statusFor(
  observed: number | null,
  granted: number | null,
  softRatio: number,
): Pick<
  ExpansionSignalResult,
  'status' | 'utilizationPct' | 'recommendsExpansion' | 'note'
> {
  if (observed == null || granted == null || granted <= 0) {
    return {
      status: 'UNKNOWN',
      utilizationPct: null,
      recommendsExpansion: false,
      note: 'Missing observed or granted — cannot invent expansion need.',
    };
  }
  const pct = Math.round((observed / granted) * 1000) / 10;
  if (observed > granted) {
    return {
      status: 'OVER',
      utilizationPct: pct,
      recommendsExpansion: true,
      note: 'Usage exceeds grant — recommend quote / plan change; do not silent-bump entitlements.',
    };
  }
  if (observed === granted) {
    return {
      status: 'AT_LIMIT',
      utilizationPct: pct,
      recommendsExpansion: true,
      note: 'At entitlement limit — expansion recommendation path only.',
    };
  }
  if (observed / granted >= softRatio) {
    return {
      status: 'APPROACHING',
      utilizationPct: pct,
      recommendsExpansion: true,
      note: `Approaching grant (≥${Math.round(softRatio * 100)}%) — CS / sales quote path.`,
    };
  }
  return {
    status: 'CLEAR',
    utilizationPct: pct,
    recommendsExpansion: false,
    note: 'Within grant headroom.',
  };
}

export function evaluateExpansionSignal(input: ExpansionSignalInput): ExpansionSignalResult {
  const soft = input.softThresholdRatio ?? 0.8;
  const scored = statusFor(input.observed, input.granted, soft);
  return {
    kind: input.kind,
    observed: input.observed,
    granted: input.granted,
    ...scored,
  };
}

/**
 * Aggregate signals into a recommendation. Never returns a silent entitlement mutation.
 */
export function buildExpansionRecommendation(
  signals: readonly ExpansionSignalInput[],
): ExpansionRecommendation {
  const evaluated = signals.map(evaluateExpansionSignal);
  const needs = evaluated.filter((s) => s.recommendsExpansion);
  const forbidden = [
    'Silent entitlement bump without commercial quote',
    'BB self-elevating modules beyond Edge grant',
    'Auto-activate paid addons from usage alone',
  ];
  if (needs.length === 0) {
    return {
      actionable: false,
      path: 'NONE',
      signals: evaluated,
      forbidden,
      summary: 'No expansion recommendation — usage within grants or data UNKNOWN.',
    };
  }
  const hasModule = needs.some((s) => s.kind === 'MODULES');
  const path = hasModule ? 'ADDON' : needs.some((s) => s.kind === 'VOLUME') ? 'PLAN_CHANGE' : 'QUOTE';
  return {
    actionable: true,
    path,
    signals: evaluated,
    forbidden,
    summary: `${needs.length} signal(s) recommend commercial path ${path} — never silent entitlement bump.`,
  };
}

/**
 * Lightweight forecast helpers.
 * historicalTrendForecast — simple linear regression on historical values.
 * scenarioApplyAssumptions — applies scenario multipliers without mutating actuals.
 */

export type HistoricalTrendForecast = {
  projectedNext: number | null;
  slope: number | null;
  intercept: number | null;
  dataQuality: 'ESTIMATED' | 'UNAVAILABLE';
  notes: string[];
};

/**
 * Ordinary least-squares linear trend over index 0..n-1.
 * Fewer than 2 finite values → UNAVAILABLE (no invented projection).
 */
export function historicalTrendForecast(values: Array<number | null | undefined>): HistoricalTrendForecast {
  const notes: string[] = [];
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) {
      points.push({ x: i, y: v });
    }
  }

  if (points.length < 2) {
    notes.push('Need ≥2 finite historical values for linear trend — UNAVAILABLE.');
    return {
      projectedNext: null,
      slope: null,
      intercept: null,
      dataQuality: 'UNAVAILABLE',
      notes,
    };
  }

  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) {
    notes.push('Degenerate x-spread — UNAVAILABLE.');
    return {
      projectedNext: null,
      slope: null,
      intercept: null,
      dataQuality: 'UNAVAILABLE',
      notes,
    };
  }

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const nextX = values.length; // project one step past the original series length
  const projectedNext = Math.round((intercept + slope * nextX) * 1e8) / 1e8;
  notes.push(`Linear OLS over ${n} points; projected index ${nextX}.`);

  return {
    projectedNext,
    slope: Math.round(slope * 1e8) / 1e8,
    intercept: Math.round(intercept * 1e8) / 1e8,
    dataQuality: 'ESTIMATED',
    notes,
  };
}

export type ScenarioAssumptions = {
  /** Multiplier applied to base series (e.g. 1.1 = +10%). Default 1. */
  growthMultiplier?: number;
  /** Additive delta applied after multiplier. Default 0. */
  additiveDelta?: number;
  /** Optional absolute override for entire series (isolates scenario from actuals). */
  absoluteOverride?: number | null;
};

export type ScenarioApplyResult = {
  /** New projected series — actuals input is never mutated. */
  scenarioValues: number[];
  assumptionsApplied: Required<Omit<ScenarioAssumptions, 'absoluteOverride'>> & {
    absoluteOverride: number | null;
  };
  notes: string[];
};

/**
 * Applies scenario assumptions to a copy of base values.
 * Does not mutate the input array (actuals isolation).
 */
export function scenarioApplyAssumptions(
  actuals: readonly number[],
  assumptions: ScenarioAssumptions = {},
): ScenarioApplyResult {
  const growthMultiplier =
    assumptions.growthMultiplier != null && Number.isFinite(assumptions.growthMultiplier)
      ? assumptions.growthMultiplier
      : 1;
  const additiveDelta =
    assumptions.additiveDelta != null && Number.isFinite(assumptions.additiveDelta)
      ? assumptions.additiveDelta
      : 0;
  const absoluteOverride =
    assumptions.absoluteOverride != null && Number.isFinite(assumptions.absoluteOverride)
      ? assumptions.absoluteOverride
      : null;

  const notes: string[] = [
    'Scenario values are a copy — actuals array is not mutated.',
  ];

  let scenarioValues: number[];
  if (absoluteOverride != null) {
    scenarioValues = actuals.map(() => absoluteOverride);
    notes.push(`absoluteOverride=${absoluteOverride} applied to all periods.`);
  } else {
    scenarioValues = actuals.map((v) =>
      Math.round((v * growthMultiplier + additiveDelta) * 1e8) / 1e8,
    );
    notes.push(`growthMultiplier=${growthMultiplier}, additiveDelta=${additiveDelta}.`);
  }

  return {
    scenarioValues,
    assumptionsApplied: { growthMultiplier, additiveDelta, absoluteOverride },
    notes,
  };
}

/** RGOM-E10 — Named forecast scenarios (prudent / central / ambitieux). Never mutate actuals. */
export type NamedForecastScenarioCode = 'PRUDENT' | 'CENTRAL' | 'AMBITIEUX';

export const NAMED_FORECAST_SCENARIO_PRESETS: Record<
  NamedForecastScenarioCode,
  { growthMultiplier: number; additiveDelta: number; note: string }
> = {
  PRUDENT: {
    growthMultiplier: 0.95,
    additiveDelta: 0,
    note: 'Prudent — mild contraction vs actuals trend (-5%).',
  },
  CENTRAL: {
    growthMultiplier: 1.0,
    additiveDelta: 0,
    note: 'Central — baseline equals actuals series (no invented uplift).',
  },
  AMBITIEUX: {
    growthMultiplier: 1.1,
    additiveDelta: 0,
    note: 'Ambitieux — +10% growth assumption; ESTIMATED only.',
  },
};

export type NamedForecastScenariosResult = {
  readonly actuals: readonly number[];
  readonly scenarios: Record<
    NamedForecastScenarioCode,
    ScenarioApplyResult & { code: NamedForecastScenarioCode; dataQuality: 'ESTIMATED' }
  >;
  readonly notes: string[];
};

export function buildNamedForecastScenarios(
  actuals: readonly number[],
): NamedForecastScenariosResult {
  const notes = [
    'Named scenarios are ESTIMATED copies — never overwrite MEASURED actuals.',
    'UNAVAILABLE actuals must be filtered by caller before invoking.',
  ];
  const scenarios = {} as NamedForecastScenariosResult['scenarios'];
  for (const code of Object.keys(NAMED_FORECAST_SCENARIO_PRESETS) as NamedForecastScenarioCode[]) {
    const preset = NAMED_FORECAST_SCENARIO_PRESETS[code];
    const applied = scenarioApplyAssumptions(actuals, {
      growthMultiplier: preset.growthMultiplier,
      additiveDelta: preset.additiveDelta,
    });
    scenarios[code] = {
      ...applied,
      code,
      dataQuality: 'ESTIMATED',
      notes: [...applied.notes, preset.note],
    };
  }
  return { actuals: [...actuals], scenarios, notes };
}

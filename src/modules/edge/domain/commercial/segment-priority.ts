import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export type SegmentPriorityWeights = {
  readonly marketAttractiveness: number;
  readonly strategicFit: number;
  readonly productReadiness: number;
  readonly competitiveIntensity: number;
  readonly acquisitionComplexity: number;
  readonly revenuePotential: number;
  readonly deliveryComplexity: number;
  readonly supportComplexity: number;
  readonly regulatoryRisk: number;
  readonly geographicAccessibility: number;
};

export type SegmentPriorityScores = Partial<SegmentPriorityWeights>;

export type SegmentPriorityResult = {
  readonly overall: string | null;
  readonly status: 'SCORED' | 'NEEDS_RESEARCH';
  readonly missingDimensions: readonly string[];
  readonly explain: readonly { dimension: string; score: number; weight: number; contribution: string }[];
  readonly weightsVersion: number;
};

const DIMENSIONS: (keyof SegmentPriorityWeights)[] = [
  'marketAttractiveness',
  'strategicFit',
  'productReadiness',
  'competitiveIntensity',
  'acquisitionComplexity',
  'revenuePotential',
  'deliveryComplexity',
  'supportComplexity',
  'regulatoryRisk',
  'geographicAccessibility',
];

export function scoreSegmentPriority(input: {
  scores: SegmentPriorityScores;
  weights: SegmentPriorityWeights;
  weightsVersion: number;
}): SegmentPriorityResult {
  const missing: string[] = [];
  const explain: SegmentPriorityResult['explain'][number][] = [];
  let total = 0;
  let weightSum = 0;

  for (const dim of DIMENSIONS) {
    const weight = input.weights[dim];
    if (typeof weight !== 'number' || weight < 0) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, `Invalid weight for ${dim}`);
    }
    const score = input.scores[dim];
    if (score === undefined || score === null || Number.isNaN(score)) {
      missing.push(dim);
      continue;
    }
    if (score < 0 || score > 1) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Score for ${dim} must be between 0 and 1 (unknown stays unset)`,
      );
    }
    const contribution = score * weight;
    total += contribution;
    weightSum += weight;
    explain.push({
      dimension: dim,
      score,
      weight,
      contribution: contribution.toFixed(6),
    });
  }

  if (missing.length > 0 || weightSum <= 0) {
    return {
      overall: null,
      status: 'NEEDS_RESEARCH',
      missingDimensions: missing,
      explain,
      weightsVersion: input.weightsVersion,
    };
  }

  return {
    overall: (total / weightSum).toFixed(6),
    status: 'SCORED',
    missingDimensions: [],
    explain,
    weightsVersion: input.weightsVersion,
  };
}

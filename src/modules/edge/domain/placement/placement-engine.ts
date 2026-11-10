import {
  CertificationStatus,
  CompatibilityResult,
  EnvironmentStatus,
  PlatformOperationalStatus,
  ProfileStatus,
  RegistryLifecycleStatus,
  TechnicalVersionStatus,
  type DeploymentProfile,
  type ProductControlContract,
  type ProductPlatform,
  type ProductRegistryRecord,
  type ProductTechnicalVersion,
  type RuntimeEnvironment,
} from '../registry/registry.types.js';
import {
  computeAvailable,
  hasSufficientCapacity,
  isFresh,
} from './capacity.js';
import {
  CapacityInventoryStatus,
  PlacementDecisionStatus,
  type CapacityInventoryRecord,
  type CapacityRequirements,
  type PlacementPolicyRecord,
  type PlacementRequestRecord,
} from './placement.types.js';

export const PLACEMENT_ALGORITHM_NAME = 'edge.p7.placement.v1';
export const PLACEMENT_ALGORITHM_VERSION = '1.0.0';

export type CandidateCompatibility = {
  platformId: string;
  environmentId: string;
  profileId: string;
  contractId: string;
  result: CompatibilityResult;
  reasons?: string[];
};

export type PlacementEngineCandidate = {
  platformId: string;
  environmentId: string;
  profileId: string;
  contractId: string;
  contractVersion: string | null;
  region: string | null;
  rank: number | null;
  passedHardConstraints: boolean;
  hardConstraintFailures: string[];
  compatibilityResult: CompatibilityResult | null;
  score: number | null;
  scoringBreakdown: Record<string, unknown>;
  capacitySnapshot: Record<string, unknown>;
  excluded: boolean;
  exclusionReason: string | null;
  placeable: boolean;
  requiresReview: boolean;
  capacityBlocked: boolean;
};

export type PlacementEngineInput = {
  request: PlacementRequestRecord;
  product: ProductRegistryRecord;
  version: ProductTechnicalVersion;
  platforms: ProductPlatform[];
  environments: RuntimeEnvironment[];
  profiles: DeploymentProfile[];
  contracts: ProductControlContract[];
  capacityRows: CapacityInventoryRecord[];
  policy: PlacementPolicyRecord | null;
  now: Date;
  compatibility:
    | CandidateCompatibility[]
    | ((candidate: {
        platform: ProductPlatform;
        environment: RuntimeEnvironment;
        profile: DeploymentProfile;
        contract: ProductControlContract;
      }) => CompatibilityResult | CandidateCompatibility);
};

export type PlacementEngineResult = {
  decisionStatus:
    | PlacementDecisionStatus.PLACED
    | PlacementDecisionStatus.REQUIRES_REVIEW
    | PlacementDecisionStatus.NO_CAPACITY
    | PlacementDecisionStatus.NO_COMPATIBLE_TARGET;
  selected: {
    platformId: string;
    environmentId: string;
    profileId: string;
    region: string | null;
    technicalVersionId: string;
    contractId: string;
    contractVersion: string | null;
  } | null;
  candidates: PlacementEngineCandidate[];
  scoringBreakdown: Record<string, unknown>;
  policyEvaluationSnapshot: Record<string, unknown>;
  evaluationSnapshot: Record<string, unknown>;
  rejectionSummary: string | null;
  algorithmName: string;
  algorithmVersion: string;
  policyId: string | null;
  policyVersion: number | null;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v));
}

function residencySatisfied(
  required: Record<string, unknown>,
  environment: RuntimeEnvironment,
): boolean {
  const keys = Object.keys(required ?? {});
  if (keys.length === 0) return true;
  const envConstraints = environment.dataResidencyConstraints ?? {};
  for (const key of keys) {
    const want = required[key];
    if (want == null) continue;
    const got = envConstraints[key] ?? (key === 'region' ? environment.region : undefined);
    if (got == null || String(got) !== String(want)) return false;
  }
  return true;
}

function securitySatisfied(
  required: string | null,
  environment: RuntimeEnvironment,
): boolean {
  if (!required) return true;
  if (!environment.securityClassification) return false;
  return environment.securityClassification === required;
}

function resolveCompatibility(
  input: PlacementEngineInput,
  platform: ProductPlatform,
  environment: RuntimeEnvironment,
  profile: DeploymentProfile,
  contract: ProductControlContract,
): { result: CompatibilityResult; reasons: string[] } {
  if (typeof input.compatibility === 'function') {
    const out = input.compatibility({ platform, environment, profile, contract });
    if (typeof out === 'string') return { result: out, reasons: [] };
    return { result: out.result, reasons: out.reasons ?? [] };
  }
  const hit = input.compatibility.find(
    (c) =>
      c.platformId === platform.id &&
      c.environmentId === environment.id &&
      c.profileId === profile.id &&
      c.contractId === contract.id,
  );
  if (!hit) {
    return {
      result: CompatibilityResult.REQUIRES_REVIEW,
      reasons: ['Compatibility evidence missing for candidate'],
    };
  }
  return { result: hit.result, reasons: hit.reasons ?? [] };
}

function evaluateCapacityForEnv(
  environmentId: string,
  platformId: string,
  requirements: CapacityRequirements,
  rows: CapacityInventoryRecord[],
  now: Date,
): {
  failures: string[];
  snapshot: Record<string, unknown>;
  blocked: boolean;
} {
  const failures: string[] = [];
  const snapshot: Record<string, unknown> = {};
  const entries = Object.entries(requirements ?? {});
  if (entries.length === 0) {
    return { failures, snapshot, blocked: false };
  }

  for (const [resourceType, rawQty] of entries) {
    const required = Number(rawQty);
    const matching = rows.filter(
      (r) =>
        r.environmentId === environmentId &&
        r.platformId === platformId &&
        r.resourceType === resourceType &&
        r.capacityStatus === CapacityInventoryStatus.ACTIVE,
    );

    if (matching.length === 0) {
      failures.push(`CAPACITY_MISSING:${resourceType}`);
      snapshot[resourceType] = { required, available: null, missing: true };
      continue;
    }

    const ordered = [...matching].sort((a, b) => {
      if (a.measurementSource === b.measurementSource) return a.id.localeCompare(b.id);
      if (a.measurementSource === 'OBSERVED') return -1;
      if (b.measurementSource === 'OBSERVED') return 1;
      return a.id.localeCompare(b.id);
    });

    const fresh = ordered.find((r) => isFresh(r.validUntil, now));
    const row = fresh ?? ordered[0];
    const available = computeAvailable(row);
    snapshot[resourceType] = {
      inventoryId: row.id,
      required,
      available,
      validUntil: row.validUntil.toISOString(),
      measurementSource: row.measurementSource,
      fresh: Boolean(fresh),
    };

    if (!fresh) {
      failures.push(`CAPACITY_STALE:${resourceType}`);
      continue;
    }
    if (!hasSufficientCapacity(available, required)) {
      failures.push(`CAPACITY_INSUFFICIENT:${resourceType}`);
    }
  }

  return { failures, snapshot, blocked: failures.length > 0 };
}

function scoreCandidate(
  candidate: PlacementEngineCandidate,
  request: PlacementRequestRecord,
  policy: PlacementPolicyRecord | null,
): { score: number; breakdown: Record<string, unknown> } {
  const weights = (policy?.scoringWeights ?? {}) as Record<string, number>;
  const wRegion = Number(weights.regionMatch ?? 10);
  const wHeadroom = Number(weights.capacityHeadroom ?? 5);
  const wPreferredPlatform = Number(weights.preferredPlatform ?? 8);
  const wCompat = Number(weights.compatibilityBonus ?? 20);

  let score = 0;
  const breakdown: Record<string, unknown> = {};

  if (
    request.requestedRegion &&
    candidate.region &&
    request.requestedRegion === candidate.region
  ) {
    score += wRegion;
    breakdown.regionMatch = wRegion;
  } else {
    breakdown.regionMatch = 0;
  }

  if (request.platformId && request.platformId === candidate.platformId) {
    score += wPreferredPlatform;
    breakdown.preferredPlatform = wPreferredPlatform;
  } else {
    breakdown.preferredPlatform = 0;
  }

  if (candidate.compatibilityResult === CompatibilityResult.COMPATIBLE) {
    score += wCompat;
    breakdown.compatibilityBonus = wCompat;
  } else {
    breakdown.compatibilityBonus = 0;
  }

  let headroomPoints = 0;
  const snap = candidate.capacitySnapshot as Record<
    string,
    { available?: number | null; required?: number }
  >;
  const ratios: number[] = [];
  for (const v of Object.values(snap)) {
    if (v && typeof v.available === 'number' && typeof v.required === 'number' && v.required > 0) {
      ratios.push(Math.min(v.available / v.required, 10));
    }
  }
  if (ratios.length > 0) {
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    headroomPoints = Math.min(wHeadroom * avg, wHeadroom * 3);
    score += headroomPoints;
  }
  breakdown.capacityHeadroom = headroomPoints;

  return { score: Number(score.toFixed(4)), breakdown };
}

/**
 * Deterministic fail-closed placement engine.
 * Empty allowlists / REQUIRES_REVIEW / missing capacity never yield PLACED.
 */
export function evaluatePlacement(input: PlacementEngineInput): PlacementEngineResult {
  const { request, product, version, platforms, environments, profiles, contracts, now } =
    input;
  const policy = input.policy;

  const evaluationSnapshot: Record<string, unknown> = {
    productRegistryId: product.id,
    productRegistryVersion: product.version,
    technicalVersionId: version.id,
    technicalVersion: version.technicalVersion,
    policyId: policy?.id ?? null,
    policyVersion: policy?.policyVersion ?? null,
    algorithmName: PLACEMENT_ALGORITHM_NAME,
    algorithmVersion: policy?.algorithmVersion ?? PLACEMENT_ALGORITHM_VERSION,
    evaluatedAt: now.toISOString(),
    requestId: request.id,
    capacityRequirements: request.capacityRequirements,
  };

  const policyEvaluationSnapshot: Record<string, unknown> = {
    policyId: policy?.id ?? null,
    policyCode: policy?.code ?? null,
    policyVersion: policy?.policyVersion ?? null,
    policyStatus: policy?.policyStatus ?? null,
    hardConstraints: policy?.hardConstraints ?? {},
    scoringWeights: policy?.scoringWeights ?? {},
    scope: policy?.scope ?? {},
  };

  const globalHard: string[] = [];
  const globalReview: string[] = [];

  if (
    product.registryStatus !== RegistryLifecycleStatus.CERTIFIED ||
    product.certificationStatus !== CertificationStatus.CERTIFIED ||
    !product.provisionable
  ) {
    globalHard.push('PRODUCT_NOT_CERTIFIED_PROVISIONABLE');
  }
  if (version.versionStatus !== TechnicalVersionStatus.PUBLISHED) {
    globalHard.push('TECHNICAL_VERSION_NOT_PUBLISHED');
  }
  if (version.supportEndsAt && version.supportEndsAt.getTime() < now.getTime()) {
    globalHard.push('TECHNICAL_VERSION_SUPPORT_ENDED');
  }

  const scopeProductIds = asStringArray(
    (policy?.scope as { productIds?: unknown } | undefined)?.productIds,
  );
  if (policy) {
    if (scopeProductIds.length === 0) {
      // Empty policy product allowlist → never auto-place.
      globalReview.push('POLICY_EMPTY_PRODUCT_ALLOWLIST');
    } else if (!scopeProductIds.includes(product.productId)) {
      globalHard.push('POLICY_PRODUCT_OUT_OF_SCOPE');
    }
  }

  if (
    asStringArray(product.compatiblePlatformIds).length === 0 ||
    asStringArray(product.compatibleEnvironmentIds).length === 0 ||
    asStringArray(product.compatibleProfileIds).length === 0 ||
    asStringArray(product.compatibleContractIds).length === 0
  ) {
    globalReview.push('EMPTY_PRODUCT_ALLOWLIST');
  }

  const candidates: PlacementEngineCandidate[] = [];

  for (const platform of platforms) {
    if (request.platformId && platform.id !== request.platformId) continue;

    for (const environment of environments.filter((e) => e.platformId === platform.id)) {
      if (environment.environmentType !== request.requestedEnvironmentType) continue;
      if (
        request.requestedRegion &&
        environment.region &&
        environment.region !== request.requestedRegion
      ) {
        continue;
      }

      for (const profile of profiles) {
        if (request.deploymentProfileId && profile.id !== request.deploymentProfileId) {
          // When a specific profile is requested, only that profile is a candidate.
          continue;
        }
        if (
          !request.deploymentProfileId &&
          request.requestedDeploymentModel &&
          String(profile.code) !== request.requestedDeploymentModel
        ) {
          continue;
        }

        const contractList = contracts.filter(
          (c) =>
            c.platformId === platform.id &&
            c.productId === product.productId &&
            (!request.contractId || c.id === request.contractId),
        );

        if (contractList.length === 0) {
          candidates.push({
            platformId: platform.id,
            environmentId: environment.id,
            profileId: profile.id,
            contractId: request.contractId,
            contractVersion: null,
            region: environment.region,
            rank: null,
            passedHardConstraints: false,
            hardConstraintFailures: [...globalHard, 'NO_MATCHING_CONTRACT'],
            compatibilityResult: null,
            score: null,
            scoringBreakdown: {},
            capacitySnapshot: {},
            excluded: true,
            exclusionReason: 'No matching control contract',
            placeable: false,
            requiresReview: globalReview.length > 0,
            capacityBlocked: false,
          });
          continue;
        }

        for (const contract of contractList) {
          const hard: string[] = [...globalHard];
          const review: string[] = [...globalReview];

          if (
            platform.operationalStatus !== PlatformOperationalStatus.ACTIVE ||
            platform.certificationStatus !== CertificationStatus.CERTIFIED
          ) {
            hard.push('PLATFORM_NOT_ACTIVE_CERTIFIED');
          }
          if (environment.environmentStatus !== EnvironmentStatus.ACTIVE) {
            hard.push('ENVIRONMENT_NOT_ACTIVE');
          }

          const isProduction = request.requestedEnvironmentType === 'PRODUCTION';
          if (profile.profileStatus !== ProfileStatus.ACTIVE) {
            hard.push('PROFILE_NOT_ACTIVE');
          }
          if (profile.certificationStatus !== CertificationStatus.CERTIFIED) {
            if (isProduction) hard.push('PROFILE_UNCERTIFIED_PRODUCTION');
            else review.push('PROFILE_UNCERTIFIED');
          }

          if (!residencySatisfied(request.dataResidencyConstraints, environment)) {
            hard.push('DATA_RESIDENCY_MISMATCH');
          }
          if (!securitySatisfied(request.securityClassification, environment)) {
            hard.push('SECURITY_CLASSIFICATION_MISMATCH');
          }

          const hardPolicy = (policy?.hardConstraints ?? {}) as Record<string, unknown>;
          if (
            hardPolicy.requireCertifiedProfile === true &&
            profile.certificationStatus !== CertificationStatus.CERTIFIED
          ) {
            hard.push('POLICY_REQUIRE_CERTIFIED_PROFILE');
          }

          const compat = resolveCompatibility(input, platform, environment, profile, contract);
          if (compat.result === CompatibilityResult.INCOMPATIBLE) {
            hard.push('COMPATIBILITY_INCOMPATIBLE');
          } else if (compat.result === CompatibilityResult.REQUIRES_REVIEW) {
            review.push('COMPATIBILITY_REQUIRES_REVIEW');
          }

          const capacity = evaluateCapacityForEnv(
            environment.id,
            platform.id,
            request.capacityRequirements ?? {},
            input.capacityRows,
            now,
          );
          if (capacity.blocked) {
            hard.push(...capacity.failures);
          }

          const nonCapacityHard = hard.filter((f) => !f.startsWith('CAPACITY_'));
          const capacityBlocked = capacity.blocked;
          const requiresReview = review.length > 0;
          // Survivors must clear non-capacity hard gates AND capacity freshness/sufficiency.
          const passedHardConstraints = nonCapacityHard.length === 0 && !capacityBlocked;
          const placeable =
            passedHardConstraints &&
            !requiresReview &&
            compat.result === CompatibilityResult.COMPATIBLE;

          const excluded =
            hard.includes('COMPATIBILITY_INCOMPATIBLE') || nonCapacityHard.length > 0;

          candidates.push({
            platformId: platform.id,
            environmentId: environment.id,
            profileId: profile.id,
            contractId: contract.id,
            contractVersion: contract.contractVersion,
            region: environment.region,
            rank: null,
            passedHardConstraints,
            hardConstraintFailures: [...hard, ...review],
            compatibilityResult: compat.result,
            score: null,
            scoringBreakdown: {},
            capacitySnapshot: capacity.snapshot,
            excluded,
            exclusionReason: excluded
              ? [...hard, ...compat.reasons].join('; ')
              : capacityBlocked
                ? capacity.failures.join('; ')
                : requiresReview
                  ? review.join('; ')
                  : null,
            placeable,
            requiresReview,
            capacityBlocked,
          });
        }
      }
    }
  }

  // Score only survivors (passed hard constraints including capacity freshness/sufficiency).
  const survivors = candidates.filter((c) => c.passedHardConstraints);
  for (const c of survivors) {
    const { score, breakdown } = scoreCandidate(c, request, policy);
    c.score = score;
    c.scoringBreakdown = breakdown;
  }

  const ranked = [...survivors].sort((a, b) => {
    const sa = a.score ?? Number.NEGATIVE_INFINITY;
    const sb = b.score ?? Number.NEGATIVE_INFINITY;
    if (sb !== sa) return sb - sa;
    const envCmp = a.environmentId.localeCompare(b.environmentId);
    if (envCmp !== 0) return envCmp;
    return a.platformId.localeCompare(b.platformId);
  });
  ranked.forEach((c, idx) => {
    c.rank = idx + 1;
  });

  const placeable = ranked.filter((c) => c.placeable);
  const reviewSurvivors = ranked.filter((c) => c.requiresReview);
  const capacityOnlyBlocked = candidates.filter((c) => {
    const nonCapacityHard = c.hardConstraintFailures.filter(
      (f) =>
        !f.startsWith('CAPACITY_') &&
        f !== 'COMPATIBILITY_REQUIRES_REVIEW' &&
        f !== 'EMPTY_PRODUCT_ALLOWLIST' &&
        f !== 'POLICY_EMPTY_PRODUCT_ALLOWLIST' &&
        f !== 'PROFILE_UNCERTIFIED',
    );
    return (
      c.capacityBlocked &&
      nonCapacityHard.length === 0 &&
      c.compatibilityResult !== CompatibilityResult.INCOMPATIBLE
    );
  });

  let decisionStatus: PlacementEngineResult['decisionStatus'];
  let selected: PlacementEngineResult['selected'] = null;
  let rejectionSummary: string | null = null;
  let scoringBreakdown: Record<string, unknown> = {};

  if (placeable.length > 0) {
    const winner = placeable[0];
    decisionStatus = PlacementDecisionStatus.PLACED;
    selected = {
      platformId: winner.platformId,
      environmentId: winner.environmentId,
      profileId: winner.profileId,
      region: winner.region,
      technicalVersionId: version.id,
      contractId: winner.contractId,
      contractVersion: winner.contractVersion,
    };
    scoringBreakdown = {
      winnerScore: winner.score,
      winnerBreakdown: winner.scoringBreakdown,
      rankedCount: ranked.length,
      placeableCount: placeable.length,
    };
  } else if (reviewSurvivors.length > 0 || globalReview.length > 0) {
    // Review signal on otherwise hard-passing candidates (or global empty allowlists).
    // If the only issue is capacity on COMPATIBLE paths and there is no review signal beyond that,
    // prefer NO_CAPACITY — handled below when globalReview empty and no reviewSurvivors.
    const hasRealReview =
      globalReview.length > 0 ||
      reviewSurvivors.length > 0 ||
      candidates.some(
        (c) =>
          c.requiresReview &&
          c.compatibilityResult !== CompatibilityResult.INCOMPATIBLE,
      );
    if (hasRealReview) {
      decisionStatus = PlacementDecisionStatus.REQUIRES_REVIEW;
      rejectionSummary =
        'No auto-placeable candidate; operator review required (empty allowlists, compatibility review, or policy scope).';
      scoringBreakdown = {
        rankedCount: ranked.length,
        reviewableCount: reviewSurvivors.length,
      };
    } else if (capacityOnlyBlocked.length > 0) {
      decisionStatus = PlacementDecisionStatus.NO_CAPACITY;
      rejectionSummary = 'No candidate has fresh sufficient capacity for requested resources';
    } else {
      decisionStatus = PlacementDecisionStatus.NO_COMPATIBLE_TARGET;
      rejectionSummary = 'No compatible placement target after hard constraints';
    }
  } else if (capacityOnlyBlocked.length > 0) {
    decisionStatus = PlacementDecisionStatus.NO_CAPACITY;
    rejectionSummary = 'No candidate has fresh sufficient capacity for requested resources';
  } else {
    decisionStatus = PlacementDecisionStatus.NO_COMPATIBLE_TARGET;
    rejectionSummary =
      candidates.length === 0
        ? 'No candidates generated for requested environment/profile/platform'
        : 'No compatible placement target after hard constraints';
  }

  candidates.sort((a, b) => {
    if (a.rank != null && b.rank != null) return a.rank - b.rank;
    if (a.rank != null) return -1;
    if (b.rank != null) return 1;
    return (
      a.environmentId.localeCompare(b.environmentId) ||
      a.platformId.localeCompare(b.platformId)
    );
  });

  return {
    decisionStatus,
    selected,
    candidates,
    scoringBreakdown,
    policyEvaluationSnapshot,
    evaluationSnapshot,
    rejectionSummary,
    algorithmName: PLACEMENT_ALGORITHM_NAME,
    algorithmVersion: policy?.algorithmVersion ?? PLACEMENT_ALGORITHM_VERSION,
    policyId: policy?.id ?? null,
    policyVersion: policy?.policyVersion ?? null,
  };
}

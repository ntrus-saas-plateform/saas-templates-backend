import type {
  CommercialInclusionType,
  CommercialOfferStatus,
  CommercialReadinessResult,
  PlanTier,
} from '../commercial/commercial.entity.js';

export const COMMERCIAL_REPOSITORY_PORT = Symbol('COMMERCIAL_REPOSITORY_PORT');

export type CommercialMarket = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly verticalId: string;
  readonly geographicScope: string | null;
  readonly marketStatus: string;
  readonly researchStatus: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type CommercialPlan = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly productId: string;
  readonly verticalId: string;
  readonly planTier: PlanTier;
  readonly solutionPackageId: string | null;
  readonly status: CommercialOfferStatus | string;
  readonly version: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type SolutionPackage = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly productId: string;
  readonly verticalId: string;
  readonly status: string;
  readonly version: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type CommercialAddon = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly productId: string;
  readonly addonType: string;
  readonly status: string;
  readonly version: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type IcpDefinition = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly verticalId: string;
  readonly productId: string;
  readonly status: string;
  readonly version: number;
  readonly attributes: Record<string, unknown>;
  readonly scoring: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type PriceBook = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly productId: string;
  readonly currency: string;
  readonly geographicScope: string | null;
  readonly status: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type PriceBookEntry = {
  readonly id: string;
  readonly priceBookId: string;
  readonly commercialItemType: string;
  readonly commercialItemId: string;
  readonly currency: string;
  readonly amount: string;
  readonly billingFrequency: string | null;
};

export type CommercialReadinessEvaluation = {
  readonly id: string;
  readonly offerType: string;
  readonly offerId: string;
  readonly productId: string;
  readonly result: CommercialReadinessResult;
  readonly checks: readonly unknown[];
  readonly blockers: readonly unknown[];
  readonly warnings: readonly unknown[];
  readonly createdAt: Date;
};

export interface CommercialRepositoryPort {
  createMarket(input: {
    code: string;
    name: string;
    description?: string | null;
    verticalId: string;
    geographicScope?: string | null;
    marketCategory?: string | null;
    ownerRef?: string | null;
    metadata?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<CommercialMarket>;
  listMarkets(input: {
    page: number;
    limit: number;
    verticalId?: string;
  }): Promise<{ items: readonly CommercialMarket[]; total: number }>;
  getMarket(id: string): Promise<CommercialMarket | null>;

  createIcp(input: {
    code: string;
    name: string;
    description?: string | null;
    verticalId: string;
    productId: string;
    attributes?: Record<string, unknown>;
    scoring?: Record<string, unknown>;
    segmentIds?: readonly string[];
    createdBy?: string | null;
  }): Promise<IcpDefinition>;
  listIcps(productId?: string): Promise<readonly IcpDefinition[]>;
  getIcp(id: string): Promise<IcpDefinition | null>;

  createPackage(input: {
    code: string;
    name: string;
    description?: string | null;
    productId: string;
    verticalId: string;
    packageType?: string | null;
    createdBy?: string | null;
  }): Promise<SolutionPackage>;
  listPackages(productId?: string): Promise<readonly SolutionPackage[]>;
  getPackage(id: string): Promise<SolutionPackage | null>;
  addPackageCapability(input: {
    packageId: string;
    capabilityId: string;
    inclusionType: CommercialInclusionType;
  }): Promise<void>;
  listPackageCapabilities(
    packageId: string,
  ): Promise<readonly { capabilityId: string; inclusionType: string }[]>;

  createPlan(input: {
    code: string;
    name: string;
    description?: string | null;
    productId: string;
    verticalId: string;
    planTier: PlanTier;
    solutionPackageId?: string | null;
    createdBy?: string | null;
  }): Promise<CommercialPlan>;
  listPlans(productId?: string): Promise<readonly CommercialPlan[]>;
  getPlan(id: string): Promise<CommercialPlan | null>;
  updatePlanStatus(id: string, status: string): Promise<CommercialPlan>;
  addPlanCapability(input: {
    planId: string;
    capabilityId: string;
    inclusionType: CommercialInclusionType;
  }): Promise<void>;
  listPlanCapabilities(
    planId: string,
  ): Promise<readonly { capabilityId: string; inclusionType: string }[]>;

  createAddon(input: {
    code: string;
    name: string;
    description?: string | null;
    productId: string;
    addonType?: string;
    createdBy?: string | null;
  }): Promise<CommercialAddon>;
  listAddons(productId?: string): Promise<readonly CommercialAddon[]>;
  getAddon(id: string): Promise<CommercialAddon | null>;
  addAddonCapability(input: {
    addonId: string;
    capabilityId: string;
    inclusionType: CommercialInclusionType;
  }): Promise<void>;
  listAddonCapabilities(
    addonId: string,
  ): Promise<readonly { capabilityId: string; inclusionType: string }[]>;
  linkAddonToPlan(input: {
    addonId: string;
    planId: string;
    compatibility: string;
  }): Promise<void>;

  createPricingUnit(input: {
    code: string;
    name: string;
    description?: string | null;
    unitCategory?: string | null;
  }): Promise<{ id: string; code: string; name: string }>;
  listPricingUnits(): Promise<readonly { id: string; code: string; name: string }[]>;

  createPriceBook(input: {
    code: string;
    name: string;
    productId: string;
    currency: string;
    geographicScope?: string | null;
    createdBy?: string | null;
  }): Promise<PriceBook>;
  listPriceBooks(productId?: string): Promise<readonly PriceBook[]>;
  getPriceBook(id: string): Promise<PriceBook | null>;
  addPriceBookEntry(input: {
    priceBookId: string;
    commercialItemType: string;
    commercialItemId: string;
    currency: string;
    amount: string;
    billingFrequency?: string | null;
  }): Promise<PriceBookEntry>;
  listPriceBookEntries(priceBookId: string): Promise<readonly PriceBookEntry[]>;

  createReadinessEvaluation(input: {
    offerType: string;
    offerId: string;
    productId: string;
    result: CommercialReadinessResult;
    checks: readonly unknown[];
    blockers: readonly unknown[];
    warnings: readonly unknown[];
    triggeredBy?: string | null;
  }): Promise<CommercialReadinessEvaluation>;
  createPublicationSnapshot(input: {
    offerType: string;
    offerId: string;
    productId: string;
    snapshot: Record<string, unknown>;
    readinessEvaluationId?: string | null;
    publishedBy?: string | null;
  }): Promise<{ id: string; publishedAt: Date }>;

  createPersona(input: {
    code: string;
    name: string;
    roleLabel: string;
    verticalId?: string | null;
    productId?: string | null;
    attributes?: Record<string, unknown>;
    influenceLevel?: string | null;
    decisionAuthority?: string | null;
  }): Promise<{
    id: string;
    code: string;
    name: string;
    roleLabel: string;
    status: string;
  }>;
  listPersonas(productId?: string): Promise<
    readonly {
      id: string;
      code: string;
      name: string;
      roleLabel: string;
      status: string;
      productId: string | null;
      verticalId: string | null;
    }[]
  >;

  createValueProposition(input: {
    code: string;
    name: string;
    productId: string;
    verticalId: string;
    segmentId?: string | null;
    icpId?: string | null;
    targetAudience?: string | null;
    customerProblem?: string | null;
    proposedSolution?: string | null;
    expectedOutcome?: string | null;
    differentiation?: string | null;
    positioningStatement?: string | null;
    evidence?: readonly unknown[];
    limitations?: string | null;
  }): Promise<{
    id: string;
    code: string;
    name: string;
    productId: string;
    status: string;
    validationStatus: string;
  }>;
  listValuePropositions(productId?: string): Promise<
    readonly {
      id: string;
      code: string;
      name: string;
      productId: string;
      status: string;
      validationStatus: string;
    }[]
  >;

  createDiscountPolicy(input: {
    code: string;
    name: string;
    productId?: string | null;
    discountType: string;
    maxPercentage?: string | null;
    maxAmount?: string | null;
    approvalMatrix?: readonly unknown[];
  }): Promise<{
    id: string;
    code: string;
    name: string;
    discountType: string;
    status: string;
  }>;
  listDiscountPolicies(productId?: string): Promise<
    readonly {
      id: string;
      code: string;
      name: string;
      discountType: string;
      status: string;
      maxPercentage: string | null;
      maxAmount: string | null;
    }[]
  >;

  createResearchProject(input: {
    marketId: string;
    code: string;
    title: string;
    researchQuestion?: string | null;
    hypothesis?: string | null;
    methodology?: string | null;
    ownerRef?: string | null;
    geographicScope?: string | null;
  }): Promise<{ id: string; code: string; title: string; status: string; marketId: string }>;
  listResearchProjects(marketId?: string): Promise<
    readonly { id: string; code: string; title: string; status: string; marketId: string }[]
  >;
  addResearchSource(input: {
    projectId: string;
    sourceType: string;
    title: string;
    uri?: string | null;
    reliability?: string | null;
    confidence?: string | null;
    notes?: string | null;
  }): Promise<{ id: string; projectId: string; title: string; sourceType: string }>;
  completeResearchProject(input: {
    projectId: string;
    findings?: string | null;
    conclusions?: string | null;
    limitations?: string | null;
    confidenceLevel?: string | null;
  }): Promise<{ id: string; status: string }>;

  upsertSegmentIntelligence(input: {
    segmentId: string;
    commercialDescription?: string | null;
    lifecycleStatus?: string;
    attractivenessScore?: string | null;
    strategicFitScore?: string | null;
    productReadinessScore?: string | null;
    overallPriorityScore?: string | null;
    researchConfidence?: string;
    notes?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string; segmentId: string; lifecycleStatus: string; researchConfidence: string }>;
  listSegmentIntelligence(segmentId?: string): Promise<
    readonly {
      id: string;
      segmentId: string;
      lifecycleStatus: string;
      researchConfidence: string;
      overallPriorityScore: string | null;
    }[]
  >;
  getSegmentPriorityModel(code?: string): Promise<{
    id: string;
    code: string;
    weights: Record<string, number>;
    version: number;
  } | null>;

  createPricingModel(input: {
    code: string;
    name: string;
    modelType: string;
    productId: string;
    pricingUnitId?: string | null;
    components?: Record<string, unknown>;
    currency?: string | null;
  }): Promise<{ id: string; code: string; modelType: string; productId: string }>;
  listPricingModels(productId?: string): Promise<
    readonly { id: string; code: string; name: string; modelType: string; productId: string }[]
  >;

  createUsageMetric(input: {
    code: string;
    name: string;
    description?: string | null;
    pricingUnitId?: string | null;
    sourceEvent?: string | null;
    aggregationWindow?: string | null;
    aggregationMethod?: string | null;
    deduplicationRequired?: boolean;
  }): Promise<{ id: string; code: string; name: string }>;
  listUsageMetrics(): Promise<readonly { id: string; code: string; name: string; status: string }[]>;

  createBuyingCommittee(input: {
    code: string;
    name: string;
    productId?: string | null;
    verticalId?: string | null;
    segmentId?: string | null;
    roles?: readonly unknown[];
  }): Promise<{ id: string; code: string; name: string }>;
  listBuyingCommittees(productId?: string): Promise<
    readonly { id: string; code: string; name: string; status: string }[]
  >;

  createDecisionJourney(input: {
    code: string;
    name: string;
    productId?: string | null;
    verticalId?: string | null;
    stages?: readonly unknown[];
  }): Promise<{ id: string; code: string; name: string }>;
  listDecisionJourneys(productId?: string): Promise<
    readonly { id: string; code: string; name: string; status: string }[]
  >;

  createEnterpriseTemplate(input: {
    code: string;
    name: string;
    description?: string | null;
    productId: string;
    verticalId: string;
    solutionPackageId?: string | null;
    basePlanId?: string | null;
    deploymentProfile?: Record<string, unknown>;
    supportProfile?: Record<string, unknown>;
    slaProfile?: Record<string, unknown>;
    negotiableTerms?: readonly unknown[];
    nonNegotiableTerms?: readonly unknown[];
    approvalLevelRequired?: string | null;
    createdBy?: string | null;
  }): Promise<{ id: string; code: string; name: string; status: string; version: number }>;
  listEnterpriseTemplates(productId?: string): Promise<
    readonly {
      id: string;
      code: string;
      name: string;
      status: string;
      productId: string;
      verticalId: string;
    }[]
  >;
  getEnterpriseTemplate(id: string): Promise<{
    id: string;
    code: string;
    name: string;
    status: string;
    productId: string;
    verticalId: string;
    version: number;
    deploymentProfile: Record<string, unknown>;
    basePlanId: string | null;
    solutionPackageId: string | null;
  } | null>;
  updateEnterpriseTemplateStatus(
    id: string,
    status: string,
  ): Promise<{
    id: string;
    code: string;
    name: string;
    status: string;
    productId: string;
    version: number;
  }>;
  updateAddonStatus(id: string, status: string): Promise<CommercialAddon>;

  createEligibilityPolicy(input: {
    code: string;
    name: string;
    productId?: string | null;
    offerType?: string;
    offerId?: string | null;
    rules?: Record<string, unknown>;
  }): Promise<{ id: string; code: string; name: string; version: number }>;
  listEligibilityPolicies(productId?: string): Promise<
    readonly { id: string; code: string; name: string; offerType: string; version: number }[]
  >;
  getEligibilityPolicy(id: string): Promise<{
    id: string;
    code: string;
    rules: Record<string, unknown>;
    version: number;
    productId: string | null;
  } | null>;

  addMarketAssessment(input: {
    marketId: string;
    dimension: string;
    valueText?: string | null;
    valueNumeric?: string | null;
    unknown?: boolean;
    sourceRef?: string | null;
    confidence?: string | null;
  }): Promise<{ id: string; marketId: string; dimension: string; unknown: boolean }>;
  listMarketAssessments(marketId: string): Promise<
    readonly {
      id: string;
      dimension: string;
      unknown: boolean;
      valueText: string | null;
      valueNumeric: string | null;
      sourceRef: string | null;
    }[]
  >;

  updatePackageStatus(id: string, status: string): Promise<SolutionPackage>;
  updatePriceBookStatus(id: string, status: string): Promise<PriceBook>;
  listPublicationSnapshots(input?: {
    offerType?: string;
    offerId?: string;
    productId?: string;
  }): Promise<
    readonly {
      id: string;
      offerType: string;
      offerId: string;
      productId: string;
      publishedAt: Date;
      publishedBy: string | null;
    }[]
  >;
}

import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  scoreSegmentPriority,
  type SegmentPriorityWeights,
} from '../../domain/commercial/segment-priority.js';
import { assertCurrency } from '../../domain/commercial/pricing-math.js';
import { assertSameProductOwnership } from '../../domain/commercial/commercial.entity.js';
import {
  createSegmentPrioritizedEvent,
  EDGE_COMMERCIAL_OUTBOX_TENANT,
} from '../../domain/commercial/commercial.events.js';
import type { CommercialRepositoryPort } from '../../domain/ports/commercial-repository.port.js';
import type { ProductRepositoryPort } from '../../domain/ports/product-repository.port.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';

export class CreateResearchProjectUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  async execute(input: {
    marketId: string;
    code: string;
    title: string;
    researchQuestion?: string | null;
    hypothesis?: string | null;
    methodology?: string | null;
    ownerRef?: string | null;
    geographicScope?: string | null;
  }) {
    if (!(await this.commercial.getMarket(input.marketId))) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Market not found');
    }
    return this.commercial.createResearchProject(input);
  }
}

export class ListResearchProjectsUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(marketId?: string) {
    return this.commercial.listResearchProjects(marketId);
  }
}

export class AddResearchSourceUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(input: {
    projectId: string;
    sourceType: string;
    title: string;
    uri?: string | null;
    reliability?: string | null;
    confidence?: string | null;
    notes?: string | null;
  }) {
    return this.commercial.addResearchSource(input);
  }
}

export class CompleteResearchProjectUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(input: {
    projectId: string;
    findings?: string | null;
    conclusions?: string | null;
    limitations?: string | null;
    confidenceLevel?: string | null;
  }) {
    return this.commercial.completeResearchProject(input);
  }
}

export class UpsertSegmentIntelligenceUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(input: {
    segmentId: string;
    commercialDescription?: string | null;
    lifecycleStatus?: string;
    attractivenessScore?: string | null;
    strategicFitScore?: string | null;
    productReadinessScore?: string | null;
    notes?: string | null;
    scores?: Partial<SegmentPriorityWeights>;
  }) {
    return this.commercial.upsertSegmentIntelligence({
      segmentId: input.segmentId,
      commercialDescription: input.commercialDescription,
      lifecycleStatus: input.lifecycleStatus,
      attractivenessScore: input.attractivenessScore,
      strategicFitScore: input.strategicFitScore,
      productReadinessScore: input.productReadinessScore,
      notes: input.notes,
      researchConfidence: 'NEEDS_RESEARCH',
    });
  }
}

export class ScoreSegmentPriorityUseCase {
  constructor(
    private readonly commercial: CommercialRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    segmentId: string;
    scores: Partial<SegmentPriorityWeights>;
    modelCode?: string;
    actorId?: string;
  }) {
    const model = await this.commercial.getSegmentPriorityModel(
      input.modelCode ?? 'DEFAULT_SEGMENT_PRIORITY',
    );
    if (!model) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Segment priority model not found');
    }
    const scored = scoreSegmentPriority({
      scores: input.scores,
      weights: model.weights as SegmentPriorityWeights,
      weightsVersion: model.version,
    });

    const lifecycleStatus =
      scored.status === 'NEEDS_RESEARCH' ? 'RESEARCHING' : 'EVALUATED';

    await this.commercial.upsertSegmentIntelligence({
      segmentId: input.segmentId,
      overallPriorityScore: scored.overall,
      researchConfidence: scored.status === 'NEEDS_RESEARCH' ? 'NEEDS_RESEARCH' : 'SCORED',
      lifecycleStatus,
      metadata: { lastScore: scored },
    });

    if (this.outbox && input.actorId && scored.status !== 'NEEDS_RESEARCH') {
      const event = createSegmentPrioritizedEvent({
        actorId: input.actorId,
        correlationId: input.segmentId,
        segmentId: input.segmentId,
        overallPriorityScore: scored.overall,
        lifecycleStatus: 'PRIORITIZED',
      });
      await this.outbox.runWithOutbox(EDGE_COMMERCIAL_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(event);
      });
    }

    return scored;
  }
}

export class ListSegmentIntelligenceUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(segmentId?: string) {
    return this.commercial.listSegmentIntelligence(segmentId);
  }
}

export class CreatePricingModelUseCase {
  constructor(
    private readonly commercial: CommercialRepositoryPort,
    private readonly products: ProductRepositoryPort,
  ) {}

  async execute(input: {
    code: string;
    name: string;
    modelType: string;
    productId: string;
    pricingUnitId?: string | null;
    components?: Record<string, unknown>;
    currency?: string | null;
  }) {
    if (!(await this.products.findById(input.productId))) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    }
    return this.commercial.createPricingModel({
      ...input,
      currency: input.currency ? assertCurrency(input.currency) : null,
    });
  }
}

export class ListPricingModelsUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(productId?: string) {
    return this.commercial.listPricingModels(productId);
  }
}

export class CreateUsageMetricUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(input: {
    code: string;
    name: string;
    description?: string | null;
    pricingUnitId?: string | null;
    sourceEvent?: string | null;
    aggregationWindow?: string | null;
    aggregationMethod?: string | null;
    deduplicationRequired?: boolean;
  }) {
    return this.commercial.createUsageMetric(input);
  }
}

export class ListUsageMetricsUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute() {
    return this.commercial.listUsageMetrics();
  }
}

export class CreateBuyingCommitteeUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(input: {
    code: string;
    name: string;
    productId?: string | null;
    verticalId?: string | null;
    segmentId?: string | null;
    roles?: readonly unknown[];
  }) {
    return this.commercial.createBuyingCommittee(input);
  }
}

export class ListBuyingCommitteesUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(productId?: string) {
    return this.commercial.listBuyingCommittees(productId);
  }
}

export class CreateDecisionJourneyUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(input: {
    code: string;
    name: string;
    productId?: string | null;
    verticalId?: string | null;
    stages?: readonly unknown[];
  }) {
    return this.commercial.createDecisionJourney(input);
  }
}

export class ListDecisionJourneysUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(productId?: string) {
    return this.commercial.listDecisionJourneys(productId);
  }
}

export class CreateEnterpriseTemplateUseCase {
  constructor(
    private readonly commercial: CommercialRepositoryPort,
    private readonly products: ProductRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    productId: string;
    solutionPackageId?: string | null;
    basePlanId?: string | null;
    deploymentProfile?: Record<string, unknown>;
    supportProfile?: Record<string, unknown>;
    slaProfile?: Record<string, unknown>;
    negotiableTerms?: readonly unknown[];
    nonNegotiableTerms?: readonly unknown[];
    approvalLevelRequired?: string | null;
  }) {
    const product = await this.products.findById(input.productId);
    if (!product) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');

    if (input.solutionPackageId) {
      const pkg = await this.commercial.getPackage(input.solutionPackageId);
      if (!pkg) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Package not found');
      assertSameProductOwnership({
        productId: product.id,
        otherProductId: pkg.productId,
        context: 'enterprise-package',
      });
    }
    if (input.basePlanId) {
      const plan = await this.commercial.getPlan(input.basePlanId);
      if (!plan) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Plan not found');
      assertSameProductOwnership({
        productId: product.id,
        otherProductId: plan.productId,
        context: 'enterprise-plan',
      });
      if (plan.planTier !== 'ENTERPRISE' && plan.planTier !== 'CUSTOM') {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Enterprise template base plan should be ENTERPRISE or CUSTOM tier',
        );
      }
    }

    return this.commercial.createEnterpriseTemplate({
      ...input,
      verticalId: product.verticalId,
      createdBy: input.actorId,
    });
  }
}

export class ListEnterpriseTemplatesUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(productId?: string) {
    return this.commercial.listEnterpriseTemplates(productId);
  }
}

export class CreateEligibilityPolicyUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(input: {
    code: string;
    name: string;
    productId?: string | null;
    offerType?: string;
    offerId?: string | null;
    rules?: Record<string, unknown>;
  }) {
    return this.commercial.createEligibilityPolicy(input);
  }
}

export class ListEligibilityPoliciesUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(productId?: string) {
    return this.commercial.listEligibilityPolicies(productId);
  }
}

export class AddMarketAssessmentUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}

  async execute(input: {
    marketId: string;
    dimension: string;
    valueText?: string | null;
    valueNumeric?: string | null;
    unknown?: boolean;
    sourceRef?: string | null;
    confidence?: string | null;
  }) {
    if (!(await this.commercial.getMarket(input.marketId))) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Market not found');
    }
    const hasValue =
      (input.valueText != null && input.valueText !== '') ||
      (input.valueNumeric != null && input.valueNumeric !== '');
    const unknown = input.unknown ?? !hasValue;
    if (!unknown && !input.sourceRef) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Market assessment with a known value requires sourceRef provenance',
      );
    }
    return this.commercial.addMarketAssessment({ ...input, unknown });
  }
}

export class ListMarketAssessmentsUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(marketId: string) {
    return this.commercial.listMarketAssessments(marketId);
  }
}

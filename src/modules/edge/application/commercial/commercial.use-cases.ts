import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  assertCapabilityCommerciallyIncludable,
  assertPublicationAllowed,
  assertSameProductOwnership,
  CommercialInclusionType,
  evaluateCommercialReadiness,
  PlanTier,
  type CommercialCapabilityRef,
} from '../../domain/commercial/commercial.entity.js';
import {
  configureCommercialOffer,
  OfferConfiguratorMode,
} from '../../domain/commercial/offer-configurator.js';
import {
  createCommercialOfferPublishedEvent,
  createCommercialOfferReadinessEvaluatedEvent,
  createIcpCreatedEvent,
  createMarketCreatedEvent,
  createPriceBookPublishedEvent,
  createSolutionPackagePublishedEvent,
  EDGE_COMMERCIAL_OUTBOX_TENANT,
} from '../../domain/commercial/commercial.events.js';
import {
  assertCurrency,
  calculateCommercialPrice,
  type PricingTier,
} from '../../domain/commercial/pricing-math.js';
import type { CommercialRepositoryPort } from '../../domain/ports/commercial-repository.port.js';
import type { ProductRepositoryPort } from '../../domain/ports/product-repository.port.js';
import type { VerticalRepositoryPort } from '../../domain/ports/vertical-repository.port.js';
import type { CapabilityRepositoryPort } from '../../domain/ports/capability-repository.port.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';

export class CreateCommercialMarketUseCase {
  constructor(
    private readonly commercial: CommercialRepositoryPort,
    private readonly verticals: VerticalRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    verticalId: string;
    geographicScope?: string | null;
  }) {
    if (!(await this.verticals.findById(input.verticalId))) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Vertical not found');
    }
    const market = await this.commercial.createMarket({
      ...input,
      createdBy: input.actorId,
    });
    if (this.outbox) {
      const event = createMarketCreatedEvent({
        actorId: input.actorId,
        correlationId: market.id,
        marketId: market.id,
        code: market.code,
        verticalId: market.verticalId,
      });
      await this.outbox.runWithOutbox(EDGE_COMMERCIAL_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(event);
      });
    }
    return market;
  }
}

export class ListCommercialMarketsUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(input: { page: number; limit: number; verticalId?: string }) {
    return this.commercial.listMarkets(input);
  }
}

export class CreateIcpUseCase {
  constructor(
    private readonly commercial: CommercialRepositoryPort,
    private readonly products: ProductRepositoryPort,
    private readonly verticals: VerticalRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    verticalId: string;
    productId: string;
    attributes?: Record<string, unknown>;
    scoring?: Record<string, unknown>;
    segmentIds?: readonly string[];
  }) {
    const product = await this.products.findById(input.productId);
    if (!product) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    if (!(await this.verticals.findById(input.verticalId))) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Vertical not found');
    }
    assertSameProductOwnership({
      productId: product.id,
      otherProductId: product.id,
      context: 'icp',
    });
    if (product.verticalId !== input.verticalId) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'ICP vertical must match product vertical',
      );
    }
    const icp = await this.commercial.createIcp({ ...input, createdBy: input.actorId });
    if (this.outbox) {
      const event = createIcpCreatedEvent({
        actorId: input.actorId,
        correlationId: icp.id,
        icpId: icp.id,
        productId: icp.productId,
        code: icp.code,
      });
      await this.outbox.runWithOutbox(EDGE_COMMERCIAL_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(event);
      });
    }
    return icp;
  }
}

export class ListIcpsUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(productId?: string) {
    return this.commercial.listIcps(productId);
  }
}

export class CreateSolutionPackageUseCase {
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
    packageType?: string | null;
  }) {
    const product = await this.products.findById(input.productId);
    if (!product) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    return this.commercial.createPackage({
      ...input,
      verticalId: product.verticalId,
      createdBy: input.actorId,
    });
  }
}

export class AddPackageCapabilityUseCase {
  constructor(
    private readonly commercial: CommercialRepositoryPort,
    private readonly capabilities: CapabilityRepositoryPort,
  ) {}

  async execute(input: {
    packageId: string;
    capabilityId: string;
    inclusionType: CommercialInclusionType;
  }) {
    const pkg = await this.commercial.getPackage(input.packageId);
    if (!pkg) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Package not found');
    const cap = await this.capabilities.findById(input.capabilityId);
    if (!cap) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Capability not found');
    assertCapabilityCommerciallyIncludable(
      {
        capabilityId: cap.id,
        technicalStatus: cap.technicalStatus,
        commercialAvailability: cap.commercialAvailability,
      },
      input.inclusionType,
    );
    await this.commercial.addPackageCapability(input);
    return { packageId: input.packageId, capabilityId: input.capabilityId };
  }
}

export class ListPackagesUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(productId?: string) {
    return this.commercial.listPackages(productId);
  }
}

export class CreateCommercialPlanUseCase {
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
    planTier: PlanTier;
    solutionPackageId?: string | null;
  }) {
    const product = await this.products.findById(input.productId);
    if (!product) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    if (input.solutionPackageId) {
      const pkg = await this.commercial.getPackage(input.solutionPackageId);
      if (!pkg) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Solution package not found');
      assertSameProductOwnership({
        productId: product.id,
        otherProductId: pkg.productId,
        context: 'plan-package',
      });
    }
    return this.commercial.createPlan({
      ...input,
      verticalId: product.verticalId,
      createdBy: input.actorId,
    });
  }
}

export class AddPlanCapabilityUseCase {
  constructor(
    private readonly commercial: CommercialRepositoryPort,
    private readonly capabilities: CapabilityRepositoryPort,
  ) {}

  async execute(input: {
    planId: string;
    capabilityId: string;
    inclusionType: CommercialInclusionType;
  }) {
    const plan = await this.commercial.getPlan(input.planId);
    if (!plan) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Plan not found');
    const cap = await this.capabilities.findById(input.capabilityId);
    if (!cap) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Capability not found');
    assertCapabilityCommerciallyIncludable(
      {
        capabilityId: cap.id,
        technicalStatus: cap.technicalStatus,
        commercialAvailability: cap.commercialAvailability,
      },
      input.inclusionType,
    );
    await this.commercial.addPlanCapability(input);
    return { planId: input.planId, capabilityId: input.capabilityId };
  }
}

export class ListCommercialPlansUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(productId?: string) {
    return this.commercial.listPlans(productId);
  }
}

export class CreateCommercialAddonUseCase {
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
    addonType?: string;
  }) {
    if (!(await this.products.findById(input.productId))) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    }
    return this.commercial.createAddon({ ...input, createdBy: input.actorId });
  }
}

export class AddAddonCapabilityUseCase {
  constructor(
    private readonly commercial: CommercialRepositoryPort,
    private readonly capabilities: CapabilityRepositoryPort,
  ) {}

  async execute(input: {
    addonId: string;
    capabilityId: string;
    inclusionType: CommercialInclusionType;
  }) {
    const addon = await this.commercial.getAddon(input.addonId);
    if (!addon) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Add-on not found');
    const cap = await this.capabilities.findById(input.capabilityId);
    if (!cap) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Capability not found');
    assertCapabilityCommerciallyIncludable(
      {
        capabilityId: cap.id,
        technicalStatus: cap.technicalStatus,
        commercialAvailability: cap.commercialAvailability,
      },
      input.inclusionType,
    );
    await this.commercial.addAddonCapability(input);
    return { addonId: input.addonId, capabilityId: input.capabilityId };
  }
}

export class GetCommercialPlanUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  async execute(id: string) {
    const plan = await this.commercial.getPlan(id);
    if (!plan) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Plan not found');
    const capabilities = await this.commercial.listPlanCapabilities(id);
    return { ...plan, capabilities };
  }
}

export class GetSolutionPackageUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  async execute(id: string) {
    const pkg = await this.commercial.getPackage(id);
    if (!pkg) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Package not found');
    const capabilities = await this.commercial.listPackageCapabilities(id);
    return { ...pkg, capabilities };
  }
}

export class ListPriceBookEntriesUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  async execute(priceBookId: string) {
    if (!(await this.commercial.getPriceBook(priceBookId))) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Price book not found');
    }
    return this.commercial.listPriceBookEntries(priceBookId);
  }
}

export class LinkAddonToPlanUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}

  async execute(input: { addonId: string; planId: string; compatibility?: string }) {
    const addon = await this.commercial.getAddon(input.addonId);
    const plan = await this.commercial.getPlan(input.planId);
    if (!addon) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Add-on not found');
    if (!plan) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Plan not found');
    assertSameProductOwnership({
      productId: addon.productId,
      otherProductId: plan.productId,
      context: 'addon-plan',
    });
    await this.commercial.linkAddonToPlan({
      addonId: input.addonId,
      planId: input.planId,
      compatibility: input.compatibility ?? 'COMPATIBLE',
    });
    return { addonId: input.addonId, planId: input.planId };
  }
}

export class CreatePriceBookUseCase {
  constructor(
    private readonly commercial: CommercialRepositoryPort,
    private readonly products: ProductRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    productId: string;
    currency: string;
    geographicScope?: string | null;
  }) {
    if (!(await this.products.findById(input.productId))) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    }
    return this.commercial.createPriceBook({
      ...input,
      currency: assertCurrency(input.currency),
      createdBy: input.actorId,
    });
  }
}

export class AddPriceBookEntryUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}

  async execute(input: {
    priceBookId: string;
    commercialItemType: string;
    commercialItemId: string;
    amount: string;
    currency?: string;
    billingFrequency?: string | null;
  }) {
    const book = await this.commercial.getPriceBook(input.priceBookId);
    if (!book) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Price book not found');
    const currency = assertCurrency(input.currency ?? book.currency);
    // Validate amount via pricing math (rejects floats / invalid decimals)
    calculateCommercialPrice({
      baseAmount: input.amount,
      currency,
      modelType: 'FLAT_FEE',
    });
    if (input.commercialItemType === 'PLAN') {
      const plan = await this.commercial.getPlan(input.commercialItemId);
      if (!plan) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Plan not found');
      assertSameProductOwnership({
        productId: book.productId,
        otherProductId: plan.productId,
        context: 'price-book-plan',
      });
    }
    return this.commercial.addPriceBookEntry({
      priceBookId: input.priceBookId,
      commercialItemType: input.commercialItemType,
      commercialItemId: input.commercialItemId,
      currency,
      amount: input.amount,
      billingFrequency: input.billingFrequency,
    });
  }
}

export class PreviewCommercialPriceUseCase {
  execute(input: {
    baseAmount: string;
    currency: string;
    quantity?: number;
    modelType: string;
    tiers?: readonly PricingTier[];
  }) {
    return calculateCommercialPrice(input);
  }
}

export class GetCommercialCatalogViewUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}

  async execute(input: {
    view: 'GLOBAL' | 'VERTICAL' | 'PRODUCT' | 'PUBLISHED' | 'INTERNAL';
    productId?: string;
    verticalId?: string;
  }) {
    const publishedOnly = input.view === 'PUBLISHED';
    const [plans, packages, addons, priceBooks, enterprise] = await Promise.all([
      this.commercial.listPlans(input.productId),
      this.commercial.listPackages(input.productId),
      this.commercial.listAddons(input.productId),
      this.commercial.listPriceBooks(input.productId),
      this.commercial.listEnterpriseTemplates(input.productId),
    ]);

    const byVertical = <T extends { verticalId: string }>(rows: readonly T[]) =>
      input.verticalId ? rows.filter((r) => r.verticalId === input.verticalId) : [...rows];

    const byPublished = <T extends { status: string }>(rows: readonly T[]) =>
      publishedOnly ? rows.filter((r) => r.status === 'PUBLISHED') : [...rows];

    return {
      view: input.view,
      productId: input.productId ?? null,
      verticalId: input.verticalId ?? null,
      plans: byPublished(byVertical(plans)),
      packages: byPublished(byVertical(packages)),
      addons: byPublished(addons),
      priceBooks: byPublished(priceBooks),
      enterpriseTemplates: byPublished(byVertical(enterprise)),
      note:
        input.view === 'INTERNAL'
          ? 'Internal catalog includes drafts; not customer-facing.'
          : input.view === 'PUBLISHED'
            ? 'Published commercial catalog only.'
            : 'Governed projection — not a duplicated catalog store.',
    };
  }
}

export class EvaluateCommercialOfferReadinessUseCase {
  constructor(
    private readonly commercial: CommercialRepositoryPort,
    private readonly products: ProductRepositoryPort,
    private readonly capabilities: CapabilityRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    offerType: 'PLAN' | 'PACKAGE' | 'ADDON' | 'ENTERPRISE_TEMPLATE';
    offerId: string;
    actorId: string;
    priceBookId?: string | null;
    correlationId?: string;
  }) {
    const productId = await this.resolveProductId(input.offerType, input.offerId);
    const product = await this.products.findById(productId);
    if (!product) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');

    const { inclusions, hasPlanTier, requirePlanTier, requireDeploymentProfile, hasDeploymentProfile } =
      await this.loadOfferContext(input.offerType, input.offerId);

    const capabilityRefs: CommercialCapabilityRef[] = [];
    for (const inc of inclusions) {
      const cap = await this.capabilities.findById(inc.capabilityId);
      if (cap) {
        capabilityRefs.push({
          capabilityId: cap.id,
          technicalStatus: cap.technicalStatus,
          commercialAvailability: cap.commercialAvailability,
        });
      }
    }

    let currency: string | null = null;
    if (input.priceBookId) {
      const book = await this.commercial.getPriceBook(input.priceBookId);
      currency = book?.currency ?? null;
    }

    const evaluated = evaluateCommercialReadiness({
      productLifecycleStatus: product.lifecycleStatus,
      hasPlanTier,
      requirePlanTier,
      capabilityRefs,
      inclusions,
      priceBookCurrency: currency,
      requireCurrencyOnPriceBook: Boolean(input.priceBookId),
      requireProductPublished: true,
      forbidUnvalidatedCapabilities: true,
      requireDeploymentProfile,
      hasDeploymentProfile,
    });

    const evaluation = await this.commercial.createReadinessEvaluation({
      offerType: input.offerType,
      offerId: input.offerId,
      productId: product.id,
      result: evaluated.result,
      checks: evaluated.checks,
      blockers: evaluated.blockers,
      warnings: evaluated.warnings,
      triggeredBy: input.actorId,
    });

    if (this.outbox) {
      const event = createCommercialOfferReadinessEvaluatedEvent({
        actorId: input.actorId,
        correlationId: input.correlationId ?? evaluation.id,
        offerType: input.offerType,
        offerId: input.offerId,
        productId: product.id,
        result: evaluation.result,
        evaluationId: evaluation.id,
      });
      await this.outbox.runWithOutbox(EDGE_COMMERCIAL_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(event);
      });
    }

    return evaluation;
  }

  private async resolveProductId(
    offerType: string,
    offerId: string,
  ): Promise<string> {
    if (offerType === 'PLAN') {
      const plan = await this.commercial.getPlan(offerId);
      if (!plan) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Plan not found');
      return plan.productId;
    }
    if (offerType === 'PACKAGE') {
      const pkg = await this.commercial.getPackage(offerId);
      if (!pkg) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Package not found');
      return pkg.productId;
    }
    if (offerType === 'ADDON') {
      const addon = await this.commercial.getAddon(offerId);
      if (!addon) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Add-on not found');
      return addon.productId;
    }
    const ent = await this.commercial.getEnterpriseTemplate(offerId);
    if (!ent) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Enterprise template not found');
    return ent.productId;
  }

  private async loadOfferContext(
    offerType: string,
    offerId: string,
  ): Promise<{
    inclusions: { capabilityId: string; inclusionType: CommercialInclusionType }[];
    hasPlanTier: boolean;
    requirePlanTier: boolean;
    requireDeploymentProfile: boolean;
    hasDeploymentProfile: boolean;
  }> {
    if (offerType === 'PLAN') {
      const plan = await this.commercial.getPlan(offerId);
      const inclusions = await this.commercial.listPlanCapabilities(offerId);
      return {
        inclusions: inclusions.map((i) => ({
          capabilityId: i.capabilityId,
          inclusionType: i.inclusionType as CommercialInclusionType,
        })),
        hasPlanTier: Boolean(plan?.planTier),
        requirePlanTier: true,
        requireDeploymentProfile: false,
        hasDeploymentProfile: false,
      };
    }
    if (offerType === 'PACKAGE') {
      const inclusions = await this.commercial.listPackageCapabilities(offerId);
      return {
        inclusions: inclusions.map((i) => ({
          capabilityId: i.capabilityId,
          inclusionType: i.inclusionType as CommercialInclusionType,
        })),
        hasPlanTier: false,
        requirePlanTier: false,
        requireDeploymentProfile: false,
        hasDeploymentProfile: false,
      };
    }
    if (offerType === 'ADDON') {
      const inclusions = await this.commercial.listAddonCapabilities(offerId);
      return {
        inclusions: inclusions.map((i) => ({
          capabilityId: i.capabilityId,
          inclusionType: i.inclusionType as CommercialInclusionType,
        })),
        hasPlanTier: false,
        requirePlanTier: false,
        requireDeploymentProfile: false,
        hasDeploymentProfile: false,
      };
    }
    const ent = await this.commercial.getEnterpriseTemplate(offerId);
    const deployment = ent?.deploymentProfile ?? {};
    return {
      inclusions: [],
      hasPlanTier: false,
      requirePlanTier: false,
      requireDeploymentProfile: true,
      hasDeploymentProfile: Object.keys(deployment).length > 0,
    };
  }
}

export class PublishSolutionPackageUseCase {
  constructor(
    private readonly commercial: CommercialRepositoryPort,
    private readonly evaluate: EvaluateCommercialOfferReadinessUseCase,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: { packageId: string; actorId: string }) {
    const pkg = await this.commercial.getPackage(input.packageId);
    if (!pkg) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Package not found');
    const evaluation = await this.evaluate.execute({
      offerType: 'PACKAGE',
      offerId: pkg.id,
      actorId: input.actorId,
    });
    assertPublicationAllowed(evaluation.result);
    const published = await this.commercial.updatePackageStatus(pkg.id, 'PUBLISHED');
    const snapshot = await this.commercial.createPublicationSnapshot({
      offerType: 'PACKAGE',
      offerId: published.id,
      productId: published.productId,
      readinessEvaluationId: evaluation.id,
      publishedBy: input.actorId,
      snapshot: { package: published, readiness: evaluation },
    });
    if (this.outbox) {
      const event = createSolutionPackagePublishedEvent({
        actorId: input.actorId,
        correlationId: snapshot.id,
        packageId: published.id,
        productId: published.productId,
        version: published.version,
      });
      await this.outbox.runWithOutbox(EDGE_COMMERCIAL_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(event);
      });
    }
    return { package: published, snapshot, evaluation };
  }
}

export class PublishCommercialAddonUseCase {
  constructor(
    private readonly commercial: CommercialRepositoryPort,
    private readonly evaluate: EvaluateCommercialOfferReadinessUseCase,
  ) {}

  async execute(input: { addonId: string; actorId: string }) {
    const addon = await this.commercial.getAddon(input.addonId);
    if (!addon) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Add-on not found');
    const evaluation = await this.evaluate.execute({
      offerType: 'ADDON',
      offerId: addon.id,
      actorId: input.actorId,
    });
    assertPublicationAllowed(evaluation.result);
    const published = await this.commercial.updateAddonStatus(addon.id, 'PUBLISHED');
    const snapshot = await this.commercial.createPublicationSnapshot({
      offerType: 'ADDON',
      offerId: published.id,
      productId: published.productId,
      readinessEvaluationId: evaluation.id,
      publishedBy: input.actorId,
      snapshot: { addon: published, readiness: evaluation },
    });
    return { addon: published, snapshot, evaluation };
  }
}

export class PublishEnterpriseTemplateUseCase {
  constructor(
    private readonly commercial: CommercialRepositoryPort,
    private readonly evaluate: EvaluateCommercialOfferReadinessUseCase,
  ) {}

  async execute(input: { templateId: string; actorId: string }) {
    const template = await this.commercial.getEnterpriseTemplate(input.templateId);
    if (!template) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Enterprise template not found');
    }
    const evaluation = await this.evaluate.execute({
      offerType: 'ENTERPRISE_TEMPLATE',
      offerId: template.id,
      actorId: input.actorId,
    });
    assertPublicationAllowed(evaluation.result);
    const published = await this.commercial.updateEnterpriseTemplateStatus(
      template.id,
      'PUBLISHED',
    );
    const snapshot = await this.commercial.createPublicationSnapshot({
      offerType: 'ENTERPRISE_TEMPLATE',
      offerId: published.id,
      productId: published.productId,
      readinessEvaluationId: evaluation.id,
      publishedBy: input.actorId,
      snapshot: { template: published, readiness: evaluation },
    });
    return { template: published, snapshot, evaluation };
  }
}

export class PublishPriceBookUseCase {
  constructor(
    private readonly commercial: CommercialRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: { priceBookId: string; actorId: string }) {
    const book = await this.commercial.getPriceBook(input.priceBookId);
    if (!book) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Price book not found');
    assertCurrency(book.currency);
    const entries = await this.commercial.listPriceBookEntries(book.id);
    if (entries.length === 0) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Cannot publish a price book without entries',
      );
    }
    const published = await this.commercial.updatePriceBookStatus(book.id, 'PUBLISHED');
    const snapshot = await this.commercial.createPublicationSnapshot({
      offerType: 'PRICE_BOOK',
      offerId: published.id,
      productId: published.productId,
      publishedBy: input.actorId,
      snapshot: { priceBook: published, entries },
    });
    if (this.outbox) {
      const event = createPriceBookPublishedEvent({
        actorId: input.actorId,
        correlationId: snapshot.id,
        priceBookId: published.id,
        productId: published.productId,
        currency: published.currency,
        version: published.version,
      });
      await this.outbox.runWithOutbox(EDGE_COMMERCIAL_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(event);
      });
    }
    return { priceBook: published, snapshot };
  }
}

export class ListPublicationSnapshotsUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(input?: { offerType?: string; offerId?: string; productId?: string }) {
    return this.commercial.listPublicationSnapshots(input);
  }
}

export class EvaluateCommercialPlanReadinessUseCase {
  constructor(
    private readonly commercial: CommercialRepositoryPort,
    private readonly products: ProductRepositoryPort,
    private readonly capabilities: CapabilityRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    planId: string;
    actorId: string;
    priceBookId?: string | null;
    correlationId?: string;
  }) {
    const plan = await this.commercial.getPlan(input.planId);
    if (!plan) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Plan not found');
    const product = await this.products.findById(plan.productId);
    if (!product) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');

    const inclusions = await this.commercial.listPlanCapabilities(plan.id);
    const capabilityRefs: CommercialCapabilityRef[] = [];
    for (const inc of inclusions) {
      const cap = await this.capabilities.findById(inc.capabilityId);
      if (cap) {
        capabilityRefs.push({
          capabilityId: cap.id,
          technicalStatus: cap.technicalStatus,
          commercialAvailability: cap.commercialAvailability,
        });
      }
    }

    let currency: string | null = null;
    if (input.priceBookId) {
      const book = await this.commercial.getPriceBook(input.priceBookId);
      currency = book?.currency ?? null;
    }

    const evaluated = evaluateCommercialReadiness({
      productLifecycleStatus: product.lifecycleStatus,
      hasPlanTier: Boolean(plan.planTier),
      capabilityRefs,
      inclusions: inclusions.map((i) => ({
        capabilityId: i.capabilityId,
        inclusionType: i.inclusionType as CommercialInclusionType,
      })),
      priceBookCurrency: currency,
      requireCurrencyOnPriceBook: Boolean(input.priceBookId),
      requireProductPublished: true,
      forbidUnvalidatedCapabilities: true,
    });

    const evaluation = await this.commercial.createReadinessEvaluation({
      offerType: 'PLAN',
      offerId: plan.id,
      productId: product.id,
      result: evaluated.result,
      checks: evaluated.checks,
      blockers: evaluated.blockers,
      warnings: evaluated.warnings,
      triggeredBy: input.actorId,
    });

    if (this.outbox) {
      const event = createCommercialOfferReadinessEvaluatedEvent({
        actorId: input.actorId,
        correlationId: input.correlationId ?? evaluation.id,
        offerType: 'PLAN',
        offerId: plan.id,
        productId: product.id,
        result: evaluation.result,
        evaluationId: evaluation.id,
      });
      await this.outbox.runWithOutbox(EDGE_COMMERCIAL_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(event);
      });
    }

    return evaluation;
  }
}

export class PublishCommercialPlanUseCase {
  constructor(
    private readonly commercial: CommercialRepositoryPort,
    private readonly evaluate: EvaluateCommercialPlanReadinessUseCase,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    planId: string;
    actorId: string;
    priceBookId?: string | null;
    approvalRefs?: readonly unknown[];
    correlationId?: string;
  }) {
    const plan = await this.commercial.getPlan(input.planId);
    if (!plan) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Plan not found');

    const evaluation = await this.evaluate.execute({
      planId: plan.id,
      actorId: input.actorId,
      priceBookId: input.priceBookId,
      correlationId: input.correlationId,
    });
    assertPublicationAllowed(evaluation.result);

    const capabilities = await this.commercial.listPlanCapabilities(plan.id);
    const published = await this.commercial.updatePlanStatus(plan.id, 'PUBLISHED');
    const snapshot = await this.commercial.createPublicationSnapshot({
      offerType: 'PLAN',
      offerId: plan.id,
      productId: plan.productId,
      readinessEvaluationId: evaluation.id,
      publishedBy: input.actorId,
      snapshot: {
        plan: published,
        capabilities,
        readiness: {
          result: evaluation.result,
          checks: evaluation.checks,
          blockers: evaluation.blockers,
          warnings: evaluation.warnings,
          evaluationId: evaluation.id,
        },
        approvalRefs: input.approvalRefs ?? [],
        priceBookId: input.priceBookId ?? null,
      },
    });

    if (this.outbox) {
      const event = createCommercialOfferPublishedEvent({
        actorId: input.actorId,
        correlationId: input.correlationId ?? snapshot.id,
        payload: {
          offerType: 'PLAN',
          offerId: plan.id,
          productId: plan.productId,
          snapshotId: snapshot.id,
          readinessEvaluationId: evaluation.id,
          planCode: published.code,
          planTier: published.planTier,
        },
      });
      await this.outbox.runWithOutbox(EDGE_COMMERCIAL_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(event);
      });
    }

    return { plan: published, snapshot, evaluation };
  }
}

export class ConfigureCommercialOfferUseCase {
  constructor(
    private readonly commercial: CommercialRepositoryPort,
    private readonly products: ProductRepositoryPort,
    private readonly capabilities: CapabilityRepositoryPort,
  ) {}

  async execute(input: {
    mode?: OfferConfiguratorMode;
    productId: string;
    planId: string;
    packageId?: string | null;
    addonIds?: readonly string[];
    geographicScope?: string | null;
    deploymentMode?: string | null;
    allowedGeographicScopes?: readonly string[] | null;
    validatedDeploymentModes?: readonly string[] | null;
  }) {
    const product = await this.products.findById(input.productId);
    if (!product) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    const plan = await this.commercial.getPlan(input.planId);
    if (!plan) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Plan not found');

    let packageProductId: string | null = null;
    if (input.packageId) {
      const pkg = await this.commercial.getPackage(input.packageId);
      if (!pkg) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Package not found');
      packageProductId = pkg.productId;
    }

    const addons = await this.commercial.listAddons(product.id);
    const selectedAddons = (input.addonIds ?? []).map((id) => {
      const addon = addons.find((a) => a.id === id);
      if (!addon) {
        throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, `Add-on not found: ${id}`);
      }
      return addon;
    });

    const inclusions = await this.commercial.listPlanCapabilities(plan.id);
    const capabilityRefs: CommercialCapabilityRef[] = [];
    for (const inc of inclusions) {
      const cap = await this.capabilities.findById(inc.capabilityId);
      if (cap) {
        capabilityRefs.push({
          capabilityId: cap.id,
          technicalStatus: cap.technicalStatus,
          commercialAvailability: cap.commercialAvailability,
        });
      }
    }

    // Load persisted eligibility policies (076) when present — do not invent scopes.
    const policies = await this.commercial.listEligibilityPolicies(product.id);
    const planPolicy = policies.find((p) => p.offerType === 'PLAN') ?? policies[0];
    let policyRules: Record<string, unknown> = {};
    let rulesVersion = 1;
    if (planPolicy) {
      const full = await this.commercial.getEligibilityPolicy(planPolicy.id);
      policyRules = full?.rules ?? {};
      rulesVersion = full?.version ?? planPolicy.version;
    }

    const allowedGeographicScopes =
      input.allowedGeographicScopes ??
      (Array.isArray(policyRules.allowedGeographicScopes)
        ? (policyRules.allowedGeographicScopes as string[])
        : null);
    const validatedDeploymentModes =
      input.validatedDeploymentModes ??
      (Array.isArray(policyRules.validatedDeploymentModes)
        ? (policyRules.validatedDeploymentModes as string[])
        : null);

    const result = configureCommercialOffer({
      mode: input.mode ?? OfferConfiguratorMode.MANUAL_CONFIGURATION,
      productId: product.id,
      productLifecycleStatus: product.lifecycleStatus,
      planId: plan.id,
      planProductId: plan.productId,
      planStatus: plan.status,
      packageId: input.packageId,
      packageProductId,
      addonIds: selectedAddons.map((a) => a.id),
      addonProductIds: selectedAddons.map((a) => a.productId),
      capabilityRefs,
      inclusions: inclusions.map((i) => ({
        capabilityId: i.capabilityId,
        inclusionType: i.inclusionType as CommercialInclusionType,
      })),
      geographicScope: input.geographicScope,
      allowedGeographicScopes,
      deploymentMode: input.deploymentMode,
      validatedDeploymentModes,
      rulesVersion,
    });

    return {
      ...result,
      eligibilityPolicyId: planPolicy?.id ?? null,
      eligibilityPolicyCode: planPolicy?.code ?? null,
    };
  }
}

export class ListPriceBooksUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(productId?: string) {
    return this.commercial.listPriceBooks(productId);
  }
}

export class ListAddonsUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(productId?: string) {
    return this.commercial.listAddons(productId);
  }
}

export class CreatePricingUnitUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(input: { code: string; name: string; description?: string | null; unitCategory?: string | null }) {
    return this.commercial.createPricingUnit(input);
  }
}

export class ListPricingUnitsUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute() {
    return this.commercial.listPricingUnits();
  }
}

export class CreatePersonaUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(input: {
    code: string;
    name: string;
    roleLabel: string;
    verticalId?: string | null;
    productId?: string | null;
    attributes?: Record<string, unknown>;
    influenceLevel?: string | null;
    decisionAuthority?: string | null;
  }) {
    return this.commercial.createPersona(input);
  }
}

export class ListPersonasUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(productId?: string) {
    return this.commercial.listPersonas(productId);
  }
}

export class CreateValuePropositionUseCase {
  constructor(
    private readonly commercial: CommercialRepositoryPort,
    private readonly products: ProductRepositoryPort,
  ) {}

  async execute(input: {
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
  }) {
    const product = await this.products.findById(input.productId);
    if (!product) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    if (product.verticalId !== input.verticalId) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Value proposition vertical must match product vertical',
      );
    }
    // Quantitative claims require evidence entries — never invent percentages.
    if (input.expectedOutcome && /\d+\s*%/.test(input.expectedOutcome)) {
      if (!input.evidence || input.evidence.length === 0) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Quantitative outcome claims require evidence provenance',
        );
      }
    }
    return this.commercial.createValueProposition(input);
  }
}

export class ListValuePropositionsUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(productId?: string) {
    return this.commercial.listValuePropositions(productId);
  }
}

export class CreateDiscountPolicyUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}

  execute(input: {
    code: string;
    name: string;
    productId?: string | null;
    discountType: string;
    maxPercentage?: string | null;
    maxAmount?: string | null;
    approvalMatrix?: readonly unknown[];
  }) {
    if (input.maxPercentage != null && input.maxPercentage !== '') {
      const n = Number(input.maxPercentage);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'maxPercentage must be between 0 and 100',
        );
      }
    }
    // Do not invent approval thresholds — matrix must be supplied by governance.
    return this.commercial.createDiscountPolicy(input);
  }
}

export class ListDiscountPoliciesUseCase {
  constructor(private readonly commercial: CommercialRepositoryPort) {}
  execute(productId?: string) {
    return this.commercial.listDiscountPolicies(productId);
  }
}

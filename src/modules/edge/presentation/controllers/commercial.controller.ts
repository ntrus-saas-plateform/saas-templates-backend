import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EdgeRoute, RequireEdgePermissions } from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgeContextService } from '../../../../shared/auth/edge-context.service.js';
import {
  CommercialInclusionType,
  PlanTier,
} from '../../domain/commercial/commercial.entity.js';
import { OfferConfiguratorMode } from '../../domain/commercial/offer-configurator.js';
import {
  AddAddonCapabilityUseCase,
  AddPackageCapabilityUseCase,
  AddPlanCapabilityUseCase,
  AddPriceBookEntryUseCase,
  ConfigureCommercialOfferUseCase,
  CreateCommercialAddonUseCase,
  CreateCommercialMarketUseCase,
  CreateCommercialPlanUseCase,
  CreateDiscountPolicyUseCase,
  CreateIcpUseCase,
  CreatePersonaUseCase,
  CreatePriceBookUseCase,
  CreatePricingUnitUseCase,
  CreateSolutionPackageUseCase,
  CreateValuePropositionUseCase,
  EvaluateCommercialOfferReadinessUseCase,
  EvaluateCommercialPlanReadinessUseCase,
  GetCommercialCatalogViewUseCase,
  GetCommercialPlanUseCase,
  GetSolutionPackageUseCase,
  LinkAddonToPlanUseCase,
  ListAddonsUseCase,
  ListCommercialMarketsUseCase,
  ListCommercialPlansUseCase,
  ListDiscountPoliciesUseCase,
  ListIcpsUseCase,
  ListPackagesUseCase,
  ListPersonasUseCase,
  ListPriceBookEntriesUseCase,
  ListPriceBooksUseCase,
  ListPricingUnitsUseCase,
  ListPublicationSnapshotsUseCase,
  ListValuePropositionsUseCase,
  PreviewCommercialPriceUseCase,
  PublishCommercialAddonUseCase,
  PublishCommercialPlanUseCase,
  PublishEnterpriseTemplateUseCase,
  PublishPriceBookUseCase,
  PublishSolutionPackageUseCase,
} from '../../application/commercial/commercial.use-cases.js';
import {
  AddMarketAssessmentUseCase,
  AddResearchSourceUseCase,
  CompleteResearchProjectUseCase,
  CreateBuyingCommitteeUseCase,
  CreateDecisionJourneyUseCase,
  CreateEligibilityPolicyUseCase,
  CreateEnterpriseTemplateUseCase,
  CreatePricingModelUseCase,
  CreateResearchProjectUseCase,
  CreateUsageMetricUseCase,
  ListBuyingCommitteesUseCase,
  ListDecisionJourneysUseCase,
  ListEligibilityPoliciesUseCase,
  ListEnterpriseTemplatesUseCase,
  ListMarketAssessmentsUseCase,
  ListPricingModelsUseCase,
  ListResearchProjectsUseCase,
  ListSegmentIntelligenceUseCase,
  ListUsageMetricsUseCase,
  ScoreSegmentPriorityUseCase,
  UpsertSegmentIntelligenceUseCase,
} from '../../application/commercial/commercial-governance.use-cases.js';

@ApiTags('edge-commercial')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller('edge/commercial')
export class EdgeCommercialController {
  constructor(
    private readonly edgeContext: EdgeContextService,
    private readonly createMarket: CreateCommercialMarketUseCase,
    private readonly listMarkets: ListCommercialMarketsUseCase,
    private readonly createIcp: CreateIcpUseCase,
    private readonly listIcps: ListIcpsUseCase,
    private readonly createPackage: CreateSolutionPackageUseCase,
    private readonly listPackages: ListPackagesUseCase,
    private readonly addPackageCapability: AddPackageCapabilityUseCase,
    private readonly createPlan: CreateCommercialPlanUseCase,
    private readonly listPlans: ListCommercialPlansUseCase,
    private readonly addPlanCapability: AddPlanCapabilityUseCase,
    private readonly createAddon: CreateCommercialAddonUseCase,
    private readonly listAddons: ListAddonsUseCase,
    private readonly addAddonCapability: AddAddonCapabilityUseCase,
    private readonly getPlan: GetCommercialPlanUseCase,
    private readonly getPackage: GetSolutionPackageUseCase,
    private readonly listPriceBookEntries: ListPriceBookEntriesUseCase,
    private readonly linkAddon: LinkAddonToPlanUseCase,
    private readonly createPriceBook: CreatePriceBookUseCase,
    private readonly listPriceBooks: ListPriceBooksUseCase,
    private readonly addPriceEntry: AddPriceBookEntryUseCase,
    private readonly createPricingUnit: CreatePricingUnitUseCase,
    private readonly listPricingUnits: ListPricingUnitsUseCase,
    private readonly previewPrice: PreviewCommercialPriceUseCase,
    private readonly evaluateReadiness: EvaluateCommercialPlanReadinessUseCase,
    private readonly publishPlan: PublishCommercialPlanUseCase,
    private readonly configureOffer: ConfigureCommercialOfferUseCase,
    private readonly createPersona: CreatePersonaUseCase,
    private readonly listPersonas: ListPersonasUseCase,
    private readonly createValueProp: CreateValuePropositionUseCase,
    private readonly listValueProps: ListValuePropositionsUseCase,
    private readonly createDiscount: CreateDiscountPolicyUseCase,
    private readonly listDiscounts: ListDiscountPoliciesUseCase,
    private readonly createResearch: CreateResearchProjectUseCase,
    private readonly listResearch: ListResearchProjectsUseCase,
    private readonly addResearchSource: AddResearchSourceUseCase,
    private readonly completeResearch: CompleteResearchProjectUseCase,
    private readonly upsertSegmentIntel: UpsertSegmentIntelligenceUseCase,
    private readonly scoreSegment: ScoreSegmentPriorityUseCase,
    private readonly listSegmentIntel: ListSegmentIntelligenceUseCase,
    private readonly createPricingModel: CreatePricingModelUseCase,
    private readonly listPricingModels: ListPricingModelsUseCase,
    private readonly createUsageMetric: CreateUsageMetricUseCase,
    private readonly listUsageMetrics: ListUsageMetricsUseCase,
    private readonly createBuyingCommittee: CreateBuyingCommitteeUseCase,
    private readonly listBuyingCommittees: ListBuyingCommitteesUseCase,
    private readonly createDecisionJourney: CreateDecisionJourneyUseCase,
    private readonly listDecisionJourneys: ListDecisionJourneysUseCase,
    private readonly createEnterprise: CreateEnterpriseTemplateUseCase,
    private readonly listEnterprise: ListEnterpriseTemplatesUseCase,
    private readonly createEligibility: CreateEligibilityPolicyUseCase,
    private readonly listEligibility: ListEligibilityPoliciesUseCase,
    private readonly addMarketAssessment: AddMarketAssessmentUseCase,
    private readonly listMarketAssessments: ListMarketAssessmentsUseCase,
    private readonly catalogView: GetCommercialCatalogViewUseCase,
    private readonly publishPackage: PublishSolutionPackageUseCase,
    private readonly publishPriceBookUc: PublishPriceBookUseCase,
    private readonly listSnapshots: ListPublicationSnapshotsUseCase,
    private readonly evaluateOffer: EvaluateCommercialOfferReadinessUseCase,
    private readonly publishAddon: PublishCommercialAddonUseCase,
    private readonly publishEnterprise: PublishEnterpriseTemplateUseCase,
  ) {}

  @Get('markets')
  @RequireEdgePermissions('platform:commercial:markets:read')
  async markets(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('verticalId') verticalId?: string,
  ) {
    return {
      data: await this.listMarkets.execute({
        page: Number(page) || 1,
        limit: Math.min(Number(limit) || 20, 100),
        verticalId,
      }),
    };
  }

  @Post('markets')
  @RequireEdgePermissions('platform:commercial:markets:manage')
  async createMarketEndpoint(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string | null;
      verticalId: string;
      geographicScope?: string | null;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.createMarket.execute({
        actorId: ctx.administratorId!,
        ...body,
      }),
    };
  }

  @Get('icps')
  @RequireEdgePermissions('platform:commercial:icp:manage')
  async icps(@Query('productId') productId?: string) {
    return { data: await this.listIcps.execute(productId) };
  }

  @Post('icps')
  @RequireEdgePermissions('platform:commercial:icp:manage')
  async createIcpEndpoint(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string | null;
      verticalId: string;
      productId: string;
      attributes?: Record<string, unknown>;
      scoring?: Record<string, unknown>;
      segmentIds?: string[];
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.createIcp.execute({
        actorId: ctx.administratorId!,
        ...body,
      }),
    };
  }

  @Get('packages')
  @RequireEdgePermissions('platform:commercial:packages:read')
  async packages(@Query('productId') productId?: string) {
    return { data: await this.listPackages.execute(productId) };
  }

  @Get('packages/:id')
  @RequireEdgePermissions('platform:commercial:packages:read')
  async getPackageEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.getPackage.execute(id) };
  }

  @Post('packages')
  @RequireEdgePermissions('platform:commercial:packages:manage')
  async createPackageEndpoint(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string | null;
      productId: string;
      packageType?: string | null;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.createPackage.execute({
        actorId: ctx.administratorId!,
        ...body,
      }),
    };
  }

  @Post('packages/:id/capabilities')
  @RequireEdgePermissions('platform:commercial:packages:manage')
  async addPackageCap(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { capabilityId: string; inclusionType?: CommercialInclusionType },
  ) {
    return {
      data: await this.addPackageCapability.execute({
        packageId: id,
        capabilityId: body.capabilityId,
        inclusionType: body.inclusionType ?? CommercialInclusionType.INCLUDED,
      }),
    };
  }

  @Get('plans')
  @RequireEdgePermissions('platform:commercial:plans:read')
  async plans(@Query('productId') productId?: string) {
    return { data: await this.listPlans.execute(productId) };
  }

  @Get('plans/:id')
  @RequireEdgePermissions('platform:commercial:plans:read')
  async getPlanEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.getPlan.execute(id) };
  }

  @Post('plans')
  @RequireEdgePermissions('platform:commercial:plans:manage')
  async createPlanEndpoint(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string | null;
      productId: string;
      planTier: PlanTier;
      solutionPackageId?: string | null;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.createPlan.execute({
        actorId: ctx.administratorId!,
        ...body,
      }),
    };
  }

  @Post('plans/:id/capabilities')
  @RequireEdgePermissions('platform:commercial:plans:manage')
  async addPlanCap(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { capabilityId: string; inclusionType?: CommercialInclusionType },
  ) {
    return {
      data: await this.addPlanCapability.execute({
        planId: id,
        capabilityId: body.capabilityId,
        inclusionType: body.inclusionType ?? CommercialInclusionType.INCLUDED,
      }),
    };
  }

  @Post('plans/:id/readiness')
  @RequireEdgePermissions('platform:commercial:readiness:evaluate')
  async evaluatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { priceBookId?: string | null },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.evaluateReadiness.execute({
        planId: id,
        actorId: ctx.administratorId!,
        priceBookId: body.priceBookId,
      }),
    };
  }

  @Post('plans/:id/publish')
  @RequireEdgePermissions('platform:commercial:offers:publish')
  async publishPlanEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { priceBookId?: string | null; approvalRefs?: unknown[] },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.publishPlan.execute({
        planId: id,
        actorId: ctx.administratorId!,
        priceBookId: body.priceBookId,
        approvalRefs: body.approvalRefs,
      }),
    };
  }

  @Get('addons')
  @RequireEdgePermissions('platform:commercial:catalog:read')
  async addons(@Query('productId') productId?: string) {
    return { data: await this.listAddons.execute(productId) };
  }

  @Post('addons')
  @RequireEdgePermissions('platform:commercial:addons:manage')
  async createAddonEndpoint(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string | null;
      productId: string;
      addonType?: string;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.createAddon.execute({
        actorId: ctx.administratorId!,
        ...body,
      }),
    };
  }

  @Post('addons/:id/plans')
  @RequireEdgePermissions('platform:commercial:addons:manage')
  async linkAddonEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { planId: string; compatibility?: string },
  ) {
    return {
      data: await this.linkAddon.execute({
        addonId: id,
        planId: body.planId,
        compatibility: body.compatibility,
      }),
    };
  }

  @Post('addons/:id/capabilities')
  @RequireEdgePermissions('platform:commercial:addons:manage')
  async addAddonCap(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { capabilityId: string; inclusionType?: CommercialInclusionType },
  ) {
    return {
      data: await this.addAddonCapability.execute({
        addonId: id,
        capabilityId: body.capabilityId,
        inclusionType: body.inclusionType ?? CommercialInclusionType.INCLUDED,
      }),
    };
  }

  @Get('price-books')
  @RequireEdgePermissions('platform:pricing:read')
  async priceBooks(@Query('productId') productId?: string) {
    return { data: await this.listPriceBooks.execute(productId) };
  }

  @Post('price-books')
  @RequireEdgePermissions('platform:pricing:manage')
  async createPriceBookEndpoint(
    @Body()
    body: {
      code: string;
      name: string;
      productId: string;
      currency: string;
      geographicScope?: string | null;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.createPriceBook.execute({
        actorId: ctx.administratorId!,
        ...body,
      }),
    };
  }

  @Get('price-books/:id/entries')
  @RequireEdgePermissions('platform:pricing:read')
  async listEntries(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.listPriceBookEntries.execute(id) };
  }

  @Post('price-books/:id/entries')
  @RequireEdgePermissions('platform:pricing:manage')
  async addEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      commercialItemType: string;
      commercialItemId: string;
      amount: string;
      currency?: string;
      billingFrequency?: string | null;
    },
  ) {
    return {
      data: await this.addPriceEntry.execute({
        priceBookId: id,
        ...body,
      }),
    };
  }

  @Get('pricing-units')
  @RequireEdgePermissions('platform:pricing:read')
  async pricingUnits() {
    return { data: await this.listPricingUnits.execute() };
  }

  @Post('pricing-units')
  @RequireEdgePermissions('platform:pricing:manage')
  async createUnit(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string | null;
      unitCategory?: string | null;
    },
  ) {
    return { data: await this.createPricingUnit.execute(body) };
  }

  @Post('pricing/preview')
  @RequireEdgePermissions('platform:pricing:read')
  async preview(
    @Body()
    body: {
      baseAmount: string;
      currency: string;
      quantity?: number;
      modelType: string;
      tiers?: { upTo: number | null; unitAmount: string }[];
    },
  ) {
    return { data: this.previewPrice.execute(body) };
  }

  @Get('catalog')
  @RequireEdgePermissions('platform:commercial:catalog:read')
  async catalog(
    @Query('view') view = 'GLOBAL',
    @Query('productId') productId?: string,
    @Query('verticalId') verticalId?: string,
  ) {
    const allowed = ['GLOBAL', 'VERTICAL', 'PRODUCT', 'PUBLISHED', 'INTERNAL'] as const;
    const normalized = allowed.includes(view as (typeof allowed)[number])
      ? (view as (typeof allowed)[number])
      : 'GLOBAL';
    return {
      data: await this.catalogView.execute({
        view: normalized,
        productId,
        verticalId,
      }),
    };
  }

  @Get('publication-snapshots')
  @RequireEdgePermissions('platform:commercial:catalog:read')
  async snapshots(
    @Query('offerType') offerType?: string,
    @Query('offerId') offerId?: string,
    @Query('productId') productId?: string,
  ) {
    return {
      data: await this.listSnapshots.execute({ offerType, offerId, productId }),
    };
  }

  @Post('packages/:id/publish')
  @RequireEdgePermissions('platform:commercial:offers:publish')
  async publishPackageEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.publishPackage.execute({
        packageId: id,
        actorId: ctx.administratorId!,
      }),
    };
  }

  @Post('price-books/:id/publish')
  @RequireEdgePermissions('platform:commercial:offers:publish')
  async publishPriceBookEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.publishPriceBookUc.execute({
        priceBookId: id,
        actorId: ctx.administratorId!,
      }),
    };
  }

  @Post('offers/:offerType/:id/readiness')
  @RequireEdgePermissions('platform:commercial:readiness:evaluate')
  async evaluateOfferEndpoint(
    @Param('offerType') offerType: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { priceBookId?: string | null },
  ) {
    const allowed = ['PLAN', 'PACKAGE', 'ADDON', 'ENTERPRISE_TEMPLATE'] as const;
    const normalized = offerType.toUpperCase().replace(/-/g, '_');
    if (!allowed.includes(normalized as (typeof allowed)[number])) {
      throw new BadRequestException(`Unsupported offer type: ${offerType}`);
    }
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.evaluateOffer.execute({
        offerType: normalized as (typeof allowed)[number],
        offerId: id,
        actorId: ctx.administratorId!,
        priceBookId: body.priceBookId,
      }),
    };
  }

  @Post('addons/:id/publish')
  @RequireEdgePermissions('platform:commercial:offers:publish')
  async publishAddonEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.publishAddon.execute({
        addonId: id,
        actorId: ctx.administratorId!,
      }),
    };
  }

  @Post('enterprise-templates/:id/publish')
  @RequireEdgePermissions('platform:commercial:offers:publish')
  async publishEnterpriseEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.publishEnterprise.execute({
        templateId: id,
        actorId: ctx.administratorId!,
      }),
    };
  }

  @Post('offers/configure')
  @RequireEdgePermissions('platform:commercial:catalog:read')
  async configure(
    @Body()
    body: {
      mode?: OfferConfiguratorMode;
      productId: string;
      planId: string;
      packageId?: string | null;
      addonIds?: string[];
      geographicScope?: string | null;
      deploymentMode?: string | null;
      allowedGeographicScopes?: string[] | null;
      validatedDeploymentModes?: string[] | null;
    },
  ) {
    return { data: await this.configureOffer.execute(body) };
  }

  @Get('personas')
  @RequireEdgePermissions('platform:commercial:personas:manage')
  async personas(@Query('productId') productId?: string) {
    return { data: await this.listPersonas.execute(productId) };
  }

  @Post('personas')
  @RequireEdgePermissions('platform:commercial:personas:manage')
  async createPersonaEndpoint(
    @Body()
    body: {
      code: string;
      name: string;
      roleLabel: string;
      verticalId?: string | null;
      productId?: string | null;
      attributes?: Record<string, unknown>;
      influenceLevel?: string | null;
      decisionAuthority?: string | null;
    },
  ) {
    return { data: await this.createPersona.execute(body) };
  }

  @Get('value-propositions')
  @RequireEdgePermissions('platform:commercial:value_props:manage')
  async valueProps(@Query('productId') productId?: string) {
    return { data: await this.listValueProps.execute(productId) };
  }

  @Post('value-propositions')
  @RequireEdgePermissions('platform:commercial:value_props:manage')
  async createValuePropEndpoint(
    @Body()
    body: {
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
      evidence?: unknown[];
      limitations?: string | null;
    },
  ) {
    return { data: await this.createValueProp.execute(body) };
  }

  @Get('discount-policies')
  @RequireEdgePermissions('platform:pricing:discounts:manage')
  async discounts(@Query('productId') productId?: string) {
    return { data: await this.listDiscounts.execute(productId) };
  }

  @Post('discount-policies')
  @RequireEdgePermissions('platform:pricing:discounts:manage')
  async createDiscountEndpoint(
    @Body()
    body: {
      code: string;
      name: string;
      productId?: string | null;
      discountType: string;
      maxPercentage?: string | null;
      maxAmount?: string | null;
      approvalMatrix?: unknown[];
    },
  ) {
    return { data: await this.createDiscount.execute(body) };
  }

  @Get('research-projects')
  @RequireEdgePermissions('platform:commercial:markets:read')
  async researchProjects(@Query('marketId') marketId?: string) {
    return { data: await this.listResearch.execute(marketId) };
  }

  @Post('research-projects')
  @RequireEdgePermissions('platform:commercial:markets:manage')
  async createResearchEndpoint(
    @Body()
    body: {
      marketId: string;
      code: string;
      title: string;
      researchQuestion?: string | null;
      hypothesis?: string | null;
      methodology?: string | null;
      ownerRef?: string | null;
      geographicScope?: string | null;
    },
  ) {
    return { data: await this.createResearch.execute(body) };
  }

  @Post('research-projects/:id/sources')
  @RequireEdgePermissions('platform:commercial:markets:manage')
  async addSource(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      sourceType: string;
      title: string;
      uri?: string | null;
      reliability?: string | null;
      confidence?: string | null;
      notes?: string | null;
    },
  ) {
    return {
      data: await this.addResearchSource.execute({ projectId: id, ...body }),
    };
  }

  @Post('research-projects/:id/complete')
  @RequireEdgePermissions('platform:commercial:markets:manage')
  async completeResearchEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      findings?: string | null;
      conclusions?: string | null;
      limitations?: string | null;
      confidenceLevel?: string | null;
    },
  ) {
    return {
      data: await this.completeResearch.execute({ projectId: id, ...body }),
    };
  }

  @Get('markets/:id/assessments')
  @RequireEdgePermissions('platform:commercial:markets:read')
  async marketAssessments(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.listMarketAssessments.execute(id) };
  }

  @Post('markets/:id/assessments')
  @RequireEdgePermissions('platform:commercial:markets:manage')
  async createAssessment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      dimension: string;
      valueText?: string | null;
      valueNumeric?: string | null;
      unknown?: boolean;
      sourceRef?: string | null;
      confidence?: string | null;
    },
  ) {
    return {
      data: await this.addMarketAssessment.execute({ marketId: id, ...body }),
    };
  }

  @Get('segment-intelligence')
  @RequireEdgePermissions('platform:commercial:markets:read')
  async segmentIntel(@Query('segmentId') segmentId?: string) {
    return { data: await this.listSegmentIntel.execute(segmentId) };
  }

  @Post('segment-intelligence')
  @RequireEdgePermissions('platform:commercial:markets:manage')
  async upsertSegment(
    @Body()
    body: {
      segmentId: string;
      commercialDescription?: string | null;
      lifecycleStatus?: string;
      attractivenessScore?: string | null;
      strategicFitScore?: string | null;
      productReadinessScore?: string | null;
      notes?: string | null;
    },
  ) {
    return { data: await this.upsertSegmentIntel.execute(body) };
  }

  @Post('segment-intelligence/:segmentId/score')
  @RequireEdgePermissions('platform:commercial:markets:manage')
  async scoreSegmentEndpoint(
    @Param('segmentId', ParseUUIDPipe) segmentId: string,
    @Body() body: { scores: Record<string, number>; modelCode?: string },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.scoreSegment.execute({
        segmentId,
        scores: body.scores,
        modelCode: body.modelCode,
        actorId: ctx.administratorId!,
      }),
    };
  }

  @Get('pricing-models')
  @RequireEdgePermissions('platform:pricing:read')
  async pricingModels(@Query('productId') productId?: string) {
    return { data: await this.listPricingModels.execute(productId) };
  }

  @Post('pricing-models')
  @RequireEdgePermissions('platform:pricing:manage')
  async createPricingModelEndpoint(
    @Body()
    body: {
      code: string;
      name: string;
      modelType: string;
      productId: string;
      pricingUnitId?: string | null;
      components?: Record<string, unknown>;
      currency?: string | null;
    },
  ) {
    return { data: await this.createPricingModel.execute(body) };
  }

  @Get('usage-metrics')
  @RequireEdgePermissions('platform:pricing:read')
  async usageMetrics() {
    return { data: await this.listUsageMetrics.execute() };
  }

  @Post('usage-metrics')
  @RequireEdgePermissions('platform:pricing:manage')
  async createUsageMetricEndpoint(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string | null;
      pricingUnitId?: string | null;
      sourceEvent?: string | null;
      aggregationWindow?: string | null;
      aggregationMethod?: string | null;
      deduplicationRequired?: boolean;
    },
  ) {
    return { data: await this.createUsageMetric.execute(body) };
  }

  @Get('buying-committees')
  @RequireEdgePermissions('platform:commercial:personas:manage')
  async buyingCommittees(@Query('productId') productId?: string) {
    return { data: await this.listBuyingCommittees.execute(productId) };
  }

  @Post('buying-committees')
  @RequireEdgePermissions('platform:commercial:personas:manage')
  async createBuyingCommitteeEndpoint(
    @Body()
    body: {
      code: string;
      name: string;
      productId?: string | null;
      verticalId?: string | null;
      segmentId?: string | null;
      roles?: unknown[];
    },
  ) {
    return { data: await this.createBuyingCommittee.execute(body) };
  }

  @Get('decision-journeys')
  @RequireEdgePermissions('platform:commercial:personas:manage')
  async decisionJourneys(@Query('productId') productId?: string) {
    return { data: await this.listDecisionJourneys.execute(productId) };
  }

  @Post('decision-journeys')
  @RequireEdgePermissions('platform:commercial:personas:manage')
  async createJourney(
    @Body()
    body: {
      code: string;
      name: string;
      productId?: string | null;
      verticalId?: string | null;
      stages?: unknown[];
    },
  ) {
    return { data: await this.createDecisionJourney.execute(body) };
  }

  @Get('enterprise-templates')
  @RequireEdgePermissions('platform:commercial:plans:read')
  async enterpriseTemplates(@Query('productId') productId?: string) {
    return { data: await this.listEnterprise.execute(productId) };
  }

  @Post('enterprise-templates')
  @RequireEdgePermissions('platform:commercial:plans:manage')
  async createEnterpriseEndpoint(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string | null;
      productId: string;
      solutionPackageId?: string | null;
      basePlanId?: string | null;
      deploymentProfile?: Record<string, unknown>;
      supportProfile?: Record<string, unknown>;
      slaProfile?: Record<string, unknown>;
      negotiableTerms?: unknown[];
      nonNegotiableTerms?: unknown[];
      approvalLevelRequired?: string | null;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.createEnterprise.execute({
        actorId: ctx.administratorId!,
        ...body,
      }),
    };
  }

  @Get('eligibility-policies')
  @RequireEdgePermissions('platform:commercial:catalog:read')
  async eligibilityPolicies(@Query('productId') productId?: string) {
    return { data: await this.listEligibility.execute(productId) };
  }

  @Post('eligibility-policies')
  @RequireEdgePermissions('platform:commercial:catalog:manage')
  async createEligibilityEndpoint(
    @Body()
    body: {
      code: string;
      name: string;
      productId?: string | null;
      offerType?: string;
      offerId?: string | null;
      rules?: Record<string, unknown>;
    },
  ) {
    return { data: await this.createEligibility.execute(body) };
  }
}

import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import {
  assertCampaignCanPromoteProduct,
  assertCampaignPublishable,
  assertCampaignStatusTransition,
  assertFormDoesNotProvisionTenant,
  assertOfferPromotable,
  calculateExplainableLeadScore,
  CampaignStatus,
  LeadStatus,
  normalizeLeadEmail,
  type ScoringWeights,
} from '../../domain/marketing/marketing.entity.js';
import {
  createMarketingCampaignCreatedEvent,
  createMarketingCampaignPublishedEvent,
  createMarketingFormSubmittedEvent,
  createMarketingLeadCreatedEvent,
  createMarketingLeadQualifiedEvent,
  createMarketingStrategyCreatedEvent,
  EDGE_MARKETING_OUTBOX_TENANT,
} from '../../domain/marketing/marketing.events.js';
import type { CommercialRepositoryPort } from '../../domain/ports/commercial-repository.port.js';
import type { MarketingRepositoryPort } from '../../domain/ports/marketing-repository.port.js';
import type { ProductRepositoryPort } from '../../domain/ports/product-repository.port.js';

export class CreateMarketingStrategyUseCase {
  constructor(
    private readonly marketing: MarketingRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    scopeType: string;
    productId?: string | null;
    verticalId?: string | null;
    marketId?: string | null;
  }) {
    const strategy = await this.marketing.createStrategy({
      ...input,
      createdBy: input.actorId,
    });
    if (this.outbox) {
      const event = createMarketingStrategyCreatedEvent({
        actorId: input.actorId,
        correlationId: strategy.id,
        strategyId: strategy.id,
        code: strategy.code,
      });
      await this.outbox.runWithOutbox(EDGE_MARKETING_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(event);
      });
    }
    return strategy;
  }
}

export class ListMarketingStrategiesUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute(opts?: { productId?: string; verticalId?: string }) {
    return this.marketing.listStrategies(opts);
  }
}

export class CreateMarketingAudienceUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    audienceKind?: string;
    productId?: string | null;
    verticalId?: string | null;
    rules?: {
      ruleType: string;
      criterionType: string;
      criterionRef?: string | null;
      criterionValue?: Record<string, unknown>;
    }[];
  }) {
    return this.marketing.createAudience({ ...input, createdBy: input.actorId }).then(
      async (audience) => {
        for (let i = 0; i < (input.rules?.length ?? 0); i += 1) {
          const rule = input.rules![i];
          await this.marketing.addAudienceRule({
            audienceId: audience.id,
            ruleType: rule.ruleType,
            criterionType: rule.criterionType,
            criterionRef: rule.criterionRef,
            criterionValue: rule.criterionValue,
            position: i,
          });
        }
        return audience;
      },
    );
  }
}

export class ListMarketingAudiencesUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute(opts?: { productId?: string }) {
    return this.marketing.listAudiences(opts);
  }
}

export class CreateMarketingCampaignUseCase {
  constructor(
    private readonly marketing: MarketingRepositoryPort,
    private readonly products: ProductRepositoryPort,
    private readonly commercial: CommercialRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    campaignType: string;
    objective?: string | null;
    productId: string;
    verticalId?: string | null;
    marketId?: string | null;
    segmentId?: string | null;
    icpId?: string | null;
    personaId?: string | null;
    offerType?: string | null;
    offerId?: string | null;
    audienceId?: string | null;
    strategyId?: string | null;
    budgetAmount?: string | null;
    budgetCurrency?: string | null;
    channels?: unknown[];
  }) {
    const product = await this.products.findById(input.productId);
    if (!product) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    assertCampaignCanPromoteProduct({
      productLifecycleStatus: product.lifecycleStatus,
      commercialAvailability: product.commercialAvailability,
      requirePublishedProduct: false,
    });

    if (input.offerType && input.offerId) {
      const offerStatus = await this.resolveOfferStatus(input.offerType, input.offerId);
      assertOfferPromotable({
        offerStatus,
        requireActiveOffer: false,
      });
    }

    const campaign = await this.marketing.createCampaign({
      ...input,
      createdBy: input.actorId,
    });
    if (this.outbox) {
      const event = createMarketingCampaignCreatedEvent({
        actorId: input.actorId,
        correlationId: campaign.id,
        campaignId: campaign.id,
        productId: campaign.productId,
        code: campaign.code,
      });
      await this.outbox.runWithOutbox(EDGE_MARKETING_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(event);
      });
    }
    return campaign;
  }

  private async resolveOfferStatus(offerType: string, offerId: string): Promise<string | null> {
    if (offerType === 'PLAN') {
      return (await this.commercial.getPlan(offerId))?.status ?? null;
    }
    if (offerType === 'PACKAGE') {
      return (await this.commercial.getPackage(offerId))?.status ?? null;
    }
    if (offerType === 'ADDON') {
      return (await this.commercial.getAddon(offerId))?.status ?? null;
    }
    if (offerType === 'ENTERPRISE_TEMPLATE') {
      return (await this.commercial.getEnterpriseTemplate(offerId))?.status ?? null;
    }
    return null;
  }
}

export class ListMarketingCampaignsUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute(opts?: { productId?: string; status?: string }) {
    return this.marketing.listCampaigns(opts);
  }
}

export class GetMarketingCampaignUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  async execute(id: string) {
    const campaign = await this.marketing.getCampaign(id);
    if (!campaign) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Campaign not found');
    return campaign;
  }
}

export class TransitionMarketingCampaignUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}

  async execute(input: { campaignId: string; toStatus: string }) {
    const campaign = await this.marketing.getCampaign(input.campaignId);
    if (!campaign) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Campaign not found');
    assertCampaignStatusTransition(campaign.status, input.toStatus);
    return this.marketing.updateCampaignStatus(campaign.id, input.toStatus);
  }
}

export class ApproveMarketingCampaignUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}

  async execute(input: {
    actorId: string;
    campaignId: string;
    approvalType: string;
    decision: 'APPROVED' | 'REJECTED';
    notes?: string | null;
  }) {
    const campaign = await this.marketing.getCampaign(input.campaignId);
    if (!campaign) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Campaign not found');
    if (campaign.status !== CampaignStatus.IN_REVIEW && campaign.status !== CampaignStatus.DRAFT) {
      // Allow approval while in review; if draft, move to in_review first is caller's job
    }
    const approval = await this.marketing.createCampaignApproval({
      campaignId: campaign.id,
      campaignVersion: campaign.version,
      approvalType: input.approvalType,
      decision: input.decision,
      decidedBy: input.actorId,
      notes: input.notes,
    });
    if (input.approvalType === 'FINAL' && input.decision === 'APPROVED') {
      if (campaign.status === CampaignStatus.IN_REVIEW) {
        await this.marketing.updateCampaignStatus(campaign.id, CampaignStatus.APPROVED);
      }
    }
    if (input.decision === 'REJECTED') {
      await this.marketing.updateCampaignStatus(campaign.id, CampaignStatus.REJECTED);
    }
    return approval;
  }
}

export class PublishMarketingCampaignUseCase {
  constructor(
    private readonly marketing: MarketingRepositoryPort,
    private readonly products: ProductRepositoryPort,
    private readonly commercial: CommercialRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: { actorId: string; campaignId: string }) {
    const campaign = await this.marketing.getCampaign(input.campaignId);
    if (!campaign) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Campaign not found');

    const product = await this.products.findById(campaign.productId);
    if (!product) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    assertCampaignCanPromoteProduct({
      productLifecycleStatus: product.lifecycleStatus,
      commercialAvailability: product.commercialAvailability,
      requirePublishedProduct: true,
    });

    if (campaign.offerType && campaign.offerId) {
      let offerStatus: string | null = null;
      if (campaign.offerType === 'PLAN') {
        offerStatus = (await this.commercial.getPlan(campaign.offerId))?.status ?? null;
      } else if (campaign.offerType === 'PACKAGE') {
        offerStatus = (await this.commercial.getPackage(campaign.offerId))?.status ?? null;
      } else if (campaign.offerType === 'ADDON') {
        offerStatus = (await this.commercial.getAddon(campaign.offerId))?.status ?? null;
      } else if (campaign.offerType === 'ENTERPRISE_TEMPLATE') {
        offerStatus =
          (await this.commercial.getEnterpriseTemplate(campaign.offerId))?.status ?? null;
      }
      assertOfferPromotable({ offerStatus, requireActiveOffer: true });
    }

    const finalApproval = await this.marketing.getLatestFinalApproval(campaign.id);
    assertCampaignPublishable({
      status: campaign.status,
      finalApprovalDecision: finalApproval?.decision ?? null,
    });

    const published = await this.marketing.updateCampaignStatus(
      campaign.id,
      CampaignStatus.ACTIVE,
      true,
    );
    if (this.outbox) {
      const event = createMarketingCampaignPublishedEvent({
        actorId: input.actorId,
        correlationId: published.id,
        campaignId: published.id,
        productId: published.productId,
        version: published.version,
      });
      await this.outbox.runWithOutbox(EDGE_MARKETING_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(event);
      });
    }
    return published;
  }
}

export class CreateMarketingFormUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute(input: {
    actorId: string;
    code: string;
    name: string;
    formType: string;
    slug: string;
    productId?: string | null;
    campaignId?: string | null;
    fields?: unknown[];
    requiredConsents?: unknown[];
  }) {
    assertFormDoesNotProvisionTenant(input.formType);
    return this.marketing.createForm({ ...input, createdBy: input.actorId });
  }
}

export class ListMarketingFormsUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute(opts?: { productId?: string }) {
    return this.marketing.listForms(opts);
  }
}

export class PublishMarketingFormUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  async execute(formId: string) {
    const form = await this.marketing.getForm(formId);
    if (!form) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Form not found');
    return this.marketing.publishForm(formId);
  }
}

export class SubmitMarketingFormPublicUseCase {
  constructor(
    private readonly marketing: MarketingRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    slug: string;
    idempotencyKey?: string | null;
    payload: Record<string, unknown>;
    utm?: Record<string, unknown>;
    sourceUrl?: string | null;
    consents?: { purpose: string; channel: string; textVersion: string }[];
    actorId?: string;
  }) {
    const form = await this.marketing.getFormBySlug(input.slug);
    if (!form || form.status !== 'PUBLISHED') {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Published form not found');
    }
    assertFormDoesNotProvisionTenant(form.formType);

    if (input.idempotencyKey) {
      const existing = await this.marketing.findSubmissionByIdempotency(
        form.id,
        input.idempotencyKey,
      );
      if (existing) return { submission: existing, lead: null, duplicate: true as const };
    }

    const emailRaw =
      typeof input.payload.email === 'string'
        ? input.payload.email
        : typeof input.payload.professionalEmail === 'string'
          ? input.payload.professionalEmail
          : null;
    const emailNormalized = emailRaw ? normalizeLeadEmail(emailRaw) : null;

    let lead = emailNormalized
      ? await this.marketing.findLeadByEmail(emailNormalized)
      : null;
    let createdNewLead = false;
    if (!lead) {
      lead = await this.marketing.createLead({
        emailNormalized,
        primaryProductId: form.productId,
        sourceType: form.formType,
        sourceCampaignId: form.campaignId,
        sourceFormId: form.id,
        status: LeadStatus.NEW,
        metadata: { formType: form.formType },
      });
      createdNewLead = true;
      await this.marketing.createLeadContact({
        leadId: lead.id,
        fullName: typeof input.payload.fullName === 'string' ? input.payload.fullName : null,
        jobTitle: typeof input.payload.jobTitle === 'string' ? input.payload.jobTitle : null,
        email: emailRaw,
        emailNormalized,
        phone: typeof input.payload.phone === 'string' ? input.payload.phone : null,
      });
    }

    for (const c of input.consents ?? []) {
      await this.marketing.createLeadConsent({
        leadId: lead.id,
        purpose: c.purpose,
        channel: c.channel,
        state: 'GRANTED',
        source: `form:${form.slug}`,
        consentTextVersion: c.textVersion,
      });
    }

    const submission = await this.marketing.createSubmission({
      formId: form.id,
      formVersion: form.version,
      idempotencyKey: input.idempotencyKey,
      leadId: lead.id,
      payload: input.payload,
      utm: input.utm,
      sourceUrl: input.sourceUrl,
      campaignId: form.campaignId,
      productId: form.productId,
      status: 'PROCESSED',
    });

    await this.marketing.createLeadActivity({
      leadId: lead.id,
      activityType: `FORM_${form.formType}`,
      campaignId: form.campaignId,
      formSubmissionId: submission.id,
      payload: { formSlug: form.slug },
    });

    await this.marketing.createAttributionTouchpoint({
      leadId: lead.id,
      campaignId: form.campaignId,
      touchType: 'LEAD_CREATION',
      channel: 'WEB_FORM',
      utm: input.utm,
      referrer: input.sourceUrl,
      dataQuality: 'MEASURED',
    });

    const actorId = input.actorId ?? 'public-form';
    if (this.outbox) {
      await this.outbox.runWithOutbox(EDGE_MARKETING_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(
          createMarketingFormSubmittedEvent({
            actorId,
            correlationId: submission.id,
            submissionId: submission.id,
            formId: form.id,
            leadId: lead.id,
          }),
        );
        if (createdNewLead) {
          await enqueue(
            createMarketingLeadCreatedEvent({
              actorId,
              correlationId: lead.id,
              leadId: lead.id,
              emailNormalized: lead.emailNormalized,
            }),
          );
        }
      });
    }

    return { submission, lead, duplicate: false as const };
  }
}

export class ListMarketingLeadsUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute(opts?: { status?: string; productId?: string; limit?: number }) {
    return this.marketing.listLeads(opts);
  }
}

export class GetMarketingLeadUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  async execute(id: string) {
    const lead = await this.marketing.getLead(id);
    if (!lead) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Lead not found');
    const consents = await this.marketing.listLeadConsents(id);
    return { ...lead, consents };
  }
}

export class ScoreMarketingLeadUseCase {
  constructor(
    private readonly marketing: MarketingRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    leadId: string;
    signals: {
      icpMatch?: boolean;
      segmentMatch?: boolean;
      demoRequest?: boolean;
      explicitContact?: boolean;
      resourceDownload?: boolean;
      eventParticipation?: boolean;
      daysSinceLastActivity?: number | null;
      profileCompletenessRatio?: number | null;
    };
    qualifyThreshold?: number;
  }) {
    const lead = await this.marketing.getLead(input.leadId);
    if (!lead) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Lead not found');
    const model = await this.marketing.getActiveScoringModel();
    if (!model) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Active scoring model not found');
    }
    const scored = calculateExplainableLeadScore({
      weights: model.weights as ScoringWeights,
      signals: input.signals,
      modelVersion: model.version,
    });
    const saved = await this.marketing.createLeadScore({
      leadId: lead.id,
      modelId: model.id,
      modelVersion: model.version,
      score: String(scored.score),
      explanation: {
        explanation: scored.explanation,
        applied: scored.applied,
      },
      missingSignals: scored.missingSignals,
    });

    const threshold = input.qualifyThreshold ?? 50;
    let updated = lead;
    if (scored.score >= threshold && lead.status === LeadStatus.NEW) {
      updated = await this.marketing.updateLeadStatus(
        lead.id,
        LeadStatus.MARKETING_QUALIFIED,
      );
      if (this.outbox) {
        const event = createMarketingLeadQualifiedEvent({
          actorId: input.actorId,
          correlationId: saved.id,
          leadId: lead.id,
          score: scored.score,
          modelVersion: model.version,
        });
        await this.outbox.runWithOutbox(EDGE_MARKETING_OUTBOX_TENANT, async (_c, enqueue) => {
          await enqueue(event);
        });
      }
    }
    return { lead: updated, score: scored, persisted: saved };
  }
}

export class CreateMarketingBudgetUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute(input: {
    code: string;
    name: string;
    scopeType: string;
    currency: string;
    plannedAmount: string;
    productId?: string | null;
    verticalId?: string | null;
    campaignId?: string | null;
  }) {
    return this.marketing.createBudget(input);
  }
}

export class ListMarketingBudgetsUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute() {
    return this.marketing.listBudgets();
  }
}

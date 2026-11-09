import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { MarketingChannelAdapterPort } from '../../domain/marketing/channel-adapter.port.js';
import {
  assertChannelActiveForSend,
  assertContentPublishable,
  assertDeliveryTransition,
  assertWithinFrequencyCap,
  calculateAttributionCredits,
  DeliveryStatus,
  evaluateJourneyGate,
  JourneyExecutionStatus,
  resolveNextJourneyStep,
  utcDayStart,
  utcWeekStart,
  type JourneyDefinition,
} from '../../domain/marketing/marketing-orchestration.js';
import type { MarketingRepositoryPort } from '../../domain/ports/marketing-repository.port.js';
import type { ProductRepositoryPort } from '../../domain/ports/product-repository.port.js';
import { assertValidStudioDocument } from '../../domain/marketing/marketing-studio.blocks.js';

export class CreateMarketingContentUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute(input: {
    actorId: string;
    code: string;
    name: string;
    contentType: string;
    productId?: string | null;
    verticalId?: string | null;
    locale?: string;
    body?: Record<string, unknown>;
  }) {
    return this.marketing.createContent({ ...input, createdBy: input.actorId });
  }
}

export class ListMarketingContentsUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute(opts?: { productId?: string }) {
    return this.marketing.listContents(opts);
  }
}

export class ApproveMarketingContentUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  async execute(id: string) {
    const content = await this.marketing.getContent(id);
    if (!content) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Content not found');
    return this.marketing.updateContentStatus(id, 'APPROVED');
  }
}

export class PublishMarketingContentUseCase {
  constructor(
    private readonly marketing: MarketingRepositoryPort,
    private readonly products: ProductRepositoryPort,
  ) {}
  async execute(id: string) {
    const content = await this.marketing.getContent(id);
    if (!content) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Content not found');
    let productLifecycleStatus: string | null = null;
    if (content.productId) {
      const product = await this.products.findById(content.productId);
      productLifecycleStatus = product?.lifecycleStatus ?? null;
    }
    assertContentPublishable({
      status: content.status,
      productLifecycleStatus,
    });
    return this.marketing.updateContentStatus(id, 'PUBLISHED');
  }
}

export class UpdateMarketingContentStudioUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  async execute(input: { id: string; studio: unknown }) {
    const content = await this.marketing.getContent(input.id);
    if (!content) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Content not found');
    if (content.status === 'PUBLISHED' || content.status === 'ARCHIVED') {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'Cannot edit studio document for published/archived content',
        [{ status: content.status }],
      );
    }
    const studio = assertValidStudioDocument(input.studio);
    return this.marketing.updateContentBody(input.id, {
      ...content.body,
      studio,
    });
  }
}

export class UpdateMarketingLandingStudioUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  async execute(input: { id: string; studio: unknown }) {
    const page = await this.marketing.getLandingPage(input.id);
    if (!page) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Landing page not found');
    if (page.status === 'PUBLISHED' || page.status === 'ARCHIVED') {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'Cannot edit studio layout for published/archived landing page',
        [{ status: page.status }],
      );
    }
    const studio = assertValidStudioDocument(input.studio);
    return this.marketing.updateLandingPageLayout(input.id, {
      ...page.layout,
      studio,
    });
  }
}

export class CreateMarketingLandingPageUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute(input: {
    actorId: string;
    code: string;
    name: string;
    pageType: string;
    slug: string;
    productId?: string | null;
    campaignId?: string | null;
    formId?: string | null;
    locale?: string;
    layout?: Record<string, unknown>;
    seo?: Record<string, unknown>;
    cta?: Record<string, unknown>;
  }) {
    return this.marketing.createLandingPage({ ...input, createdBy: input.actorId });
  }
}

export class ListMarketingLandingPagesUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute(opts?: { productId?: string }) {
    return this.marketing.listLandingPages(opts);
  }
}

export class PublishMarketingLandingPageUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  async execute(id: string) {
    const page = await this.marketing.getLandingPage(id);
    if (!page) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Landing page not found');
    if (page.status !== 'APPROVED' && page.status !== 'DRAFT') {
      // Allow draft→published for Increment 2 simplicity after explicit publish intent,
      // but require at least non-archived.
    }
    if (page.status === 'ARCHIVED' || page.status === 'UNPUBLISHED') {
      throw new DomainError(ErrorCode.CONFLICT, 'Cannot publish archived/unpublished page', [
        { status: page.status },
      ]);
    }
    return this.marketing.updateLandingPageStatus(id, 'PUBLISHED', new Date());
  }
}

export class ListMarketingChannelsUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute() {
    return this.marketing.listChannelConfigs();
  }
}

export class UpsertMarketingChannelUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute(input: {
    code: string;
    channelType: string;
    displayName: string;
    status?: string;
    providerRef?: string | null;
    secretRef?: string | null;
    settings?: Record<string, unknown>;
  }) {
    // secretRef is a vault reference — never accept raw secrets in settings
    if (input.settings && 'apiKey' in input.settings) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Raw provider secrets are forbidden in channel settings; use secretRef',
      );
    }
    return this.marketing.upsertChannelConfig(input);
  }
}

export class CreateMarketingMessageTemplateUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute(input: {
    actorId: string;
    code: string;
    name: string;
    channelType: string;
    locale?: string;
    subject?: string | null;
    body?: Record<string, unknown>;
  }) {
    return this.marketing.createMessageTemplate({ ...input, createdBy: input.actorId });
  }
}

export class ListMarketingMessageTemplatesUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute() {
    return this.marketing.listMessageTemplates();
  }
}

/**
 * Requests a delivery via channel adapter.
 * ACCEPTED → SUBMITTED (await receipt). Never marks DELIVERED here.
 */
export class RequestMarketingDeliveryUseCase {
  constructor(
    private readonly marketing: MarketingRepositoryPort,
    private readonly channelAdapter: MarketingChannelAdapterPort,
  ) {}

  async execute(input: {
    channelConfigId: string;
    leadId: string;
    templateId?: string | null;
    campaignId?: string | null;
    purpose: string;
    channel: string;
    idempotencyKey: string;
  }) {
    const existing = await this.marketing.findDeliveryByIdempotency(input.idempotencyKey);
    if (existing) return { delivery: existing, duplicate: true as const, adapter: null };

    const channel = await this.marketing.getChannelConfig(input.channelConfigId);
    if (!channel) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Channel not found');
    assertChannelActiveForSend(channel.status);

    const lead = await this.marketing.getLead(input.leadId);
    if (!lead) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Lead not found');

    const suppressed = await this.marketing.isSuppressed(lead.emailNormalized, input.channel);
    const consents = await this.marketing.listLeadConsents(lead.id);
    const gate = evaluateJourneyGate({
      suppressed,
      consents,
      purpose: input.purpose,
      channel: input.channel,
    });
    if (gate === 'SUPPRESS' || gate === 'EXIT_UNSUBSCRIBE') {
      const delivery = await this.marketing.createDeliveryAttempt({
        channelConfigId: channel.id,
        templateId: input.templateId,
        campaignId: input.campaignId,
        leadId: lead.id,
        status: DeliveryStatus.SUPPRESSED,
        idempotencyKey: input.idempotencyKey,
        metadata: { gate },
      });
      return { delivery, duplicate: false as const, adapter: null };
    }

    const dayStart = utcDayStart();
    const weekStart = utcWeekStart();
    const policy = await this.marketing.getFrequencyPolicy(input.channel);
    const counters = await this.marketing.getFrequencyCounters(
      lead.id,
      input.channel,
      dayStart,
      weekStart,
    );
    assertWithinFrequencyCap({ policy, counters });

    let delivery = await this.marketing.createDeliveryAttempt({
      channelConfigId: channel.id,
      templateId: input.templateId,
      campaignId: input.campaignId,
      leadId: lead.id,
      status: DeliveryStatus.REQUESTED,
      idempotencyKey: input.idempotencyKey,
    });

    const template = input.templateId
      ? await this.marketing.getMessageTemplate(input.templateId)
      : null;
    const templateBody = template?.body ?? {};
    const html =
      typeof templateBody.html === 'string'
        ? templateBody.html
        : typeof templateBody.htmlBody === 'string'
          ? templateBody.htmlBody
          : null;
    const text =
      typeof templateBody.text === 'string'
        ? templateBody.text
        : typeof templateBody.textBody === 'string'
          ? templateBody.textBody
          : null;
    const toPhoneE164 = await this.marketing.getLeadPrimaryPhone(lead.id);

    const adapterResult = await this.channelAdapter.send({
      channelType: channel.channelType,
      providerRef: channel.providerRef,
      secretRef: channel.secretRef,
      settings: channel.settings,
      toEmailNormalized: lead.emailNormalized,
      toPhoneE164,
      leadId: lead.id,
      templateId: input.templateId ?? null,
      idempotencyKey: input.idempotencyKey,
      deliveryAttemptId: delivery.id,
      subject: template?.subject ?? null,
      html,
      text,
    });

    if (adapterResult.outcome === 'ACCEPTED') {
      assertDeliveryTransition(delivery.status, DeliveryStatus.SUBMITTED);
      delivery = await this.marketing.updateDeliveryAttemptStatus({
        id: delivery.id,
        status: DeliveryStatus.SUBMITTED,
        providerMessageId: adapterResult.providerMessageId,
        submittedAt: new Date(),
      });
      await this.marketing.incrementFrequencyCounter(lead.id, input.channel, 'DAY', dayStart);
      await this.marketing.incrementFrequencyCounter(lead.id, input.channel, 'WEEK', weekStart);
    } else {
      delivery = await this.marketing.updateDeliveryAttemptStatus({
        id: delivery.id,
        status: DeliveryStatus.FAILED,
        failureCode: adapterResult.failureCode,
        failureMessage: adapterResult.failureMessage,
        terminalAt: new Date(),
      });
    }

    return { delivery, duplicate: false as const, adapter: adapterResult };
  }
}

export class IngestMarketingDeliveryReceiptUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}

  async execute(input: {
    deliveryAttemptId: string;
    providerEventId: string;
    receiptStatus: 'DELIVERED' | 'FAILED' | 'BOUNCED' | 'OPENED' | 'CLICKED' | 'UNKNOWN';
    signatureValid: boolean;
    rawPayload?: Record<string, unknown>;
    source?: 'operator' | 'provider_webhook';
  }) {
    if (!input.signatureValid) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'Webhook signature invalid');
    }
    const attempt = await this.marketing.getDeliveryAttempt(input.deliveryAttemptId);
    if (!attempt) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Delivery attempt not found');

    if (input.providerEventId) {
      const existing = await this.marketing.findDeliveryReceiptByProviderEventId(
        input.providerEventId,
      );
      if (existing) {
        return { receiptId: existing.id, duplicate: true as const };
      }
    }

    const receipt = await this.marketing.createDeliveryReceipt({
      deliveryAttemptId: attempt.id,
      providerEventId: input.providerEventId,
      receiptStatus: input.receiptStatus,
      rawPayload: {
        ...(input.rawPayload ?? {}),
        _ingestSource: input.source ?? 'provider_webhook',
      },
      signatureValid: true,
    });

    let currentStatus = attempt.status;
    if (
      currentStatus === DeliveryStatus.REQUESTED ||
      currentStatus === DeliveryStatus.QUEUED
    ) {
      assertDeliveryTransition(currentStatus, DeliveryStatus.SUBMITTED);
      await this.marketing.updateDeliveryAttemptStatus({
        id: attempt.id,
        status: DeliveryStatus.SUBMITTED,
        submittedAt: new Date(),
      });
      currentStatus = DeliveryStatus.SUBMITTED;
    }

    // Engagement events are recorded but do not mutate terminal delivery state.
    if (
      input.receiptStatus === 'OPENED' ||
      input.receiptStatus === 'CLICKED' ||
      input.receiptStatus === 'UNKNOWN'
    ) {
      return { receiptId: receipt.id, duplicate: false as const };
    }

    if (input.receiptStatus === 'DELIVERED') {
      if (currentStatus === DeliveryStatus.DELIVERED) {
        return { receiptId: receipt.id, duplicate: false as const };
      }
      if (currentStatus !== DeliveryStatus.SUBMITTED) {
        return { receiptId: receipt.id, duplicate: false as const, transitionSkipped: true as const };
      }
      assertDeliveryTransition(currentStatus, DeliveryStatus.DELIVERED, {
        hasVerifiedReceipt: true,
      });
      await this.marketing.updateDeliveryAttemptStatus({
        id: attempt.id,
        status: DeliveryStatus.DELIVERED,
        terminalAt: new Date(),
      });
    } else if (input.receiptStatus === 'FAILED' || input.receiptStatus === 'BOUNCED') {
      const to =
        input.receiptStatus === 'BOUNCED' ? DeliveryStatus.BOUNCED : DeliveryStatus.FAILED;
      if (currentStatus === to) {
        return { receiptId: receipt.id, duplicate: false as const };
      }
      if (currentStatus !== DeliveryStatus.SUBMITTED) {
        return { receiptId: receipt.id, duplicate: false as const, transitionSkipped: true as const };
      }
      assertDeliveryTransition(currentStatus, to, { hasVerifiedReceipt: true });
      await this.marketing.updateDeliveryAttemptStatus({
        id: attempt.id,
        status: to,
        terminalAt: new Date(),
        failureCode: input.receiptStatus,
      });
    }

    return { receiptId: receipt.id, duplicate: false as const };
  }
}

export class CreateMarketingJourneyUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    productId?: string | null;
    triggerType: string;
    definition: JourneyDefinition;
  }) {
    if (!input.definition.entryStepKey || !input.definition.steps?.length) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Journey definition requires entry + steps');
    }
    return this.marketing.createJourney({
      ...input,
      definition: input.definition as unknown as Record<string, unknown>,
      createdBy: input.actorId,
    });
  }
}

export class ListMarketingJourneysUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute() {
    return this.marketing.listJourneys();
  }
}

export class ActivateMarketingJourneyUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  async execute(id: string) {
    const journey = await this.marketing.getJourney(id);
    if (!journey) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Journey not found');
    return this.marketing.updateJourneyStatus(id, 'ACTIVE');
  }
}

/** Deterministic single-pass journey runner (no async waits executed inline). */
export class StartMarketingJourneyExecutionUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}

  async execute(input: {
    journeyId: string;
    leadId: string;
    idempotencyKey: string;
  }) {
    const existing = await this.marketing.findJourneyExecutionByIdempotency(input.idempotencyKey);
    if (existing) return { execution: existing, duplicate: true as const };

    const journey = await this.marketing.getJourney(input.journeyId);
    if (!journey || journey.status !== 'ACTIVE') {
      throw new DomainError(ErrorCode.CONFLICT, 'Journey not active');
    }
    const lead = await this.marketing.getLead(input.leadId);
    if (!lead) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Lead not found');

    const definition = journey.definition as unknown as JourneyDefinition;
    const entry = resolveNextJourneyStep(definition, null);
    const execution = await this.marketing.createJourneyExecution({
      journeyId: journey.id,
      journeyVersion: journey.version,
      leadId: lead.id,
      idempotencyKey: input.idempotencyKey,
      currentStepKey: entry?.key ?? null,
      status: JourneyExecutionStatus.RUNNING,
    });

    let step = entry;
    let guard = 0;
    while (step && guard < 50) {
      guard += 1;
      if (step.type === 'WAIT') {
        const hours = Math.max(0, step.waitHours ?? 0);
        const resumeAt = new Date(Date.now() + hours * 3600_000);
        await this.marketing.scheduleJourneyWait({
          executionId: execution.id,
          stepKey: step.key,
          resumeAt,
        });
        await this.marketing.recordJourneyStep({
          executionId: execution.id,
          stepKey: step.key,
          stepType: step.type,
          status: 'WAITING',
          result: { waitHours: hours, resumeAt: resumeAt.toISOString() },
        });
        await this.marketing.updateJourneyExecution({
          id: execution.id,
          status: JourneyExecutionStatus.WAITING,
          currentStepKey: step.key,
        });
        break;
      }
      if (step.type === 'STOP') {
        await this.marketing.recordJourneyStep({
          executionId: execution.id,
          stepKey: step.key,
          stepType: step.type,
          status: 'EXECUTED',
        });
        await this.marketing.updateJourneyExecution({
          id: execution.id,
          status: JourneyExecutionStatus.COMPLETED,
          currentStepKey: step.key,
          completedAt: new Date(),
        });
        break;
      }
      if (step.type === 'UPDATE_STATUS' && step.toStatus) {
        await this.marketing.updateLeadStatus(lead.id, step.toStatus);
        await this.marketing.recordJourneyStep({
          executionId: execution.id,
          stepKey: step.key,
          stepType: step.type,
          status: 'EXECUTED',
          result: { toStatus: step.toStatus },
        });
      } else if (step.type === 'SEND_MESSAGE') {
        const channel = step.channel ?? 'EMAIL';
        const purpose = step.purpose ?? 'marketing_email';
        const suppressed = await this.marketing.isSuppressed(lead.emailNormalized, channel);
        const consents = await this.marketing.listLeadConsents(lead.id);
        const gate = evaluateJourneyGate({ suppressed, consents, purpose, channel });
        if (gate !== 'CONTINUE') {
          await this.marketing.recordJourneyStep({
            executionId: execution.id,
            stepKey: step.key,
            stepType: step.type,
            status: 'SKIPPED',
            result: { gate },
          });
          await this.marketing.updateJourneyExecution({
            id: execution.id,
            status: JourneyExecutionStatus.EXITED_UNSUBSCRIBE,
            currentStepKey: step.key,
            completedAt: new Date(),
          });
          break;
        }
        await this.marketing.recordJourneyStep({
          executionId: execution.id,
          stepKey: step.key,
          stepType: step.type,
          status: 'EXECUTED',
          result: { queued: true, note: 'Delivery must be requested via channel adapter' },
        });
      } else {
        await this.marketing.recordJourneyStep({
          executionId: execution.id,
          stepKey: step.key,
          stepType: step.type,
          status: 'EXECUTED',
        });
      }
      step = resolveNextJourneyStep(definition, step.key);
      if (!step) {
        await this.marketing.updateJourneyExecution({
          id: execution.id,
          status: JourneyExecutionStatus.COMPLETED,
          completedAt: new Date(),
        });
      } else {
        await this.marketing.updateJourneyExecution({
          id: execution.id,
          status: JourneyExecutionStatus.RUNNING,
          currentStepKey: step.key,
        });
      }
    }

    const finalExec = await this.marketing.findJourneyExecutionByIdempotency(input.idempotencyKey);
    return { execution: finalExec!, duplicate: false as const };
  }
}

export class CalculateMarketingAttributionUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}

  async execute(input: {
    leadId: string;
    modelCode: string;
    conversionKey: string;
  }) {
    const model = await this.marketing.getAttributionModel(input.modelCode);
    if (!model) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Attribution model not found');
    const touches = await this.marketing.listTouchpointsForLead(input.leadId);
    const result = calculateAttributionCredits({
      modelType: model.modelType,
      touches,
    });
    const saved = await this.marketing.saveAttributionResult({
      modelId: model.id,
      modelVersion: model.version,
      leadId: input.leadId,
      conversionKey: input.conversionKey,
      credits: result.credits,
      dataQuality: result.dataQuality,
    });
    return { ...result, resultId: saved.id, model };
  }
}

export class ListMarketingAttributionModelsUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute() {
    return this.marketing.listAttributionModels();
  }
}

const REVENUE_DEPENDENT_METRICS = new Set([
  'cac',
  'CAC',
  'roas',
  'ROAS',
  'revenueAttributed',
  'ltv',
  'LTV',
]);

export class CreateMarketingPerformanceSnapshotUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute(input: {
    scopeType: string;
    scopeId?: string | null;
    periodStart: string;
    periodEnd: string;
    metrics: Record<string, unknown>;
    metricQuality: Record<string, string>;
  }) {
    for (const [key, quality] of Object.entries(input.metricQuality)) {
      if (!['MEASURED', 'ESTIMATED', 'UNAVAILABLE'].includes(quality)) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          `Invalid metric quality for ${key}`,
          [{ quality }],
        );
      }
      if (
        REVENUE_DEPENDENT_METRICS.has(key) &&
        quality === 'MEASURED' &&
        input.metrics.revenueReconciled !== true
      ) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          `${key} cannot be MEASURED without revenueReconciled=true`,
          [{ key, quality }],
        );
      }
      if (quality === 'MEASURED' && !(key in input.metrics)) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          `MEASURED metric ${key} requires a value in metrics`,
          [{ key }],
        );
      }
    }
    return this.marketing.createPerformanceSnapshot(input);
  }
}

export class ListMarketingPerformanceSnapshotsUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  execute(opts?: { scopeType?: string }) {
    return this.marketing.listPerformanceSnapshots(opts);
  }
}

/** Aggregate snapshot qualities — never invents CAC/ROAS. */
export class SummarizeMarketingAnalyticsUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  async execute(opts?: { scopeType?: string }) {
    const snapshots = await this.marketing.listPerformanceSnapshots(opts);
    const qualityCounts = { MEASURED: 0, ESTIMATED: 0, UNAVAILABLE: 0 };
    const metricKeys = new Set<string>();
    for (const snap of snapshots) {
      for (const [key, quality] of Object.entries(snap.metricQuality ?? {})) {
        metricKeys.add(key);
        if (quality === 'MEASURED' || quality === 'ESTIMATED' || quality === 'UNAVAILABLE') {
          qualityCounts[quality] += 1;
        }
      }
    }
    const revenueGate = {
      status: 'UNAVAILABLE' as const,
      reason: 'Requires reconciled revenue source of truth (commercial/billing)',
    };
    return {
      snapshotCount: snapshots.length,
      qualityCounts,
      metricKeys: [...metricKeys].sort(),
      cac: revenueGate,
      roas: revenueGate,
      ltv: revenueGate,
      revenueAttributed: revenueGate,
      revenueReconciled: false,
      latest: snapshots[0]
        ? {
            id: snapshots[0].id,
            scopeType: snapshots[0].scopeType,
            periodStart: snapshots[0].periodStart,
            periodEnd: snapshots[0].periodEnd,
            metrics: snapshots[0].metrics,
            metricQuality: snapshots[0].metricQuality,
          }
        : null,
    };
  }
}

export class CreateMarketingSuppressionUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  async execute(input: {
    leadId?: string | null;
    emailNormalized?: string | null;
    channel: string;
    reason: string;
  }) {
    const created = await this.marketing.createSuppression(input);
    if (input.leadId) {
      await this.marketing.createLeadActivity({
        leadId: input.leadId,
        activityType: 'SUPPRESSION',
        payload: { channel: input.channel, reason: input.reason },
      });
    }
    return created;
  }
}

/** Resume due WAIT steps — continues from next after the wait step. */
export class ResumeWaitingMarketingJourneysUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}

  async execute(input?: { now?: Date; limit?: number }) {
    const now = input?.now ?? new Date();
    const due = await this.marketing.listDueJourneyWaits(now, input?.limit ?? 50);
    const results: { waitId: string; executionId: string; status: string }[] = [];

    for (const wait of due) {
      const execution = await this.marketing.getJourneyExecution(wait.executionId);
      if (!execution || execution.status !== JourneyExecutionStatus.WAITING) {
        await this.marketing.markJourneyWaitResumed(wait.id);
        results.push({
          waitId: wait.id,
          executionId: wait.executionId,
          status: 'SKIPPED',
        });
        continue;
      }
      const journey = await this.marketing.getJourney(execution.journeyId);
      if (!journey) {
        await this.marketing.markJourneyWaitResumed(wait.id);
        results.push({
          waitId: wait.id,
          executionId: wait.executionId,
          status: 'FAILED',
        });
        continue;
      }
      const definition = journey.definition as unknown as JourneyDefinition;
      const next = resolveNextJourneyStep(definition, wait.stepKey);
      await this.marketing.markJourneyWaitResumed(wait.id);
      if (!next) {
        await this.marketing.updateJourneyExecution({
          id: execution.id,
          status: JourneyExecutionStatus.COMPLETED,
          completedAt: new Date(),
        });
        results.push({
          waitId: wait.id,
          executionId: execution.id,
          status: 'COMPLETED',
        });
        continue;
      }
      if (next.type === 'STOP') {
        await this.marketing.recordJourneyStep({
          executionId: execution.id,
          stepKey: next.key,
          stepType: next.type,
          status: 'EXECUTED',
        });
        await this.marketing.updateJourneyExecution({
          id: execution.id,
          status: JourneyExecutionStatus.COMPLETED,
          currentStepKey: next.key,
          completedAt: new Date(),
        });
        results.push({
          waitId: wait.id,
          executionId: execution.id,
          status: 'COMPLETED',
        });
        continue;
      }
      if (next.type === 'UPDATE_STATUS' && next.toStatus) {
        await this.marketing.updateLeadStatus(execution.leadId, next.toStatus);
        await this.marketing.recordJourneyStep({
          executionId: execution.id,
          stepKey: next.key,
          stepType: next.type,
          status: 'EXECUTED',
          result: { toStatus: next.toStatus, resumedFromWait: wait.stepKey },
        });
      } else {
        await this.marketing.recordJourneyStep({
          executionId: execution.id,
          stepKey: next.key,
          stepType: next.type,
          status: 'EXECUTED',
          result: { resumedFromWait: wait.stepKey },
        });
      }
      const following = resolveNextJourneyStep(definition, next.key);
      if (!following || following.type === 'STOP') {
        await this.marketing.updateJourneyExecution({
          id: execution.id,
          status: JourneyExecutionStatus.COMPLETED,
          currentStepKey: following?.key ?? next.key,
          completedAt: new Date(),
        });
        results.push({
          waitId: wait.id,
          executionId: execution.id,
          status: 'COMPLETED',
        });
      } else if (following.type === 'WAIT') {
        const hours = Math.max(0, following.waitHours ?? 0);
        const resumeAt = new Date(Date.now() + hours * 3600_000);
        await this.marketing.scheduleJourneyWait({
          executionId: execution.id,
          stepKey: following.key,
          resumeAt,
        });
        await this.marketing.updateJourneyExecution({
          id: execution.id,
          status: JourneyExecutionStatus.WAITING,
          currentStepKey: following.key,
        });
        results.push({
          waitId: wait.id,
          executionId: execution.id,
          status: 'WAITING',
        });
      } else {
        await this.marketing.updateJourneyExecution({
          id: execution.id,
          status: JourneyExecutionStatus.RUNNING,
          currentStepKey: following.key,
        });
        results.push({
          waitId: wait.id,
          executionId: execution.id,
          status: 'RUNNING',
        });
      }
    }
    return { processed: results.length, results };
  }
}

export class AssignMarketingLeadUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  async execute(input: { leadId: string; assignedTo: string; actorId: string }) {
    const lead = await this.marketing.getLead(input.leadId);
    if (!lead) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Lead not found');
    const updated = await this.marketing.assignLead(input.leadId, input.assignedTo);
    await this.marketing.createLeadActivity({
      leadId: input.leadId,
      activityType: 'ASSIGNED',
      payload: { assignedTo: input.assignedTo, actorId: input.actorId },
    });
    return updated;
  }
}

export class MergeMarketingLeadsUseCase {
  constructor(private readonly marketing: MarketingRepositoryPort) {}
  async execute(input: {
    keepLeadId: string;
    duplicateLeadId: string;
    actorId: string;
  }) {
    const keep = await this.marketing.getLead(input.keepLeadId);
    const dup = await this.marketing.getLead(input.duplicateLeadId);
    if (!keep || !dup) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Lead not found');
    const merged = await this.marketing.mergeLeadDuplicate({
      keepLeadId: input.keepLeadId,
      duplicateLeadId: input.duplicateLeadId,
    });
    await this.marketing.createLeadActivity({
      leadId: input.keepLeadId,
      activityType: 'MERGED_DUPLICATE',
      payload: {
        duplicateLeadId: input.duplicateLeadId,
        actorId: input.actorId,
      },
    });
    return merged;
  }
}

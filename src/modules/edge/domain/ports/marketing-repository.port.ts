export const MARKETING_REPOSITORY_PORT = Symbol('MARKETING_REPOSITORY_PORT');

export type MarketingStrategy = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly scopeType: string;
  readonly productId: string | null;
  readonly verticalId: string | null;
  readonly marketId: string | null;
  readonly status: string;
  readonly version: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type MarketingAudience = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly audienceKind: string;
  readonly productId: string | null;
  readonly verticalId: string | null;
  readonly status: string;
  readonly version: number;
  readonly estimatedSize: number | null;
  readonly estimatedSizeSource: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type MarketingAudienceRule = {
  readonly id: string;
  readonly audienceId: string;
  readonly ruleType: string;
  readonly criterionType: string;
  readonly criterionRef: string | null;
  readonly criterionValue: Record<string, unknown>;
  readonly position: number;
};

export type MarketingCampaign = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly campaignType: string;
  readonly objective: string | null;
  readonly productId: string;
  readonly verticalId: string | null;
  readonly marketId: string | null;
  readonly segmentId: string | null;
  readonly icpId: string | null;
  readonly personaId: string | null;
  readonly offerType: string | null;
  readonly offerId: string | null;
  readonly audienceId: string | null;
  readonly strategyId: string | null;
  readonly status: string;
  readonly version: number;
  readonly budgetAmount: string | null;
  readonly budgetCurrency: string | null;
  readonly startsAt: Date | null;
  readonly endsAt: Date | null;
  readonly channels: unknown[];
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type MarketingFormDefinition = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly formType: string;
  readonly slug: string;
  readonly productId: string | null;
  readonly campaignId: string | null;
  readonly status: string;
  readonly version: number;
  readonly fields: unknown[];
  readonly requiredConsents: unknown[];
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type MarketingFormSubmission = {
  readonly id: string;
  readonly formId: string;
  readonly formVersion: number;
  readonly idempotencyKey: string | null;
  readonly leadId: string | null;
  readonly payload: Record<string, unknown>;
  readonly utm: Record<string, unknown>;
  readonly sourceUrl: string | null;
  readonly campaignId: string | null;
  readonly productId: string | null;
  readonly status: string;
  readonly rejectionReason: string | null;
  readonly createdAt: Date;
};

export type MarketingLead = {
  readonly id: string;
  readonly status: string;
  readonly emailNormalized: string | null;
  readonly primaryProductId: string | null;
  readonly verticalId: string | null;
  readonly organizationId: string | null;
  readonly sourceType: string | null;
  readonly sourceCampaignId: string | null;
  readonly sourceFormId: string | null;
  readonly duplicateOfLeadId: string | null;
  readonly assignedTo: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type MarketingScoringModel = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly version: number;
  readonly status: string;
  readonly weights: Record<string, unknown>;
};

export type MarketingBudget = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly scopeType: string;
  readonly currency: string;
  readonly plannedAmount: string;
  readonly committedAmount: string;
  readonly spentAmount: string;
  readonly spentSource: string;
  readonly status: string;
};

export type MarketingContent = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly contentType: string;
  readonly productId: string | null;
  readonly verticalId: string | null;
  readonly locale: string;
  readonly status: string;
  readonly version: number;
  readonly body: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type MarketingLandingPage = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly pageType: string;
  readonly slug: string;
  readonly productId: string | null;
  readonly campaignId: string | null;
  readonly formId: string | null;
  readonly locale: string;
  readonly status: string;
  readonly version: number;
  readonly layout: Record<string, unknown>;
  readonly seo: Record<string, unknown>;
  readonly cta: Record<string, unknown>;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type MarketingChannelConfig = {
  readonly id: string;
  readonly code: string;
  readonly channelType: string;
  readonly displayName: string;
  readonly status: string;
  readonly providerRef: string | null;
  readonly secretRef: string | null;
  readonly settings: Record<string, unknown>;
};

export type MarketingMessageTemplate = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly channelType: string;
  readonly locale: string;
  readonly subject: string | null;
  readonly body: Record<string, unknown>;
  readonly status: string;
  readonly version: number;
};

export type MarketingDeliveryAttempt = {
  readonly id: string;
  readonly channelConfigId: string | null;
  readonly templateId: string | null;
  readonly campaignId: string | null;
  readonly leadId: string | null;
  readonly journeyExecutionId: string | null;
  readonly status: string;
  readonly providerMessageId: string | null;
  readonly idempotencyKey: string | null;
  readonly requestedAt: Date;
};

export type MarketingJourney = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly productId: string | null;
  readonly triggerType: string;
  readonly status: string;
  readonly version: number;
  readonly definition: Record<string, unknown>;
};

export type MarketingJourneyExecution = {
  readonly id: string;
  readonly journeyId: string;
  readonly journeyVersion: number;
  readonly leadId: string;
  readonly status: string;
  readonly currentStepKey: string | null;
  readonly idempotencyKey: string;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
};

export type MarketingAttributionModel = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly modelType: string;
  readonly version: number;
  readonly status: string;
  readonly parameters: Record<string, unknown>;
};

export interface MarketingRepositoryPort {
  createStrategy(input: {
    code: string;
    name: string;
    description?: string | null;
    scopeType: string;
    productId?: string | null;
    verticalId?: string | null;
    marketId?: string | null;
    createdBy?: string | null;
  }): Promise<MarketingStrategy>;
  listStrategies(opts?: { productId?: string; verticalId?: string }): Promise<MarketingStrategy[]>;

  createAudience(input: {
    code: string;
    name: string;
    description?: string | null;
    audienceKind?: string;
    productId?: string | null;
    verticalId?: string | null;
    createdBy?: string | null;
  }): Promise<MarketingAudience>;
  listAudiences(opts?: { productId?: string }): Promise<MarketingAudience[]>;
  addAudienceRule(input: {
    audienceId: string;
    ruleType: string;
    criterionType: string;
    criterionRef?: string | null;
    criterionValue?: Record<string, unknown>;
    position?: number;
  }): Promise<MarketingAudienceRule>;
  listAudienceRules(audienceId: string): Promise<MarketingAudienceRule[]>;

  createCampaign(input: {
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
    createdBy?: string | null;
  }): Promise<MarketingCampaign>;
  getCampaign(id: string): Promise<MarketingCampaign | null>;
  listCampaigns(opts?: { productId?: string; status?: string }): Promise<MarketingCampaign[]>;
  updateCampaignStatus(id: string, status: string, bumpVersion?: boolean): Promise<MarketingCampaign>;
  createCampaignApproval(input: {
    campaignId: string;
    campaignVersion: number;
    approvalType: string;
    decision: string;
    decidedBy?: string | null;
    notes?: string | null;
  }): Promise<{ id: string; decision: string; approvalType: string }>;
  getLatestFinalApproval(campaignId: string): Promise<{ decision: string } | null>;

  createForm(input: {
    code: string;
    name: string;
    formType: string;
    slug: string;
    productId?: string | null;
    campaignId?: string | null;
    fields?: unknown[];
    requiredConsents?: unknown[];
    createdBy?: string | null;
  }): Promise<MarketingFormDefinition>;
  getFormBySlug(slug: string): Promise<MarketingFormDefinition | null>;
  getForm(id: string): Promise<MarketingFormDefinition | null>;
  listForms(opts?: { productId?: string }): Promise<MarketingFormDefinition[]>;
  publishForm(id: string): Promise<MarketingFormDefinition>;
  findSubmissionByIdempotency(
    formId: string,
    idempotencyKey: string,
  ): Promise<MarketingFormSubmission | null>;
  createSubmission(input: {
    formId: string;
    formVersion: number;
    idempotencyKey?: string | null;
    leadId?: string | null;
    payload: Record<string, unknown>;
    utm?: Record<string, unknown>;
    sourceUrl?: string | null;
    campaignId?: string | null;
    productId?: string | null;
    status?: string;
    rejectionReason?: string | null;
  }): Promise<MarketingFormSubmission>;

  findLeadByEmail(emailNormalized: string): Promise<MarketingLead | null>;
  createLead(input: {
    emailNormalized?: string | null;
    primaryProductId?: string | null;
    verticalId?: string | null;
    sourceType?: string | null;
    sourceCampaignId?: string | null;
    sourceFormId?: string | null;
    status?: string;
    metadata?: Record<string, unknown>;
  }): Promise<MarketingLead>;
  getLead(id: string): Promise<MarketingLead | null>;
  listLeads(opts?: { status?: string; productId?: string; limit?: number }): Promise<MarketingLead[]>;
  updateLeadStatus(id: string, status: string): Promise<MarketingLead>;
  markLeadDuplicate(id: string, duplicateOfLeadId: string): Promise<MarketingLead>;
  createLeadContact(input: {
    leadId: string;
    fullName?: string | null;
    jobTitle?: string | null;
    email?: string | null;
    emailNormalized?: string | null;
    phone?: string | null;
    preferredChannel?: string | null;
  }): Promise<{ id: string }>;
  createLeadActivity(input: {
    leadId: string;
    activityType: string;
    campaignId?: string | null;
    formSubmissionId?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<{ id: string }>;
  createLeadConsent(input: {
    leadId: string;
    purpose: string;
    channel: string;
    state: string;
    source: string;
    consentTextVersion: string;
    proofRef?: string | null;
  }): Promise<{ id: string }>;
  listLeadConsents(leadId: string): Promise<
    { purpose: string; channel: string; state: string; withdrawnAt: Date | null }[]
  >;

  getActiveScoringModel(code?: string): Promise<MarketingScoringModel | null>;
  createLeadScore(input: {
    leadId: string;
    modelId: string;
    modelVersion: number;
    score: string;
    explanation: Record<string, unknown>;
    missingSignals: unknown[];
  }): Promise<{ id: string; score: string }>;

  createBudget(input: {
    code: string;
    name: string;
    scopeType: string;
    currency: string;
    plannedAmount: string;
    productId?: string | null;
    verticalId?: string | null;
    campaignId?: string | null;
  }): Promise<MarketingBudget>;
  listBudgets(): Promise<MarketingBudget[]>;

  createAttributionTouchpoint(input: {
    leadId?: string | null;
    campaignId?: string | null;
    touchType: string;
    channel?: string | null;
    utm?: Record<string, unknown>;
    referrer?: string | null;
    dataQuality?: string;
  }): Promise<{ id: string }>;

  createContent(input: {
    code: string;
    name: string;
    contentType: string;
    productId?: string | null;
    verticalId?: string | null;
    locale?: string;
    body?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<MarketingContent>;
  listContents(opts?: { productId?: string }): Promise<MarketingContent[]>;
  getContent(id: string): Promise<MarketingContent | null>;
  updateContentStatus(id: string, status: string): Promise<MarketingContent>;
  updateContentBody(
    id: string,
    body: Record<string, unknown>,
  ): Promise<MarketingContent>;

  createLandingPage(input: {
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
    createdBy?: string | null;
  }): Promise<MarketingLandingPage>;
  listLandingPages(opts?: { productId?: string }): Promise<MarketingLandingPage[]>;
  getLandingPage(id: string): Promise<MarketingLandingPage | null>;
  getLandingPageBySlug(slug: string): Promise<MarketingLandingPage | null>;
  updateLandingPageStatus(
    id: string,
    status: string,
    publishedAt?: Date | null,
  ): Promise<MarketingLandingPage>;
  updateLandingPageLayout(
    id: string,
    layout: Record<string, unknown>,
  ): Promise<MarketingLandingPage>;
  getLeadPrimaryPhone(leadId: string): Promise<string | null>;

  listChannelConfigs(): Promise<MarketingChannelConfig[]>;
  upsertChannelConfig(input: {
    code: string;
    channelType: string;
    displayName: string;
    status?: string;
    providerRef?: string | null;
    secretRef?: string | null;
    settings?: Record<string, unknown>;
  }): Promise<MarketingChannelConfig>;
  getChannelConfig(id: string): Promise<MarketingChannelConfig | null>;

  createMessageTemplate(input: {
    code: string;
    name: string;
    channelType: string;
    locale?: string;
    subject?: string | null;
    body?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<MarketingMessageTemplate>;
  listMessageTemplates(): Promise<MarketingMessageTemplate[]>;
  getMessageTemplate(id: string): Promise<MarketingMessageTemplate | null>;

  createDeliveryAttempt(input: {
    channelConfigId?: string | null;
    templateId?: string | null;
    campaignId?: string | null;
    leadId?: string | null;
    journeyExecutionId?: string | null;
    status?: string;
    idempotencyKey?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<MarketingDeliveryAttempt>;
  findDeliveryByIdempotency(key: string): Promise<MarketingDeliveryAttempt | null>;
  findDeliveryByProviderMessageId(
    providerMessageId: string,
  ): Promise<MarketingDeliveryAttempt | null>;
  getDeliveryAttempt(id: string): Promise<MarketingDeliveryAttempt | null>;
  updateDeliveryAttemptStatus(input: {
    id: string;
    status: string;
    providerMessageId?: string | null;
    failureCode?: string | null;
    failureMessage?: string | null;
    submittedAt?: Date | null;
    terminalAt?: Date | null;
  }): Promise<MarketingDeliveryAttempt>;
  createDeliveryReceipt(input: {
    deliveryAttemptId: string;
    providerEventId?: string | null;
    receiptStatus: string;
    rawPayload?: Record<string, unknown>;
    signatureValid: boolean;
  }): Promise<{ id: string }>;
  findDeliveryReceiptByProviderEventId(
    providerEventId: string,
  ): Promise<{ id: string; deliveryAttemptId: string; receiptStatus: string } | null>;

  isSuppressed(emailNormalized: string | null, channel: string): Promise<boolean>;
  createSuppression(input: {
    emailNormalized?: string | null;
    leadId?: string | null;
    channel: string;
    reason: string;
  }): Promise<{ id: string }>;

  createJourney(input: {
    code: string;
    name: string;
    description?: string | null;
    productId?: string | null;
    triggerType: string;
    definition: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<MarketingJourney>;
  listJourneys(): Promise<MarketingJourney[]>;
  getJourney(id: string): Promise<MarketingJourney | null>;
  updateJourneyStatus(id: string, status: string): Promise<MarketingJourney>;
  createJourneyExecution(input: {
    journeyId: string;
    journeyVersion: number;
    leadId: string;
    idempotencyKey: string;
    currentStepKey?: string | null;
    status?: string;
  }): Promise<MarketingJourneyExecution>;
  findJourneyExecutionByIdempotency(
    key: string,
  ): Promise<MarketingJourneyExecution | null>;
  updateJourneyExecution(input: {
    id: string;
    status: string;
    currentStepKey?: string | null;
    completedAt?: Date | null;
  }): Promise<MarketingJourneyExecution>;
  recordJourneyStep(input: {
    executionId: string;
    stepKey: string;
    stepType: string;
    status: string;
    result?: Record<string, unknown>;
  }): Promise<{ id: string }>;

  listTouchpointsForLead(leadId: string): Promise<
    {
      id: string;
      campaignId: string | null;
      channel: string | null;
      occurredAt: Date;
    }[]
  >;
  getAttributionModel(code: string): Promise<MarketingAttributionModel | null>;
  listAttributionModels(): Promise<MarketingAttributionModel[]>;
  saveAttributionResult(input: {
    modelId: string;
    modelVersion: number;
    leadId: string;
    conversionKey: string;
    credits: unknown[];
    dataQuality: string;
  }): Promise<{ id: string }>;
  createPerformanceSnapshot(input: {
    scopeType: string;
    scopeId?: string | null;
    periodStart: string;
    periodEnd: string;
    metrics: Record<string, unknown>;
    metricQuality: Record<string, unknown>;
  }): Promise<{ id: string }>;
  listPerformanceSnapshots(opts?: {
    scopeType?: string;
  }): Promise<
    {
      id: string;
      scopeType: string;
      periodStart: string;
      periodEnd: string;
      metrics: Record<string, unknown>;
      metricQuality: Record<string, unknown>;
    }[]
  >;

  getFrequencyPolicy(channel: string): Promise<{
    channel: string;
    maxPerDay: number;
    maxPerWeek: number;
  } | null>;
  getFrequencyCounters(
    leadId: string,
    channel: string,
    dayStart: string,
    weekStart: string,
  ): Promise<{ dayCount: number; weekCount: number }>;
  incrementFrequencyCounter(
    leadId: string,
    channel: string,
    windowType: 'DAY' | 'WEEK',
    windowStart: string,
  ): Promise<void>;

  scheduleJourneyWait(input: {
    executionId: string;
    stepKey: string;
    resumeAt: Date;
  }): Promise<{ id: string }>;
  listDueJourneyWaits(now: Date, limit?: number): Promise<
    {
      id: string;
      executionId: string;
      stepKey: string;
      resumeAt: Date;
    }[]
  >;
  markJourneyWaitResumed(id: string): Promise<void>;
  getJourneyExecution(id: string): Promise<MarketingJourneyExecution | null>;

  assignLead(leadId: string, assignedTo: string): Promise<MarketingLead>;
  mergeLeadDuplicate(input: {
    keepLeadId: string;
    duplicateLeadId: string;
  }): Promise<MarketingLead>;
}

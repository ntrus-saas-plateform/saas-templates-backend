export const SALES_COMMERCE_REPOSITORY_PORT = Symbol('SALES_COMMERCE_REPOSITORY_PORT');

export type SalesActivity = {
  readonly id: string;
  readonly activityType: string;
  readonly subject: string;
  readonly description: string | null;
  readonly status: string;
  readonly accountId: string | null;
  readonly contactId: string | null;
  readonly salesLeadId: string | null;
  readonly opportunityId: string | null;
  readonly ownerAdministratorId: string | null;
  readonly scheduledStartAt: Date | null;
  readonly scheduledEndAt: Date | null;
  readonly completedAt: Date | null;
  readonly outcomeSummary: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
};

export type NeedsAssessment = {
  readonly id: string;
  readonly opportunityId: string;
  readonly accountId: string;
  readonly status: string;
  readonly templateCode: string | null;
  readonly fitDecision: string | null;
  readonly uncoveredNeeds: unknown[];
  readonly gapAnalysis: unknown[];
  readonly functionalRequirements: unknown[];
  readonly technicalRequirements: unknown[];
  readonly recommendations: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type OfferConfiguration = {
  readonly id: string;
  readonly opportunityId: string;
  readonly accountId: string;
  readonly version: number;
  readonly status: string;
  readonly productId: string;
  readonly planId: string | null;
  readonly solutionPackageId: string | null;
  readonly addonIds: unknown[];
  readonly currency: string;
  readonly listAmount: string | null;
  readonly netAmount: string | null;
  readonly eligibilityDecision: string | null;
  readonly p2Snapshot: Record<string, unknown>;
  readonly configuratorResult: Record<string, unknown>;
  readonly createdAt: Date;
};

export type SalesQuote = {
  readonly id: string;
  readonly quoteNumber: string;
  readonly accountId: string;
  readonly opportunityId: string;
  readonly contactId: string | null;
  readonly offerConfigurationId: string | null;
  readonly status: string;
  readonly currentVersion: number;
  readonly currency: string;
  readonly subtotalAmount: string;
  readonly discountAmount: string;
  readonly taxAmount: string;
  readonly totalAmount: string;
  readonly validUntil: string | null;
  readonly commercialTerms: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type SalesProposal = {
  readonly id: string;
  readonly proposalNumber: string;
  readonly accountId: string;
  readonly opportunityId: string;
  readonly quoteId: string | null;
  readonly status: string;
  readonly currentVersion: number;
  readonly language: string;
  readonly title: string;
  readonly sections: unknown[];
  readonly createdAt: Date;
};

export type DiscountPolicy = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly discountType: string;
  readonly approvalMatrix: unknown[];
  readonly status: string;
};

export type DiscountRequest = {
  readonly id: string;
  readonly opportunityId: string;
  readonly quoteId: string | null;
  readonly accountId: string;
  readonly policyId: string | null;
  readonly discountType: string;
  readonly status: string;
  readonly listAmount: string;
  readonly requestedAmount: string;
  readonly discountPercent: string | null;
  readonly currency: string;
  readonly justification: string;
  readonly requiredApprovalLevel: string;
  readonly requestedBy: string;
  readonly decidedBy: string | null;
  readonly createdAt: Date;
};

export type SalesApproval = {
  readonly id: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly approvalType: string;
  readonly status: string;
  readonly requiredLevel: string;
  readonly requesterId: string;
  readonly assigneeId: string | null;
  readonly decisionBy: string | null;
  readonly cannotSelfApprove: boolean;
  readonly createdAt: Date;
};

export type SalesContract = {
  readonly id: string;
  readonly contractNumber: string;
  readonly accountId: string;
  readonly opportunityId: string | null;
  readonly quoteId: string | null;
  readonly contractType: string;
  readonly status: string;
  readonly currentVersion: number;
  readonly productId: string | null;
  readonly currency: string;
  readonly contractValue: string | null;
  readonly commercialTermsSnapshot: Record<string, unknown>;
  readonly signatureProvider: string | null;
  readonly signatureConfirmedAt: Date | null;
  readonly executedAt: Date | null;
  readonly createdAt: Date;
};

export type SalesOrder = {
  readonly id: string;
  readonly orderNumber: string;
  readonly accountId: string;
  readonly contractId: string | null;
  readonly opportunityId: string | null;
  readonly quoteId: string | null;
  readonly status: string;
  readonly productId: string | null;
  readonly currency: string;
  readonly totalAmount: string;
  readonly commercialTerms: Record<string, unknown>;
  readonly offerConfiguration: Record<string, unknown>;
  readonly createdAt: Date;
};

export type SalesHandoff = {
  readonly id: string;
  readonly salesOrderId: string;
  readonly accountId: string;
  readonly opportunityId: string | null;
  readonly contractId: string | null;
  readonly status: string;
  readonly correlationId: string;
  readonly packagePayload: Record<string, unknown>;
  readonly provisioningConfirmedAt: Date | null;
  readonly createdAt: Date;
};

export interface SalesCommerceRepositoryPort {
  createActivity(input: {
    activityType: string;
    subject: string;
    description?: string | null;
    accountId?: string | null;
    contactId?: string | null;
    salesLeadId?: string | null;
    opportunityId?: string | null;
    ownerAdministratorId?: string | null;
    scheduledStartAt?: string | null;
    scheduledEndAt?: string | null;
    createdBy?: string | null;
  }): Promise<SalesActivity>;
  listActivities(opts?: {
    accountId?: string;
    opportunityId?: string;
    status?: string;
    limit?: number;
  }): Promise<SalesActivity[]>;
  completeActivity(id: string, outcomeSummary?: string | null): Promise<SalesActivity>;

  createNeedsAssessment(input: {
    opportunityId: string;
    accountId: string;
    templateCode?: string | null;
    verticalId?: string | null;
    currentSituation?: string | null;
    objectives?: string | null;
    functionalRequirements?: unknown[];
    technicalRequirements?: unknown[];
    createdBy?: string | null;
  }): Promise<NeedsAssessment>;
  getNeedsAssessment(id: string): Promise<NeedsAssessment | null>;
  listNeedsAssessments(opportunityId: string): Promise<NeedsAssessment[]>;
  completeNeedsAssessment(input: {
    id: string;
    fitDecision: string;
    uncoveredNeeds: unknown[];
    gapAnalysis?: unknown[];
    recommendations?: string | null;
  }): Promise<NeedsAssessment>;

  createOfferConfiguration(input: {
    opportunityId: string;
    accountId: string;
    version: number;
    productId: string;
    planId?: string | null;
    solutionPackageId?: string | null;
    addonIds?: unknown[];
    currency?: string;
    listAmount?: number | null;
    netAmount?: number | null;
    eligibilityDecision?: string | null;
    p2Snapshot?: Record<string, unknown>;
    configuratorResult?: Record<string, unknown>;
    commercialTerms?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<OfferConfiguration>;
  listOfferConfigurations(opportunityId: string): Promise<OfferConfiguration[]>;
  getOfferConfiguration(id: string): Promise<OfferConfiguration | null>;

  nextQuoteNumber(): Promise<string>;
  createQuote(input: {
    quoteNumber: string;
    accountId: string;
    opportunityId: string;
    contactId?: string | null;
    offerConfigurationId?: string | null;
    currency?: string;
    subtotalAmount?: number;
    discountAmount?: number;
    taxAmount?: number;
    totalAmount?: number;
    validUntil?: string | null;
    commercialTerms?: Record<string, unknown>;
    lines?: Array<{
      lineNumber: number;
      lineType?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discountPercent?: number;
      discountAmount?: number;
      lineTotal: number;
      productId?: string | null;
      planId?: string | null;
      packageId?: string | null;
      addonId?: string | null;
      pricingModel?: string | null;
      p2Refs?: Record<string, unknown>;
    }>;
    ownerAdministratorId?: string | null;
    createdBy?: string | null;
  }): Promise<SalesQuote>;
  getQuote(id: string): Promise<SalesQuote | null>;
  listQuotes(opts?: {
    opportunityId?: string;
    accountId?: string;
    status?: string;
    limit?: number;
  }): Promise<SalesQuote[]>;
  transitionQuoteStatus(id: string, status: string): Promise<SalesQuote>;
  reviseQuote(input: {
    quoteId: string;
    changeReason: string;
    subtotalAmount: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
    commercialTerms?: Record<string, unknown>;
    lines: Array<{
      lineNumber: number;
      lineType?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discountPercent?: number;
      discountAmount?: number;
      lineTotal: number;
      productId?: string | null;
      planId?: string | null;
      packageId?: string | null;
      addonId?: string | null;
      pricingModel?: string | null;
      p2Refs?: Record<string, unknown>;
    }>;
    createdBy?: string | null;
  }): Promise<SalesQuote>;
  hasAcceptedQuoteForOpportunity(opportunityId: string): Promise<boolean>;

  nextProposalNumber(): Promise<string>;
  createProposal(input: {
    proposalNumber: string;
    accountId: string;
    opportunityId: string;
    quoteId?: string | null;
    title: string;
    language?: string;
    templateCode?: string | null;
    sections?: unknown[];
    createdBy?: string | null;
  }): Promise<SalesProposal>;
  listProposals(opportunityId?: string): Promise<SalesProposal[]>;
  getProposal(id: string): Promise<SalesProposal | null>;
  issueProposal(id: string): Promise<SalesProposal>;

  getActiveDiscountPolicy(code?: string): Promise<DiscountPolicy | null>;
  createDiscountRequest(input: {
    opportunityId: string;
    accountId: string;
    quoteId?: string | null;
    policyId?: string | null;
    discountType: string;
    listAmount: number;
    requestedAmount: number;
    discountPercent: number;
    discountAmount: number;
    currency?: string;
    justification: string;
    requiredApprovalLevel: string;
    status: string;
    requestedBy: string;
  }): Promise<DiscountRequest>;
  getDiscountRequest(id: string): Promise<DiscountRequest | null>;
  listDiscountRequests(opts?: {
    status?: string;
    opportunityId?: string;
  }): Promise<DiscountRequest[]>;
  decideDiscountRequest(input: {
    id: string;
    status: string;
    decidedBy: string;
    decisionNotes?: string | null;
  }): Promise<DiscountRequest>;

  createApproval(input: {
    subjectType: string;
    subjectId: string;
    approvalType?: string;
    requiredLevel: string;
    requesterId: string;
    assigneeId?: string | null;
    cannotSelfApprove?: boolean;
    correlationId?: string | null;
  }): Promise<SalesApproval>;
  listApprovals(opts?: {
    status?: string;
    subjectType?: string;
    subjectId?: string;
  }): Promise<SalesApproval[]>;
  decideApproval(input: {
    id: string;
    status: string;
    decisionBy: string;
    decisionNotes?: string | null;
  }): Promise<SalesApproval>;
  hasApprovedSubject(subjectType: string, subjectId: string): Promise<boolean>;

  nextContractNumber(): Promise<string>;
  createContract(input: {
    contractNumber: string;
    accountId: string;
    opportunityId?: string | null;
    quoteId?: string | null;
    contractType?: string;
    productId?: string | null;
    currency?: string;
    contractValue?: number | null;
    commercialTermsSnapshot?: Record<string, unknown>;
    parties?: unknown[];
    signers?: unknown[];
    createdBy?: string | null;
  }): Promise<SalesContract>;
  getContract(id: string): Promise<SalesContract | null>;
  listContracts(opts?: {
    accountId?: string;
    opportunityId?: string;
    status?: string;
  }): Promise<SalesContract[]>;
  transitionContractStatus(input: {
    id: string;
    status: string;
    signatureProvider?: string | null;
    signatureExternalId?: string | null;
    signatureConfirmedAt?: Date | null;
    executedAt?: Date | null;
  }): Promise<SalesContract>;
  appendSignatureEvent(input: {
    contractId: string;
    eventType: string;
    provider?: string | null;
    providerEventId?: string | null;
    signerEmail?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<void>;
  hasExecutedContractForOpportunity(opportunityId: string): Promise<boolean>;

  nextOrderNumber(): Promise<string>;
  createOrder(input: {
    orderNumber: string;
    accountId: string;
    contractId?: string | null;
    opportunityId?: string | null;
    quoteId?: string | null;
    productId?: string | null;
    verticalId?: string | null;
    currency?: string;
    totalAmount?: number;
    commercialTerms?: Record<string, unknown>;
    offerConfiguration?: Record<string, unknown>;
    requestedGoLiveDate?: string | null;
    ownerAdministratorId?: string | null;
    createdBy?: string | null;
  }): Promise<SalesOrder>;
  getOrder(id: string): Promise<SalesOrder | null>;
  listOrders(opts?: { accountId?: string; status?: string }): Promise<SalesOrder[]>;
  transitionOrderStatus(id: string, status: string): Promise<SalesOrder>;

  createHandoff(input: {
    salesOrderId: string;
    accountId: string;
    opportunityId?: string | null;
    contractId?: string | null;
    correlationId: string;
    packagePayload: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<SalesHandoff>;
  getHandoff(id: string): Promise<SalesHandoff | null>;
  getHandoffByCorrelation(correlationId: string): Promise<SalesHandoff | null>;
  getHandoffByOrder(salesOrderId: string): Promise<SalesHandoff | null>;
  listHandoffs(opts?: { status?: string }): Promise<SalesHandoff[]>;
  updateHandoffStatus(input: {
    id: string;
    status: string;
    lastError?: string | null;
    acceptedAt?: Date | null;
    provisioningConfirmedAt?: Date | null;
    provisioningRefs?: unknown[];
  }): Promise<SalesHandoff>;
  recordHandoffAttempt(input: {
    handoffId: string;
    attemptNo: number;
    idempotencyKey: string;
    requestPayload?: Record<string, unknown>;
    responsePayload?: Record<string, unknown>;
    success: boolean;
    errorText?: string | null;
  }): Promise<void>;
  addProvisioningReference(input: {
    handoffId: string;
    accountId: string;
    externalSystem: string;
    externalRef: string;
    refType?: string;
    productId?: string | null;
    confirmed?: boolean;
  }): Promise<void>;

  computeForecast(input: {
    model: 'PIPELINE' | 'WEIGHTED' | 'BEST_CASE' | 'COMMIT' | 'MOST_LIKELY';
    ownerAdministratorId?: string | null;
    teamId?: string | null;
    productId?: string | null;
  }): Promise<{
    currency: string;
    amount: number;
    opportunityCount: number;
    assumptions: Record<string, unknown>;
  }>;
  salesPerformanceSummary(): Promise<{
    openOpportunities: number;
    wonOpportunities: number;
    lostOpportunities: number;
    pipelineValue: number;
    weightedPipelineValue: number;
    acceptedQuotes: number;
    executedContracts: number;
    handoffsPending: number;
    handoffsConfirmed: number;
  }>;
}

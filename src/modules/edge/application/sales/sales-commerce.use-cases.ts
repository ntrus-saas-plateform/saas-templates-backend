import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import {
  ApprovalLevel,
  assertActivityHasCommercialContext,
  assertApprovalCannotBeBypassed,
  assertApprovalNotSelfServed,
  assertContractExecutable,
  assertContractStatusTransition,
  assertForecastIsNotRecognizedRevenue,
  assertHandoffPackageComplete,
  assertProvisioningNotFaked,
  assertQuoteMutable,
  assertQuoteStatusTransition,
  assertSalesOrderStatusTransition,
  assertUncoveredNeedsExplicit,
  computeDiscountPercent,
  ContractStatus,
  DiscountRequestStatus,
  HandoffStatus,
  QuoteStatus,
  resolveRequiredDiscountApprovalLevel,
  SalesOrderStatus,
  type DiscountApprovalMatrixEntry,
} from '../../domain/sales/sales-commerce.entity.js';
import {
  createContractCreatedEvent,
  createContractExecutedEvent,
  createDiscountApprovedEvent,
  createDiscountRejectedEvent,
  createDiscountRequestedEvent,
  createNeedsAssessmentCompletedEvent,
  createOfferConfigurationCreatedEvent,
  createProposalIssuedEvent,
  createProvisioningStatusReceivedEvent,
  createQuoteAcceptedEvent,
  createQuoteApprovedEvent,
  createQuoteCreatedEvent,
  createQuoteIssuedEvent,
  createQuoteRejectedEvent,
  createContractApprovedEvent,
  createContractSentForSignatureEvent,
  createSalesOrderApprovedEvent,
  createSalesHandoffAcceptedEvent,
  createSalesHandoffRequestedEvent,
  createSalesOrderCreatedEvent,
  EDGE_SALES_OUTBOX_TENANT,
} from '../../domain/sales/sales.events.js';
import type { SalesRepositoryPort } from '../../domain/ports/sales-repository.port.js';
import type { SalesCommerceRepositoryPort } from '../../domain/ports/sales-commerce-repository.port.js';
import {
  configureCommercialOffer,
  OfferConfiguratorMode,
} from '../../domain/commercial/offer-configurator.js';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import type { SalesSignatureAdapterPort } from '../../domain/sales/signature-adapter.port.js';

async function enqueueSales(
  outbox: ControlPlaneOutboxTransactionService | undefined,
  event: IntegrationEvent<unknown>,
) {
  if (!outbox) return;
  await outbox.runWithOutbox(EDGE_SALES_OUTBOX_TENANT, async (_c, enqueue) => {
    await enqueue(event);
  });
}

export class CreateSalesActivityUseCase {
  constructor(private readonly commerce: SalesCommerceRepositoryPort) {}
  execute(input: {
    actorId: string;
    activityType: string;
    subject: string;
    description?: string | null;
    accountId?: string | null;
    contactId?: string | null;
    salesLeadId?: string | null;
    opportunityId?: string | null;
    scheduledStartAt?: string | null;
    scheduledEndAt?: string | null;
  }) {
    assertActivityHasCommercialContext(input);
    return this.commerce.createActivity({
      ...input,
      ownerAdministratorId: input.actorId,
      createdBy: input.actorId,
    });
  }
}

export class ListSalesActivitiesUseCase {
  constructor(private readonly commerce: SalesCommerceRepositoryPort) {}
  execute(opts?: {
    accountId?: string;
    opportunityId?: string;
    status?: string;
    limit?: number;
  }) {
    return this.commerce.listActivities(opts);
  }
}

export class CompleteSalesActivityUseCase {
  constructor(private readonly commerce: SalesCommerceRepositoryPort) {}
  execute(id: string, outcomeSummary?: string | null) {
    return this.commerce.completeActivity(id, outcomeSummary);
  }
}

export class CreateNeedsAssessmentUseCase {
  constructor(
    private readonly commerce: SalesCommerceRepositoryPort,
    private readonly sales: SalesRepositoryPort,
  ) {}
  async execute(input: {
    actorId: string;
    opportunityId: string;
    templateCode?: string | null;
    currentSituation?: string | null;
    objectives?: string | null;
    functionalRequirements?: unknown[];
    technicalRequirements?: unknown[];
  }) {
    const opp = await this.sales.getOpportunity(input.opportunityId);
    if (!opp) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Opportunity not found');
    return this.commerce.createNeedsAssessment({
      opportunityId: opp.id,
      accountId: opp.accountId,
      templateCode: input.templateCode,
      verticalId: opp.verticalId,
      currentSituation: input.currentSituation,
      objectives: input.objectives,
      functionalRequirements: input.functionalRequirements,
      technicalRequirements: input.technicalRequirements,
      createdBy: input.actorId,
    });
  }
}

export class CompleteNeedsAssessmentUseCase {
  constructor(
    private readonly commerce: SalesCommerceRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}
  async execute(input: {
    actorId: string;
    assessmentId: string;
    fitDecision: string;
    uncoveredNeeds?: unknown[];
    gapAnalysis?: unknown[];
    recommendations?: string | null;
    promisedCapabilities?: string[];
    commerciallyAuthorizedCapabilities?: string[];
  }) {
    assertUncoveredNeedsExplicit({
      fitDecision: input.fitDecision,
      uncoveredNeeds: input.uncoveredNeeds ?? [],
    });
    if (input.promisedCapabilities?.length) {
      const { assertNoUnauthorizedCapabilityPromise } = await import(
        '../../domain/sales/sales-commerce.entity.js'
      );
      assertNoUnauthorizedCapabilityPromise({
        promisedCapabilities: input.promisedCapabilities,
        commerciallyAuthorizedCapabilities: input.commerciallyAuthorizedCapabilities ?? [],
      });
    }
    const assessment = await this.commerce.completeNeedsAssessment({
      id: input.assessmentId,
      fitDecision: input.fitDecision,
      uncoveredNeeds: input.uncoveredNeeds ?? [],
      gapAnalysis: input.gapAnalysis,
      recommendations: input.recommendations,
    });
    const correlationId = randomUUID();
    await enqueueSales(
      this.outbox,
      createNeedsAssessmentCompletedEvent({
        actorId: input.actorId,
        correlationId,
        assessmentId: assessment.id,
        opportunityId: assessment.opportunityId,
        fitDecision: assessment.fitDecision,
      }),
    );
    return assessment;
  }
}

export class ListNeedsAssessmentsUseCase {
  constructor(private readonly commerce: SalesCommerceRepositoryPort) {}
  execute(opportunityId: string) {
    return this.commerce.listNeedsAssessments(opportunityId);
  }
}

export class CreateOpportunityOfferConfigurationUseCase {
  constructor(
    private readonly commerce: SalesCommerceRepositoryPort,
    private readonly sales: SalesRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}
  async execute(input: {
    actorId: string;
    opportunityId: string;
    productId: string;
    productLifecycleStatus: string;
    planId: string;
    planProductId: string;
    planStatus: string;
    packageId?: string | null;
    packageProductId?: string | null;
    addonIds?: string[];
    addonProductIds?: string[];
    currency?: string;
    listAmount?: number | null;
    netAmount?: number | null;
    geographicScope?: string | null;
    deploymentMode?: string | null;
    rulesVersion?: number;
  }) {
    const opp = await this.sales.getOpportunity(input.opportunityId);
    if (!opp) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Opportunity not found');
    const configuratorResult = configureCommercialOffer({
      mode: OfferConfiguratorMode.GUIDED_CONFIGURATION,
      productId: input.productId,
      productLifecycleStatus: input.productLifecycleStatus,
      planId: input.planId,
      planProductId: input.planProductId,
      planStatus: input.planStatus,
      packageId: input.packageId,
      packageProductId: input.packageProductId,
      addonIds: input.addonIds,
      addonProductIds: input.addonProductIds,
      capabilityRefs: [],
      inclusions: [],
      geographicScope: input.geographicScope,
      deploymentMode: input.deploymentMode,
      rulesVersion: input.rulesVersion ?? 1,
    });
    if (configuratorResult.decision === 'INELIGIBLE') {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Offer configuration ineligible: ${configuratorResult.unsatisfied.join(', ')}`,
      );
    }
    const existing = await this.commerce.listOfferConfigurations(opp.id);
    const version = (existing[0]?.version ?? 0) + 1;
    const cfg = await this.commerce.createOfferConfiguration({
      opportunityId: opp.id,
      accountId: opp.accountId,
      version,
      productId: input.productId,
      planId: input.planId,
      solutionPackageId: input.packageId,
      addonIds: input.addonIds ?? [],
      currency: input.currency,
      listAmount: input.listAmount,
      netAmount: input.netAmount,
      eligibilityDecision: configuratorResult.decision,
      p2Snapshot: {
        productId: input.productId,
        planId: input.planId,
        packageId: input.packageId ?? null,
        addonIds: input.addonIds ?? [],
        rulesVersion: input.rulesVersion ?? 1,
        capturedAt: new Date().toISOString(),
      },
      configuratorResult: configuratorResult as unknown as Record<string, unknown>,
      createdBy: input.actorId,
    });
    await enqueueSales(
      this.outbox,
      createOfferConfigurationCreatedEvent({
        actorId: input.actorId,
        correlationId: randomUUID(),
        configurationId: cfg.id,
        opportunityId: cfg.opportunityId,
        productId: cfg.productId,
      }),
    );
    return cfg;
  }
}

export class ListOfferConfigurationsUseCase {
  constructor(private readonly commerce: SalesCommerceRepositoryPort) {}
  execute(opportunityId: string) {
    return this.commerce.listOfferConfigurations(opportunityId);
  }
}

export class CreateSalesQuoteUseCase {
  constructor(
    private readonly commerce: SalesCommerceRepositoryPort,
    private readonly sales: SalesRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}
  async execute(input: {
    actorId: string;
    opportunityId: string;
    contactId?: string | null;
    offerConfigurationId?: string | null;
    currency?: string;
    validUntil?: string | null;
    lines: Array<{
      lineNumber: number;
      lineType?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discountPercent?: number;
      productId?: string | null;
      planId?: string | null;
      packageId?: string | null;
      addonId?: string | null;
      pricingModel?: string | null;
      p2Refs?: Record<string, unknown>;
    }>;
  }) {
    const opp = await this.sales.getOpportunity(input.opportunityId);
    if (!opp) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Opportunity not found');
    if (input.offerConfigurationId) {
      const cfg = await this.commerce.getOfferConfiguration(input.offerConfigurationId);
      if (!cfg || cfg.opportunityId !== opp.id) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Offer configuration mismatch');
      }
    }
    const lines = input.lines.map((l) => {
      const discountPercent = l.discountPercent ?? 0;
      const gross = l.quantity * l.unitPrice;
      const discountAmount = Math.round(gross * (discountPercent / 100) * 100) / 100;
      return {
        ...l,
        discountPercent,
        discountAmount,
        lineTotal: Math.round((gross - discountAmount) * 100) / 100,
      };
    });
    const subtotalAmount = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const discountAmount = lines.reduce((s, l) => s + l.discountAmount, 0);
    const totalAmount = Math.round((subtotalAmount - discountAmount) * 100) / 100;
    const quoteNumber = await this.commerce.nextQuoteNumber();
    const quote = await this.commerce.createQuote({
      quoteNumber,
      accountId: opp.accountId,
      opportunityId: opp.id,
      contactId: input.contactId,
      offerConfigurationId: input.offerConfigurationId,
      currency: input.currency ?? opp.currency,
      subtotalAmount,
      discountAmount,
      taxAmount: 0,
      totalAmount,
      validUntil: input.validUntil,
      lines,
      ownerAdministratorId: input.actorId,
      createdBy: input.actorId,
    });
    await enqueueSales(
      this.outbox,
      createQuoteCreatedEvent({
        actorId: input.actorId,
        correlationId: randomUUID(),
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        opportunityId: quote.opportunityId,
      }),
    );
    return quote;
  }
}

export class ListSalesQuotesUseCase {
  constructor(private readonly commerce: SalesCommerceRepositoryPort) {}
  execute(opts?: { opportunityId?: string; accountId?: string; status?: string }) {
    return this.commerce.listQuotes(opts);
  }
}

export class GetSalesQuoteUseCase {
  constructor(private readonly commerce: SalesCommerceRepositoryPort) {}
  async execute(id: string) {
    const quote = await this.commerce.getQuote(id);
    if (!quote) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Quote not found');
    return quote;
  }
}

export class TransitionSalesQuoteUseCase {
  constructor(
    private readonly commerce: SalesCommerceRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}
  async execute(input: {
    actorId: string;
    quoteId: string;
    toStatus: string;
    approvalRequired?: boolean;
  }) {
    const quote = await this.commerce.getQuote(input.quoteId);
    if (!quote) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Quote not found');
    assertQuoteStatusTransition(quote.status, input.toStatus);
    if (input.toStatus === QuoteStatus.APPROVED || input.toStatus === QuoteStatus.ISSUED) {
      if (input.approvalRequired) {
        const approved = await this.commerce.hasApprovedSubject('QUOTE', quote.id);
        assertApprovalCannotBeBypassed({ required: true, approved });
      }
    }
    const updated = await this.commerce.transitionQuoteStatus(quote.id, input.toStatus);
    const correlationId = randomUUID();
    if (input.toStatus === QuoteStatus.APPROVED) {
      await enqueueSales(
        this.outbox,
        createQuoteApprovedEvent({
          actorId: input.actorId,
          correlationId,
          quoteId: updated.id,
        }),
      );
    }
    if (input.toStatus === QuoteStatus.ISSUED) {
      await enqueueSales(
        this.outbox,
        createQuoteIssuedEvent({
          actorId: input.actorId,
          correlationId,
          quoteId: updated.id,
          version: updated.currentVersion,
        }),
      );
    }
    if (input.toStatus === QuoteStatus.ACCEPTED) {
      await enqueueSales(
        this.outbox,
        createQuoteAcceptedEvent({
          actorId: input.actorId,
          correlationId,
          quoteId: updated.id,
        }),
      );
    }
    if (input.toStatus === QuoteStatus.REJECTED) {
      await enqueueSales(
        this.outbox,
        createQuoteRejectedEvent({
          actorId: input.actorId,
          correlationId,
          quoteId: updated.id,
        }),
      );
    }
    return updated;
  }
}

export class ReviseSalesQuoteUseCase {
  constructor(private readonly commerce: SalesCommerceRepositoryPort) {}
  async execute(input: {
    actorId: string;
    quoteId: string;
    changeReason: string;
    lines: Array<{
      lineNumber: number;
      lineType?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discountPercent?: number;
      productId?: string | null;
      planId?: string | null;
      packageId?: string | null;
      addonId?: string | null;
      pricingModel?: string | null;
      p2Refs?: Record<string, unknown>;
    }>;
  }) {
    const quote = await this.commerce.getQuote(input.quoteId);
    if (!quote) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Quote not found');
    // Issued quotes: revise creates new version (allowed path). Direct mutation blocked.
    if (
      quote.status !== QuoteStatus.ISSUED &&
      quote.status !== QuoteStatus.VIEWED &&
      quote.status !== QuoteStatus.DRAFT &&
      quote.status !== QuoteStatus.IN_REVIEW &&
      quote.status !== QuoteStatus.APPROVED
    ) {
      assertQuoteMutable(quote.status);
    }
    if (!input.changeReason.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Quote revision requires a change reason');
    }
    const lines = input.lines.map((l) => {
      const discountPercent = l.discountPercent ?? 0;
      const gross = l.quantity * l.unitPrice;
      const discountAmount = Math.round(gross * (discountPercent / 100) * 100) / 100;
      return {
        ...l,
        discountPercent,
        discountAmount,
        lineTotal: Math.round((gross - discountAmount) * 100) / 100,
      };
    });
    const subtotalAmount = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const discountAmount = lines.reduce((s, l) => s + l.discountAmount, 0);
    const totalAmount = Math.round((subtotalAmount - discountAmount) * 100) / 100;
    return this.commerce.reviseQuote({
      quoteId: quote.id,
      changeReason: input.changeReason,
      subtotalAmount,
      discountAmount,
      taxAmount: 0,
      totalAmount,
      lines,
      createdBy: input.actorId,
    });
  }
}

export class CreateSalesProposalUseCase {
  constructor(
    private readonly commerce: SalesCommerceRepositoryPort,
    private readonly sales: SalesRepositoryPort,
  ) {}
  async execute(input: {
    actorId: string;
    opportunityId: string;
    quoteId?: string | null;
    title: string;
    language?: string;
    templateCode?: string | null;
    sections?: unknown[];
  }) {
    const opp = await this.sales.getOpportunity(input.opportunityId);
    if (!opp) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Opportunity not found');
    const proposalNumber = await this.commerce.nextProposalNumber();
    return this.commerce.createProposal({
      proposalNumber,
      accountId: opp.accountId,
      opportunityId: opp.id,
      quoteId: input.quoteId,
      title: input.title,
      language: input.language,
      templateCode: input.templateCode,
      sections: input.sections ?? [
        { code: 'NEED', title: 'Compréhension du besoin' },
        { code: 'SOLUTION', title: 'Solution proposée' },
        { code: 'COMMERCIAL', title: 'Conditions commerciales' },
        { code: 'NEXT', title: 'Prochaines étapes' },
      ],
      createdBy: input.actorId,
    });
  }
}

export class ListSalesProposalsUseCase {
  constructor(private readonly commerce: SalesCommerceRepositoryPort) {}
  execute(opportunityId?: string) {
    return this.commerce.listProposals(opportunityId);
  }
}

export class IssueSalesProposalUseCase {
  constructor(
    private readonly commerce: SalesCommerceRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}
  async execute(input: { actorId: string; proposalId: string }) {
    const proposal = await this.commerce.getProposal(input.proposalId);
    if (!proposal) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Proposal not found');
    const issued = await this.commerce.issueProposal(proposal.id);
    await enqueueSales(
      this.outbox,
      createProposalIssuedEvent({
        actorId: input.actorId,
        correlationId: randomUUID(),
        proposalId: issued.id,
      }),
    );
    return issued;
  }
}

export class RequestSalesDiscountUseCase {
  constructor(
    private readonly commerce: SalesCommerceRepositoryPort,
    private readonly sales: SalesRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}
  async execute(input: {
    actorId: string;
    opportunityId: string;
    quoteId?: string | null;
    listAmount: number;
    requestedAmount: number;
    justification: string;
    discountType?: string;
    policyCode?: string;
  }) {
    const opp = await this.sales.getOpportunity(input.opportunityId);
    if (!opp) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Opportunity not found');
    if (!input.justification.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Discount justification is required');
    }
    const policy = await this.commerce.getActiveDiscountPolicy(input.policyCode);
    if (!policy) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Active discount policy not found');
    }
    const discountPercent = computeDiscountPercent(input.listAmount, input.requestedAmount);
    const discountAmount = Math.round((input.listAmount - input.requestedAmount) * 100) / 100;
    const matrix = (policy.approvalMatrix as DiscountApprovalMatrixEntry[]) ?? [];
    const requiredLevel = resolveRequiredDiscountApprovalLevel({
      discountPercent,
      matrix,
    });
    const status =
      requiredLevel === ApprovalLevel.STANDARD
        ? DiscountRequestStatus.APPROVED
        : requiredLevel === ApprovalLevel.MANAGER
          ? DiscountRequestStatus.PENDING_MANAGER
          : DiscountRequestStatus.PENDING_EXECUTIVE;
    const request = await this.commerce.createDiscountRequest({
      opportunityId: opp.id,
      accountId: opp.accountId,
      quoteId: input.quoteId,
      policyId: policy.id,
      discountType: input.discountType ?? policy.discountType,
      listAmount: input.listAmount,
      requestedAmount: input.requestedAmount,
      discountPercent,
      discountAmount,
      currency: opp.currency,
      justification: input.justification,
      requiredApprovalLevel: requiredLevel,
      status,
      requestedBy: input.actorId,
    });
    if (requiredLevel !== ApprovalLevel.STANDARD) {
      await this.commerce.createApproval({
        subjectType: 'DISCOUNT_REQUEST',
        subjectId: request.id,
        requiredLevel,
        requesterId: input.actorId,
        cannotSelfApprove: true,
      });
    }
    await enqueueSales(
      this.outbox,
      createDiscountRequestedEvent({
        actorId: input.actorId,
        correlationId: randomUUID(),
        requestId: request.id,
        requiredLevel,
      }),
    );
    return request;
  }
}

export class DecideSalesDiscountUseCase {
  constructor(
    private readonly commerce: SalesCommerceRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}
  async execute(input: {
    actorId: string;
    requestId: string;
    decision: 'APPROVED' | 'REJECTED';
    decisionNotes?: string | null;
  }) {
    const request = await this.commerce.getDiscountRequest(input.requestId);
    if (!request) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Discount request not found');
    assertApprovalNotSelfServed({
      requesterId: request.requestedBy,
      decisionBy: input.actorId,
      cannotSelfApprove: true,
    });
    const updated = await this.commerce.decideDiscountRequest({
      id: request.id,
      status: input.decision,
      decidedBy: input.actorId,
      decisionNotes: input.decisionNotes,
    });
    const approvals = await this.commerce.listApprovals({
      subjectType: 'DISCOUNT_REQUEST',
      subjectId: request.id,
      status: 'PENDING',
    });
    for (const approval of approvals) {
      await this.commerce.decideApproval({
        id: approval.id,
        status: input.decision,
        decisionBy: input.actorId,
        decisionNotes: input.decisionNotes,
      });
    }
    await enqueueSales(
      this.outbox,
      input.decision === 'APPROVED'
        ? createDiscountApprovedEvent({
            actorId: input.actorId,
            correlationId: randomUUID(),
            requestId: updated.id,
          })
        : createDiscountRejectedEvent({
            actorId: input.actorId,
            correlationId: randomUUID(),
            requestId: updated.id,
          }),
    );
    return updated;
  }
}

export class ListSalesDiscountRequestsUseCase {
  constructor(private readonly commerce: SalesCommerceRepositoryPort) {}
  execute(opts?: { status?: string; opportunityId?: string }) {
    return this.commerce.listDiscountRequests(opts);
  }
}

export class ListSalesApprovalsUseCase {
  constructor(private readonly commerce: SalesCommerceRepositoryPort) {}
  execute(opts?: { status?: string; subjectType?: string }) {
    return this.commerce.listApprovals(opts);
  }
}

export class DecideSalesApprovalUseCase {
  constructor(private readonly commerce: SalesCommerceRepositoryPort) {}
  async execute(input: {
    actorId: string;
    approvalId: string;
    decision: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
    decisionNotes?: string | null;
  }) {
    const approvals = await this.commerce.listApprovals({});
    const approval = approvals.find((a) => a.id === input.approvalId);
    if (!approval) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Approval not found');
    assertApprovalNotSelfServed({
      requesterId: approval.requesterId,
      decisionBy: input.actorId,
      cannotSelfApprove: approval.cannotSelfApprove,
    });
    return this.commerce.decideApproval({
      id: approval.id,
      status: input.decision,
      decisionBy: input.actorId,
      decisionNotes: input.decisionNotes,
    });
  }
}

export class CreateSalesContractUseCase {
  constructor(
    private readonly commerce: SalesCommerceRepositoryPort,
    private readonly sales: SalesRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}
  async execute(input: {
    actorId: string;
    opportunityId: string;
    quoteId?: string | null;
    contractType?: string;
    contractValue?: number | null;
    commercialTermsSnapshot?: Record<string, unknown>;
    parties?: unknown[];
    signers?: unknown[];
  }) {
    const opp = await this.sales.getOpportunity(input.opportunityId);
    if (!opp) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Opportunity not found');
    if (input.quoteId) {
      const quote = await this.commerce.getQuote(input.quoteId);
      if (!quote || quote.status !== QuoteStatus.ACCEPTED) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Contract from quote requires an accepted quote',
        );
      }
    }
    const contractNumber = await this.commerce.nextContractNumber();
    const contract = await this.commerce.createContract({
      contractNumber,
      accountId: opp.accountId,
      opportunityId: opp.id,
      quoteId: input.quoteId,
      contractType: input.contractType,
      productId: opp.productId,
      currency: opp.currency,
      contractValue: input.contractValue ?? Number(opp.estimatedValue ?? 0),
      commercialTermsSnapshot: input.commercialTermsSnapshot ?? {
        estimatedValue: opp.estimatedValue,
        currency: opp.currency,
      },
      parties: input.parties,
      signers: input.signers,
      createdBy: input.actorId,
    });
    await enqueueSales(
      this.outbox,
      createContractCreatedEvent({
        actorId: input.actorId,
        correlationId: randomUUID(),
        contractId: contract.id,
        contractNumber: contract.contractNumber,
      }),
    );
    return contract;
  }
}

export class ListSalesContractsUseCase {
  constructor(private readonly commerce: SalesCommerceRepositoryPort) {}
  execute(opts?: { accountId?: string; opportunityId?: string; status?: string }) {
    return this.commerce.listContracts(opts);
  }
}

export class TransitionSalesContractUseCase {
  constructor(
    private readonly commerce: SalesCommerceRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly signatures?: SalesSignatureAdapterPort,
  ) {}
  async execute(input: {
    actorId: string;
    contractId: string;
    toStatus: string;
    signatureProviderConfirmed?: boolean;
    signatureProvider?: string | null;
    signatureExternalId?: string | null;
    providerEventId?: string | null;
    signers?: { email: string; name?: string; role?: string }[];
  }) {
    const contract = await this.commerce.getContract(input.contractId);
    if (!contract) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Contract not found');
    assertContractStatusTransition(contract.status, input.toStatus);

    let signatureProvider = input.signatureProvider ?? contract.signatureProvider;
    let signatureExternalId = input.signatureExternalId;

    if (input.toStatus === ContractStatus.SENT_FOR_SIGNATURE) {
      if (this.signatures) {
        const requested = await this.signatures.requestSignature({
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          signers: input.signers ?? [],
          correlationId: randomUUID(),
        });
        if (requested.outcome === 'REQUESTED') {
          signatureProvider = requested.provider;
          signatureExternalId = requested.externalId;
          await this.commerce.appendSignatureEvent({
            contractId: contract.id,
            eventType: 'REQUESTED',
            provider: requested.provider,
            providerEventId: requested.externalId,
            payload: { requestedBy: input.actorId },
          });
        } else {
          // Honest fallback: offline/manual signature process — not a fake e-sign.
          signatureProvider = 'MANUAL_SIGNATURE_PROCESS';
          signatureExternalId = `manual:${contract.id}`;
          await this.commerce.appendSignatureEvent({
            contractId: contract.id,
            eventType: 'REQUESTED',
            provider: signatureProvider,
            providerEventId: signatureExternalId,
            payload: {
              requestedBy: input.actorId,
              note: requested.failureMessage,
              eSignConfigured: false,
            },
          });
        }
      } else {
        signatureProvider = 'MANUAL_SIGNATURE_PROCESS';
        signatureExternalId = `manual:${contract.id}`;
      }
    }

    if (input.toStatus === ContractStatus.EXECUTED) {
      let providerConfirmed = false;
      let confirmationPath: 'PROVIDER' | 'GOVERNED_MANUAL' | null = null;

      if (this.signatures && signatureProvider && signatureExternalId) {
        const confirmation = await this.signatures.confirmSignature({
          contractId: contract.id,
          provider: signatureProvider,
          externalId: signatureExternalId,
          providerEventId: input.providerEventId,
        });
        if (confirmation.outcome === 'CONFIRMED') {
          providerConfirmed = true;
          confirmationPath = 'PROVIDER';
        } else if (confirmation.outcome === 'NOT_CONFIRMED') {
          throw new DomainError(
            ErrorCode.VALIDATION_ERROR,
            confirmation.failureMessage,
          );
        }
        // UNAVAILABLE → fall through to governed manual path
      }

      if (!providerConfirmed) {
        const approved = await this.commerce.hasApprovedSubject(
          'CONTRACT',
          contract.id,
        );
        if (input.signatureProviderConfirmed && approved) {
          providerConfirmed = true;
          confirmationPath = 'GOVERNED_MANUAL';
          signatureProvider = signatureProvider ?? 'GOVERNED_MANUAL';
        }
      }

      assertContractExecutable({
        toStatus: input.toStatus,
        signatureProviderConfirmed: providerConfirmed,
      });
      await this.commerce.appendSignatureEvent({
        contractId: contract.id,
        eventType:
          confirmationPath === 'GOVERNED_MANUAL'
            ? 'COMPLETED'
            : 'PROVIDER_CONFIRMED',
        provider: signatureProvider,
        providerEventId: input.providerEventId ?? signatureExternalId,
        payload: {
          confirmedBy: input.actorId,
          confirmationPath,
          note:
            confirmationPath === 'GOVERNED_MANUAL'
              ? 'Executed via governed approval — not an e-sign provider claim'
              : 'Provider confirmed',
        },
      });
    }

    const updated = await this.commerce.transitionContractStatus({
      id: contract.id,
      status: input.toStatus,
      signatureProvider,
      signatureExternalId,
      signatureConfirmedAt:
        input.toStatus === ContractStatus.EXECUTED ? new Date() : null,
      executedAt: input.toStatus === ContractStatus.EXECUTED ? new Date() : null,
    });
    const correlationId = randomUUID();
    if (input.toStatus === ContractStatus.APPROVED) {
      await enqueueSales(
        this.outbox,
        createContractApprovedEvent({
          actorId: input.actorId,
          correlationId,
          contractId: updated.id,
        }),
      );
    }
    if (input.toStatus === ContractStatus.SENT_FOR_SIGNATURE) {
      await enqueueSales(
        this.outbox,
        createContractSentForSignatureEvent({
          actorId: input.actorId,
          correlationId,
          contractId: updated.id,
        }),
      );
    }
    if (input.toStatus === ContractStatus.EXECUTED) {
      await enqueueSales(
        this.outbox,
        createContractExecutedEvent({
          actorId: input.actorId,
          correlationId,
          contractId: updated.id,
        }),
      );
    }
    return updated;
  }
}

export class CreateSalesOrderUseCase {
  constructor(
    private readonly commerce: SalesCommerceRepositoryPort,
    private readonly sales: SalesRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}
  async execute(input: {
    actorId: string;
    opportunityId?: string | null;
    contractId?: string | null;
    quoteId?: string | null;
    requestedGoLiveDate?: string | null;
  }) {
    let accountId: string | null = null;
    let productId: string | null = null;
    let currency = 'USD';
    let totalAmount = 0;
    let commercialTerms: Record<string, unknown> = {};
    let offerConfiguration: Record<string, unknown> = {};

    if (input.contractId) {
      const contract = await this.commerce.getContract(input.contractId);
      if (!contract || !['EXECUTED', 'ACTIVE'].includes(contract.status)) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Sales order from contract requires EXECUTED/ACTIVE contract',
        );
      }
      accountId = contract.accountId;
      productId = contract.productId;
      currency = contract.currency;
      totalAmount = Number(contract.contractValue ?? 0);
      commercialTerms = contract.commercialTermsSnapshot;
    } else if (input.quoteId) {
      const quote = await this.commerce.getQuote(input.quoteId);
      if (!quote || quote.status !== QuoteStatus.ACCEPTED) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Sales order from quote requires accepted quote',
        );
      }
      accountId = quote.accountId;
      currency = quote.currency;
      totalAmount = Number(quote.totalAmount);
      commercialTerms = quote.commercialTerms;
    } else if (input.opportunityId) {
      const opp = await this.sales.getOpportunity(input.opportunityId);
      if (!opp) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Opportunity not found');
      accountId = opp.accountId;
      productId = opp.productId;
      currency = opp.currency;
      totalAmount = Number(opp.estimatedValue ?? 0);
    } else {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Sales order requires contract, quote, or opportunity',
      );
    }

    const orderNumber = await this.commerce.nextOrderNumber();
    const order = await this.commerce.createOrder({
      orderNumber,
      accountId: accountId!,
      contractId: input.contractId,
      opportunityId: input.opportunityId,
      quoteId: input.quoteId,
      productId,
      currency,
      totalAmount,
      commercialTerms,
      offerConfiguration,
      requestedGoLiveDate: input.requestedGoLiveDate,
      ownerAdministratorId: input.actorId,
      createdBy: input.actorId,
    });
    await enqueueSales(
      this.outbox,
      createSalesOrderCreatedEvent({
        actorId: input.actorId,
        correlationId: randomUUID(),
        orderId: order.id,
        orderNumber: order.orderNumber,
      }),
    );
    return order;
  }
}

export class ListSalesOrdersUseCase {
  constructor(private readonly commerce: SalesCommerceRepositoryPort) {}
  execute(opts?: { accountId?: string; status?: string }) {
    return this.commerce.listOrders(opts);
  }
}

export class TransitionSalesOrderUseCase {
  constructor(
    private readonly commerce: SalesCommerceRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}
  async execute(input: { actorId?: string; orderId: string; toStatus: string }) {
    const order = await this.commerce.getOrder(input.orderId);
    if (!order) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Sales order not found');
    assertSalesOrderStatusTransition(order.status, input.toStatus);
    const updated = await this.commerce.transitionOrderStatus(order.id, input.toStatus);
    if (input.toStatus === SalesOrderStatus.APPROVED && input.actorId) {
      await enqueueSales(
        this.outbox,
        createSalesOrderApprovedEvent({
          actorId: input.actorId,
          correlationId: randomUUID(),
          orderId: updated.id,
        }),
      );
    }
    return updated;
  }
}

export class RequestSalesHandoffUseCase {
  constructor(
    private readonly commerce: SalesCommerceRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}
  async execute(input: {
    actorId: string;
    salesOrderId: string;
    correlationId?: string;
    requireContract?: boolean;
    requireQuote?: boolean;
    idempotencyKey?: string;
  }) {
    const order = await this.commerce.getOrder(input.salesOrderId);
    if (!order) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Sales order not found');
    if (
      order.status !== SalesOrderStatus.CONFIRMED &&
      order.status !== SalesOrderStatus.HANDOFF_PENDING
    ) {
      if (order.status === SalesOrderStatus.APPROVED) {
        await this.commerce.transitionOrderStatus(order.id, SalesOrderStatus.CONFIRMED);
      } else {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Handoff requires confirmed sales order',
        );
      }
    }

    const contractExecuted = order.contractId
      ? Boolean(
          (await this.commerce.getContract(order.contractId))?.status &&
            ['EXECUTED', 'ACTIVE'].includes(
              (await this.commerce.getContract(order.contractId))!.status,
            ),
        )
      : order.opportunityId
        ? await this.commerce.hasExecutedContractForOpportunity(order.opportunityId)
        : false;
    const quoteAccepted = order.quoteId
      ? (await this.commerce.getQuote(order.quoteId))?.status === QuoteStatus.ACCEPTED
      : order.opportunityId
        ? await this.commerce.hasAcceptedQuoteForOpportunity(order.opportunityId)
        : false;

    assertHandoffPackageComplete({
      accountId: order.accountId,
      productId: order.productId,
      commercialTermsPresent: Object.keys(order.commercialTerms ?? {}).length > 0 || Number(order.totalAmount) > 0,
      requireContract: input.requireContract ?? Boolean(order.contractId),
      contractExecutedWhenRequired: contractExecuted,
      requireQuote: input.requireQuote ?? false,
      quoteAcceptedWhenRequired: quoteAccepted,
    });

    const correlationId = input.correlationId ?? randomUUID();
    const packagePayload = {
      accountId: order.accountId,
      salesOrderId: order.id,
      orderNumber: order.orderNumber,
      opportunityId: order.opportunityId,
      contractId: order.contractId,
      quoteId: order.quoteId,
      productId: order.productId,
      currency: order.currency,
      totalAmount: order.totalAmount,
      commercialTerms: order.commercialTerms,
      offerConfiguration: order.offerConfiguration,
      correlationId,
      note: 'P4 does not create tenants or subscriptions',
    };

    const handoff = await this.commerce.createHandoff({
      salesOrderId: order.id,
      accountId: order.accountId,
      opportunityId: order.opportunityId,
      contractId: order.contractId,
      correlationId,
      packagePayload,
      createdBy: input.actorId,
    });

    await this.commerce.recordHandoffAttempt({
      handoffId: handoff.id,
      attemptNo: 1,
      idempotencyKey: input.idempotencyKey ?? `handoff:${handoff.id}:1`,
      requestPayload: packagePayload,
      success: true,
    });

    if (order.status !== SalesOrderStatus.HANDOFF_PENDING) {
      await this.commerce.transitionOrderStatus(order.id, SalesOrderStatus.HANDOFF_PENDING);
    }

    await enqueueSales(
      this.outbox,
      createSalesHandoffRequestedEvent({
        actorId: input.actorId,
        correlationId,
        handoffId: handoff.id,
        salesOrderId: order.id,
      }),
    );
    return handoff;
  }
}

export class AcceptSalesHandoffUseCase {
  constructor(
    private readonly commerce: SalesCommerceRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}
  async execute(input: { actorId: string; handoffId: string }) {
    const handoff = await this.commerce.getHandoff(input.handoffId);
    if (!handoff) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Handoff not found');
    const updated = await this.commerce.updateHandoffStatus({
      id: handoff.id,
      status: HandoffStatus.ACCEPTED,
      acceptedAt: new Date(),
    });
    await this.commerce.transitionOrderStatus(
      handoff.salesOrderId,
      SalesOrderStatus.HANDOFF_ACCEPTED,
    );
    await enqueueSales(
      this.outbox,
      createSalesHandoffAcceptedEvent({
        actorId: input.actorId,
        correlationId: handoff.correlationId,
        handoffId: updated.id,
      }),
    );
    return updated;
  }
}

export class ReceiveProvisioningStatusUseCase {
  constructor(
    private readonly commerce: SalesCommerceRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}
  async execute(input: {
    actorId: string;
    handoffId: string;
    confirmed: boolean;
    externalSystem?: string;
    externalRef?: string | null;
    productId?: string | null;
    claimFulfilled?: boolean;
  }) {
    assertProvisioningNotFaked({
      claimedFulfilled: input.claimFulfilled,
      provisioningConfirmed: input.confirmed,
    });
    const handoff = await this.commerce.getHandoff(input.handoffId);
    if (!handoff) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Handoff not found');
    if (input.confirmed && input.externalRef && input.externalSystem) {
      await this.commerce.addProvisioningReference({
        handoffId: handoff.id,
        accountId: handoff.accountId,
        externalSystem: input.externalSystem,
        externalRef: input.externalRef,
        productId: input.productId,
        confirmed: true,
      });
    }
    const updated = await this.commerce.updateHandoffStatus({
      id: handoff.id,
      status: input.confirmed
        ? HandoffStatus.PROVISIONING_CONFIRMED
        : HandoffStatus.PROVISIONING_PENDING,
      provisioningConfirmedAt: input.confirmed ? new Date() : null,
      provisioningRefs: input.externalRef
        ? [{ system: input.externalSystem, ref: input.externalRef }]
        : undefined,
    });
    if (input.confirmed) {
      await this.commerce.transitionOrderStatus(
        handoff.salesOrderId,
        SalesOrderStatus.FULFILLED,
      );
    }
    await enqueueSales(
      this.outbox,
      createProvisioningStatusReceivedEvent({
        actorId: input.actorId,
        correlationId: handoff.correlationId,
        handoffId: updated.id,
        confirmed: input.confirmed,
        externalRef: input.externalRef,
      }),
    );
    return updated;
  }
}

export class ListSalesHandoffsUseCase {
  constructor(private readonly commerce: SalesCommerceRepositoryPort) {}
  execute(opts?: { status?: string }) {
    return this.commerce.listHandoffs(opts);
  }
}

export class GetSalesForecastUseCase {
  constructor(private readonly commerce: SalesCommerceRepositoryPort) {}
  execute(input: {
    model?: 'PIPELINE' | 'WEIGHTED' | 'BEST_CASE' | 'COMMIT' | 'MOST_LIKELY';
    ownerAdministratorId?: string | null;
    teamId?: string | null;
    productId?: string | null;
    labelAsRecognizedRevenue?: boolean;
  }) {
    assertForecastIsNotRecognizedRevenue({
      labelAsRecognizedRevenue: input.labelAsRecognizedRevenue,
    });
    return this.commerce.computeForecast({
      model: input.model ?? 'WEIGHTED',
      ownerAdministratorId: input.ownerAdministratorId,
      teamId: input.teamId,
      productId: input.productId,
    });
  }
}

export class GetSalesPerformanceUseCase {
  constructor(private readonly commerce: SalesCommerceRepositoryPort) {}
  async execute() {
    const summary = await this.commerce.salesPerformanceSummary();
    return {
      ...summary,
      disclaimer:
        'Pipeline and forecast values are commercial projections, not recognized revenue.',
    };
  }
}

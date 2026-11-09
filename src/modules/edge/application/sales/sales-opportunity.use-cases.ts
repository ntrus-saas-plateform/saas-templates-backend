import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import {
  assertClosedWonGates,
  assertOpportunityMutable,
  assertOpportunityReopen,
  assertPipelineTransitionAllowed,
  assertValidLossReason,
  computeWeightedPipelineValue,
  OpportunityStatus,
  PipelineStageKind,
  SalesLeadStatus,
  assertSalesLeadStatusTransition,
} from '../../domain/sales/sales.entity.js';
import {
  createOpportunityCreatedEvent,
  createOpportunityLostEvent,
  createOpportunityStageChangedEvent,
  createOpportunityWonEvent,
  EDGE_SALES_OUTBOX_TENANT,
} from '../../domain/sales/sales.events.js';
import type { SalesRepositoryPort } from '../../domain/ports/sales-repository.port.js';
import type { SalesCommerceRepositoryPort } from '../../domain/ports/sales-commerce-repository.port.js';

export class ListSalesPipelinesUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  execute() {
    return this.sales.listPipelines();
  }
}

export class GetSalesPipelineBoardUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  async execute(pipelineId?: string) {
    const pipeline =
      (pipelineId
        ? (await this.sales.listPipelines()).find((p) => p.id === pipelineId)
        : null) ?? (await this.sales.getDefaultPipeline());
    if (!pipeline) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'No active sales pipeline');
    }
    const board = await this.sales.pipelineBoard(pipeline.id);
    return { pipeline, board };
  }
}

export class CreateOpportunityUseCase {
  constructor(
    private readonly sales: SalesRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    name: string;
    accountId: string;
    salesLeadId?: string | null;
    pipelineId?: string | null;
    ownerAdministratorId?: string | null;
    teamId?: string | null;
    productId?: string | null;
    verticalId?: string | null;
    needSummary?: string | null;
    scopeSummary?: string | null;
    estimatedValue?: number | null;
    currency?: string;
    expectedCloseDate?: string | null;
    source?: string | null;
  }) {
    const account = await this.sales.getAccount(input.accountId);
    if (!account || account.status === 'MERGED') {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Commercial account not found');
    }
    const pipeline =
      (input.pipelineId
        ? (await this.sales.listPipelines()).find((p) => p.id === input.pipelineId)
        : null) ?? (await this.sales.getDefaultPipeline());
    if (!pipeline) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'No active sales pipeline');
    }
    const stages = await this.sales.listPipelineStages(pipeline.id);
    const firstOpen = stages.find((s) => s.stageKind === PipelineStageKind.OPEN);
    if (!firstOpen) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Pipeline has no open stages');
    }
    const opportunityNumber = await this.sales.nextOpportunityNumber();
    const opportunity = await this.sales.createOpportunity({
      opportunityNumber,
      name: input.name.trim(),
      accountId: input.accountId,
      salesLeadId: input.salesLeadId,
      pipelineId: pipeline.id,
      stageId: firstOpen.id,
      ownerAdministratorId: input.ownerAdministratorId,
      teamId: input.teamId,
      productId: input.productId,
      verticalId: input.verticalId,
      needSummary: input.needSummary,
      scopeSummary: input.scopeSummary,
      estimatedValue: input.estimatedValue,
      currency: input.currency,
      probability: Number(firstOpen.referenceProbability),
      expectedCloseDate: input.expectedCloseDate,
      source: input.source,
      createdBy: input.actorId,
    });
    await this.sales.appendTimelineEvent({
      accountId: opportunity.accountId,
      eventType: 'OPPORTUNITY_CREATED',
      provenance: 'SALES',
      title: `Opportunity created: ${opportunity.name}`,
      actorId: input.actorId,
      metadata: { opportunityId: opportunity.id },
    });
    if (input.salesLeadId) {
      const lead = await this.sales.getSalesLead(input.salesLeadId);
      if (lead && lead.status === SalesLeadStatus.SALES_QUALIFIED) {
        assertSalesLeadStatusTransition(
          lead.status,
          SalesLeadStatus.CONVERTED_TO_OPPORTUNITY,
        );
        await this.sales.transitionSalesLead({
          id: lead.id,
          toStatus: SalesLeadStatus.CONVERTED_TO_OPPORTUNITY,
          decisionType: 'QUALIFY',
          actorId: input.actorId,
          correlationId: opportunity.id,
          accountId: opportunity.accountId,
          payload: { opportunityId: opportunity.id },
        });
      }
    }
    if (this.outbox) {
      const event = createOpportunityCreatedEvent({
        actorId: input.actorId,
        correlationId: opportunity.id,
        opportunityId: opportunity.id,
        accountId: opportunity.accountId,
        pipelineId: opportunity.pipelineId,
      });
      await this.outbox.runWithOutbox(EDGE_SALES_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(event);
      });
    }
    return opportunity;
  }
}

export class ListOpportunitiesUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  execute(opts?: {
    status?: string;
    accountId?: string;
    pipelineId?: string;
    stageId?: string;
    ownerAdministratorId?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.sales.listOpportunities(opts);
  }
}

export class GetOpportunityUseCase {
  constructor(
    private readonly sales: SalesRepositoryPort,
    private readonly commerce?: SalesCommerceRepositoryPort,
  ) {}
  async execute(id: string) {
    const opportunity = await this.sales.getOpportunity(id);
    if (!opportunity) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Opportunity not found');
    }
    const [risks, competitors, history, stage] = await Promise.all([
      this.sales.listOpportunityRisks(id),
      this.sales.listOpportunityCompetitors(id),
      this.sales.listOpportunityStageHistory(id),
      this.sales.getPipelineStage(opportunity.stageId),
    ]);
    const weighted =
      opportunity.estimatedValue != null && opportunity.probability != null
        ? computeWeightedPipelineValue(
            Number(opportunity.estimatedValue),
            Number(opportunity.probability),
          )
        : null;
    const workspace = this.commerce
      ? await Promise.all([
          this.commerce.listNeedsAssessments(id),
          this.commerce.listOfferConfigurations(id),
          this.commerce.listQuotes({ opportunityId: id }),
          this.commerce.listProposals(id),
          this.commerce.listContracts({ opportunityId: id }),
          this.commerce.listActivities({ opportunityId: id, limit: 50 }),
          this.commerce.hasAcceptedQuoteForOpportunity(id),
          this.commerce.hasExecutedContractForOpportunity(id),
        ]).then(
          ([
            assessments,
            offers,
            quotes,
            proposals,
            contracts,
            activities,
            hasAcceptedQuote,
            hasExecutedContract,
          ]) => ({
            assessments,
            offers,
            quotes,
            proposals,
            contracts,
            activities,
            closeReadiness: {
              hasAcceptedQuote,
              hasExecutedContract,
              note: 'Closed Won verifies these server-side; client flags are ignored',
            },
          }),
        )
      : undefined;
    return {
      opportunity,
      stage,
      risks,
      competitors,
      history,
      workspace,
      weightedPipelineValue: weighted,
      revenueNote:
        'Weighted pipeline value is a forecast input, not recognized revenue',
    };
  }
}

export class UpdateOpportunityUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  async execute(input: {
    actorId: string;
    id: string;
    name?: string;
    ownerAdministratorId?: string | null;
    teamId?: string | null;
    productId?: string | null;
    verticalId?: string | null;
    needSummary?: string | null;
    scopeSummary?: string | null;
    estimatedValue?: number | null;
    currency?: string;
    probability?: number | null;
    expectedCloseDate?: string | null;
    forecastCategory?: string;
  }) {
    const current = await this.sales.getOpportunity(input.id);
    if (!current) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Opportunity not found');
    }
    assertOpportunityMutable(current.status);
    return this.sales.updateOpportunity(input.id, input);
  }
}

export class TransitionOpportunityStageUseCase {
  constructor(
    private readonly sales: SalesRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly commerce?: SalesCommerceRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    opportunityId: string;
    toStageId: string;
    reasonCode?: string | null;
    reasonText?: string | null;
    /** Defaults true for Closed Won — cannot be falsified via quoteAccepted flags. */
    requireQuote?: boolean;
    requireContract?: boolean;
  }) {
    const opportunity = await this.sales.getOpportunity(input.opportunityId);
    if (!opportunity) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Opportunity not found');
    }
    if (
      opportunity.status === OpportunityStatus.WON ||
      opportunity.status === OpportunityStatus.LOST
    ) {
      assertOpportunityMutable(opportunity.status);
    }
    const toStage = await this.sales.getPipelineStage(input.toStageId);
    if (!toStage || toStage.pipelineId !== opportunity.pipelineId) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid target stage');
    }
    const allowed = await this.sales.listAllowedTransitionTargets(
      opportunity.pipelineId,
      opportunity.stageId,
    );
    assertPipelineTransitionAllowed({
      allowedToStageIds: allowed,
      toStageId: input.toStageId,
    });

    let toStatus: string = OpportunityStatus.OPEN;
    if (toStage.stageKind === PipelineStageKind.WON) {
      const requireQuote = input.requireQuote !== false;
      const requireContract = input.requireContract !== false;
      if (!this.commerce) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Closed Won requires sales commerce repository for quote/contract verification',
        );
      }
      const [quoteAccepted, contractExecuted] = await Promise.all([
        this.commerce.hasAcceptedQuoteForOpportunity(opportunity.id),
        this.commerce.hasExecutedContractForOpportunity(opportunity.id),
      ]);
      assertClosedWonGates({
        toStageKind: toStage.stageKind,
        accountId: opportunity.accountId,
        estimatedValue: opportunity.estimatedValue,
        productId: opportunity.productId,
        requireQuote,
        requireContract,
        quoteAcceptedWhenRequired: quoteAccepted,
        contractExecutedWhenRequired: contractExecuted,
      });
      toStatus = OpportunityStatus.WON;
    } else if (toStage.stageKind === PipelineStageKind.LOST) {
      assertValidLossReason({
        reasonCode: input.reasonCode,
        reasonText: input.reasonText,
      });
      toStatus = OpportunityStatus.LOST;
    } else if (opportunity.status === OpportunityStatus.REOPENED) {
      toStatus = OpportunityStatus.OPEN;
    }

    const updated = await this.sales.transitionOpportunityStage({
      opportunityId: opportunity.id,
      toStageId: input.toStageId,
      toStatus,
      reasonCode: input.reasonCode,
      reasonText: input.reasonText,
      actorId: input.actorId,
      correlationId: opportunity.id,
      probability: Number(toStage.referenceProbability),
    });

    await this.sales.appendTimelineEvent({
      accountId: updated.accountId,
      eventType: 'OPPORTUNITY_STAGE_CHANGED',
      provenance: 'SALES',
      title: `Stage → ${toStage.name}`,
      actorId: input.actorId,
      metadata: { toStageId: toStage.id, toStatus },
    });

    if (this.outbox) {
      await this.outbox.runWithOutbox(EDGE_SALES_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(
          createOpportunityStageChangedEvent({
            actorId: input.actorId,
            correlationId: updated.id,
            opportunityId: updated.id,
            fromStageId: opportunity.stageId,
            toStageId: updated.stageId,
          }),
        );
        if (toStatus === OpportunityStatus.WON) {
          await enqueue(
            createOpportunityWonEvent({
              actorId: input.actorId,
              correlationId: updated.id,
              opportunityId: updated.id,
              accountId: updated.accountId,
              estimatedValue: updated.estimatedValue,
              currency: updated.currency,
            }),
          );
        }
        if (toStatus === OpportunityStatus.LOST) {
          await enqueue(
            createOpportunityLostEvent({
              actorId: input.actorId,
              correlationId: updated.id,
              opportunityId: updated.id,
              lossReasonCode: input.reasonCode!,
            }),
          );
        }
      });
    }
    return updated;
  }
}

export class ReopenOpportunityUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  async execute(input: {
    actorId: string;
    opportunityId: string;
    reason: string;
  }) {
    const opportunity = await this.sales.getOpportunity(input.opportunityId);
    if (!opportunity) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Opportunity not found');
    }
    assertOpportunityReopen({ status: opportunity.status, reason: input.reason });
    const stages = await this.sales.listPipelineStages(opportunity.pipelineId);
    const reopenStage =
      stages.find((s) => s.code === 'NEGOTIATION') ??
      stages.find((s) => s.stageKind === PipelineStageKind.OPEN);
    if (!reopenStage) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'No reopen stage available');
    }
    return this.sales.reopenOpportunity({
      opportunityId: opportunity.id,
      stageId: reopenStage.id,
      reason: input.reason,
      actorId: input.actorId,
    });
  }
}

export class AddOpportunityRiskUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  async execute(input: {
    opportunityId: string;
    code: string;
    title: string;
    severity?: string;
    description?: string | null;
  }) {
    const opportunity = await this.sales.getOpportunity(input.opportunityId);
    if (!opportunity) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Opportunity not found');
    }
    assertOpportunityMutable(opportunity.status);
    return this.sales.addOpportunityRisk(input);
  }
}

export class AddOpportunityCompetitorUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  async execute(input: {
    opportunityId: string;
    competitorName: string;
    threatLevel?: string;
    notes?: string | null;
  }) {
    const opportunity = await this.sales.getOpportunity(input.opportunityId);
    if (!opportunity) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Opportunity not found');
    }
    assertOpportunityMutable(opportunity.status);
    return this.sales.addOpportunityCompetitor(input);
  }
}

export class AddOpportunityContactUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  async execute(input: {
    opportunityId: string;
    contactId: string;
    roleOnOpportunity?: string;
    isPrimary?: boolean;
  }) {
    const opportunity = await this.sales.getOpportunity(input.opportunityId);
    if (!opportunity) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Opportunity not found');
    }
    assertOpportunityMutable(opportunity.status);
    await this.sales.addOpportunityContact(input);
    return { ok: true };
  }
}

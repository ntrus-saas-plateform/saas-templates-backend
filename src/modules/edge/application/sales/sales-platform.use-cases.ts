import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { SalesPlatformRepositoryPort } from '../../domain/ports/sales-platform-repository.port.js';
import type { SalesCommerceRepositoryPort } from '../../domain/ports/sales-commerce-repository.port.js';
import type { SalesRepositoryPort } from '../../domain/ports/sales-repository.port.js';
import type { SalesProposalDocumentAdapterPort } from '../../domain/sales/proposal-document.adapter.port.js';
import type { SalesCalendarAdapterPort } from '../../domain/sales/calendar-adapter.port.js';
import {
  createContractAmendedEvent,
  createProposalDocumentGeneratedEvent,
  createQuoteApprovedEvent,
  createSalesOrderApprovedEvent,
  createSolutionFitValidatedEvent,
  EDGE_SALES_OUTBOX_TENANT,
} from '../../domain/sales/sales.events.js';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import { assertForecastIsNotRecognizedRevenue } from '../../domain/sales/sales-commerce.entity.js';

async function enqueueSales(
  outbox: ControlPlaneOutboxTransactionService | undefined,
  event: IntegrationEvent<unknown>,
) {
  if (!outbox) return;
  await outbox.runWithOutbox(EDGE_SALES_OUTBOX_TENANT, async (_c, enqueue) => {
    await enqueue(event);
  });
}

export class AddAccountRelationshipUseCase {
  constructor(private readonly platform: SalesPlatformRepositoryPort) {}
  execute(input: {
    actorId: string;
    fromAccountId: string;
    toAccountId: string;
    relationshipType: string;
    notes?: string | null;
  }) {
    return this.platform.addAccountRelationship({
      ...input,
      createdBy: input.actorId,
    });
  }
}

export class GetAccountHierarchyUseCase {
  constructor(private readonly platform: SalesPlatformRepositoryPort) {}
  execute(accountId: string) {
    return this.platform.getAccountHierarchy(accountId);
  }
}

export class AddContactRoleUseCase {
  constructor(private readonly platform: SalesPlatformRepositoryPort) {}
  execute(input: {
    contactId: string;
    accountId: string;
    roleType: string;
    isPrimary?: boolean;
    effectiveUntil?: string | null;
  }) {
    return this.platform.addContactRole(input);
  }
}

export class ListContactRolesUseCase {
  constructor(private readonly platform: SalesPlatformRepositoryPort) {}
  execute(contactId: string) {
    return this.platform.listContactRoles(contactId);
  }
}

export class UpsertDiscoveryQuestionnaireUseCase {
  constructor(private readonly platform: SalesPlatformRepositoryPort) {}
  execute(input: {
    code: string;
    name: string;
    verticalId?: string | null;
    productId?: string | null;
    questions: unknown[];
    status?: string;
  }) {
    if (!input.questions?.length) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Questionnaire requires questions');
    }
    return this.platform.upsertDiscoveryQuestionnaire(input);
  }
}

export class ListDiscoveryQuestionnairesUseCase {
  constructor(private readonly platform: SalesPlatformRepositoryPort) {}
  execute(opts?: { verticalId?: string; productId?: string }) {
    return this.platform.listDiscoveryQuestionnaires(opts);
  }
}

export class CreateContractAmendmentUseCase {
  constructor(
    private readonly platform: SalesPlatformRepositoryPort,
    private readonly commerce: SalesCommerceRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}
  async execute(input: {
    actorId: string;
    contractId: string;
    summary: string;
    changes?: Record<string, unknown>;
  }) {
    const contract = await this.commerce.getContract(input.contractId);
    if (!contract) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Contract not found');
    if (!input.summary.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Amendment summary required');
    }
    const amendments = await this.platform.listContractAmendments(contract.id);
    const amendmentNumber = `A-${amendments.length + 1}`;
    const amendment = await this.platform.createContractAmendment({
      contractId: contract.id,
      amendmentNumber,
      summary: input.summary,
      changes: input.changes,
      createdBy: input.actorId,
    });
    await enqueueSales(
      this.outbox,
      createContractAmendedEvent({
        actorId: input.actorId,
        correlationId: randomUUID(),
        contractId: contract.id,
        amendmentId: amendment.id,
      }),
    );
    return amendment;
  }
}

export class ListContractAmendmentsUseCase {
  constructor(private readonly platform: SalesPlatformRepositoryPort) {}
  execute(contractId: string) {
    return this.platform.listContractAmendments(contractId);
  }
}

export class ExecuteContractAmendmentUseCase {
  constructor(private readonly platform: SalesPlatformRepositoryPort) {}
  execute(id: string) {
    return this.platform.executeContractAmendment(id);
  }
}

export class SetSalesOrderLinesUseCase {
  constructor(
    private readonly platform: SalesPlatformRepositoryPort,
    private readonly commerce: SalesCommerceRepositoryPort,
  ) {}
  async execute(input: {
    orderId: string;
    lines: Array<{
      lineNumber: number;
      description: string;
      quantity: number;
      unitPrice: number;
      productId?: string | null;
      planId?: string | null;
      packageId?: string | null;
      addonId?: string | null;
      p2Refs?: Record<string, unknown>;
    }>;
  }) {
    const order = await this.commerce.getOrder(input.orderId);
    if (!order) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Order not found');
    if (!['DRAFT', 'PENDING_APPROVAL'].includes(order.status)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Order lines can only be set while draft/pending approval',
      );
    }
    const lines = input.lines.map((l) => ({
      ...l,
      lineTotal: Math.round(l.quantity * l.unitPrice * 100) / 100,
    }));
    await this.platform.replaceOrderLines(order.id, lines);
    return this.platform.listOrderLines(order.id);
  }
}

export class ListSalesOrderLinesUseCase {
  constructor(private readonly platform: SalesPlatformRepositoryPort) {}
  execute(orderId: string) {
    return this.platform.listOrderLines(orderId);
  }
}

export class PersistSalesForecastSnapshotUseCase {
  constructor(
    private readonly platform: SalesPlatformRepositoryPort,
    private readonly commerce: SalesCommerceRepositoryPort,
  ) {}
  async execute(input: {
    actorId: string;
    periodType: string;
    periodKey: string;
    model?: 'PIPELINE' | 'WEIGHTED' | 'BEST_CASE' | 'COMMIT' | 'MOST_LIKELY';
    scopeType?: string;
    scopeId?: string | null;
    labelAsRecognizedRevenue?: boolean;
  }) {
    assertForecastIsNotRecognizedRevenue({
      labelAsRecognizedRevenue: input.labelAsRecognizedRevenue,
    });
    const forecast = await this.commerce.computeForecast({
      model: input.model ?? 'WEIGHTED',
    });
    return this.platform.saveForecastSnapshot({
      periodType: input.periodType,
      periodKey: input.periodKey,
      scopeType: input.scopeType ?? 'GLOBAL',
      scopeId: input.scopeId,
      model: input.model ?? 'WEIGHTED',
      currency: forecast.currency,
      amount: forecast.amount,
      opportunityCount: forecast.opportunityCount,
      assumptions: forecast.assumptions,
      createdBy: input.actorId,
    });
  }
}

export class ListSalesForecastSnapshotsUseCase {
  constructor(private readonly platform: SalesPlatformRepositoryPort) {}
  execute(opts?: { periodType?: string; periodKey?: string; model?: string }) {
    return this.platform.listForecastSnapshots(opts);
  }
}

export class GlobalSalesSearchUseCase {
  constructor(private readonly platform: SalesPlatformRepositoryPort) {}
  execute(input: {
    q: string;
    actorId: string;
    visibilityMode?: 'OWNED' | 'TEAM' | 'ALL';
    teamIds?: string[];
    limit?: number;
  }) {
    if (!input.q.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Search query required');
    }
    return this.platform.globalSearch(input);
  }
}

export class CreateSalesSavedViewUseCase {
  constructor(private readonly platform: SalesPlatformRepositoryPort) {}
  execute(input: {
    actorId: string;
    name: string;
    scope: string;
    entityType: string;
    teamId?: string | null;
    filters?: Record<string, unknown>;
    columns?: unknown[];
    sortSpec?: unknown[];
    isDefault?: boolean;
  }) {
    return this.platform.createSavedView({
      name: input.name,
      scope: input.scope,
      entityType: input.entityType,
      ownerAdministratorId: input.scope === 'PERSONAL' ? input.actorId : null,
      teamId: input.teamId,
      filters: input.filters,
      columns: input.columns,
      sortSpec: input.sortSpec,
      isDefault: input.isDefault,
    });
  }
}

export class ListSalesSavedViewsUseCase {
  constructor(private readonly platform: SalesPlatformRepositoryPort) {}
  execute(input: { actorId: string; entityType?: string; teamIds?: string[] }) {
    return this.platform.listSavedViews(input);
  }
}

export class DeleteSalesSavedViewUseCase {
  constructor(private readonly platform: SalesPlatformRepositoryPort) {}
  execute(id: string, actorId: string) {
    return this.platform.deleteSavedView(id, actorId);
  }
}

export class ExportSalesEntitiesUseCase {
  constructor(
    private readonly platform: SalesPlatformRepositoryPort,
    private readonly sales: SalesRepositoryPort,
    private readonly commerce: SalesCommerceRepositoryPort,
  ) {}
  async execute(input: {
    actorId: string;
    entityType: string;
    format?: 'JSON' | 'CSV';
    filters?: Record<string, unknown>;
    hasExportPermission: boolean;
  }) {
    if (!input.hasExportPermission) {
      return this.platform.createExportJob({
        entityType: input.entityType,
        status: 'DENIED',
        requestedBy: input.actorId,
        filters: input.filters,
        rowCount: 0,
        format: input.format ?? 'JSON',
        payload: [],
        denialReason: 'Missing sales export/read permission',
      });
    }
    let payload: unknown[] = [];
    switch (input.entityType) {
      case 'ACCOUNT':
        payload = (await this.sales.listAccounts({ limit: 500 })).items;
        break;
      case 'CONTACT':
        payload = (await this.sales.listContacts({ limit: 500 })).items;
        break;
      case 'LEAD':
        payload = (await this.sales.listSalesLeads({ limit: 500 })).items;
        break;
      case 'OPPORTUNITY':
        payload = (await this.sales.listOpportunities({ limit: 500 })).items;
        break;
      case 'QUOTE':
        payload = await this.commerce.listQuotes({ limit: 500 });
        break;
      case 'CONTRACT':
        payload = await this.commerce.listContracts({});
        break;
      default:
        throw new DomainError(ErrorCode.VALIDATION_ERROR, `Unsupported export type ${input.entityType}`);
    }
    return this.platform.createExportJob({
      entityType: input.entityType,
      status: 'COMPLETED',
      requestedBy: input.actorId,
      filters: input.filters,
      rowCount: payload.length,
      format: input.format ?? 'JSON',
      payload,
      correlationId: randomUUID(),
    });
  }
}

export class ListSalesExportJobsUseCase {
  constructor(private readonly platform: SalesPlatformRepositoryPort) {}
  execute(actorId: string) {
    return this.platform.listExportJobs(actorId);
  }
}

export class GrantSalesVisibilityUseCase {
  constructor(private readonly platform: SalesPlatformRepositoryPort) {}
  execute(input: {
    actorId: string;
    subjectType: string;
    subjectId: string;
    granteeAdministratorId?: string | null;
    granteeTeamId?: string | null;
    accessLevel?: string;
  }) {
    return this.platform.grantVisibility({
      ...input,
      grantedBy: input.actorId,
    });
  }
}

export class ListSalesVisibilityGrantsUseCase {
  constructor(private readonly platform: SalesPlatformRepositoryPort) {}
  execute(subjectType: string, subjectId: string) {
    return this.platform.listVisibilityGrants(subjectType, subjectId);
  }
}

export class AssertSalesSubjectAccessUseCase {
  constructor(private readonly platform: SalesPlatformRepositoryPort) {}
  async execute(input: {
    subjectType: string;
    subjectId: string;
    actorId: string;
    teamIds?: string[];
    ownerAdministratorId?: string | null;
    isElevated?: boolean;
  }) {
    const ok = await this.platform.canAccessSubject({
      ...input,
      teamIds: input.teamIds ?? [],
    });
    if (!ok) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'Sales subject not visible to actor');
    }
    return { ok: true };
  }
}

export class GenerateProposalDocumentUseCase {
  constructor(
    private readonly commerce: SalesCommerceRepositoryPort,
    private readonly platform: SalesPlatformRepositoryPort,
    private readonly documents: SalesProposalDocumentAdapterPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}
  async execute(input: { actorId: string; proposalId: string }) {
    const proposal = await this.commerce.getProposal(input.proposalId);
    if (!proposal) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Proposal not found');
    const generated = await this.documents.generate({
      proposalId: proposal.id,
      proposalNumber: proposal.proposalNumber,
      title: proposal.title,
      language: proposal.language,
      sections: (proposal.sections as { code?: string; title?: string; body?: string }[]) ?? [],
    });
    if (generated.outcome === 'UNAVAILABLE') {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, generated.failureMessage);
    }
    await this.platform.updateProposalDocumentRef(proposal.id, generated.documentRef);
    await enqueueSales(
      this.outbox,
      createProposalDocumentGeneratedEvent({
        actorId: input.actorId,
        correlationId: randomUUID(),
        proposalId: proposal.id,
        documentRef: generated.documentRef,
      }),
    );
    return {
      proposalId: proposal.id,
      documentRef: generated.documentRef,
      format: generated.format,
      bytesBase64: generated.bytesBase64,
    };
  }
}

export class SyncSalesActivityCalendarUseCase {
  constructor(
    private readonly commerce: SalesCommerceRepositoryPort,
    private readonly platform: SalesPlatformRepositoryPort,
    private readonly calendar: SalesCalendarAdapterPort,
  ) {}
  async execute(input: { activityId: string }) {
    const activities = await this.commerce.listActivities({ limit: 500 });
    const activity = activities.find((a) => a.id === input.activityId);
    if (!activity) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Activity not found');
    const result = await this.calendar.syncActivity({
      activityId: activity.id,
      subject: activity.subject,
      scheduledStartAt: activity.scheduledStartAt?.toISOString() ?? null,
      scheduledEndAt: activity.scheduledEndAt?.toISOString() ?? null,
    });
    await this.platform.recordCalendarSyncEvent({
      activityId: activity.id,
      provider: result.outcome === 'SYNCED' ? result.provider : 'NONE',
      outcome: result.outcome,
      externalRef: result.outcome === 'SYNCED' ? result.externalRef : null,
      failureMessage: result.outcome === 'UNAVAILABLE' ? result.failureMessage : null,
    });
    return result;
  }
}

export class ValidateSolutionFitUseCase {
  constructor(
    private readonly commerce: SalesCommerceRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}
  async execute(input: {
    actorId: string;
    assessmentId: string;
    commerciallyAuthorizedCapabilities: string[];
  }) {
    const assessment = await this.commerce.getNeedsAssessment(input.assessmentId);
    if (!assessment) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Needs assessment not found');
    }
    if (assessment.status !== 'COMPLETED' && assessment.status !== 'TECHNICALLY_VALIDATED') {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Assessment must be completed before solution fit validation',
      );
    }
    await enqueueSales(
      this.outbox,
      createSolutionFitValidatedEvent({
        actorId: input.actorId,
        correlationId: randomUUID(),
        assessmentId: assessment.id,
        opportunityId: assessment.opportunityId,
        fitDecision: assessment.fitDecision,
      }),
    );
    return {
      assessmentId: assessment.id,
      fitDecision: assessment.fitDecision,
      uncoveredNeeds: assessment.uncoveredNeeds,
      authorizedCapabilities: input.commerciallyAuthorizedCapabilities,
    };
  }
}

export class RecordQuoteApprovedEventUseCase {
  constructor(private readonly outbox?: ControlPlaneOutboxTransactionService) {}
  async execute(input: { actorId: string; quoteId: string }) {
    await enqueueSales(
      this.outbox,
      createQuoteApprovedEvent({
        actorId: input.actorId,
        correlationId: randomUUID(),
        quoteId: input.quoteId,
      }),
    );
  }
}

export class RecordOrderApprovedEventUseCase {
  constructor(private readonly outbox?: ControlPlaneOutboxTransactionService) {}
  async execute(input: { actorId: string; orderId: string }) {
    await enqueueSales(
      this.outbox,
      createSalesOrderApprovedEvent({
        actorId: input.actorId,
        correlationId: randomUUID(),
        orderId: input.orderId,
      }),
    );
  }
}

export class ResolveSalesIdempotencyUseCase {
  constructor(private readonly platform: SalesPlatformRepositoryPort) {}
  async execute(input: {
    idempotencyKey?: string | null;
    routeKey: string;
    actorId: string;
    run: () => Promise<Record<string, unknown>>;
  }) {
    if (!input.idempotencyKey?.trim()) {
      return input.run();
    }
    const existing = await this.platform.findIdempotentResponse(
      input.idempotencyKey,
      input.routeKey,
    );
    if (existing) return existing.responseBody;
    const body = await input.run();
    await this.platform.saveIdempotentResponse({
      idempotencyKey: input.idempotencyKey,
      routeKey: input.routeKey,
      actorId: input.actorId,
      responseBody: body,
    });
    return body;
  }
}

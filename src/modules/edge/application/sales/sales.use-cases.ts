import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import {
  assertAccountIsNotTenant,
  assertAccountStatusTransition,
  assertControlledMerge,
  assertQualificationDecision,
  assertRejectionRequiresReason,
  assertSalesDecisionIndependentOfMarketingScore,
  assertSalesLeadStatusTransition,
  normalizeAccountName,
  normalizeEmailDomain,
  SalesLeadStatus,
} from '../../domain/sales/sales.entity.js';
import {
  createCommercialAccountCreatedEvent,
  createCommercialAccountMergedEvent,
  createSalesContactCreatedEvent,
  createSalesLeadAcceptedEvent,
  createSalesLeadAssignedEvent,
  createSalesLeadQualifiedEvent,
  createSalesLeadReceivedEvent,
  createSalesLeadRejectedEvent,
  EDGE_SALES_OUTBOX_TENANT,
} from '../../domain/sales/sales.events.js';
import type { SalesRepositoryPort } from '../../domain/ports/sales-repository.port.js';

export class CreateSalesTeamUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    managerAdministratorId?: string | null;
  }) {
    return this.sales.createTeam({ ...input, createdBy: input.actorId });
  }
}

export class ListSalesTeamsUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  execute() {
    return this.sales.listTeams();
  }
}

export class AddSalesTeamMemberUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  async execute(input: {
    teamId: string;
    administratorId: string;
    memberRole?: string;
    territoryId?: string | null;
  }) {
    const team = await this.sales.getTeam(input.teamId);
    if (!team) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Sales team not found');
    await this.sales.addTeamMember(input);
    return { ok: true };
  }
}

export class CreateSalesTerritoryUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  execute(input: {
    code: string;
    name: string;
    territoryType?: string;
    country?: string | null;
    region?: string | null;
    productId?: string | null;
    verticalId?: string | null;
    marketId?: string | null;
  }) {
    return this.sales.createTerritory(input);
  }
}

export class ListSalesTerritoriesUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  execute() {
    return this.sales.listTerritories();
  }
}

export class CreateCommercialAccountUseCase {
  constructor(
    private readonly sales: SalesRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    legalName: string;
    tradeName?: string | null;
    accountType?: string;
    country?: string | null;
    region?: string | null;
    city?: string | null;
    addressLine1?: string | null;
    industry?: string | null;
    companySize?: string | null;
    website?: string | null;
    legalIdentifier?: string | null;
    legalIdentifierType?: string | null;
    emailDomain?: string | null;
    phoneNormalized?: string | null;
    parentAccountId?: string | null;
    ownerAdministratorId?: string | null;
    teamId?: string | null;
    primaryProductId?: string | null;
    verticalId?: string | null;
    billingInfo?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    tenantId?: string | null;
    createsTenant?: boolean;
    forceCreateDespiteDuplicates?: boolean;
  }) {
    assertAccountIsNotTenant({
      tenantId: input.tenantId,
      createsTenant: input.createsTenant,
    });
    const nameNormalized = normalizeAccountName(input.legalName);
    const emailDomainNormalized = input.emailDomain
      ? normalizeEmailDomain(input.emailDomain)
      : null;
    const duplicates = await this.sales.findDuplicateCandidates({
      nameNormalized,
      legalIdentifier: input.legalIdentifier,
      emailDomainNormalized,
      phoneNormalized: input.phoneNormalized,
      country: input.country,
    });
    if (duplicates.length > 0 && !input.forceCreateDespiteDuplicates) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'Potential duplicate commercial accounts detected; review candidates or set forceCreateDespiteDuplicates',
        [{ duplicates }],
      );
    }
    const accountNumber = await this.sales.nextAccountNumber();
    const account = await this.sales.createAccount({
      accountNumber,
      legalName: input.legalName.trim(),
      tradeName: input.tradeName,
      accountType: input.accountType,
      country: input.country,
      region: input.region,
      city: input.city,
      addressLine1: input.addressLine1,
      industry: input.industry,
      companySize: input.companySize,
      website: input.website,
      legalIdentifier: input.legalIdentifier,
      legalIdentifierType: input.legalIdentifierType,
      emailDomainNormalized,
      phoneNormalized: input.phoneNormalized,
      parentAccountId: input.parentAccountId,
      ownerAdministratorId: input.ownerAdministratorId,
      teamId: input.teamId,
      primaryProductId: input.primaryProductId,
      verticalId: input.verticalId,
      nameNormalized,
      billingInfo: input.billingInfo,
      metadata: input.metadata,
      createdBy: input.actorId,
    });
    await this.sales.appendTimelineEvent({
      accountId: account.id,
      eventType: 'ACCOUNT_CREATED',
      provenance: 'SALES',
      title: 'Commercial account created',
      actorId: input.actorId,
      metadata: { accountNumber: account.accountNumber },
    });
    if (this.outbox) {
      const event = createCommercialAccountCreatedEvent({
        actorId: input.actorId,
        correlationId: account.id,
        accountId: account.id,
        accountNumber: account.accountNumber,
        legalName: account.legalName,
      });
      await this.outbox.runWithOutbox(EDGE_SALES_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(event);
      });
    }
    return { account, duplicateWarnings: duplicates };
  }
}

export class ListCommercialAccountsUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  execute(opts?: {
    status?: string;
    q?: string;
    ownerAdministratorId?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.sales.listAccounts(opts);
  }
}

export class GetCommercialAccountUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  async execute(id: string) {
    const account = await this.sales.getAccount(id);
    if (!account) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Commercial account not found');
    return account;
  }
}

export class UpdateCommercialAccountUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  async execute(input: {
    actorId: string;
    id: string;
    legalName?: string;
    tradeName?: string | null;
    accountType?: string;
    status?: string;
    country?: string | null;
    region?: string | null;
    city?: string | null;
    addressLine1?: string | null;
    industry?: string | null;
    companySize?: string | null;
    website?: string | null;
    legalIdentifier?: string | null;
    legalIdentifierType?: string | null;
    emailDomain?: string | null;
    phoneNormalized?: string | null;
    parentAccountId?: string | null;
    ownerAdministratorId?: string | null;
    teamId?: string | null;
    primaryProductId?: string | null;
    verticalId?: string | null;
  }) {
    const current = await this.sales.getAccount(input.id);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Commercial account not found');
    if (input.status && input.status !== current.status) {
      assertAccountStatusTransition(current.status, input.status);
    }
    const patch = {
      ...input,
      nameNormalized: input.legalName
        ? normalizeAccountName(input.legalName)
        : undefined,
      emailDomainNormalized: input.emailDomain
        ? normalizeEmailDomain(input.emailDomain)
        : undefined,
    };
    const updated = await this.sales.updateAccount(input.id, patch);
    await this.sales.appendTimelineEvent({
      accountId: updated.id,
      eventType: 'ACCOUNT_UPDATED',
      provenance: 'SALES',
      title: 'Commercial account updated',
      actorId: input.actorId,
    });
    return updated;
  }
}

export class FindDuplicateAccountsUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  execute(input: {
    legalName: string;
    legalIdentifier?: string | null;
    emailDomain?: string | null;
    phoneNormalized?: string | null;
    country?: string | null;
    excludeAccountId?: string | null;
  }) {
    return this.sales.findDuplicateCandidates({
      nameNormalized: normalizeAccountName(input.legalName),
      legalIdentifier: input.legalIdentifier,
      emailDomainNormalized: input.emailDomain
        ? normalizeEmailDomain(input.emailDomain)
        : null,
      phoneNormalized: input.phoneNormalized,
      country: input.country,
      excludeAccountId: input.excludeAccountId,
    });
  }
}

export class MergeCommercialAccountsUseCase {
  constructor(
    private readonly sales: SalesRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    survivingAccountId: string;
    mergedAccountId: string;
    reason: string;
    autoMergeByNameSimilarity?: boolean;
  }) {
    assertControlledMerge(input);
    const correlationId = randomUUID();
    const surviving = await this.sales.mergeAccounts({
      survivingAccountId: input.survivingAccountId,
      mergedAccountId: input.mergedAccountId,
      reason: input.reason,
      actorId: input.actorId,
      correlationId,
    });
    await this.sales.appendTimelineEvent({
      accountId: surviving.id,
      eventType: 'ACCOUNT_MERGED',
      provenance: 'SALES',
      title: 'Accounts merged',
      body: input.reason,
      actorId: input.actorId,
      metadata: { mergedAccountId: input.mergedAccountId },
    });
    if (this.outbox) {
      const event = createCommercialAccountMergedEvent({
        actorId: input.actorId,
        correlationId,
        survivingAccountId: input.survivingAccountId,
        mergedAccountId: input.mergedAccountId,
        reason: input.reason,
      });
      await this.outbox.runWithOutbox(EDGE_SALES_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(event);
      });
    }
    return surviving;
  }
}

export class CreateSalesContactUseCase {
  constructor(
    private readonly sales: SalesRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    accountId: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phoneNormalized?: string | null;
    jobTitle?: string | null;
    department?: string | null;
    stakeholderType?: string;
    influenceLevel?: string;
    communicationPreference?: string | null;
    ownerAdministratorId?: string | null;
    marketingLeadId?: string | null;
  }) {
    const account = await this.sales.getAccount(input.accountId);
    if (!account || account.status === 'MERGED') {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Commercial account not found');
    }
    const contact = await this.sales.createContact({
      accountId: input.accountId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      emailNormalized: input.email?.trim().toLowerCase() ?? null,
      phoneNormalized: input.phoneNormalized,
      jobTitle: input.jobTitle,
      department: input.department,
      stakeholderType: input.stakeholderType,
      influenceLevel: input.influenceLevel,
      communicationPreference: input.communicationPreference,
      ownerAdministratorId: input.ownerAdministratorId,
      marketingLeadId: input.marketingLeadId,
      createdBy: input.actorId,
    });
    await this.sales.appendTimelineEvent({
      accountId: input.accountId,
      contactId: contact.id,
      eventType: 'CONTACT_CREATED',
      provenance: 'SALES',
      title: `Contact created: ${contact.firstName} ${contact.lastName}`,
      actorId: input.actorId,
    });
    if (this.outbox) {
      const event = createSalesContactCreatedEvent({
        actorId: input.actorId,
        correlationId: contact.id,
        contactId: contact.id,
        accountId: contact.accountId,
      });
      await this.outbox.runWithOutbox(EDGE_SALES_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(event);
      });
    }
    return contact;
  }
}

export class ListSalesContactsUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  execute(opts?: { accountId?: string; q?: string; limit?: number; offset?: number }) {
    return this.sales.listContacts(opts);
  }
}

export class GetSalesContactUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  async execute(id: string) {
    const contact = await this.sales.getContact(id);
    if (!contact) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Sales contact not found');
    return contact;
  }
}

export class ReceiveSalesLeadUseCase {
  constructor(
    private readonly sales: SalesRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    marketingLeadId: string;
    ownerAdministratorId?: string | null;
    teamId?: string | null;
    salesPriority?: string;
    slaHours?: number;
  }) {
    const mkt = await this.sales.getMarketingLeadSnapshot(input.marketingLeadId);
    if (!mkt) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Marketing lead not found');
    }
    const slaDueAt =
      input.slaHours != null
        ? new Date(Date.now() + input.slaHours * 3600_000)
        : new Date(Date.now() + 24 * 3600_000);
    const { lead, created } = await this.sales.receiveSalesLead({
      marketingLeadId: input.marketingLeadId,
      productId: mkt.primaryProductId,
      verticalId: mkt.verticalId,
      provenance: {
        marketingLeadId: mkt.id,
        marketingStatus: mkt.status,
        sourceCampaignId: mkt.sourceCampaignId,
        organizationId: mkt.organizationId,
        emailNormalized: mkt.emailNormalized,
        receivedFrom: 'P3',
      },
      ownerAdministratorId: input.ownerAdministratorId,
      teamId: input.teamId,
      salesPriority: input.salesPriority,
      slaDueAt,
      createdBy: input.actorId,
    });
    if (created) {
      await this.sales.appendTimelineEvent({
        salesLeadId: lead.id,
        accountId: lead.accountId,
        eventType: 'SALES_LEAD_RECEIVED',
        provenance: 'SYSTEM',
        title: 'Sales lead received from marketing',
        actorId: input.actorId,
        metadata: { marketingLeadId: mkt.id },
      });
      if (this.outbox) {
        const event = createSalesLeadReceivedEvent({
          actorId: input.actorId,
          correlationId: lead.id,
          salesLeadId: lead.id,
          marketingLeadId: mkt.id,
        });
        await this.outbox.runWithOutbox(EDGE_SALES_OUTBOX_TENANT, async (_c, enqueue) => {
          await enqueue(event);
        });
      }
    }
    return { lead, created };
  }
}

export class ListSalesLeadsUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  execute(opts?: {
    status?: string;
    ownerAdministratorId?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.sales.listSalesLeads(opts);
  }
}

export class GetSalesLeadUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  async execute(id: string) {
    const lead = await this.sales.getSalesLead(id);
    if (!lead) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Sales lead not found');
    return lead;
  }
}

export class AcceptSalesLeadUseCase {
  constructor(
    private readonly sales: SalesRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    salesLeadId: string;
    accountId?: string | null;
    createAccount?: {
      legalName: string;
      country?: string | null;
      emailDomain?: string | null;
      industry?: string | null;
    };
    contact?: {
      firstName: string;
      lastName: string;
      email?: string | null;
      jobTitle?: string | null;
    };
  }) {
    const lead = await this.sales.getSalesLead(input.salesLeadId);
    if (!lead) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Sales lead not found');
    assertSalesLeadStatusTransition(lead.status, SalesLeadStatus.ACCEPTED);

    let accountId = input.accountId ?? lead.accountId;
    if (!accountId && input.createAccount) {
      const created = await new CreateCommercialAccountUseCase(this.sales).execute({
        actorId: input.actorId,
        legalName: input.createAccount.legalName,
        country: input.createAccount.country,
        emailDomain: input.createAccount.emailDomain,
        industry: input.createAccount.industry,
        forceCreateDespiteDuplicates: true,
      });
      accountId = created.account.id;
    }

    let contactId = lead.contactId;
    if (accountId && input.contact && !contactId) {
      const contact = await this.sales.createContact({
        accountId,
        firstName: input.contact.firstName,
        lastName: input.contact.lastName,
        emailNormalized: input.contact.email?.trim().toLowerCase() ?? null,
        jobTitle: input.contact.jobTitle,
        marketingLeadId: lead.marketingLeadId,
        createdBy: input.actorId,
      });
      contactId = contact.id;
    }

    const updated = await this.sales.transitionSalesLead({
      id: lead.id,
      toStatus: SalesLeadStatus.ACCEPTED,
      decisionType: 'ACCEPT',
      actorId: input.actorId,
      correlationId: lead.id,
      accountId,
      contactId,
    });
    await this.sales.appendTimelineEvent({
      accountId: updated.accountId,
      salesLeadId: updated.id,
      contactId: updated.contactId,
      eventType: 'SALES_LEAD_ACCEPTED',
      provenance: 'SALES',
      title: 'Sales lead accepted',
      actorId: input.actorId,
    });
    if (this.outbox) {
      const event = createSalesLeadAcceptedEvent({
        actorId: input.actorId,
        correlationId: updated.id,
        salesLeadId: updated.id,
        marketingLeadId: updated.marketingLeadId,
        accountId: updated.accountId,
      });
      await this.outbox.runWithOutbox(EDGE_SALES_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(event);
      });
    }
    return updated;
  }
}

export class RejectSalesLeadUseCase {
  constructor(
    private readonly sales: SalesRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    salesLeadId: string;
    reasonCode?: string | null;
    reasonText?: string | null;
  }) {
    const lead = await this.sales.getSalesLead(input.salesLeadId);
    if (!lead) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Sales lead not found');
    assertSalesLeadStatusTransition(lead.status, SalesLeadStatus.REJECTED);
    assertRejectionRequiresReason({
      toStatus: SalesLeadStatus.REJECTED,
      reasonCode: input.reasonCode,
      reasonText: input.reasonText,
    });
    const updated = await this.sales.transitionSalesLead({
      id: lead.id,
      toStatus: SalesLeadStatus.REJECTED,
      decisionType: 'REJECT',
      reasonCode: input.reasonCode,
      reasonText: input.reasonText,
      actorId: input.actorId,
      correlationId: lead.id,
    });
    await this.sales.appendTimelineEvent({
      accountId: updated.accountId,
      salesLeadId: updated.id,
      eventType: 'SALES_LEAD_REJECTED',
      provenance: 'SALES',
      title: 'Sales lead rejected',
      body: input.reasonText ?? input.reasonCode ?? null,
      actorId: input.actorId,
    });
    if (this.outbox) {
      const event = createSalesLeadRejectedEvent({
        actorId: input.actorId,
        correlationId: updated.id,
        salesLeadId: updated.id,
        marketingLeadId: updated.marketingLeadId,
        reasonCode: input.reasonCode ?? null,
      });
      await this.outbox.runWithOutbox(EDGE_SALES_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(event);
      });
    }
    return updated;
  }
}

export class QualifySalesLeadUseCase {
  constructor(
    private readonly sales: SalesRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    salesLeadId: string;
    needConfirmed: boolean;
    productFit: boolean;
    decisionCapacity: boolean;
    budgetIndicative?: string | null;
    decisionTimeline?: string | null;
    projectMaturity?: string | null;
    technicalConstraints?: string | null;
    geographicScope?: string | null;
    salesDecisionBasedOnlyOnMarketingScore?: boolean;
  }) {
    const lead = await this.sales.getSalesLead(input.salesLeadId);
    if (!lead) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Sales lead not found');
    assertSalesLeadStatusTransition(lead.status, SalesLeadStatus.SALES_QUALIFIED);
    assertQualificationDecision(input);
    assertSalesDecisionIndependentOfMarketingScore({
      marketingScore: lead.marketingScore ? Number(lead.marketingScore) : null,
      salesDecisionBasedOnlyOnMarketingScore:
        input.salesDecisionBasedOnlyOnMarketingScore,
    });
    const qualification = {
      needConfirmed: input.needConfirmed,
      productFit: input.productFit,
      decisionCapacity: input.decisionCapacity,
      budgetIndicative: input.budgetIndicative ?? null,
      decisionTimeline: input.decisionTimeline ?? null,
      projectMaturity: input.projectMaturity ?? null,
      technicalConstraints: input.technicalConstraints ?? null,
      geographicScope: input.geographicScope ?? null,
      qualifiedAt: new Date().toISOString(),
      qualifiedBy: input.actorId,
    };
    const updated = await this.sales.transitionSalesLead({
      id: lead.id,
      toStatus: SalesLeadStatus.SALES_QUALIFIED,
      decisionType: 'QUALIFY',
      actorId: input.actorId,
      correlationId: lead.id,
      qualification,
    });
    await this.sales.appendTimelineEvent({
      accountId: updated.accountId,
      salesLeadId: updated.id,
      eventType: 'SALES_LEAD_QUALIFIED',
      provenance: 'SALES',
      title: 'Sales qualification completed',
      actorId: input.actorId,
      metadata: qualification,
    });
    if (this.outbox) {
      const event = createSalesLeadQualifiedEvent({
        actorId: input.actorId,
        correlationId: updated.id,
        salesLeadId: updated.id,
        marketingLeadId: updated.marketingLeadId,
      });
      await this.outbox.runWithOutbox(EDGE_SALES_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(event);
      });
    }
    return updated;
  }
}

export class AssignSalesLeadUseCase {
  constructor(
    private readonly sales: SalesRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    salesLeadId: string;
    ownerAdministratorId: string;
    teamId?: string | null;
  }) {
    const lead = await this.sales.getSalesLead(input.salesLeadId);
    if (!lead) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Sales lead not found');
    const nextStatus =
      lead.status === SalesLeadStatus.RECEIVED
        ? SalesLeadStatus.PENDING_REVIEW
        : lead.status;
    if (nextStatus !== lead.status) {
      assertSalesLeadStatusTransition(lead.status, nextStatus);
    }
    const updated = await this.sales.transitionSalesLead({
      id: lead.id,
      toStatus: nextStatus,
      decisionType: 'ASSIGN',
      actorId: input.actorId,
      correlationId: lead.id,
      ownerAdministratorId: input.ownerAdministratorId,
      teamId: input.teamId,
    });
    if (this.outbox) {
      const event = createSalesLeadAssignedEvent({
        actorId: input.actorId,
        correlationId: updated.id,
        salesLeadId: updated.id,
        ownerAdministratorId: input.ownerAdministratorId,
      });
      await this.outbox.runWithOutbox(EDGE_SALES_OUTBOX_TENANT, async (_c, enqueue) => {
        await enqueue(event);
      });
    }
    return updated;
  }
}

export class ListAccountTimelineUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  execute(accountId: string, limit?: number) {
    return this.sales.listTimeline({ accountId, limit });
  }
}

export class CreateSalesNoteUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  execute(input: {
    actorId: string;
    accountId?: string | null;
    contactId?: string | null;
    salesLeadId?: string | null;
    body: string;
    visibility?: string;
  }) {
    return this.sales.createNote({
      accountId: input.accountId,
      contactId: input.contactId,
      salesLeadId: input.salesLeadId,
      body: input.body,
      visibility: input.visibility,
      authorId: input.actorId,
    });
  }
}

export class CreateSalesTaskUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  execute(input: {
    actorId: string;
    accountId?: string | null;
    contactId?: string | null;
    salesLeadId?: string | null;
    title: string;
    description?: string | null;
    priority?: string;
    dueAt?: string | null;
    assigneeId?: string | null;
  }) {
    return this.sales.createTask({
      accountId: input.accountId,
      contactId: input.contactId,
      salesLeadId: input.salesLeadId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      assigneeId: input.assigneeId,
      createdBy: input.actorId,
    });
  }
}

export class ListSalesTasksUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  execute(opts?: { accountId?: string; assigneeId?: string; status?: string }) {
    return this.sales.listTasks(opts);
  }
}

export class CompleteSalesTaskUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  execute(id: string) {
    return this.sales.completeTask(id);
  }
}

export class SalesOverviewUseCase {
  constructor(private readonly sales: SalesRepositoryPort) {}
  async execute() {
    const [accounts, leads, tasks] = await Promise.all([
      this.sales.listAccounts({ limit: 1 }),
      this.sales.listSalesLeads({ limit: 1 }),
      this.sales.listTasks({ status: 'OPEN' }),
    ]);
    const pending = await this.sales.listSalesLeads({
      status: SalesLeadStatus.RECEIVED,
      limit: 1,
    });
    const pendingReview = await this.sales.listSalesLeads({
      status: SalesLeadStatus.PENDING_REVIEW,
      limit: 1,
    });
    return {
      accountsTotal: accounts.total,
      leadsTotal: leads.total,
      openTasks: tasks.length,
      inboxPending: pending.total + pendingReview.total,
      note: 'Pipeline/forecast metrics unavailable until opportunity aggregates ship',
      dataQuality: 'PARTIAL' as const,
    };
  }
}

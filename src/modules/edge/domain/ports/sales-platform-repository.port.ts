export const SALES_PLATFORM_REPOSITORY_PORT = Symbol('SALES_PLATFORM_REPOSITORY_PORT');

export type AccountRelationship = {
  readonly id: string;
  readonly fromAccountId: string;
  readonly toAccountId: string;
  readonly relationshipType: string;
  readonly notes: string | null;
  readonly createdAt: Date;
};

export type ContactRole = {
  readonly id: string;
  readonly contactId: string;
  readonly accountId: string;
  readonly roleType: string;
  readonly isPrimary: boolean;
  readonly effectiveFrom: Date;
  readonly effectiveUntil: Date | null;
};

export type DiscoveryQuestionnaire = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly verticalId: string | null;
  readonly productId: string | null;
  readonly status: string;
  readonly questions: unknown[];
};

export type ContractAmendment = {
  readonly id: string;
  readonly contractId: string;
  readonly amendmentNumber: string;
  readonly status: string;
  readonly summary: string;
  readonly changes: Record<string, unknown>;
  readonly executedAt: Date | null;
  readonly createdAt: Date;
};

export type SavedView = {
  readonly id: string;
  readonly name: string;
  readonly scope: string;
  readonly entityType: string;
  readonly ownerAdministratorId: string | null;
  readonly teamId: string | null;
  readonly filters: Record<string, unknown>;
  readonly columns: unknown[];
  readonly sortSpec: unknown[];
  readonly isDefault: boolean;
};

export type SalesExportJob = {
  readonly id: string;
  readonly entityType: string;
  readonly status: string;
  readonly requestedBy: string;
  readonly rowCount: number;
  readonly format: string;
  readonly payload: unknown[];
  readonly denialReason: string | null;
  readonly createdAt: Date;
};

export type GlobalSearchHit = {
  readonly entityType: string;
  readonly id: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly status: string | null;
};

export interface SalesPlatformRepositoryPort {
  listAccountRelationships(accountId: string): Promise<AccountRelationship[]>;
  addAccountRelationship(input: {
    fromAccountId: string;
    toAccountId: string;
    relationshipType: string;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<AccountRelationship>;
  getAccountHierarchy(accountId: string): Promise<{
    accountId: string;
    parentAccountId: string | null;
    children: { id: string; legalName: string; accountType: string }[];
    relationships: AccountRelationship[];
  }>;

  addContactRole(input: {
    contactId: string;
    accountId: string;
    roleType: string;
    isPrimary?: boolean;
    effectiveUntil?: string | null;
  }): Promise<ContactRole>;
  listContactRoles(contactId: string): Promise<ContactRole[]>;

  upsertDiscoveryQuestionnaire(input: {
    code: string;
    name: string;
    verticalId?: string | null;
    productId?: string | null;
    questions: unknown[];
    status?: string;
  }): Promise<DiscoveryQuestionnaire>;
  listDiscoveryQuestionnaires(opts?: {
    verticalId?: string;
    productId?: string;
  }): Promise<DiscoveryQuestionnaire[]>;
  getDiscoveryQuestionnaire(id: string): Promise<DiscoveryQuestionnaire | null>;

  createContractAmendment(input: {
    contractId: string;
    amendmentNumber: string;
    summary: string;
    changes?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<ContractAmendment>;
  listContractAmendments(contractId: string): Promise<ContractAmendment[]>;
  executeContractAmendment(id: string): Promise<ContractAmendment>;

  replaceOrderLines(
    orderId: string,
    lines: Array<{
      lineNumber: number;
      description: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      productId?: string | null;
      planId?: string | null;
      packageId?: string | null;
      addonId?: string | null;
      p2Refs?: Record<string, unknown>;
    }>,
  ): Promise<void>;
  listOrderLines(orderId: string): Promise<
    {
      id: string;
      lineNumber: number;
      description: string;
      quantity: string;
      unitPrice: string;
      lineTotal: string;
    }[]
  >;

  saveForecastSnapshot(input: {
    periodType: string;
    periodKey: string;
    scopeType: string;
    scopeId?: string | null;
    model: string;
    currency: string;
    amount: number;
    opportunityCount: number;
    assumptions: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<{ id: string; version: number }>;
  listForecastSnapshots(opts?: {
    periodType?: string;
    periodKey?: string;
    model?: string;
  }): Promise<
    {
      id: string;
      periodType: string;
      periodKey: string;
      model: string;
      amount: string;
      opportunityCount: number;
      version: number;
      assumptions: Record<string, unknown>;
      createdAt: Date;
    }[]
  >;

  createSavedView(input: {
    name: string;
    scope: string;
    entityType: string;
    ownerAdministratorId?: string | null;
    teamId?: string | null;
    filters?: Record<string, unknown>;
    columns?: unknown[];
    sortSpec?: unknown[];
    isDefault?: boolean;
  }): Promise<SavedView>;
  listSavedViews(opts: {
    actorId: string;
    entityType?: string;
    teamIds?: string[];
  }): Promise<SavedView[]>;
  deleteSavedView(id: string, actorId: string): Promise<void>;

  createExportJob(input: {
    entityType: string;
    status: string;
    requestedBy: string;
    filters?: Record<string, unknown>;
    rowCount: number;
    format: string;
    payload: unknown[];
    denialReason?: string | null;
    correlationId?: string | null;
  }): Promise<SalesExportJob>;
  listExportJobs(actorId: string, limit?: number): Promise<SalesExportJob[]>;

  globalSearch(input: {
    q: string;
    limit?: number;
    actorId?: string;
    visibilityMode?: 'OWNED' | 'TEAM' | 'ALL';
    teamIds?: string[];
  }): Promise<GlobalSearchHit[]>;

  findIdempotentResponse(
    idempotencyKey: string,
    routeKey: string,
  ): Promise<{ responseStatus: number; responseBody: Record<string, unknown> } | null>;
  saveIdempotentResponse(input: {
    idempotencyKey: string;
    routeKey: string;
    actorId?: string | null;
    responseStatus?: number;
    responseBody: Record<string, unknown>;
  }): Promise<void>;

  grantVisibility(input: {
    subjectType: string;
    subjectId: string;
    granteeAdministratorId?: string | null;
    granteeTeamId?: string | null;
    accessLevel?: string;
    grantedBy?: string | null;
  }): Promise<void>;
  listVisibilityGrants(subjectType: string, subjectId: string): Promise<
    {
      id: string;
      granteeAdministratorId: string | null;
      granteeTeamId: string | null;
      accessLevel: string;
    }[]
  >;
  canAccessSubject(input: {
    subjectType: string;
    subjectId: string;
    actorId: string;
    teamIds: string[];
    ownerAdministratorId?: string | null;
    isElevated?: boolean;
  }): Promise<boolean>;

  recordCalendarSyncEvent(input: {
    activityId: string;
    provider: string;
    outcome: string;
    externalRef?: string | null;
    failureMessage?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<void>;

  updateProposalDocumentRef(proposalId: string, documentRef: string): Promise<void>;
}

export const SALES_REPOSITORY_PORT = Symbol('SALES_REPOSITORY_PORT');

export type SalesTeam = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly managerAdministratorId: string | null;
  readonly status: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type SalesTerritory = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly territoryType: string;
  readonly country: string | null;
  readonly region: string | null;
  readonly productId: string | null;
  readonly verticalId: string | null;
  readonly marketId: string | null;
  readonly status: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type CommercialAccount = {
  readonly id: string;
  readonly accountNumber: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly accountType: string;
  readonly status: string;
  readonly country: string | null;
  readonly region: string | null;
  readonly city: string | null;
  readonly addressLine1: string | null;
  readonly industry: string | null;
  readonly companySize: string | null;
  readonly website: string | null;
  readonly legalIdentifier: string | null;
  readonly legalIdentifierType: string | null;
  readonly emailDomainNormalized: string | null;
  readonly phoneNormalized: string | null;
  readonly parentAccountId: string | null;
  readonly ownerAdministratorId: string | null;
  readonly teamId: string | null;
  readonly primaryProductId: string | null;
  readonly verticalId: string | null;
  readonly mergedIntoAccountId: string | null;
  readonly nameNormalized: string;
  readonly billingInfo: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type SalesContact = {
  readonly id: string;
  readonly accountId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly emailNormalized: string | null;
  readonly phoneNormalized: string | null;
  readonly jobTitle: string | null;
  readonly department: string | null;
  readonly stakeholderType: string;
  readonly influenceLevel: string;
  readonly communicationPreference: string | null;
  readonly status: string;
  readonly ownerAdministratorId: string | null;
  readonly marketingLeadId: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type SalesLead = {
  readonly id: string;
  readonly marketingLeadId: string;
  readonly status: string;
  readonly accountId: string | null;
  readonly contactId: string | null;
  readonly ownerAdministratorId: string | null;
  readonly teamId: string | null;
  readonly productId: string | null;
  readonly verticalId: string | null;
  readonly marketingScore: string | null;
  readonly salesPriority: string;
  readonly rejectionReasonCode: string | null;
  readonly rejectionReasonText: string | null;
  readonly qualification: Record<string, unknown>;
  readonly provenance: Record<string, unknown>;
  readonly receivedAt: Date;
  readonly reviewedAt: Date | null;
  readonly acceptedAt: Date | null;
  readonly qualifiedAt: Date | null;
  readonly slaDueAt: Date | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type SalesNote = {
  readonly id: string;
  readonly accountId: string | null;
  readonly contactId: string | null;
  readonly salesLeadId: string | null;
  readonly body: string;
  readonly visibility: string;
  readonly authorId: string | null;
  readonly createdAt: Date;
};

export type SalesTimelineEvent = {
  readonly id: string;
  readonly accountId: string | null;
  readonly contactId: string | null;
  readonly salesLeadId: string | null;
  readonly eventType: string;
  readonly provenance: string;
  readonly title: string;
  readonly body: string | null;
  readonly actorId: string | null;
  readonly occurredAt: Date;
  readonly metadata: Record<string, unknown>;
};

export type SalesTask = {
  readonly id: string;
  readonly accountId: string | null;
  readonly contactId: string | null;
  readonly salesLeadId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly status: string;
  readonly priority: string;
  readonly dueAt: Date | null;
  readonly assigneeId: string | null;
  readonly createdBy: string | null;
  readonly completedAt: Date | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type DuplicateAccountCandidate = {
  readonly account: CommercialAccount;
  readonly matchReasons: string[];
};

export interface SalesRepositoryPort {
  createTeam(input: {
    code: string;
    name: string;
    description?: string | null;
    managerAdministratorId?: string | null;
    createdBy?: string | null;
  }): Promise<SalesTeam>;
  listTeams(): Promise<SalesTeam[]>;
  getTeam(id: string): Promise<SalesTeam | null>;
  addTeamMember(input: {
    teamId: string;
    administratorId: string;
    memberRole?: string;
    territoryId?: string | null;
  }): Promise<void>;

  createTerritory(input: {
    code: string;
    name: string;
    territoryType?: string;
    country?: string | null;
    region?: string | null;
    productId?: string | null;
    verticalId?: string | null;
    marketId?: string | null;
  }): Promise<SalesTerritory>;
  listTerritories(): Promise<SalesTerritory[]>;

  nextAccountNumber(): Promise<string>;
  createAccount(input: {
    accountNumber: string;
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
    emailDomainNormalized?: string | null;
    phoneNormalized?: string | null;
    parentAccountId?: string | null;
    ownerAdministratorId?: string | null;
    teamId?: string | null;
    primaryProductId?: string | null;
    verticalId?: string | null;
    nameNormalized: string;
    billingInfo?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<CommercialAccount>;
  updateAccount(
    id: string,
    patch: Partial<{
      legalName: string;
      tradeName: string | null;
      accountType: string;
      status: string;
      country: string | null;
      region: string | null;
      city: string | null;
      addressLine1: string | null;
      industry: string | null;
      companySize: string | null;
      website: string | null;
      legalIdentifier: string | null;
      legalIdentifierType: string | null;
      emailDomainNormalized: string | null;
      phoneNormalized: string | null;
      parentAccountId: string | null;
      ownerAdministratorId: string | null;
      teamId: string | null;
      primaryProductId: string | null;
      verticalId: string | null;
      nameNormalized: string;
      billingInfo: Record<string, unknown>;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<CommercialAccount>;
  getAccount(id: string): Promise<CommercialAccount | null>;
  listAccounts(opts?: {
    status?: string;
    q?: string;
    ownerAdministratorId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: CommercialAccount[]; total: number }>;
  findDuplicateCandidates(input: {
    nameNormalized: string;
    legalIdentifier?: string | null;
    emailDomainNormalized?: string | null;
    phoneNormalized?: string | null;
    country?: string | null;
    excludeAccountId?: string | null;
  }): Promise<DuplicateAccountCandidate[]>;
  mergeAccounts(input: {
    survivingAccountId: string;
    mergedAccountId: string;
    reason: string;
    actorId?: string | null;
    correlationId?: string | null;
  }): Promise<CommercialAccount>;
  addAccountRelationship(input: {
    fromAccountId: string;
    toAccountId: string;
    relationshipType: string;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<void>;

  createContact(input: {
    accountId: string;
    firstName: string;
    lastName: string;
    emailNormalized?: string | null;
    phoneNormalized?: string | null;
    jobTitle?: string | null;
    department?: string | null;
    stakeholderType?: string;
    influenceLevel?: string;
    communicationPreference?: string | null;
    ownerAdministratorId?: string | null;
    marketingLeadId?: string | null;
    metadata?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<SalesContact>;
  updateContact(
    id: string,
    patch: Partial<{
      firstName: string;
      lastName: string;
      emailNormalized: string | null;
      phoneNormalized: string | null;
      jobTitle: string | null;
      department: string | null;
      stakeholderType: string;
      influenceLevel: string;
      communicationPreference: string | null;
      status: string;
      ownerAdministratorId: string | null;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<SalesContact>;
  getContact(id: string): Promise<SalesContact | null>;
  listContacts(opts?: {
    accountId?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: SalesContact[]; total: number }>;

  receiveSalesLead(input: {
    marketingLeadId: string;
    productId?: string | null;
    verticalId?: string | null;
    marketingScore?: number | null;
    provenance?: Record<string, unknown>;
    ownerAdministratorId?: string | null;
    teamId?: string | null;
    salesPriority?: string;
    slaDueAt?: Date | null;
    createdBy?: string | null;
  }): Promise<{ lead: SalesLead; created: boolean }>;
  getSalesLead(id: string): Promise<SalesLead | null>;
  getSalesLeadByMarketingId(marketingLeadId: string): Promise<SalesLead | null>;
  listSalesLeads(opts?: {
    status?: string;
    ownerAdministratorId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: SalesLead[]; total: number }>;
  transitionSalesLead(input: {
    id: string;
    toStatus: string;
    decisionType: string;
    reasonCode?: string | null;
    reasonText?: string | null;
    actorId?: string | null;
    correlationId?: string | null;
    accountId?: string | null;
    contactId?: string | null;
    ownerAdministratorId?: string | null;
    teamId?: string | null;
    qualification?: Record<string, unknown>;
    payload?: Record<string, unknown>;
  }): Promise<SalesLead>;

  createNote(input: {
    accountId?: string | null;
    contactId?: string | null;
    salesLeadId?: string | null;
    body: string;
    visibility?: string;
    authorId?: string | null;
  }): Promise<SalesNote>;
  listNotes(opts: {
    accountId?: string;
    contactId?: string;
    salesLeadId?: string;
  }): Promise<SalesNote[]>;

  appendTimelineEvent(input: {
    accountId?: string | null;
    contactId?: string | null;
    salesLeadId?: string | null;
    eventType: string;
    provenance?: string;
    title: string;
    body?: string | null;
    actorId?: string | null;
    occurredAt?: Date;
    metadata?: Record<string, unknown>;
  }): Promise<SalesTimelineEvent>;
  listTimeline(opts: {
    accountId?: string;
    limit?: number;
  }): Promise<SalesTimelineEvent[]>;

  createTask(input: {
    accountId?: string | null;
    contactId?: string | null;
    salesLeadId?: string | null;
    title: string;
    description?: string | null;
    priority?: string;
    dueAt?: Date | null;
    assigneeId?: string | null;
    createdBy?: string | null;
  }): Promise<SalesTask>;
  listTasks(opts?: {
    accountId?: string;
    assigneeId?: string;
    status?: string;
  }): Promise<SalesTask[]>;
  completeTask(id: string): Promise<SalesTask>;

  /** Lightweight marketing lead read for bridge validation. */
  getMarketingLeadSnapshot(marketingLeadId: string): Promise<{
    id: string;
    status: string;
    emailNormalized: string | null;
    primaryProductId: string | null;
    verticalId: string | null;
    sourceCampaignId: string | null;
    organizationId: string | null;
    metadata: Record<string, unknown>;
  } | null>;

  getDefaultPipeline(): Promise<SalesPipeline | null>;
  listPipelines(): Promise<SalesPipeline[]>;
  listPipelineStages(pipelineId: string): Promise<SalesPipelineStage[]>;
  getPipelineStage(stageId: string): Promise<SalesPipelineStage | null>;
  listAllowedTransitionTargets(
    pipelineId: string,
    fromStageId: string,
  ): Promise<string[]>;

  nextOpportunityNumber(): Promise<string>;
  createOpportunity(input: {
    opportunityNumber: string;
    name: string;
    accountId: string;
    salesLeadId?: string | null;
    pipelineId: string;
    stageId: string;
    ownerAdministratorId?: string | null;
    teamId?: string | null;
    productId?: string | null;
    verticalId?: string | null;
    marketId?: string | null;
    needSummary?: string | null;
    scopeSummary?: string | null;
    estimatedValue?: number | null;
    currency?: string;
    probability?: number | null;
    expectedCloseDate?: string | null;
    source?: string | null;
    forecastCategory?: string;
    metadata?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<SalesOpportunity>;
  getOpportunity(id: string): Promise<SalesOpportunity | null>;
  listOpportunities(opts?: {
    status?: string;
    accountId?: string;
    pipelineId?: string;
    stageId?: string;
    ownerAdministratorId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: SalesOpportunity[]; total: number }>;
  updateOpportunity(
    id: string,
    patch: Partial<{
      name: string;
      ownerAdministratorId: string | null;
      teamId: string | null;
      productId: string | null;
      verticalId: string | null;
      needSummary: string | null;
      scopeSummary: string | null;
      estimatedValue: number | null;
      currency: string;
      probability: number | null;
      expectedCloseDate: string | null;
      forecastCategory: string;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<SalesOpportunity>;
  transitionOpportunityStage(input: {
    opportunityId: string;
    toStageId: string;
    toStatus: string;
    reasonCode?: string | null;
    reasonText?: string | null;
    actorId?: string | null;
    correlationId?: string | null;
    probability?: number | null;
  }): Promise<SalesOpportunity>;
  reopenOpportunity(input: {
    opportunityId: string;
    stageId: string;
    reason: string;
    actorId?: string | null;
  }): Promise<SalesOpportunity>;
  addOpportunityContact(input: {
    opportunityId: string;
    contactId: string;
    roleOnOpportunity?: string;
    isPrimary?: boolean;
  }): Promise<void>;
  addOpportunityRisk(input: {
    opportunityId: string;
    code: string;
    title: string;
    severity?: string;
    description?: string | null;
  }): Promise<SalesOpportunityRisk>;
  listOpportunityRisks(opportunityId: string): Promise<SalesOpportunityRisk[]>;
  addOpportunityCompetitor(input: {
    opportunityId: string;
    competitorName: string;
    threatLevel?: string;
    notes?: string | null;
  }): Promise<SalesOpportunityCompetitor>;
  listOpportunityCompetitors(
    opportunityId: string,
  ): Promise<SalesOpportunityCompetitor[]>;
  listOpportunityStageHistory(
    opportunityId: string,
  ): Promise<SalesOpportunityStageHistory[]>;
  pipelineBoard(pipelineId: string): Promise<
    {
      stage: SalesPipelineStage;
      opportunities: SalesOpportunity[];
    }[]
  >;
}

export type SalesPipeline = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly scopeType: string;
  readonly productId: string | null;
  readonly verticalId: string | null;
  readonly teamId: string | null;
  readonly marketId: string | null;
  readonly status: string;
  readonly isDefault: boolean;
  readonly version: number;
  readonly metadata: Record<string, unknown>;
};

export type SalesPipelineStage = {
  readonly id: string;
  readonly pipelineId: string;
  readonly code: string;
  readonly name: string;
  readonly position: number;
  readonly stageKind: string;
  readonly requiredFields: unknown[];
  readonly referenceProbability: string;
  readonly targetDurationDays: number | null;
};

export type SalesOpportunity = {
  readonly id: string;
  readonly opportunityNumber: string;
  readonly name: string;
  readonly accountId: string;
  readonly salesLeadId: string | null;
  readonly pipelineId: string;
  readonly stageId: string;
  readonly status: string;
  readonly ownerAdministratorId: string | null;
  readonly teamId: string | null;
  readonly productId: string | null;
  readonly verticalId: string | null;
  readonly marketId: string | null;
  readonly needSummary: string | null;
  readonly scopeSummary: string | null;
  readonly estimatedValue: string | null;
  readonly currency: string;
  readonly probability: string | null;
  readonly expectedCloseDate: string | null;
  readonly source: string | null;
  readonly lossReasonCode: string | null;
  readonly lossReasonText: string | null;
  readonly forecastCategory: string;
  readonly reopenCount: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type SalesOpportunityRisk = {
  readonly id: string;
  readonly opportunityId: string;
  readonly code: string;
  readonly title: string;
  readonly severity: string;
  readonly status: string;
  readonly description: string | null;
};

export type SalesOpportunityCompetitor = {
  readonly id: string;
  readonly opportunityId: string;
  readonly competitorName: string;
  readonly threatLevel: string;
  readonly notes: string | null;
};

export type SalesOpportunityStageHistory = {
  readonly id: string;
  readonly opportunityId: string;
  readonly fromStageId: string | null;
  readonly toStageId: string;
  readonly fromStatus: string | null;
  readonly toStatus: string | null;
  readonly reasonCode: string | null;
  readonly reasonText: string | null;
  readonly createdAt: Date;
};

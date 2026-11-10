export const BILLING_REPOSITORY_PORT = Symbol('BILLING_REPOSITORY_PORT');

export type BillingAccount = {
  id: string;
  accountNumber: string;
  commercialAccountId: string;
  status: string;
  currency: string;
  paymentTermsDays: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
};

export type BillingProfile = {
  id: string;
  billingAccountId: string;
  version: number;
  legalName: string;
  tradeName?: string | null;
  country?: string | null;
  currency: string;
  paymentTermsDays: number;
  isCurrent: boolean;
  snapshot: Record<string, unknown>;
  validFrom: Date;
  createdAt: Date;
};

export type BillingSchedule = {
  id: string;
  subscriptionId: string;
  billingAccountId: string;
  frequency: string;
  nextBillAt?: Date | null;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type BillingPeriod = {
  id: string;
  subscriptionId: string;
  billingAccountId: string;
  periodNumber: number;
  startsAt: Date;
  endsAt: Date;
  billAt?: Date | null;
  dueAt?: Date | null;
  currency: string;
  status: string;
  snapshot: Record<string, unknown>;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  billingAccountId: string;
  subscriptionId?: string | null;
  periodId?: string | null;
  status: string;
  currency: string;
  issueAt?: Date | null;
  dueAt?: Date | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  profileSnapshot: Record<string, unknown>;
  commercialSnapshot: Record<string, unknown>;
  taxSnapshot: Record<string, unknown>;
  issuedDocumentRef?: string | null;
  correlationId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
};

export type InvoiceLine = {
  id: string;
  invoiceId: string;
  lineNumber: number;
  description: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxableAmount: string;
  taxRate?: string | null;
  taxAmount: string;
  lineTotal: string;
  productRef?: string | null;
  planRef?: string | null;
  metadata: Record<string, unknown>;
};

export type InvoiceTaxLine = {
  id: string;
  invoiceId: string;
  jurisdictionCode: string;
  category: string;
  rate: string;
  taxableAmount: string;
  taxAmount: string;
};

export type PaymentIntent = {
  id: string;
  billingAccountId: string;
  invoiceId?: string | null;
  amount: string;
  currency: string;
  status: string;
  provider: string;
  providerIntentRef?: string | null;
  correlationId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentAttempt = {
  id: string;
  intentId: string;
  attemptNumber: number;
  status: string;
  providerRef?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  rawResponse: Record<string, unknown>;
  createdAt: Date;
};

export type PaymentAllocation = {
  id: string;
  paymentIntentId: string;
  invoiceId: string;
  amount: string;
  currency: string;
  allocatedAt: Date;
};

export type Refund = {
  id: string;
  paymentIntentId: string;
  invoiceId?: string | null;
  amount: string;
  currency: string;
  status: string;
  reason?: string | null;
  providerRef?: string | null;
  approvedBy?: string | null;
  correlationId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CollectionCase = {
  id: string;
  billingAccountId: string;
  invoiceId: string;
  status: string;
  overdueSince?: Date | null;
  nextActionAt?: Date | null;
  policyCode?: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type DunningAttempt = {
  id: string;
  caseId: string;
  channel: string;
  templateRef?: string | null;
  status: string;
  createdAt: Date;
};

export type JournalEntry = {
  id: string;
  entryType: string;
  referenceType: string;
  referenceId: string;
  billingAccountId: string;
  currency: string;
  amount: string;
  direction: 'DEBIT' | 'CREDIT';
  description?: string | null;
  correlationId?: string | null;
  actorId?: string | null;
  createdAt: Date;
};

export type PaymentWebhookEvent = {
  id: string;
  provider: string;
  providerEventId: string;
  signatureValid: boolean;
  payload: Record<string, unknown>;
  processingStatus: string;
  correlationId?: string | null;
  receivedAt: Date;
  processedAt?: Date | null;
};

export type BillingOverview = {
  accounts: number;
  openInvoices: number;
  issuedUnpaidTotal: string;
  collectedTotal: string;
  refundedTotal: string;
  recognizedRevenue: string | null;
  recognitionMethod: string;
  disclaimer: string;
};

export type BillingAnalytics = {
  billedTotal: string;
  collectedTotal: string;
  refundedTotal: string;
  recognizedRevenue: string | null;
  recognitionMethod: string;
  currency: string;
  disclaimer: string;
};

export type RevenuePolicy = {
  id: string;
  code: string;
  method: string;
  rules: Record<string, unknown>;
  status: string;
  version: number;
};

export type FinancialExportBatch = {
  id: string;
  exportType: string;
  status: string;
  currency?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  itemCount: number;
  checksumSha256?: string | null;
  artifactRef?: string | null;
  summary: Record<string, unknown>;
  createdAt: Date;
};

export type BillingParty = {
  id: string;
  billingAccountId: string;
  partyRole: string;
  legalName: string;
  taxId?: string | null;
  country?: string | null;
  address: Record<string, unknown>;
  email?: string | null;
  status: string;
  createdAt: Date;
};

export type TaxJurisdiction = {
  id: string;
  code: string;
  name: string;
  country?: string | null;
  rules: Record<string, unknown>;
  status: string;
};

export type TaxRate = {
  id: string;
  jurisdictionId: string;
  category: string;
  rate: string;
  validFrom: Date;
  validUntil?: Date | null;
  version: number;
};

export type CreditNote = {
  id: string;
  creditNoteNumber: string;
  invoiceId?: string | null;
  billingAccountId: string;
  status: string;
  currency: string;
  total: string;
  reason?: string | null;
  snapshot: Record<string, unknown>;
  createdAt: Date;
};

export type InvoiceDocument = {
  id: string;
  invoiceId: string;
  documentType: string;
  storageRef: string;
  contentSha256?: string | null;
  issuedAt: Date;
  immutable: boolean;
};

export type BillingPolicy = {
  id: string;
  code: string;
  policyType: string;
  rules: Record<string, unknown>;
  status: string;
};

export type ReconciliationRun = {
  id: string;
  provider: string;
  status: string;
  startedAt: Date;
  completedAt?: Date | null;
  summary: Record<string, unknown>;
};

export type ReconciliationException = {
  id: string;
  runId: string;
  status: string;
  exceptionType: string;
  internalRef?: string | null;
  providerRef?: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
  resolvedAt?: Date | null;
};

export type ProviderTransaction = {
  id: string;
  provider: string;
  providerTxnId: string;
  paymentIntentId?: string | null;
  amount: string;
  currency: string;
  status: string;
  fees: string;
  occurredAt: Date;
};

export type SettlementBatch = {
  id: string;
  provider: string;
  merchantAccount?: string | null;
  settlementDate: string;
  grossAmount: string;
  fees: string;
  refunds: string;
  chargebacks: string;
  netAmount: string;
  currency: string;
  bankReference?: string | null;
  status: string;
};

export type BillingDispute = {
  id: string;
  paymentIntentId?: string | null;
  invoiceId?: string | null;
  billingAccountId: string;
  provider: string;
  providerDisputeId?: string | null;
  disputeType: string;
  amount: string;
  currency: string;
  status: string;
  dueAt?: Date | null;
  createdAt: Date;
};

export type FxRate = {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: string;
  source: string;
  effectiveAt: Date;
  version: number;
};

export type PaymentMethodRecord = {
  id: string;
  billingAccountId: string;
  provider: string;
  providerMethodRef: string;
  methodType: string;
  brand?: string | null;
  last4?: string | null;
  status: string;
  isDefault: boolean;
  createdAt: Date;
};

export interface BillingRepositoryPort {
  allocateAccountNumber(): Promise<string>;
  allocateInvoiceNumber(): Promise<string>;

  createBillingAccount(input: {
    commercialAccountId: string;
    currency?: string;
    paymentTermsDays?: number;
    metadata?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<BillingAccount>;

  listBillingAccounts(input?: { commercialAccountId?: string; limit?: number }): Promise<BillingAccount[]>;
  getBillingAccount(id: string): Promise<BillingAccount | null>;
  findBillingAccountByCommercial(commercialAccountId: string): Promise<BillingAccount | null>;
  updateBillingAccount(
    id: string,
    patch: Partial<Pick<BillingAccount, 'status' | 'paymentTermsDays' | 'metadata'>>,
  ): Promise<BillingAccount>;

  upsertBillingProfile(input: {
    billingAccountId: string;
    legalName: string;
    tradeName?: string | null;
    country?: string | null;
    currency: string;
    paymentTermsDays: number;
    snapshot?: Record<string, unknown>;
  }): Promise<BillingProfile>;
  getCurrentBillingProfile(billingAccountId: string): Promise<BillingProfile | null>;

  linkSubscriptionToBillingAccount(input: {
    billingAccountId: string;
    subscriptionId: string;
  }): Promise<{ id: string; subscriptionId: string; billingAccountId: string; status: string }>;
  getBillingAccountForSubscription(subscriptionId: string): Promise<BillingAccount | null>;

  createBillingSchedule(input: {
    subscriptionId: string;
    billingAccountId: string;
    frequency: string;
    nextBillAt?: Date | null;
    metadata?: Record<string, unknown>;
  }): Promise<BillingSchedule>;
  listBillingSchedules(subscriptionId: string): Promise<BillingSchedule[]>;

  createBillingPeriod(input: {
    subscriptionId: string;
    billingAccountId: string;
    periodNumber: number;
    startsAt: Date;
    endsAt: Date;
    billAt?: Date | null;
    dueAt?: Date | null;
    currency: string;
    snapshot?: Record<string, unknown>;
  }): Promise<BillingPeriod>;
  allocateNextPeriodNumber(subscriptionId: string): Promise<number>;

  createInvoice(input: {
    billingAccountId: string;
    subscriptionId?: string | null;
    periodId?: string | null;
    currency: string;
    dueAt?: Date | null;
    profileSnapshot?: Record<string, unknown>;
    commercialSnapshot?: Record<string, unknown>;
    taxSnapshot?: Record<string, unknown>;
    correlationId?: string | null;
    createdBy?: string | null;
    status?: string;
  }): Promise<Invoice>;

  addInvoiceLines(
    invoiceId: string,
    lines: readonly Omit<InvoiceLine, 'id' | 'invoiceId'>[],
  ): Promise<InvoiceLine[]>;

  getInvoice(id: string): Promise<Invoice | null>;
  listInvoices(input?: { billingAccountId?: string; status?: string; limit?: number }): Promise<Invoice[]>;
  listOverdueCandidates(asOf?: Date, limit?: number): Promise<Invoice[]>;
  updateInvoice(
    id: string,
    patch: Partial<
      Pick<
        Invoice,
        | 'status'
        | 'subtotal'
        | 'discountTotal'
        | 'taxTotal'
        | 'total'
        | 'amountPaid'
        | 'amountDue'
        | 'issueAt'
        | 'dueAt'
        | 'issuedDocumentRef'
        | 'taxSnapshot'
        | 'metadata'
      >
    >,
  ): Promise<Invoice>;
  appendInvoiceStatusHistory(input: {
    invoiceId: string;
    fromStatus?: string | null;
    toStatus: string;
    reason?: string | null;
    actorId?: string | null;
    correlationId?: string | null;
  }): Promise<void>;

  createPaymentIntent(input: {
    billingAccountId: string;
    invoiceId?: string | null;
    amount: string;
    currency: string;
    provider: string;
    providerIntentRef?: string | null;
    correlationId?: string | null;
    status?: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentIntent>;
  getPaymentIntent(id: string): Promise<PaymentIntent | null>;
  updatePaymentIntent(
    id: string,
    patch: Partial<Pick<PaymentIntent, 'status' | 'providerIntentRef' | 'metadata'>>,
  ): Promise<PaymentIntent>;
  createPaymentAttempt(input: {
    intentId: string;
    attemptNumber: number;
    status: string;
    providerRef?: string | null;
    failureCode?: string | null;
    failureMessage?: string | null;
    rawResponse?: Record<string, unknown>;
  }): Promise<PaymentAttempt>;

  createPaymentAllocation(input: {
    paymentIntentId: string;
    invoiceId: string;
    amount: string;
    currency: string;
  }): Promise<PaymentAllocation>;
  listPaymentAllocationsForIntent(paymentIntentId: string): Promise<PaymentAllocation[]>;

  createRefund(input: {
    paymentIntentId: string;
    invoiceId?: string | null;
    amount: string;
    currency: string;
    reason?: string | null;
    correlationId?: string | null;
    status?: string;
  }): Promise<Refund>;
  getRefund(id: string): Promise<Refund | null>;
  updateRefund(
    id: string,
    patch: Partial<Pick<Refund, 'status' | 'providerRef' | 'approvedBy'>>,
  ): Promise<Refund>;

  openCollectionCase(input: {
    billingAccountId: string;
    invoiceId: string;
    policyCode?: string | null;
    overdueSince?: Date | null;
  }): Promise<CollectionCase>;
  recordDunningAttempt(input: {
    caseId: string;
    channel: string;
    templateRef?: string | null;
    status?: string;
  }): Promise<DunningAttempt>;

  appendJournalEntry(input: Omit<JournalEntry, 'id' | 'createdAt'>): Promise<JournalEntry>;
  listJournalEntries(billingAccountId: string, limit?: number): Promise<JournalEntry[]>;

  ingestWebhookEvent(input: {
    provider: string;
    providerEventId: string;
    signatureValid: boolean;
    payload: Record<string, unknown>;
    correlationId?: string | null;
  }): Promise<PaymentWebhookEvent>;
  getWebhookEventByProviderId(providerEventId: string): Promise<PaymentWebhookEvent | null>;
  updateWebhookEvent(
    id: string,
    patch: Partial<Pick<PaymentWebhookEvent, 'processingStatus' | 'processedAt'>>,
  ): Promise<PaymentWebhookEvent>;

  getBillingOverview(): Promise<BillingOverview>;
  getBillingAnalytics(currency?: string): Promise<BillingAnalytics>;

  resolveIdempotency(
    idempotencyKey: string,
  ): Promise<{ resourceType: string; resourceId?: string | null; responseSnapshot: Record<string, unknown> } | null>;
  storeIdempotency(input: {
    idempotencyKey: string;
    operation: string;
    resourceType: string;
    resourceId?: string | null;
    responseSnapshot?: Record<string, unknown>;
  }): Promise<void>;

  // --- Parties ---
  upsertBillingParty(input: {
    billingAccountId: string;
    partyRole: string;
    legalName: string;
    taxId?: string | null;
    country?: string | null;
    address?: Record<string, unknown>;
    email?: string | null;
  }): Promise<BillingParty>;
  listBillingParties(billingAccountId: string): Promise<BillingParty[]>;

  // --- Profiles history ---
  listBillingProfiles(billingAccountId: string): Promise<BillingProfile[]>;

  // --- Invoice lines / tax / documents ---
  listInvoiceLines(invoiceId: string): Promise<InvoiceLine[]>;
  replaceInvoiceTaxLines(
    invoiceId: string,
    lines: readonly Omit<InvoiceTaxLine, 'id' | 'invoiceId'>[],
  ): Promise<InvoiceTaxLine[]>;
  listInvoiceTaxLines(invoiceId: string): Promise<InvoiceTaxLine[]>;
  storeInvoiceDocument(input: {
    invoiceId: string;
    documentType?: string;
    storageRef: string;
    contentSha256?: string | null;
  }): Promise<InvoiceDocument>;
  listInvoiceDocuments(invoiceId: string): Promise<InvoiceDocument[]>;

  // --- Tax registry ---
  listTaxJurisdictions(): Promise<TaxJurisdiction[]>;
  resolveTaxRate(input: {
    country?: string | null;
    category?: string;
    at?: Date;
  }): Promise<(TaxRate & { jurisdictionCode: string }) | null>;

  // --- Credit notes ---
  allocateCreditNoteNumber(): Promise<string>;
  createCreditNote(input: {
    invoiceId?: string | null;
    billingAccountId: string;
    currency: string;
    total: string;
    reason?: string | null;
    snapshot?: Record<string, unknown>;
    status?: string;
  }): Promise<CreditNote>;
  listCreditNotes(input?: { billingAccountId?: string; invoiceId?: string }): Promise<CreditNote[]>;
  issueCreditNote(id: string): Promise<CreditNote>;

  // --- Collections ---
  listCollectionCases(input?: {
    billingAccountId?: string;
    status?: string;
    limit?: number;
  }): Promise<CollectionCase[]>;
  getCollectionCase(id: string): Promise<CollectionCase | null>;
  updateCollectionCase(
    id: string,
    patch: Partial<Pick<CollectionCase, 'status' | 'nextActionAt' | 'policyCode' | 'metadata'>>,
  ): Promise<CollectionCase>;
  listDunningAttempts(caseId: string): Promise<DunningAttempt[]>;

  // --- Policies ---
  listBillingPolicies(policyType?: string): Promise<BillingPolicy[]>;
  getBillingPolicyByCode(code: string): Promise<BillingPolicy | null>;
  upsertBillingPolicy(input: {
    code: string;
    policyType: string;
    rules: Record<string, unknown>;
    status?: string;
  }): Promise<BillingPolicy>;

  // --- Payment methods (token refs only) ---
  listPaymentMethods(billingAccountId: string): Promise<PaymentMethodRecord[]>;
  registerPaymentMethod(input: {
    billingAccountId: string;
    provider: string;
    providerMethodRef: string;
    methodType: string;
    brand?: string | null;
    last4?: string | null;
    isDefault?: boolean;
  }): Promise<PaymentMethodRecord>;
  revokePaymentMethod(id: string): Promise<PaymentMethodRecord>;

  // --- Reconciliation ---
  createReconciliationRun(input: {
    provider: string;
    summary?: Record<string, unknown>;
  }): Promise<ReconciliationRun>;
  completeReconciliationRun(
    id: string,
    summary: Record<string, unknown>,
    status?: 'COMPLETED' | 'FAILED',
  ): Promise<ReconciliationRun>;
  listReconciliationRuns(limit?: number): Promise<ReconciliationRun[]>;
  getReconciliationRun(id: string): Promise<ReconciliationRun | null>;
  createReconciliationException(input: {
    runId: string;
    exceptionType: string;
    internalRef?: string | null;
    providerRef?: string | null;
    details?: Record<string, unknown>;
  }): Promise<ReconciliationException>;
  listReconciliationExceptions(input?: {
    runId?: string;
    status?: string;
  }): Promise<ReconciliationException[]>;
  resolveReconciliationException(id: string): Promise<ReconciliationException>;

  // --- Provider tx / settlement / disputes / FX ---
  upsertProviderTransaction(input: {
    provider: string;
    providerTxnId: string;
    paymentIntentId?: string | null;
    amount: string;
    currency: string;
    status?: string;
    fees?: string;
    raw?: Record<string, unknown>;
    occurredAt?: Date;
  }): Promise<ProviderTransaction>;
  listProviderTransactions(provider?: string, limit?: number): Promise<ProviderTransaction[]>;
  listSucceededPaymentIntentsWithoutProviderTxn(provider: string): Promise<PaymentIntent[]>;

  createSettlementBatch(input: {
    provider: string;
    merchantAccount?: string | null;
    settlementDate: string;
    grossAmount: string;
    fees?: string;
    refunds?: string;
    chargebacks?: string;
    netAmount: string;
    currency: string;
    bankReference?: string | null;
  }): Promise<SettlementBatch>;
  listSettlementBatches(limit?: number): Promise<SettlementBatch[]>;

  createDispute(input: {
    billingAccountId: string;
    paymentIntentId?: string | null;
    invoiceId?: string | null;
    provider: string;
    providerDisputeId?: string | null;
    disputeType?: string;
    amount: string;
    currency: string;
    dueAt?: Date | null;
  }): Promise<BillingDispute>;
  listDisputes(input?: { billingAccountId?: string; status?: string }): Promise<BillingDispute[]>;
  updateDisputeStatus(id: string, status: string, resolution?: Record<string, unknown>): Promise<BillingDispute>;

  listFxRates(baseCurrency?: string): Promise<FxRate[]>;
  getLatestFxRate(baseCurrency: string, quoteCurrency: string): Promise<FxRate | null>;
  createFxRate(input: {
    baseCurrency: string;
    quoteCurrency: string;
    rate: string;
    source?: string;
  }): Promise<FxRate>;

  listPaymentIntents(input?: {
    billingAccountId?: string;
    status?: string;
    limit?: number;
  }): Promise<PaymentIntent[]>;
  listRefunds(input?: { paymentIntentId?: string; limit?: number }): Promise<Refund[]>;

  getActiveRevenuePolicy(): Promise<RevenuePolicy | null>;
  listRevenuePolicies(): Promise<RevenuePolicy[]>;
  upsertRevenuePolicy(input: {
    code: string;
    method: string;
    rules?: Record<string, unknown>;
    status?: string;
  }): Promise<RevenuePolicy>;
  sumSucceededRefunds(currency?: string): Promise<string>;

  listDueBillingSchedules(asOf?: Date, limit?: number): Promise<BillingSchedule[]>;
  advanceBillingSchedule(
    id: string,
    nextBillAt: Date | null,
  ): Promise<BillingSchedule>;

  createExportBatch(input: {
    exportType: string;
    currency?: string | null;
    periodStart?: Date | null;
    periodEnd?: Date | null;
    itemCount: number;
    checksumSha256?: string | null;
    artifactRef?: string | null;
    summary?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<FinancialExportBatch>;
  addExportItems(
    batchId: string,
    items: readonly { entityType: string; entityId: string; payload: Record<string, unknown> }[],
  ): Promise<number>;
  listExportBatches(limit?: number): Promise<FinancialExportBatch[]>;
  getExportBatch(id: string): Promise<FinancialExportBatch | null>;
  listExportItems(batchId: string): Promise<
    { id: string; entityType: string; entityId: string; payload: Record<string, unknown> }[]
  >;

  listInvoicesForExport(input: {
    currency?: string;
    periodStart?: Date | null;
    periodEnd?: Date | null;
  }): Promise<Invoice[]>;
  listPaymentIntentsForExport(input: {
    currency?: string;
    periodStart?: Date | null;
    periodEnd?: Date | null;
  }): Promise<PaymentIntent[]>;
}

import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export enum SalesActivityStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum NeedsAssessmentStatus {
  DRAFT = 'DRAFT',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  TECHNICALLY_VALIDATED = 'TECHNICALLY_VALIDATED',
  ARCHIVED = 'ARCHIVED',
}

export enum QuoteStatus {
  DRAFT = 'DRAFT',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  ISSUED = 'ISSUED',
  VIEWED = 'VIEWED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum ProposalStatus {
  DRAFT = 'DRAFT',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  ISSUED = 'ISSUED',
  VIEWED = 'VIEWED',
  WITHDRAWN = 'WITHDRAWN',
  SUPERSEDED = 'SUPERSEDED',
}

export enum DiscountRequestStatus {
  REQUESTED = 'REQUESTED',
  PENDING_MANAGER = 'PENDING_MANAGER',
  PENDING_EXECUTIVE = 'PENDING_EXECUTIVE',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum ApprovalLevel {
  STANDARD = 'STANDARD',
  MANAGER = 'MANAGER',
  EXECUTIVE = 'EXECUTIVE',
  STRATEGIC = 'STRATEGIC',
}

export enum ContractStatus {
  DRAFT = 'DRAFT',
  INTERNAL_REVIEW = 'INTERNAL_REVIEW',
  APPROVED = 'APPROVED',
  SENT_FOR_SIGNATURE = 'SENT_FOR_SIGNATURE',
  PARTIALLY_SIGNED = 'PARTIALLY_SIGNED',
  EXECUTED = 'EXECUTED',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  SUPERSEDED = 'SUPERSEDED',
}

export enum SalesOrderStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  CONFIRMED = 'CONFIRMED',
  HANDOFF_PENDING = 'HANDOFF_PENDING',
  HANDOFF_ACCEPTED = 'HANDOFF_ACCEPTED',
  FULFILLMENT_IN_PROGRESS = 'FULFILLMENT_IN_PROGRESS',
  FULFILLED = 'FULFILLED',
  CANCELLED = 'CANCELLED',
}

export enum HandoffStatus {
  REQUESTED = 'REQUESTED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  IN_PROGRESS = 'IN_PROGRESS',
  PROVISIONING_PENDING = 'PROVISIONING_PENDING',
  PROVISIONING_CONFIRMED = 'PROVISIONING_CONFIRMED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

const QUOTE_TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  [QuoteStatus.DRAFT]: [QuoteStatus.IN_REVIEW, QuoteStatus.WITHDRAWN],
  [QuoteStatus.IN_REVIEW]: [
    QuoteStatus.APPROVED,
    QuoteStatus.DRAFT,
    QuoteStatus.WITHDRAWN,
  ],
  [QuoteStatus.APPROVED]: [QuoteStatus.ISSUED, QuoteStatus.WITHDRAWN],
  [QuoteStatus.ISSUED]: [
    QuoteStatus.VIEWED,
    QuoteStatus.ACCEPTED,
    QuoteStatus.REJECTED,
    QuoteStatus.EXPIRED,
    QuoteStatus.WITHDRAWN,
  ],
  [QuoteStatus.VIEWED]: [
    QuoteStatus.ACCEPTED,
    QuoteStatus.REJECTED,
    QuoteStatus.EXPIRED,
    QuoteStatus.WITHDRAWN,
  ],
  [QuoteStatus.ACCEPTED]: [],
  [QuoteStatus.REJECTED]: [],
  [QuoteStatus.EXPIRED]: [],
  [QuoteStatus.WITHDRAWN]: [],
};

const CONTRACT_TRANSITIONS: Record<ContractStatus, readonly ContractStatus[]> = {
  [ContractStatus.DRAFT]: [
    ContractStatus.INTERNAL_REVIEW,
    ContractStatus.CANCELLED,
  ],
  [ContractStatus.INTERNAL_REVIEW]: [
    ContractStatus.APPROVED,
    ContractStatus.DRAFT,
    ContractStatus.REJECTED,
    ContractStatus.CANCELLED,
  ],
  [ContractStatus.APPROVED]: [
    ContractStatus.SENT_FOR_SIGNATURE,
    ContractStatus.CANCELLED,
  ],
  [ContractStatus.SENT_FOR_SIGNATURE]: [
    ContractStatus.PARTIALLY_SIGNED,
    ContractStatus.EXECUTED,
    ContractStatus.REJECTED,
    ContractStatus.CANCELLED,
  ],
  [ContractStatus.PARTIALLY_SIGNED]: [
    ContractStatus.EXECUTED,
    ContractStatus.CANCELLED,
  ],
  [ContractStatus.EXECUTED]: [ContractStatus.ACTIVE, ContractStatus.SUPERSEDED],
  [ContractStatus.ACTIVE]: [
    ContractStatus.EXPIRED,
    ContractStatus.TERMINATED,
    ContractStatus.SUPERSEDED,
  ],
  [ContractStatus.EXPIRED]: [],
  [ContractStatus.TERMINATED]: [],
  [ContractStatus.REJECTED]: [],
  [ContractStatus.CANCELLED]: [],
  [ContractStatus.SUPERSEDED]: [],
};

const ORDER_TRANSITIONS: Record<SalesOrderStatus, readonly SalesOrderStatus[]> = {
  [SalesOrderStatus.DRAFT]: [
    SalesOrderStatus.PENDING_APPROVAL,
    SalesOrderStatus.CANCELLED,
  ],
  [SalesOrderStatus.PENDING_APPROVAL]: [
    SalesOrderStatus.APPROVED,
    SalesOrderStatus.DRAFT,
    SalesOrderStatus.CANCELLED,
  ],
  [SalesOrderStatus.APPROVED]: [
    SalesOrderStatus.CONFIRMED,
    SalesOrderStatus.CANCELLED,
  ],
  [SalesOrderStatus.CONFIRMED]: [
    SalesOrderStatus.HANDOFF_PENDING,
    SalesOrderStatus.CANCELLED,
  ],
  [SalesOrderStatus.HANDOFF_PENDING]: [
    SalesOrderStatus.HANDOFF_ACCEPTED,
    SalesOrderStatus.CANCELLED,
  ],
  [SalesOrderStatus.HANDOFF_ACCEPTED]: [
    SalesOrderStatus.FULFILLMENT_IN_PROGRESS,
  ],
  [SalesOrderStatus.FULFILLMENT_IN_PROGRESS]: [SalesOrderStatus.FULFILLED],
  [SalesOrderStatus.FULFILLED]: [],
  [SalesOrderStatus.CANCELLED]: [],
};

export function assertActivityHasCommercialContext(input: {
  accountId?: string | null;
  contactId?: string | null;
  salesLeadId?: string | null;
  opportunityId?: string | null;
}): void {
  if (
    !input.accountId &&
    !input.contactId &&
    !input.salesLeadId &&
    !input.opportunityId
  ) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Sales activity requires account, contact, lead, or opportunity context',
    );
  }
}

export function assertUncoveredNeedsExplicit(input: {
  fitDecision?: string | null;
  uncoveredNeeds?: readonly unknown[] | null;
}): void {
  if (input.fitDecision === 'PARTIAL_FIT' || input.fitDecision === 'NO_FIT') {
    if (!input.uncoveredNeeds || input.uncoveredNeeds.length === 0) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Partial/no fit assessments must explicitly list uncovered needs',
      );
    }
  }
}

export function assertNoUnauthorizedCapabilityPromise(input: {
  promisedCapabilities?: readonly string[] | null;
  commerciallyAuthorizedCapabilities?: readonly string[] | null;
}): void {
  const authorized = new Set(input.commerciallyAuthorizedCapabilities ?? []);
  for (const cap of input.promisedCapabilities ?? []) {
    if (!authorized.has(cap)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Cannot promise unauthorized capability: ${cap}`,
      );
    }
  }
}

export function assertQuoteStatusTransition(
  from: QuoteStatus | string,
  to: QuoteStatus | string,
): void {
  const allowed = QUOTE_TRANSITIONS[from as QuoteStatus] ?? [];
  if (!allowed.includes(to as QuoteStatus)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid quote transition ${from} → ${to}`,
    );
  }
}

/** Issued (and later) quotes are immutable; edits must create a new version. */
export function assertQuoteMutable(status: QuoteStatus | string): void {
  const immutable = new Set<string>([
    QuoteStatus.ISSUED,
    QuoteStatus.VIEWED,
    QuoteStatus.ACCEPTED,
    QuoteStatus.REJECTED,
    QuoteStatus.EXPIRED,
    QuoteStatus.WITHDRAWN,
  ]);
  if (immutable.has(status)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Issued quotes cannot be modified directly; create a new version',
    );
  }
}

export type DiscountApprovalMatrixEntry = {
  readonly maxPercent: number;
  readonly level: ApprovalLevel | string;
};

export function resolveRequiredDiscountApprovalLevel(input: {
  discountPercent: number;
  matrix: readonly DiscountApprovalMatrixEntry[];
}): ApprovalLevel {
  if (input.discountPercent < 0) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Discount percent cannot be negative');
  }
  if (!input.matrix.length) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Discount approval matrix is required (not hardcoded)',
    );
  }
  const sorted = [...input.matrix].sort((a, b) => a.maxPercent - b.maxPercent);
  for (const entry of sorted) {
    if (input.discountPercent <= entry.maxPercent) {
      return entry.level as ApprovalLevel;
    }
  }
  throw new DomainError(
    ErrorCode.VALIDATION_ERROR,
    'Requested discount exceeds configured policy limits',
  );
}

export function assertApprovalNotSelfServed(input: {
  requesterId: string;
  decisionBy: string;
  cannotSelfApprove?: boolean;
}): void {
  if (input.cannotSelfApprove === false) return;
  if (input.requesterId === input.decisionBy) {
    throw new DomainError(
      ErrorCode.FORBIDDEN,
      'Self-approval of commercial exceptions is forbidden',
    );
  }
}

export function assertApprovalCannotBeBypassed(input: {
  required?: boolean;
  approved?: boolean;
}): void {
  if (input.required && !input.approved) {
    throw new DomainError(
      ErrorCode.FORBIDDEN,
      'Required commercial approval is missing; API cannot bypass governance',
    );
  }
}

export function assertContractStatusTransition(
  from: ContractStatus | string,
  to: ContractStatus | string,
): void {
  const allowed = CONTRACT_TRANSITIONS[from as ContractStatus] ?? [];
  if (!allowed.includes(to as ContractStatus)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid contract transition ${from} → ${to}`,
    );
  }
}

/** EXECUTED requires provider confirmation — never claim signed without it. */
export function assertContractExecutable(input: {
  toStatus: ContractStatus | string;
  signatureProviderConfirmed?: boolean;
}): void {
  if (input.toStatus !== ContractStatus.EXECUTED) return;
  if (!input.signatureProviderConfirmed) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Contract cannot be EXECUTED without signature provider confirmation',
    );
  }
}

export function assertSalesOrderStatusTransition(
  from: SalesOrderStatus | string,
  to: SalesOrderStatus | string,
): void {
  const allowed = ORDER_TRANSITIONS[from as SalesOrderStatus] ?? [];
  if (!allowed.includes(to as SalesOrderStatus)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid sales order transition ${from} → ${to}`,
    );
  }
}

export function assertHandoffPackageComplete(input: {
  accountId?: string | null;
  productId?: string | null;
  commercialTermsPresent?: boolean;
  contractExecutedWhenRequired?: boolean;
  requireContract?: boolean;
  quoteAcceptedWhenRequired?: boolean;
  requireQuote?: boolean;
}): void {
  if (!input.accountId) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Handoff requires commercial account');
  }
  if (!input.productId) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Handoff requires product');
  }
  if (!input.commercialTermsPresent) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Handoff requires commercial terms snapshot',
    );
  }
  if (input.requireContract && !input.contractExecutedWhenRequired) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Handoff requires executed contract',
    );
  }
  if (input.requireQuote && !input.quoteAcceptedWhenRequired) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Handoff requires accepted quote',
    );
  }
}

/** Provisioning success is only from responsible system confirmation. */
export function assertProvisioningNotFaked(input: {
  claimedFulfilled?: boolean;
  provisioningConfirmed?: boolean;
}): void {
  if (input.claimedFulfilled && !input.provisioningConfirmed) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Cannot mark handoff fulfilled without provisioning confirmation',
    );
  }
}

/** Forecast amounts are projections — never recognized revenue. */
export function assertForecastIsNotRecognizedRevenue(input: {
  labelAsRecognizedRevenue?: boolean;
}): void {
  if (input.labelAsRecognizedRevenue) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Sales forecast must not be labeled as recognized revenue',
    );
  }
}

export function computeDiscountPercent(listAmount: number, requestedAmount: number): number {
  if (listAmount <= 0) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'List amount must be positive');
  }
  if (requestedAmount < 0 || requestedAmount > listAmount) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Requested amount must be between 0 and list amount',
    );
  }
  return Math.round(((listAmount - requestedAmount) / listAmount) * 10000) / 100;
}

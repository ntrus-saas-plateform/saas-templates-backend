import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export enum CommercialAccountStatus {
  PROSPECT = 'PROSPECT',
  QUALIFIED = 'QUALIFIED',
  ACTIVE_CUSTOMER = 'ACTIVE_CUSTOMER',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
  MERGED = 'MERGED',
}

export enum SalesLeadStatus {
  RECEIVED = 'RECEIVED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  SALES_QUALIFIED = 'SALES_QUALIFIED',
  CONVERTED_TO_OPPORTUNITY = 'CONVERTED_TO_OPPORTUNITY',
  RECYCLED = 'RECYCLED',
  NURTURING_REQUESTED = 'NURTURING_REQUESTED',
  DUPLICATE = 'DUPLICATE',
  INVALID = 'INVALID',
  UNREACHABLE = 'UNREACHABLE',
}

const ACCOUNT_TRANSITIONS: Record<
  CommercialAccountStatus,
  readonly CommercialAccountStatus[]
> = {
  [CommercialAccountStatus.PROSPECT]: [
    CommercialAccountStatus.QUALIFIED,
    CommercialAccountStatus.INACTIVE,
    CommercialAccountStatus.ARCHIVED,
    CommercialAccountStatus.MERGED,
  ],
  [CommercialAccountStatus.QUALIFIED]: [
    CommercialAccountStatus.ACTIVE_CUSTOMER,
    CommercialAccountStatus.INACTIVE,
    CommercialAccountStatus.ARCHIVED,
    CommercialAccountStatus.MERGED,
  ],
  [CommercialAccountStatus.ACTIVE_CUSTOMER]: [
    CommercialAccountStatus.INACTIVE,
    CommercialAccountStatus.ARCHIVED,
    CommercialAccountStatus.MERGED,
  ],
  [CommercialAccountStatus.INACTIVE]: [
    CommercialAccountStatus.PROSPECT,
    CommercialAccountStatus.QUALIFIED,
    CommercialAccountStatus.ACTIVE_CUSTOMER,
    CommercialAccountStatus.ARCHIVED,
  ],
  [CommercialAccountStatus.ARCHIVED]: [],
  [CommercialAccountStatus.MERGED]: [],
};

const LEAD_TRANSITIONS: Record<SalesLeadStatus, readonly SalesLeadStatus[]> = {
  [SalesLeadStatus.RECEIVED]: [
    SalesLeadStatus.PENDING_REVIEW,
    SalesLeadStatus.ACCEPTED,
    SalesLeadStatus.REJECTED,
    SalesLeadStatus.DUPLICATE,
    SalesLeadStatus.INVALID,
    SalesLeadStatus.UNREACHABLE,
    SalesLeadStatus.NURTURING_REQUESTED,
    SalesLeadStatus.RECYCLED,
  ],
  [SalesLeadStatus.PENDING_REVIEW]: [
    SalesLeadStatus.ACCEPTED,
    SalesLeadStatus.REJECTED,
    SalesLeadStatus.DUPLICATE,
    SalesLeadStatus.INVALID,
    SalesLeadStatus.UNREACHABLE,
    SalesLeadStatus.NURTURING_REQUESTED,
    SalesLeadStatus.RECYCLED,
  ],
  [SalesLeadStatus.ACCEPTED]: [
    SalesLeadStatus.SALES_QUALIFIED,
    SalesLeadStatus.REJECTED,
    SalesLeadStatus.NURTURING_REQUESTED,
    SalesLeadStatus.RECYCLED,
    SalesLeadStatus.UNREACHABLE,
  ],
  [SalesLeadStatus.SALES_QUALIFIED]: [
    SalesLeadStatus.CONVERTED_TO_OPPORTUNITY,
    SalesLeadStatus.RECYCLED,
    SalesLeadStatus.NURTURING_REQUESTED,
  ],
  [SalesLeadStatus.REJECTED]: [SalesLeadStatus.RECYCLED, SalesLeadStatus.NURTURING_REQUESTED],
  [SalesLeadStatus.RECYCLED]: [SalesLeadStatus.PENDING_REVIEW],
  [SalesLeadStatus.NURTURING_REQUESTED]: [SalesLeadStatus.PENDING_REVIEW, SalesLeadStatus.RECYCLED],
  [SalesLeadStatus.DUPLICATE]: [],
  [SalesLeadStatus.INVALID]: [],
  [SalesLeadStatus.UNREACHABLE]: [SalesLeadStatus.PENDING_REVIEW, SalesLeadStatus.RECYCLED],
  [SalesLeadStatus.CONVERTED_TO_OPPORTUNITY]: [],
};

export function normalizeAccountName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeEmailDomain(emailOrDomain: string): string | null {
  const raw = emailOrDomain.trim().toLowerCase();
  if (!raw) return null;
  const at = raw.indexOf('@');
  const domain = at >= 0 ? raw.slice(at + 1) : raw;
  return domain || null;
}

export function assertAccountStatusTransition(
  from: CommercialAccountStatus | string,
  to: CommercialAccountStatus | string,
): void {
  const allowed = ACCOUNT_TRANSITIONS[from as CommercialAccountStatus] ?? [];
  if (!allowed.includes(to as CommercialAccountStatus)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid commercial account transition ${from} ? ${to}`,
    );
  }
}

export function assertSalesLeadStatusTransition(
  from: SalesLeadStatus | string,
  to: SalesLeadStatus | string,
): void {
  const allowed = LEAD_TRANSITIONS[from as SalesLeadStatus] ?? [];
  if (!allowed.includes(to as SalesLeadStatus)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid sales lead transition ${from} ? ${to}`,
    );
  }
}

export function assertRejectionRequiresReason(input: {
  toStatus: SalesLeadStatus | string;
  reasonCode?: string | null;
  reasonText?: string | null;
}): void {
  if (input.toStatus !== SalesLeadStatus.REJECTED) return;
  if (!input.reasonCode?.trim() && !input.reasonText?.trim()) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Sales lead rejection requires a reason code or text',
    );
  }
}

export function assertAccountIsNotTenant(input: {
  tenantId?: string | null;
  createsTenant?: boolean;
}): void {
  if (input.tenantId || input.createsTenant) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Commercial accounts must not create or bind tenants; provisioning is out of P4',
    );
  }
}

export function assertControlledMerge(input: {
  survivingAccountId: string;
  mergedAccountId: string;
  reason?: string | null;
  autoMergeByNameSimilarity?: boolean;
}): void {
  if (input.survivingAccountId === input.mergedAccountId) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Cannot merge an account into itself');
  }
  if (input.autoMergeByNameSimilarity) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Automatic merge by name similarity is forbidden',
    );
  }
  if (!input.reason?.trim()) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Account merge requires an explicit reason');
  }
}

export function assertQualificationDecision(input: {
  needConfirmed?: boolean;
  productFit?: boolean;
  decisionCapacity?: boolean;
}): void {
  if (!input.needConfirmed || !input.productFit || !input.decisionCapacity) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Sales qualification requires confirmed need, product fit, and decision capacity',
    );
  }
}

/** Marketing MQL score is informative only — never equals sales qualification. */
export function assertSalesDecisionIndependentOfMarketingScore(input: {
  marketingScore?: number | null;
  salesDecisionBasedOnlyOnMarketingScore?: boolean;
}): void {
  if (input.salesDecisionBasedOnlyOnMarketingScore) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Sales qualification must not be based solely on marketing score',
    );
  }
}

export enum OpportunityStatus {
  OPEN = 'OPEN',
  WON = 'WON',
  LOST = 'LOST',
  ON_HOLD = 'ON_HOLD',
  REOPENED = 'REOPENED',
}

export enum PipelineStageKind {
  OPEN = 'OPEN',
  WON = 'WON',
  LOST = 'LOST',
}

const LOSS_REASON_CODES = new Set([
  'PRICE',
  'COMPETITOR',
  'NO_BUDGET',
  'PROJECT_ABANDONED',
  'POOR_FIT',
  'MISSING_FEATURES',
  'TIMING',
  'DECISION_POSTPONED',
  'NO_DECISION',
  'TECHNICAL_CONSTRAINTS',
  'OTHER',
]);

export function assertValidLossReason(input: {
  reasonCode?: string | null;
  reasonText?: string | null;
}): void {
  if (!input.reasonCode?.trim()) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Closed lost requires a loss reason code',
    );
  }
  if (!LOSS_REASON_CODES.has(input.reasonCode)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Unknown loss reason code: ${input.reasonCode}`,
    );
  }
  if (input.reasonCode === 'OTHER' && !input.reasonText?.trim()) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Loss reason OTHER requires documented text',
    );
  }
}

export function assertPipelineTransitionAllowed(input: {
  allowedToStageIds: readonly string[];
  toStageId: string;
}): void {
  if (!input.allowedToStageIds.includes(input.toStageId)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Pipeline stage transition is not allowed',
    );
  }
}

export function assertClosedWonGates(input: {
  toStageKind: PipelineStageKind | string;
  accountId?: string | null;
  estimatedValue?: number | string | null;
  productId?: string | null;
  quoteAcceptedWhenRequired?: boolean;
  contractExecutedWhenRequired?: boolean;
  requireQuote?: boolean;
  requireContract?: boolean;
}): void {
  if (input.toStageKind !== PipelineStageKind.WON) return;
  if (!input.accountId) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Closed Won requires a commercial account',
    );
  }
  if (input.estimatedValue == null || Number(input.estimatedValue) <= 0) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Closed Won requires a positive estimated value',
    );
  }
  if (!input.productId) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Closed Won requires a product reference',
    );
  }
  if (input.requireQuote && !input.quoteAcceptedWhenRequired) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Closed Won requires an accepted quote',
    );
  }
  if (input.requireContract && !input.contractExecutedWhenRequired) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Closed Won requires an executed contract',
    );
  }
}

export function assertOpportunityMutable(status: OpportunityStatus | string): void {
  if (status === OpportunityStatus.WON || status === OpportunityStatus.LOST) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Closed opportunities cannot be silently modified; reopen under controlled conditions',
    );
  }
}

export function assertOpportunityReopen(input: {
  status: OpportunityStatus | string;
  reason?: string | null;
}): void {
  if (
    input.status !== OpportunityStatus.WON &&
    input.status !== OpportunityStatus.LOST
  ) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Only won or lost opportunities can be reopened',
    );
  }
  if (!input.reason?.trim()) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Opportunity reopen requires a reason',
    );
  }
}

/** Weighted forecast helper ? never treat as recognized revenue. */
export function computeWeightedPipelineValue(
  estimatedValue: number,
  probability: number,
): number {
  if (estimatedValue < 0 || probability < 0 || probability > 1) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid estimated value or probability for weighted forecast',
    );
  }
  return Math.round(estimatedValue * probability * 100) / 100;
}

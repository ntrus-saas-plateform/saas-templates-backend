import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { PriceDisplayMode } from './acquisition.types.js';

const PROSPECT_TRANSITIONS: Record<string, readonly string[]> = {
  NEW: ['CONTACTED', 'ENGAGED', 'QUALIFYING', 'DISQUALIFIED', 'ARCHIVED'],
  CONTACTED: ['ENGAGED', 'QUALIFYING', 'DISQUALIFIED', 'ARCHIVED'],
  ENGAGED: ['QUALIFYING', 'APPLICATION_IN_PROGRESS', 'DISQUALIFIED', 'ARCHIVED'],
  QUALIFYING: ['QUALIFIED', 'DISQUALIFIED', 'APPLICATION_IN_PROGRESS', 'ARCHIVED'],
  QUALIFIED: ['APPLICATION_IN_PROGRESS', 'CHECKOUT_PENDING', 'DISQUALIFIED', 'ARCHIVED'],
  APPLICATION_IN_PROGRESS: ['QUALIFYING', 'CHECKOUT_PENDING', 'DISQUALIFIED', 'ARCHIVED'],
  CHECKOUT_PENDING: ['HANDED_OFF', 'DISQUALIFIED', 'ARCHIVED'],
  HANDED_OFF: ['CONVERTED', 'ARCHIVED'],
  CONVERTED: ['ARCHIVED'],
  DISQUALIFIED: ['ARCHIVED', 'NEW'],
  ARCHIVED: [],
};

/**
 * Application status transitions — mandate + legacy aliases.
 * UNDER_REVIEW ↔ IN_REVIEW; INFORMATION_REQUIRED ↔ DOCUMENTS_PENDING;
 * QUALIFIED/ACCEPTED ↔ APPROVED paths; CHECKOUT_PENDING ↔ CHECKOUT_READY;
 * CONVERTED ↔ COMPLETED.
 */
const REVIEW_STATUSES = ['IN_REVIEW', 'UNDER_REVIEW'] as const;
const INFO_REQUIRED_STATUSES = ['DOCUMENTS_PENDING', 'INFORMATION_REQUIRED'] as const;
const QUALIFIED_STATUSES = ['APPROVED', 'QUALIFIED', 'ACCEPTED'] as const;
const CHECKOUT_STATUSES = ['CHECKOUT_READY', 'CHECKOUT_PENDING'] as const;
const DONE_STATUSES = ['COMPLETED', 'CONVERTED'] as const;

const FROM_SUBMITTED = [
  ...REVIEW_STATUSES,
  ...INFO_REQUIRED_STATUSES,
  'QUOTATION_PENDING',
  'WITHDRAWN',
  'EXPIRED',
] as const;

const FROM_REVIEW = [
  ...INFO_REQUIRED_STATUSES,
  'INFORMATION_RECEIVED',
  'QUALIFICATION_PENDING',
  ...QUALIFIED_STATUSES,
  'DISQUALIFIED',
  'REJECTED',
  'QUOTATION_PENDING',
  'WITHDRAWN',
] as const;

const FROM_INFO_REQUIRED = [
  ...REVIEW_STATUSES,
  'INFORMATION_RECEIVED',
  'WITHDRAWN',
  'EXPIRED',
] as const;

const FROM_QUALIFIED = [
  ...CHECKOUT_STATUSES,
  'QUOTATION_PENDING',
  ...DONE_STATUSES,
] as const;

const APPLICATION_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: [...FROM_SUBMITTED],
  IN_REVIEW: [...FROM_REVIEW],
  UNDER_REVIEW: [...FROM_REVIEW],
  DOCUMENTS_PENDING: [...FROM_INFO_REQUIRED],
  INFORMATION_REQUIRED: [...FROM_INFO_REQUIRED],
  INFORMATION_RECEIVED: [
    ...REVIEW_STATUSES,
    'QUALIFICATION_PENDING',
    ...QUALIFIED_STATUSES,
    'DISQUALIFIED',
    'REJECTED',
    'QUOTATION_PENDING',
    'WITHDRAWN',
  ],
  QUALIFICATION_PENDING: [
    ...QUALIFIED_STATUSES,
    'DISQUALIFIED',
    'REJECTED',
    ...REVIEW_STATUSES,
    'QUOTATION_PENDING',
    'WITHDRAWN',
  ],
  APPROVED: [...FROM_QUALIFIED],
  QUALIFIED: [...FROM_QUALIFIED],
  ACCEPTED: [...FROM_QUALIFIED],
  QUOTATION_PENDING: [
    'QUOTATION_ISSUED',
    ...REVIEW_STATUSES,
    'REJECTED',
    'DISQUALIFIED',
    'WITHDRAWN',
    'EXPIRED',
  ],
  QUOTATION_ISSUED: [
    'ACCEPTED',
    'QUALIFIED',
    'APPROVED',
    'REJECTED',
    'DISQUALIFIED',
    ...CHECKOUT_STATUSES,
    'EXPIRED',
    'WITHDRAWN',
  ],
  CHECKOUT_READY: [...DONE_STATUSES, 'WITHDRAWN', 'CHECKOUT_PENDING'],
  CHECKOUT_PENDING: [...DONE_STATUSES, 'WITHDRAWN', 'CHECKOUT_READY'],
  DISQUALIFIED: [],
  REJECTED: [],
  WITHDRAWN: [],
  EXPIRED: [],
  COMPLETED: [],
  CONVERTED: [],
};

const DOCUMENT_TRANSITIONS: Record<string, readonly string[]> = {
  UPLOADED: ['PENDING_REVIEW', 'WITHDRAWN'],
  PENDING_REVIEW: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  ACCEPTED: ['EXPIRED'],
  REJECTED: ['UPLOADED', 'WITHDRAWN'],
  EXPIRED: [],
  WITHDRAWN: [],
};

const QUALIFICATION_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ['IN_PROGRESS', 'WITHDRAWN'],
  IN_PROGRESS: ['APPROVED', 'REJECTED', 'CONDITIONAL', 'WITHDRAWN'],
  CONDITIONAL: ['APPROVED', 'REJECTED', 'WITHDRAWN'],
  APPROVED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

const CHECKOUT_TRANSITIONS: Record<string, readonly string[]> = {
  CREATED: ['AWAITING_PAYMENT', 'CANCELLED', 'EXPIRED'],
  AWAITING_PAYMENT: ['AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED', 'EXPIRED'],
  AUTHORIZED: ['CAPTURED', 'FAILED', 'CANCELLED'],
  CAPTURED: ['HANDOFF_READY', 'COMPLETED'],
  HANDOFF_READY: ['COMPLETED'],
  FAILED: ['AWAITING_PAYMENT', 'CANCELLED'],
  CANCELLED: [],
  EXPIRED: [],
  COMPLETED: [],
};

const FORM_VERSION_PUBLISH_FROM: readonly string[] = ['DRAFT'];

function assertTransition(
  map: Record<string, readonly string[]>,
  from: string,
  to: string,
  code: string,
  label: string,
): void {
  const allowed = map[from] ?? [];
  if (!allowed.includes(to)) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `${label} transition ${from} → ${to} is not allowed`,
      [{ code, from, to }],
    );
  }
}

export function assertProspectTransition(from: string, to: string): void {
  assertTransition(PROSPECT_TRANSITIONS, from, to, 'PROSPECT_TRANSITION_FORBIDDEN', 'Prospect');
}

export function assertApplicationTransition(from: string, to: string): void {
  assertTransition(
    APPLICATION_TRANSITIONS,
    from,
    to,
    'APPLICATION_TRANSITION_FORBIDDEN',
    'Application',
  );
}

export function assertDocumentTransition(from: string, to: string): void {
  assertTransition(DOCUMENT_TRANSITIONS, from, to, 'DOCUMENT_TRANSITION_FORBIDDEN', 'Document');
}

export function assertQualificationTransition(from: string, to: string): void {
  assertTransition(
    QUALIFICATION_TRANSITIONS,
    from,
    to,
    'QUALIFICATION_TRANSITION_FORBIDDEN',
    'Qualification',
  );
}

export function assertCheckoutTransition(from: string, to: string): void {
  assertTransition(CHECKOUT_TRANSITIONS, from, to, 'CHECKOUT_TRANSITION_FORBIDDEN', 'Checkout');
}

/** Published form/content versions are immutable — no schema mutation after publish. */
export function assertFormVersionMutable(status: string, immutableAfterPublish = true): void {
  if (status === 'PUBLISHED' && immutableAfterPublish) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      'Published form versions are immutable',
      [{ code: 'FORM_VERSION_IMMUTABLE' }],
    );
  }
  if (status === 'SUPERSEDED' || status === 'ARCHIVED') {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Form version in status ${status} cannot be mutated`,
      [{ code: 'FORM_VERSION_NOT_MUTABLE', status }],
    );
  }
}

export function assertFormVersionPublishable(status: string): void {
  if (!FORM_VERSION_PUBLISH_FROM.includes(status)) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Form version status ${status} cannot be published`,
      [{ code: 'FORM_VERSION_PUBLISH_FORBIDDEN', status }],
    );
  }
}

export function assertContentVersionMutable(status: string, immutableAfterPublish = true): void {
  if (status === 'PUBLISHED' && immutableAfterPublish) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      'Published content versions are immutable',
      [{ code: 'CONTENT_VERSION_IMMUTABLE' }],
    );
  }
}

export function assertSeparationOfDuties(requesterId: string, approverId: string): void {
  if (requesterId.trim().toLowerCase() === approverId.trim().toLowerCase()) {
    throw new DomainError(
      ErrorCode.FORBIDDEN,
      'Separation of duties: actor cannot approve their own request',
      [{ code: 'SELF_APPROVAL_FORBIDDEN' }],
    );
  }
}

/** Checkout requires an active quote ref when price display mode is quote/enterprise. */
export function assertCheckoutAllowedForPriceMode(
  priceDisplayMode: PriceDisplayMode | string,
  quoteReferenceId: string | null | undefined,
): void {
  if (
    (priceDisplayMode === 'QUOTE_REQUIRED' || priceDisplayMode === 'ENTERPRISE_CUSTOM') &&
    (!quoteReferenceId || quoteReferenceId.trim().length < 1)
  ) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Checkout requires an active quote reference for this price display mode',
      [{ code: 'QUOTE_REFERENCE_REQUIRED', priceDisplayMode }],
    );
  }
}

/** Never invent prices — AUTHORITATIVE still requires an external display ref. */
export function assertPriceDisplayRef(
  priceDisplayMode: PriceDisplayMode | string,
  priceDisplayRef: string | null | undefined,
): void {
  if (priceDisplayMode === 'AUTHORITATIVE') {
    if (!priceDisplayRef || priceDisplayRef.trim().length < 2) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'AUTHORITATIVE price display requires a commercial display ref (never invent amounts)',
        [{ code: 'PRICE_DISPLAY_REF_REQUIRED' }],
      );
    }
  }
}

export function assertHandoffCompletable(
  status: string,
  externalEvidenceRef: string | null | undefined,
  subscriptionRef: string | null | undefined,
): void {
  if (status !== 'COMPLETED') return;
  if (!externalEvidenceRef || externalEvidenceRef.trim().length < 4) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Subscription handoff COMPLETED requires external evidence',
      [{ code: 'HANDOFF_EVIDENCE_REQUIRED' }],
    );
  }
  if (!subscriptionRef || subscriptionRef.trim().length < 2) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Subscription handoff COMPLETED requires subscription ref from P5',
      [{ code: 'HANDOFF_SUBSCRIPTION_REF_REQUIRED' }],
    );
  }
}

export function assertNoPaymentCredentials(metadata: Record<string, unknown> | null | undefined): void {
  if (!metadata) return;
  const forbidden = [
    'cardNumber',
    'card_number',
    'cvv',
    'cvc',
    'pan',
    'paymentToken',
    'payment_token',
    'password',
    'secret',
    'clientSecret',
    'client_secret',
  ];
  const keys = Object.keys(metadata);
  for (const key of keys) {
    if (forbidden.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Payment credentials must not be stored in P10 acquisition metadata',
        [{ code: 'PAYMENT_CREDENTIALS_FORBIDDEN', key }],
      );
    }
  }
}

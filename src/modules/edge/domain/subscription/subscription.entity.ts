import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

/**
 * P5 Subscription lifecycle — Control Plane only.
 * One subscription = one product. Account ≠ Tenant ≠ Subscription ≠ Invoice.
 */

export enum SubscriptionStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  PENDING_ACTIVATION = 'PENDING_ACTIVATION',
  PENDING_PROVISIONING = 'PENDING_PROVISIONING',
  TRIALING = 'TRIALING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  SUSPENDED = 'SUSPENDED',
  PENDING_CANCELLATION = 'PENDING_CANCELLATION',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
  FAILED_ACTIVATION = 'FAILED_ACTIVATION',
}

/** Aligns with edge_subscription_items.item_type CHECK. */
export enum SubscriptionItemType {
  PLAN = 'PLAN',
  PACKAGE = 'PACKAGE',
  ADDON = 'ADDON',
  ENTITLEMENT = 'ENTITLEMENT',
  OTHER = 'OTHER',
}

/** Aligns with edge_subscription_change_requests.change_type CHECK. */
export enum SubscriptionChangeType {
  PLAN_CHANGE = 'PLAN_CHANGE',
  ADDON_ADD = 'ADDON_ADD',
  ADDON_REMOVE = 'ADDON_REMOVE',
  QUANTITY_CHANGE = 'QUANTITY_CHANGE',
  BILLING_FREQUENCY = 'BILLING_FREQUENCY',
  ENTERPRISE_OVERLAY = 'ENTERPRISE_OVERLAY',
  OTHER = 'OTHER',
}

export enum ChangeRequestStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SCHEDULED = 'SCHEDULED',
  EXECUTING = 'EXECUTING',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum RenewalStatus {
  NOT_DUE = 'NOT_DUE',
  UPCOMING = 'UPCOMING',
  RENEWAL_REVIEW = 'RENEWAL_REVIEW',
  RENEWAL_OFFERED = 'RENEWAL_OFFERED',
  RENEWAL_PENDING = 'RENEWAL_PENDING',
  RENEWED = 'RENEWED',
  RENEWAL_FAILED = 'RENEWAL_FAILED',
  NON_RENEWAL_REQUESTED = 'NON_RENEWAL_REQUESTED',
  EXPIRED = 'EXPIRED',
}

export enum TrialStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  EXTENDED = 'EXTENDED',
  CONVERTED = 'CONVERTED',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
  CLOSED = 'CLOSED',
}

export enum SuspensionReason {
  PAYMENT_DELINQUENCY = 'PAYMENT_DELINQUENCY',
  CONTRACTUAL_BREACH = 'CONTRACTUAL_BREACH',
  SECURITY_INCIDENT = 'SECURITY_INCIDENT',
  CUSTOMER_REQUEST = 'CUSTOMER_REQUEST',
  REGULATORY_REQUIREMENT = 'REGULATORY_REQUIREMENT',
  ADMINISTRATIVE_DECISION = 'ADMINISTRATIVE_DECISION',
  PRODUCT_RESTRICTION = 'PRODUCT_RESTRICTION',
  OTHER_APPROVED = 'OTHER_APPROVED',
}

export enum CoordinationOutcome {
  REQUESTED = 'REQUESTED',
  ACCEPTED = 'ACCEPTED',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
  UNAVAILABLE = 'UNAVAILABLE',
  COMPLETE = 'COMPLETE',
}

export enum EntitlementCapabilityKind {
  FEATURE_FLAG = 'FEATURE_FLAG',
  QUOTA = 'QUOTA',
  CAPACITY = 'CAPACITY',
  LIMIT = 'LIMIT',
  MUTUALLY_EXCLUSIVE = 'MUTUALLY_EXCLUSIVE',
}

const SUBSCRIPTION_TRANSITIONS: Record<
  SubscriptionStatus,
  readonly SubscriptionStatus[]
> = {
  [SubscriptionStatus.DRAFT]: [
    SubscriptionStatus.PENDING_APPROVAL,
    SubscriptionStatus.PENDING_ACTIVATION,
    SubscriptionStatus.TRIALING,
    SubscriptionStatus.TERMINATED,
  ],
  [SubscriptionStatus.PENDING_APPROVAL]: [
    SubscriptionStatus.DRAFT,
    SubscriptionStatus.PENDING_ACTIVATION,
    SubscriptionStatus.TERMINATED,
  ],
  [SubscriptionStatus.PENDING_ACTIVATION]: [
    SubscriptionStatus.PENDING_PROVISIONING,
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.TRIALING,
    SubscriptionStatus.FAILED_ACTIVATION,
    SubscriptionStatus.TERMINATED,
  ],
  [SubscriptionStatus.PENDING_PROVISIONING]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.FAILED_ACTIVATION,
    SubscriptionStatus.TERMINATED,
  ],
  [SubscriptionStatus.TRIALING]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.SUSPENDED,
    SubscriptionStatus.EXPIRED,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.TERMINATED,
  ],
  [SubscriptionStatus.ACTIVE]: [
    SubscriptionStatus.PAST_DUE,
    SubscriptionStatus.SUSPENDED,
    SubscriptionStatus.PENDING_CANCELLATION,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.EXPIRED,
    SubscriptionStatus.TERMINATED,
  ],
  [SubscriptionStatus.PAST_DUE]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.SUSPENDED,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.TERMINATED,
  ],
  [SubscriptionStatus.SUSPENDED]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.TERMINATED,
  ],
  [SubscriptionStatus.PENDING_CANCELLATION]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.EXPIRED,
    SubscriptionStatus.TERMINATED,
  ],
  [SubscriptionStatus.CANCELLED]: [
    SubscriptionStatus.EXPIRED,
    SubscriptionStatus.TERMINATED,
  ],
  [SubscriptionStatus.EXPIRED]: [SubscriptionStatus.TERMINATED],
  [SubscriptionStatus.TERMINATED]: [],
  [SubscriptionStatus.FAILED_ACTIVATION]: [
    SubscriptionStatus.DRAFT,
    SubscriptionStatus.TERMINATED,
  ],
};

export function assertSubscriptionStatusTransition(
  from: SubscriptionStatus | string,
  to: SubscriptionStatus | string,
): void {
  const allowed = SUBSCRIPTION_TRANSITIONS[from as SubscriptionStatus] ?? [];
  if (!allowed.includes(to as SubscriptionStatus)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid subscription transition ${from} → ${to}`,
    );
  }
}

/** One subscription = one product. Never multi-product tenants via subscription. */
export function assertSingleProductSubscription(input: {
  productId?: string | null;
  itemProductIds?: readonly (string | null | undefined)[];
}): void {
  if (!input.productId) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Subscription requires a single productId',
    );
  }
  for (const pid of input.itemProductIds ?? []) {
    if (pid && pid !== input.productId) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Subscription items must belong to the same product as the subscription',
      );
    }
  }
}

export function assertNotActiveWithoutGates(input: {
  toStatus: SubscriptionStatus | string;
  commercialValidated?: boolean;
  provisioningRequired?: boolean;
  provisioningConfirmed?: boolean;
  billingRequired?: boolean;
  billingConfirmed?: boolean;
}): void {
  if (input.toStatus !== SubscriptionStatus.ACTIVE) return;
  if (!input.commercialValidated) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Cannot activate subscription without commercial validation',
    );
  }
  if (input.provisioningRequired && !input.provisioningConfirmed) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Cannot activate subscription without provisioning confirmation',
    );
  }
  if (input.billingRequired && !input.billingConfirmed) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Cannot activate subscription without billing coordination confirmation',
    );
  }
}

export function assertTrialNotPaid(input: {
  isTrial?: boolean;
  labelAsPaid?: boolean;
}): void {
  if (input.isTrial && input.labelAsPaid) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Trial must not be labeled as a paid subscription',
    );
  }
}

export function assertSuspensionReasonRequired(input: {
  toStatus: SubscriptionStatus | string;
  reason?: string | null;
}): void {
  if (input.toStatus !== SubscriptionStatus.SUSPENDED) return;
  if (!input.reason) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Suspension requires an explicit reason',
    );
  }
}

export function assertNoSelfApproval(input: {
  requesterId: string;
  decisionBy: string;
}): void {
  if (input.requesterId === input.decisionBy) {
    throw new DomainError(
      ErrorCode.FORBIDDEN,
      'Self-approval of subscription exceptions is forbidden',
    );
  }
}

export function assertHandoffCreateInput(input: {
  accountId?: string | null;
  productId?: string | null;
  salesOrderId?: string | null;
  correlationId?: string | null;
}): void {
  if (!input.accountId) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Subscription from handoff requires commercial account',
    );
  }
  if (!input.productId) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Subscription from handoff requires product',
    );
  }
  if (!input.salesOrderId) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Subscription from handoff requires sales order',
    );
  }
  if (!input.correlationId) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Subscription from handoff requires correlationId for idempotency',
    );
  }
}

export type EntitlementSource = {
  readonly sourceType: 'PLAN' | 'PACKAGE' | 'ADDON' | 'CONTRACTUAL_EXTENSION';
  readonly sourceRef?: string | null;
  readonly capabilityCode: string;
  readonly kind: EntitlementCapabilityKind | string;
  readonly enabled?: boolean | null;
  readonly numericLimit?: number | null;
  readonly mutuallyExclusiveGroup?: string | null;
};

export type ResolvedEntitlement = {
  readonly capabilityCode: string;
  readonly kind: string;
  readonly enabled: boolean;
  readonly numericLimit: number | null;
  readonly sources: readonly string[];
  readonly conflictResolution: string;
};

/**
 * Deterministic entitlement resolution.
 * Quotas/capacity: MAX, then contractual ceiling overrides.
 * Feature flags: BOOLEAN OR.
 * Mutually exclusive / unknown: REJECT.
 */
export function resolveEffectiveEntitlements(
  sources: readonly EntitlementSource[],
): readonly ResolvedEntitlement[] {
  const byCode = new Map<string, EntitlementSource[]>();
  for (const s of sources) {
    const list = byCode.get(s.capabilityCode) ?? [];
    list.push(s);
    byCode.set(s.capabilityCode, list);
  }

  const exclusiveGroups = new Map<string, Set<string>>();
  for (const s of sources) {
    if (
      s.kind === EntitlementCapabilityKind.MUTUALLY_EXCLUSIVE ||
      s.mutuallyExclusiveGroup
    ) {
      const group = s.mutuallyExclusiveGroup ?? s.capabilityCode;
      const set = exclusiveGroups.get(group) ?? new Set();
      if (s.enabled !== false) set.add(s.capabilityCode);
      exclusiveGroups.set(group, set);
    }
  }
  for (const [group, codes] of exclusiveGroups) {
    if (codes.size > 1) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Mutually exclusive entitlements conflict in group ${group}: ${[...codes].join(', ')}`,
      );
    }
  }

  const resolved: ResolvedEntitlement[] = [];
  for (const [capabilityCode, list] of byCode) {
    const kinds = new Set(list.map((s) => s.kind));
    if (kinds.size !== 1) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Capability ${capabilityCode} has conflicting kinds`,
      );
    }
    const kind = list[0]!.kind;

    if (
      kind !== EntitlementCapabilityKind.FEATURE_FLAG &&
      kind !== EntitlementCapabilityKind.QUOTA &&
      kind !== EntitlementCapabilityKind.CAPACITY &&
      kind !== EntitlementCapabilityKind.LIMIT &&
      kind !== EntitlementCapabilityKind.MUTUALLY_EXCLUSIVE
    ) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Unknown entitlement kind for ${capabilityCode}: ${kind}`,
      );
    }

    const sourceLabels = list.map((s) => `${s.sourceType}:${s.sourceRef ?? s.capabilityCode}`);

    if (kind === EntitlementCapabilityKind.FEATURE_FLAG) {
      const enabled = list.some((s) => s.enabled === true);
      resolved.push({
        capabilityCode,
        kind,
        enabled,
        numericLimit: null,
        sources: sourceLabels,
        conflictResolution: 'BOOLEAN_OR',
      });
      continue;
    }

    if (
      kind === EntitlementCapabilityKind.QUOTA ||
      kind === EntitlementCapabilityKind.CAPACITY ||
      kind === EntitlementCapabilityKind.LIMIT
    ) {
      const nonContract = list.filter((s) => s.sourceType !== 'CONTRACTUAL_EXTENSION');
      const contract = list.filter((s) => s.sourceType === 'CONTRACTUAL_EXTENSION');
      let limit: number | null = null;
      let resolution = 'MAX';
      for (const s of nonContract) {
        if (s.numericLimit == null) continue;
        limit = limit == null ? s.numericLimit : Math.max(limit, s.numericLimit);
      }
      if (contract.length) {
        const ceilings = contract
          .map((s) => s.numericLimit)
          .filter((n): n is number => n != null);
        if (ceilings.length) {
          limit = Math.min(...ceilings);
          resolution = 'CONTRACTUAL_CEILING_OVERRIDE';
        }
      }
      resolved.push({
        capabilityCode,
        kind,
        enabled: true,
        numericLimit: limit,
        sources: sourceLabels,
        conflictResolution: resolution,
      });
      continue;
    }

    // MUTUALLY_EXCLUSIVE already validated for group conflicts
    resolved.push({
      capabilityCode,
      kind,
      enabled: list.some((s) => s.enabled !== false),
      numericLimit: null,
      sources: sourceLabels,
      conflictResolution: 'MUTEX_SINGLE',
    });
  }

  return resolved.sort((a, b) => a.capabilityCode.localeCompare(b.capabilityCode));
}

export function assertSnapshotImmutable(input: { attemptedUpdate?: boolean }): void {
  if (input.attemptedUpdate) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Entitlement snapshots are immutable; create a new version',
    );
  }
}

export function nextPeriodEnd(input: {
  from: Date;
  billingFrequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'CUSTOM';
  customDays?: number;
}): Date {
  const d = new Date(input.from);
  switch (input.billingFrequency) {
    case 'MONTHLY':
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case 'QUARTERLY':
      d.setUTCMonth(d.getUTCMonth() + 3);
      break;
    case 'SEMI_ANNUAL':
      d.setUTCMonth(d.getUTCMonth() + 6);
      break;
    case 'ANNUAL':
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
    case 'CUSTOM':
      if (!input.customDays || input.customDays < 1) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'CUSTOM billing frequency requires customDays >= 1',
        );
      }
      d.setUTCDate(d.getUTCDate() + input.customDays);
      break;
    default:
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Unsupported billing frequency: ${input.billingFrequency as string}`,
      );
  }
  return d;
}

export function assertAddonCompatible(input: {
  addonProductId?: string | null;
  subscriptionProductId: string;
  available?: boolean;
  eligible?: boolean;
}): void {
  if (input.available === false) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Add-on is not available');
  }
  if (input.eligible === false) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Add-on is not eligible for this subscription',
    );
  }
  if (input.addonProductId && input.addonProductId !== input.subscriptionProductId) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Add-on belongs to a different product',
    );
  }
}

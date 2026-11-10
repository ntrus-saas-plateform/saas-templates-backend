import type { ResolvedEntitlement } from '../subscription/subscription.entity.js';

export const SUBSCRIPTION_REPOSITORY_PORT = Symbol('SUBSCRIPTION_REPOSITORY_PORT');

export type EdgeSubscription = {
  readonly id: string;
  readonly subscriptionNumber: string;
  readonly accountId: string;
  readonly contractId: string | null;
  readonly salesOrderId: string | null;
  readonly handoffId: string | null;
  readonly productId: string;
  readonly verticalId: string | null;
  readonly marketId: string | null;
  readonly packageId: string | null;
  readonly planId: string | null;
  readonly planVersion: number | null;
  readonly status: string;
  readonly subscriptionType: string;
  readonly billingFrequency: string | null;
  readonly currency: string;
  readonly startAt: Date | null;
  readonly endAt: Date | null;
  readonly currentPeriodStart: Date | null;
  readonly currentPeriodEnd: Date | null;
  readonly renewalAt: Date | null;
  readonly trialStartAt: Date | null;
  readonly trialEndAt: Date | null;
  readonly billingReference: string | null;
  readonly correlationId: string | null;
  readonly commercialValidated: boolean;
  readonly provisioningRequired: boolean;
  readonly provisioningConfirmed: boolean;
  readonly billingRequired: boolean;
  readonly billingConfirmed: boolean;
  readonly enterpriseProfile: Record<string, unknown>;
  readonly commercialSnapshot: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type SubscriptionItem = {
  readonly id: string;
  readonly subscriptionId: string;
  readonly itemType: string;
  readonly productId: string | null;
  readonly offerRef: string | null;
  readonly version: number | null;
  readonly quantity: string;
  readonly unit: string | null;
  readonly status: string;
  readonly pricingRef: string | null;
  readonly entitlementRef: string | null;
  readonly startAt: Date | null;
  readonly endAt: Date | null;
  readonly snapshot: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type SubscriptionPeriod = {
  readonly id: string;
  readonly subscriptionId: string;
  readonly periodNumber: number;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly status: string;
  readonly billingFrequency: string | null;
  readonly createdAt: Date;
};

export type StatusHistory = {
  readonly id: string;
  readonly subscriptionId: string;
  readonly fromStatus: string | null;
  readonly toStatus: string;
  readonly reason: string | null;
  readonly actorId: string | null;
  readonly correlationId: string | null;
  readonly createdAt: Date;
};

export type LifecycleEvent = {
  readonly id: string;
  readonly subscriptionId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly actorId: string | null;
  readonly correlationId: string | null;
  readonly createdAt: Date;
};

export type EntitlementSnapshot = {
  readonly id: string;
  readonly subscriptionId: string;
  readonly version: number;
  readonly periodId: string | null;
  readonly entitlements: Record<string, unknown>;
  readonly sourceOfferVersions: Record<string, unknown>;
  readonly calculationVersion: string | null;
  readonly reason: string | null;
  readonly correlationId: string | null;
  readonly validFrom: Date;
  readonly validUntil: Date | null;
  readonly createdAt: Date;
};

export type EntitlementPublication = {
  readonly id: string;
  readonly subscriptionId: string;
  readonly snapshotId: string;
  readonly status: string;
  readonly externalAck: string | null;
  readonly failureMessage: string | null;
  readonly correlationId: string | null;
  readonly createdAt: Date;
  readonly publishedAt: Date | null;
};

export type ChangeRequest = {
  readonly id: string;
  readonly subscriptionId: string;
  readonly changeType: string;
  readonly currentConfig: Record<string, unknown>;
  readonly proposedConfig: Record<string, unknown>;
  readonly requestedEffectiveAt: Date | null;
  readonly requestedBy: string | null;
  readonly reason: string | null;
  readonly approvalStatus: string;
  readonly pricingImpact: Record<string, unknown>;
  readonly entitlementImpact: Record<string, unknown>;
  readonly billingImpactRef: string | null;
  readonly provisioningImpact: Record<string, unknown>;
  readonly executionStatus: string;
  readonly correlationId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type Renewal = {
  readonly id: string;
  readonly subscriptionId: string;
  readonly renewalStatus: string;
  readonly offeredAt: Date | null;
  readonly dueAt: Date | null;
  readonly renewedPeriodStart: Date | null;
  readonly renewedPeriodEnd: Date | null;
  readonly failureMessage: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type Trial = {
  readonly id: string;
  readonly subscriptionId: string | null;
  readonly accountId: string;
  readonly productId: string;
  readonly packageId: string | null;
  readonly status: string;
  readonly startAt: Date | null;
  readonly endAt: Date | null;
  readonly durationDays: number | null;
  readonly trialEntitlements: Record<string, unknown>;
  readonly restrictions: Record<string, unknown>;
  readonly conversionSubscriptionId: string | null;
  readonly ownerAdministratorId: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type Suspension = {
  readonly id: string;
  readonly subscriptionId: string;
  readonly reason: string;
  readonly reasonDetail: string | null;
  readonly requestedBy: string | null;
  readonly approvedBy: string | null;
  readonly effectiveAt: Date;
  readonly liftedAt: Date | null;
  readonly status: string;
  readonly createdAt: Date;
};

export type Cancellation = {
  readonly id: string;
  readonly subscriptionId: string;
  readonly reason: string;
  readonly noticeDays: number | null;
  readonly effectiveAt: Date | null;
  readonly requestedBy: string | null;
  readonly approvedBy: string | null;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type BillingCoordination = {
  readonly id: string;
  readonly subscriptionId: string;
  readonly outcome: string;
  readonly billingAccountRef: string | null;
  readonly payload: Record<string, unknown>;
  readonly externalRef: string | null;
  readonly failureMessage: string | null;
  readonly correlationId: string | null;
  readonly createdAt: Date;
  readonly confirmedAt: Date | null;
};

export type ProvisioningRequest = {
  readonly id: string;
  readonly subscriptionId: string;
  readonly outcome: string;
  readonly tenantRef: string | null;
  readonly payload: Record<string, unknown>;
  readonly externalRef: string | null;
  readonly failureMessage: string | null;
  readonly correlationId: string;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
};

export type SubscriptionPolicy = {
  readonly id: string;
  readonly code: string;
  readonly policyType: string;
  readonly rules: Record<string, unknown>;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type SubscriptionApproval = {
  readonly id: string;
  readonly subscriptionId: string | null;
  readonly changeRequestId: string | null;
  readonly approvalType: string;
  readonly status: string;
  readonly requestedBy: string | null;
  readonly decisionBy: string | null;
  readonly decisionNote: string | null;
  readonly decidedAt: Date | null;
  readonly createdAt: Date;
};

export type ScheduledChange = {
  readonly id: string;
  readonly changeRequestId: string;
  readonly executeAt: Date;
  readonly status: string;
  readonly cancelledAt: Date | null;
  readonly createdAt: Date;
};

export type OverviewStats = {
  readonly totalSubscriptions: number;
  readonly byStatus: Record<string, number>;
  readonly activeTrials: number;
  readonly pendingActivation: number;
  readonly note: string;
  readonly dataQuality: 'PARTIAL' | 'COMPLETE';
};

export type SubscriptionListResult = {
  readonly items: EdgeSubscription[];
  readonly total: number;
};

export interface SubscriptionRepositoryPort {
  createSubscription(input: {
    accountId: string;
    contractId?: string | null;
    salesOrderId?: string | null;
    handoffId?: string | null;
    productId: string;
    verticalId?: string | null;
    marketId?: string | null;
    packageId?: string | null;
    planId?: string | null;
    planVersion?: number | null;
    status?: string;
    subscriptionType?: string;
    billingFrequency?: string | null;
    currency?: string;
    correlationId?: string | null;
    commercialValidated?: boolean;
    provisioningRequired?: boolean;
    billingRequired?: boolean;
    enterpriseProfile?: Record<string, unknown>;
    commercialSnapshot?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<EdgeSubscription>;

  getById(id: string): Promise<EdgeSubscription | null>;
  getByCorrelationId(correlationId: string): Promise<EdgeSubscription | null>;
  listSubscriptions(opts?: {
    accountId?: string;
    productId?: string;
    status?: string;
    handoffId?: string;
    limit?: number;
    offset?: number;
  }): Promise<SubscriptionListResult>;

  updateSubscription(
    id: string,
    patch: Partial<{
      status: string;
      planId: string | null;
      packageId: string | null;
      billingFrequency: string | null;
      currency: string;
      startAt: Date | null;
      endAt: Date | null;
      currentPeriodStart: Date | null;
      currentPeriodEnd: Date | null;
      renewalAt: Date | null;
      trialStartAt: Date | null;
      trialEndAt: Date | null;
      commercialValidated: boolean;
      provisioningConfirmed: boolean;
      billingConfirmed: boolean;
      enterpriseProfile: Record<string, unknown>;
      commercialSnapshot: Record<string, unknown>;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<EdgeSubscription>;

  appendStatusHistory(input: {
    subscriptionId: string;
    fromStatus?: string | null;
    toStatus: string;
    reason?: string | null;
    actorId?: string | null;
    correlationId?: string | null;
  }): Promise<StatusHistory>;

  appendLifecycleEvent(input: {
    subscriptionId: string;
    eventType: string;
    payload?: Record<string, unknown>;
    actorId?: string | null;
    correlationId?: string | null;
  }): Promise<LifecycleEvent>;

  listStatusHistory(subscriptionId: string): Promise<StatusHistory[]>;
  listLifecycleEvents(subscriptionId: string): Promise<LifecycleEvent[]>;

  addItem(input: {
    subscriptionId: string;
    itemType: string;
    productId?: string | null;
    offerRef?: string | null;
    version?: number | null;
    quantity?: number;
    unit?: string | null;
    status?: string;
    pricingRef?: string | null;
    entitlementRef?: string | null;
    startAt?: Date | null;
    endAt?: Date | null;
    snapshot?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<SubscriptionItem>;

  listItems(subscriptionId: string): Promise<SubscriptionItem[]>;

  updateItemStatus(
    itemId: string,
    status: string,
    endAt?: Date | null,
  ): Promise<SubscriptionItem>;

  createPeriod(input: {
    subscriptionId: string;
    periodNumber: number;
    startsAt: Date;
    endsAt: Date;
    status?: string;
    billingFrequency?: string | null;
  }): Promise<SubscriptionPeriod>;

  listPeriods(subscriptionId: string): Promise<SubscriptionPeriod[]>;

  createEntitlementSnapshot(input: {
    subscriptionId: string;
    periodId?: string | null;
    entitlements: Record<string, unknown> | { resolved: readonly ResolvedEntitlement[] };
    sourceOfferVersions?: Record<string, unknown>;
    calculationVersion?: string | null;
    reason?: string | null;
    correlationId?: string | null;
  }): Promise<EntitlementSnapshot>;

  listSnapshots(subscriptionId: string): Promise<EntitlementSnapshot[]>;
  getLatestSnapshot(subscriptionId: string): Promise<EntitlementSnapshot | null>;

  createPublication(input: {
    subscriptionId: string;
    snapshotId: string;
    status?: string;
    correlationId?: string | null;
  }): Promise<EntitlementPublication>;

  listPublications(subscriptionId: string): Promise<EntitlementPublication[]>;

  createChangeRequest(input: {
    subscriptionId: string;
    changeType: string;
    currentConfig?: Record<string, unknown>;
    proposedConfig?: Record<string, unknown>;
    requestedEffectiveAt?: Date | null;
    requestedBy?: string | null;
    reason?: string | null;
    approvalStatus?: string;
    pricingImpact?: Record<string, unknown>;
    entitlementImpact?: Record<string, unknown>;
    billingImpactRef?: string | null;
    provisioningImpact?: Record<string, unknown>;
    correlationId?: string | null;
  }): Promise<ChangeRequest>;

  listChangeRequests(subscriptionId: string): Promise<ChangeRequest[]>;
  getChangeRequest(id: string): Promise<ChangeRequest | null>;
  updateChangeRequest(
    id: string,
    patch: Partial<{
      approvalStatus: string;
      executionStatus: string;
      proposedConfig: Record<string, unknown>;
    }>,
  ): Promise<ChangeRequest>;

  createRenewal(input: {
    subscriptionId: string;
    renewalStatus?: string;
    offeredAt?: Date | null;
    dueAt?: Date | null;
    renewedPeriodStart?: Date | null;
    renewedPeriodEnd?: Date | null;
    metadata?: Record<string, unknown>;
  }): Promise<Renewal>;

  listRenewals(subscriptionId: string): Promise<Renewal[]>;
  updateRenewal(
    id: string,
    patch: Partial<{
      renewalStatus: string;
      renewedPeriodStart: Date | null;
      renewedPeriodEnd: Date | null;
      failureMessage: string | null;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<Renewal>;

  createTrial(input: {
    subscriptionId?: string | null;
    accountId: string;
    productId: string;
    packageId?: string | null;
    status?: string;
    startAt?: Date | null;
    endAt?: Date | null;
    durationDays?: number | null;
    trialEntitlements?: Record<string, unknown>;
    restrictions?: Record<string, unknown>;
    ownerAdministratorId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<Trial>;

  listTrials(opts?: {
    accountId?: string;
    subscriptionId?: string;
    status?: string;
    limit?: number;
  }): Promise<Trial[]>;

  updateTrial(
    id: string,
    patch: Partial<{
      status: string;
      endAt: Date | null;
      conversionSubscriptionId: string | null;
      subscriptionId: string | null;
    }>,
  ): Promise<Trial>;

  listSuspensions(subscriptionId: string): Promise<Suspension[]>;
  updateSuspension(
    id: string,
    patch: Partial<{
      status: string;
      liftedAt: Date | null;
    }>,
  ): Promise<Suspension>;

  createSuspension(input: {
    subscriptionId: string;
    reason: string;
    reasonDetail?: string | null;
    requestedBy?: string | null;
    approvedBy?: string | null;
    effectiveAt?: Date;
    status?: string;
  }): Promise<Suspension>;

  listCancellations(subscriptionId: string): Promise<Cancellation[]>;

  createCancellation(input: {
    subscriptionId: string;
    reason: string;
    noticeDays?: number | null;
    effectiveAt?: Date | null;
    requestedBy?: string | null;
    approvedBy?: string | null;
    status?: string;
  }): Promise<Cancellation>;

  createBillingCoordination(input: {
    subscriptionId: string;
    outcome?: string;
    billingAccountRef?: string | null;
    payload?: Record<string, unknown>;
    externalRef?: string | null;
    failureMessage?: string | null;
    correlationId?: string | null;
  }): Promise<BillingCoordination>;

  updateBillingCoordination(
    id: string,
    patch: Partial<{
      outcome: string;
      externalRef: string | null;
      failureMessage: string | null;
      confirmedAt: Date | null;
    }>,
  ): Promise<BillingCoordination>;

  listBillingCoordination(subscriptionId: string): Promise<BillingCoordination[]>;

  updatePublication(
    id: string,
    patch: Partial<{
      status: string;
      externalAck: string | null;
      failureMessage: string | null;
      publishedAt: Date | null;
    }>,
  ): Promise<EntitlementPublication>;

  getTrialById(id: string): Promise<Trial | null>;

  createProvisioningRequest(input: {
    subscriptionId: string;
    outcome?: string;
    tenantRef?: string | null;
    payload?: Record<string, unknown>;
    externalRef?: string | null;
    failureMessage?: string | null;
    correlationId: string;
  }): Promise<ProvisioningRequest>;

  getProvisioningByCorrelation(correlationId: string): Promise<ProvisioningRequest | null>;
  listProvisioningRequests(subscriptionId: string): Promise<ProvisioningRequest[]>;
  updateProvisioningRequest(
    id: string,
    patch: Partial<{
      outcome: string;
      tenantRef: string | null;
      externalRef: string | null;
      failureMessage: string | null;
      completedAt: Date | null;
    }>,
  ): Promise<ProvisioningRequest>;

  getPolicyByCode(code: string): Promise<SubscriptionPolicy | null>;
  listPolicies(opts?: { status?: string }): Promise<SubscriptionPolicy[]>;
  upsertPolicy(input: {
    code: string;
    policyType?: string;
    rules?: Record<string, unknown>;
    status?: string;
  }): Promise<SubscriptionPolicy>;

  createApproval(input: {
    subscriptionId?: string | null;
    changeRequestId?: string | null;
    approvalType: string;
    status?: string;
    requestedBy?: string | null;
    decisionBy?: string | null;
    decisionNote?: string | null;
    decidedAt?: Date | null;
  }): Promise<SubscriptionApproval>;

  listApprovals(opts?: {
    subscriptionId?: string;
    changeRequestId?: string;
    status?: string;
    limit?: number;
  }): Promise<SubscriptionApproval[]>;

  listDueScheduledChanges(asOf?: Date): Promise<
    Array<ScheduledChange & { subscriptionId: string; changeRequestId: string }>
  >;

  createScheduledChange(input: {
    changeRequestId: string;
    executeAt: Date;
    status?: string;
  }): Promise<ScheduledChange>;

  listScheduledChanges(changeRequestId: string): Promise<ScheduledChange[]>;
  cancelScheduledChange(id: string): Promise<ScheduledChange>;
  markScheduledExecuted(id: string): Promise<ScheduledChange>;

  getOverviewStats(): Promise<OverviewStats>;

  beginIdempotency(input: {
    idempotencyKey: string;
    operation: string;
    resourceType: string;
  }): Promise<{
    replay: boolean;
    resourceId: string | null;
    responseSnapshot: Record<string, unknown>;
  }>;

  completeIdempotency(input: {
    idempotencyKey: string;
    resourceId?: string | null;
    responseSnapshot: Record<string, unknown>;
  }): Promise<void>;
}

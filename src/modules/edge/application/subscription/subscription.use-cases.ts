import { createHash, randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import type { SubscriptionRepositoryPort } from '../../domain/ports/subscription-repository.port.js';
import type { SubscriptionTenantAssociationPort } from '../../domain/ports/subscription-tenant-association.port.js';
import type { SalesCommerceRepositoryPort } from '../../domain/ports/sales-commerce-repository.port.js';
import { assertHandoffPackageComplete } from '../../domain/sales/sales-commerce.entity.js';
import {
  assertAddonCompatible,
  assertHandoffCreateInput,
  assertNoSelfApproval,
  assertNotActiveWithoutGates,
  assertSingleProductSubscription,
  assertSubscriptionStatusTransition,
  assertSuspensionReasonRequired,
  assertTrialNotPaid,
  nextPeriodEnd,
  SubscriptionChangeType,
  SubscriptionItemType,
  SubscriptionStatus,
} from '../../domain/subscription/subscription.entity.js';
import {
  buildBbEntitlementProjectionFromItems,
  collectEntitlementSourcesFromItems,
  projectResolvedEntitlementsToBbControl,
  resolvedFromSnapshotEntitlements,
} from '../../domain/subscription/bb-entitlement-projection.js';
import {
  resolveEffectiveEntitlements,
  type EntitlementSource,
} from '../../domain/subscription/subscription.entity.js';
import { assessEntitlementPayload } from '../../domain/provisioning/entitlement-payload.guard.js';
import type { ControlV1BusinessBackendClient } from '../../infrastructure/product-control/control-v1-business-backend.client.js';
import type { BindSubscriptionTenantAssociationUseCase } from './subscription-tenant-association.use-cases.js';
import { assertPlanChangeKeepsProductTenant } from '../../domain/subscription/subscription-tenant-association.js';
import {
  commercialPlanEntitlementSnapshot,
} from '../../domain/commercial/commercial-plan-entitlements.js';
import {
  extractCommercialPlanCode,
  mergeSqlCapabilityRowsIntoCatalogCapabilities,
  resolveCommercialCatalogEntitlements,
  type SqlCapabilityEntitlementRow,
} from '../../domain/commercial/resolve-commercial-catalog-entitlements.js';
import type { CommercialRepositoryPort } from '../../domain/ports/commercial-repository.port.js';

/** Charge les caps SQL d'un plan (config gestion) pour overlay sur snapshot TS. */
async function loadSqlCapabilityRows(
  commercial: CommercialRepositoryPort | undefined,
  planCode: string | null | undefined,
): Promise<readonly SqlCapabilityEntitlementRow[]> {
  const code = planCode?.trim();
  if (!commercial || !code) return [];
  return commercial.listPlanCapabilityEntitlementRowsByPlanCode(code);
}

/** Charge les caps SQL d'un package (ex. PKG_REST_CAFE_CONTROLLED quotas). */
async function loadSqlPackageCapabilityRows(
  commercial: CommercialRepositoryPort | undefined,
  packageCode: string | null | undefined,
): Promise<readonly SqlCapabilityEntitlementRow[]> {
  const code = packageCode?.trim();
  if (!commercial || !code) return [];
  return commercial.listPackageCapabilityEntitlementRowsByPackageCode(code);
}
import {
  resolveSubscriptionTenantRef,
  syncBbTenantLifecycle,
} from './subscription-bb-lifecycle.js';
import type { BillingRepositoryPort } from '../../domain/ports/billing-repository.port.js';
import {
  assertActivationNotAfterFailedPaymentOnly,
  assertBillingConfirmRequiresCollectedPayment,
} from '../../domain/billing/payment-activation-guard.js';
import {
  createBillingCoordinationConfirmedEvent,
  createBillingCoordinationRequestedEvent,
  createEntitlementSnapshotCreatedEvent,
  createEntitlementsPublishedEvent,
  createProvisioningCompletedEvent,
  createProvisioningRequestedEvent,
  createSubscriptionActivatedEvent,
  createSubscriptionActivationFailedEvent,
  createSubscriptionActivationRequestedEvent,
  createSubscriptionApprovedEvent,
  createSubscriptionHandoffConsumedEvent,
  createSubscriptionCancelledEvent,
  createSubscriptionChangedEvent,
  createSubscriptionCreatedEvent,
  createSubscriptionPastDueEvent,
  createSubscriptionReactivatedEvent,
  createSubscriptionRenewedEvent,
  createSubscriptionSubmittedEvent,
  createSubscriptionSuspendedEvent,
  createSubscriptionTerminatedEvent,
  createTrialConvertedEvent,
  createTrialStartedEvent,
  EDGE_SUBSCRIPTION_OUTBOX_TENANT,
} from '../../domain/subscription/subscription.events.js';
import type { SubscriptionBillingCoordinationPort } from '../../domain/subscription/billing-coordination.port.js';
import type { SubscriptionProvisioningCoordinationPort } from '../../domain/subscription/provisioning-coordination.port.js';
import { AcceptSalesHandoffUseCase } from '../sales/sales-commerce.use-cases.js';

async function enqueueSubscription(
  outbox: ControlPlaneOutboxTransactionService | undefined,
  event: IntegrationEvent<unknown>,
) {
  if (!outbox) return;
  await outbox.runWithOutbox(EDGE_SUBSCRIPTION_OUTBOX_TENANT, async (_c, enqueue) => {
    await enqueue(event);
  });
}

export async function transitionSubscription(
  repo: SubscriptionRepositoryPort,
  input: {
    subscriptionId: string;
    from: string;
    to: string;
    actorId: string;
    correlationId: string;
    reason?: string | null;
  },
) {
  assertSubscriptionStatusTransition(input.from, input.to);
  const updated = await repo.updateSubscription(input.subscriptionId, { status: input.to });
  await repo.appendStatusHistory({
    subscriptionId: input.subscriptionId,
    fromStatus: input.from,
    toStatus: input.to,
    reason: input.reason ?? null,
    actorId: input.actorId,
    correlationId: input.correlationId,
  });
  await repo.appendLifecycleEvent({
    subscriptionId: input.subscriptionId,
    eventType: 'STATUS_CHANGED',
    payload: { from: input.from, to: input.to, reason: input.reason ?? null },
    actorId: input.actorId,
    correlationId: input.correlationId,
  });
  return updated;
}

export class CreateSubscriptionFromHandoffUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly commerce?: SalesCommerceRepositoryPort,
    private readonly acceptHandoff?: AcceptSalesHandoffUseCase,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly commercial?: CommercialRepositoryPort,
  ) {}

  async execute(input: { actorId: string; handoffId: string; acceptHandoff?: boolean }) {
    if (!this.commerce) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Sales commerce repository not available');
    }
    const handoff = await this.commerce.getHandoff(input.handoffId);
    if (!handoff) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Handoff not found');

    const pkg = handoff.packagePayload ?? {};
    const productId = String(pkg.productId ?? '');
    const accountId = handoff.accountId;
    const salesOrderId = handoff.salesOrderId;
    const correlationId = handoff.correlationId;

    assertHandoffCreateInput({
      accountId,
      productId,
      salesOrderId,
      correlationId,
    });

    const commercialTermsPresent =
      Object.keys((pkg.commercialTerms as Record<string, unknown>) ?? {}).length > 0 ||
      Number(pkg.totalAmount ?? 0) > 0;

    assertHandoffPackageComplete({
      accountId,
      productId,
      commercialTermsPresent,
      requireContract: Boolean(pkg.contractId),
      contractExecutedWhenRequired: true,
      requireQuote: false,
    });

    const existing = await this.subscriptions.getByCorrelationId(correlationId);
    if (existing) return existing;

    const offerConfiguration = (pkg.offerConfiguration as Record<string, unknown>) ?? {};
    const planId = offerConfiguration.planId as string | undefined;
    const packageId = offerConfiguration.solutionPackageId as string | undefined;
    const packageCode =
      typeof offerConfiguration.packageCode === 'string'
        ? offerConfiguration.packageCode
        : typeof offerConfiguration.solutionPackageCode === 'string'
          ? offerConfiguration.solutionPackageCode
          : null;
    const planCode =
      extractCommercialPlanCode(offerConfiguration, pkg as Record<string, unknown>) ??
      (typeof offerConfiguration.planCode === 'string' ? offerConfiguration.planCode : null);
    const catalog = planCode ? commercialPlanEntitlementSnapshot(planCode) : null;
    const sqlRows = [
      ...(await loadSqlCapabilityRows(this.commercial, planCode)),
      ...(await loadSqlPackageCapabilityRows(this.commercial, packageCode)),
    ];
    const capabilities = mergeSqlCapabilityRowsIntoCatalogCapabilities(
      resolveCommercialCatalogEntitlements({ planCode, packageCode }),
      sqlRows,
    );
    const profileCode = catalog?.profileCode ?? null;

    const sub = await this.subscriptions.createSubscription({
      accountId,
      contractId: handoff.contractId,
      salesOrderId,
      handoffId: handoff.id,
      productId,
      planId: planId ?? null,
      packageId: packageId ?? null,
      correlationId,
      commercialValidated: commercialTermsPresent,
      commercialSnapshot: pkg as Record<string, unknown>,
      metadata: {
        ...(typeof pkg.metadata === 'object' && pkg.metadata ? (pkg.metadata as object) : {}),
        ...(planCode ? { planCode, productCode: catalog?.productFamily } : {}),
        ...(profileCode ? { profileCode } : {}),
      },
      createdBy: input.actorId,
      status: SubscriptionStatus.DRAFT,
    });

    if (planId || packageId || catalog || capabilities.length) {
      const snapshot: Record<string, unknown> = {
        ...offerConfiguration,
        ...(planCode ? { planCode } : {}),
        ...(capabilities.length
          ? { capabilities }
          : catalog
            ? { capabilities: catalog.capabilities, productFamily: catalog.productFamily }
            : {}),
        ...(catalog ? { productFamily: catalog.productFamily } : {}),
      };
      await this.subscriptions.addItem({
        subscriptionId: sub.id,
        itemType: packageId && !catalog ? SubscriptionItemType.PACKAGE : SubscriptionItemType.PLAN,
        productId,
        offerRef: planCode ?? planId ?? packageId ?? null,
        snapshot,
      });
    }

    await enqueueSubscription(
      this.outbox,
      createSubscriptionCreatedEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: sub.id,
        accountId,
        productId,
        salesOrderId,
      }),
    );
    await enqueueSubscription(
      this.outbox,
      createSubscriptionHandoffConsumedEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: sub.id,
        handoffId: handoff.id,
      }),
    );

    if (input.acceptHandoff && this.acceptHandoff) {
      await this.acceptHandoff.execute({ actorId: input.actorId, handoffId: handoff.id });
    }

    return sub;
  }
}

export class CreateSubscriptionUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly commercial?: CommercialRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    accountId: string;
    productId: string;
    contractId?: string | null;
    planId?: string | null;
    packageId?: string | null;
    /** Commercial plan code e.g. SYNTIX_LITE / OKAPI_REST_STARTER / OKAPI_REST_CAFE_CONTROLLED */
    planCode?: string | null;
    currency?: string;
    billingFrequency?: string | null;
    correlationId?: string;
    enterpriseProfile?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    assertSingleProductSubscription({ productId: input.productId });
    const correlationId = input.correlationId ?? randomUUID();
    const planCode =
      input.planCode?.trim() ||
      extractCommercialPlanCode(input.metadata, input.enterpriseProfile) ||
      null;
    const catalog = planCode ? commercialPlanEntitlementSnapshot(planCode) : null;
    const sqlRows = await loadSqlCapabilityRows(this.commercial, planCode);
    const capabilities = mergeSqlCapabilityRowsIntoCatalogCapabilities(
      resolveCommercialCatalogEntitlements({ planCode }),
      sqlRows,
    );
    const profileCode = catalog?.profileCode ?? null;
    const sub = await this.subscriptions.createSubscription({
      accountId: input.accountId,
      productId: input.productId,
      contractId: input.contractId,
      planId: input.planId,
      packageId: input.packageId,
      currency: input.currency,
      billingFrequency: input.billingFrequency,
      enterpriseProfile: input.enterpriseProfile,
      correlationId,
      status: SubscriptionStatus.DRAFT,
      createdBy: input.actorId,
      metadata: {
        ...(input.metadata ?? {}),
        ...(planCode ? { planCode, productCode: catalog?.productFamily } : {}),
        ...(profileCode ? { profileCode } : {}),
      },
    });
    if (catalog || capabilities.length) {
      await this.subscriptions.addItem({
        subscriptionId: sub.id,
        itemType: SubscriptionItemType.PLAN,
        productId: input.productId,
        offerRef: catalog?.planCode ?? planCode,
        snapshot: {
          planCode: catalog?.planCode ?? planCode,
          productFamily: catalog?.productFamily,
          capabilities: capabilities.length ? capabilities : (catalog?.capabilities ?? []),
        },
      });
    }
    await enqueueSubscription(
      this.outbox,
      createSubscriptionCreatedEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: sub.id,
        accountId: input.accountId,
        productId: input.productId,
        salesOrderId: null,
      }),
    );
    return sub;
  }
}

export class GetSubscriptionUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  async execute(id: string) {
    const sub = await this.subscriptions.getById(id);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    return sub;
  }
}

export class ListSubscriptionsUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  execute(opts?: Parameters<SubscriptionRepositoryPort['listSubscriptions']>[0]) {
    return this.subscriptions.listSubscriptions(opts);
  }
}

export class GetSubscriptionWorkspaceUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly associations?: SubscriptionTenantAssociationPort,
  ) {}
  async execute(subscriptionId: string) {
    const sub = await this.subscriptions.getById(subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const [items, periods, snapshot, statusHistory, lifecycle, associationList, activeAssociation] =
      await Promise.all([
        this.subscriptions.listItems(subscriptionId),
        this.subscriptions.listPeriods(subscriptionId),
        this.subscriptions.getLatestSnapshot(subscriptionId),
        this.subscriptions.listStatusHistory(subscriptionId),
        this.subscriptions.listLifecycleEvents(subscriptionId),
        this.associations?.listBySubscription(subscriptionId) ?? Promise.resolve([]),
        this.associations?.getActiveBySubscription(subscriptionId) ?? Promise.resolve(null),
      ]);
    return {
      subscription: sub,
      items,
      periods,
      latestEntitlements: snapshot,
      timeline: lifecycle,
      statusHistory,
      associations: associationList,
      activeAssociation,
    };
  }
}

export class GetSubscriptionHistoryUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  async execute(subscriptionId: string) {
    const sub = await this.subscriptions.getById(subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const [statusHistory, timeline] = await Promise.all([
      this.subscriptions.listStatusHistory(subscriptionId),
      this.subscriptions.listLifecycleEvents(subscriptionId),
    ]);
    return { statusHistory, timeline };
  }
}

export class SubmitSubscriptionUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: { actorId: string; subscriptionId: string }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const needsApproval = Boolean(
      (sub.enterpriseProfile as { requiresApproval?: boolean }).requiresApproval,
    );
    const to = needsApproval
      ? SubscriptionStatus.PENDING_APPROVAL
      : SubscriptionStatus.PENDING_ACTIVATION;
    const correlationId = randomUUID();
    const updated = await transitionSubscription(this.subscriptions, {
      subscriptionId: sub.id,
      from: sub.status,
      to,
      actorId: input.actorId,
      correlationId,
    });
    await enqueueSubscription(
      this.outbox,
      createSubscriptionSubmittedEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: sub.id,
      }),
    );
    return updated;
  }
}

export class ApproveSubscriptionUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: { actorId: string; subscriptionId: string; requestedBy?: string }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    if (sub.status !== SubscriptionStatus.PENDING_APPROVAL) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Subscription must be PENDING_APPROVAL to approve',
      );
    }
    const requesterId = input.requestedBy ?? sub.createdBy ?? input.actorId;
    assertNoSelfApproval({ requesterId, decisionBy: input.actorId });
    const correlationId = randomUUID();
    await this.subscriptions.createApproval({
      subscriptionId: sub.id,
      approvalType: 'SUBSCRIPTION_ACTIVATION',
      status: 'APPROVED',
      requestedBy: requesterId,
      decisionBy: input.actorId,
      decidedAt: new Date(),
    });
    const updated = await transitionSubscription(this.subscriptions, {
      subscriptionId: sub.id,
      from: sub.status,
      to: SubscriptionStatus.PENDING_ACTIVATION,
      actorId: input.actorId,
      correlationId,
    });
    await enqueueSubscription(
      this.outbox,
      createSubscriptionApprovedEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: sub.id,
      }),
    );
    return updated;
  }
}

export class RequestActivationUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly provisioning?: SubscriptionProvisioningCoordinationPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: { actorId: string; subscriptionId: string }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const correlationId = randomUUID();
    const activationTarget = sub.provisioningRequired
      ? SubscriptionStatus.PENDING_PROVISIONING
      : SubscriptionStatus.PENDING_ACTIVATION;
    const updated = await transitionSubscription(this.subscriptions, {
      subscriptionId: sub.id,
      from: sub.status,
      to: activationTarget,
      actorId: input.actorId,
      correlationId,
    });

    if (sub.provisioningRequired) {
      let outcome = 'REQUESTED';
      let externalRef: string | null = null;
      let failureMessage: string | null = null;
      if (this.provisioning) {
        const adapterResult = await this.provisioning.requestProvisioning({
          subscriptionId: sub.id,
          subscriptionNumber: sub.subscriptionNumber,
          accountId: sub.accountId,
          productId: sub.productId,
          correlationId,
        });
        outcome =
          adapterResult.outcome === 'UNAVAILABLE' ? 'UNAVAILABLE' : adapterResult.outcome;
        externalRef =
          adapterResult.outcome !== 'UNAVAILABLE' ? adapterResult.externalRef ?? null : null;
        failureMessage =
          adapterResult.outcome === 'UNAVAILABLE' ? adapterResult.failureMessage : null;
      }
      const prov = await this.subscriptions.createProvisioningRequest({
        subscriptionId: sub.id,
        correlationId,
        outcome,
        externalRef,
        failureMessage,
        payload: { source: 'activation.requested' },
      });
      await enqueueSubscription(
        this.outbox,
        createProvisioningRequestedEvent({
          actorId: input.actorId,
          correlationId,
          subscriptionId: sub.id,
          requestId: prov.id,
        }),
      );
    }

    await enqueueSubscription(
      this.outbox,
      createSubscriptionActivationRequestedEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: sub.id,
      }),
    );
    return updated;
  }
}

export class ActivateSubscriptionUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly billing?: BillingRepositoryPort,
  ) {}

  async execute(input: { actorId: string; subscriptionId: string }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const policy = await this.subscriptions.getPolicyByCode('ACTIVATION_GATES');
    const rules = (policy?.rules ?? {}) as {
      provisioningRequired?: boolean;
      billingRequired?: boolean;
    };
    const provisioningRequired =
      rules.provisioningRequired !== undefined
        ? Boolean(rules.provisioningRequired)
        : sub.provisioningRequired;
    const billingRequired =
      rules.billingRequired !== undefined
        ? Boolean(rules.billingRequired)
        : sub.billingRequired;
    const correlationId = randomUUID();
    try {
      assertNotActiveWithoutGates({
        toStatus: SubscriptionStatus.ACTIVE,
        commercialValidated: sub.commercialValidated,
        provisioningRequired,
        provisioningConfirmed: sub.provisioningConfirmed,
        billingRequired,
        billingConfirmed: sub.billingConfirmed,
      });
      if (this.billing && billingRequired) {
        const account = await this.billing.getBillingAccountForSubscription(sub.id);
        const intents = account
          ? await this.billing.listPaymentIntents({
              billingAccountId: account.id,
              limit: 100,
            })
          : [];
        assertActivationNotAfterFailedPaymentOnly({
          billingRequired,
          paymentIntentStatuses: intents.map((i) => i.status),
        });
      }
    } catch (err) {
      if (
        err instanceof DomainError &&
        (sub.status === SubscriptionStatus.PENDING_ACTIVATION ||
          sub.status === SubscriptionStatus.PENDING_PROVISIONING)
      ) {
        await enqueueSubscription(
          this.outbox,
          createSubscriptionActivationFailedEvent({
            actorId: input.actorId,
            correlationId,
            subscriptionId: sub.id,
            reason: err.message,
          }),
        );
        await transitionSubscription(this.subscriptions, {
          subscriptionId: sub.id,
          from: sub.status,
          to: SubscriptionStatus.FAILED_ACTIVATION,
          actorId: input.actorId,
          correlationId,
          reason: err.message,
        });
      }
      throw err;
    }
    const updated = await transitionSubscription(this.subscriptions, {
      subscriptionId: sub.id,
      from: sub.status,
      to: SubscriptionStatus.ACTIVE,
      actorId: input.actorId,
      correlationId,
    });
    await enqueueSubscription(
      this.outbox,
      createSubscriptionActivatedEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: sub.id,
      }),
    );
    return updated;
  }
}

/** RGOM-E7.6 — ACTIVE/TRIALING → PAST_DUE during billing grace. */
export class MarkSubscriptionPastDueUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    reason: string;
    collectionCaseId?: string | null;
    graceEndsAt?: Date | null;
  }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    if (sub.status === SubscriptionStatus.PAST_DUE) return sub;
    const correlationId = randomUUID();
    const updated = await transitionSubscription(this.subscriptions, {
      subscriptionId: sub.id,
      from: sub.status,
      to: SubscriptionStatus.PAST_DUE,
      actorId: input.actorId,
      correlationId,
      reason: input.reason,
    });
    await this.subscriptions.appendLifecycleEvent({
      subscriptionId: sub.id,
      eventType: 'PAST_DUE',
      payload: {
        reason: input.reason,
        collectionCaseId: input.collectionCaseId ?? null,
        graceEndsAt: input.graceEndsAt?.toISOString() ?? null,
      },
      actorId: input.actorId,
      correlationId,
    });
    await enqueueSubscription(
      this.outbox,
      createSubscriptionPastDueEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: sub.id,
        reason: input.reason,
        collectionCaseId: input.collectionCaseId,
        graceEndsAt: input.graceEndsAt?.toISOString() ?? null,
      }),
    );
    return updated;
  }
}

export class SuspendSubscriptionUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly bbClient?: ControlV1BusinessBackendClient,
    private readonly associations?: SubscriptionTenantAssociationPort,
  ) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    reason: string;
    /** Default true — sync BB tenant when configured. */
    syncBb?: boolean;
  }) {
    assertSuspensionReasonRequired({
      toStatus: SubscriptionStatus.SUSPENDED,
      reason: input.reason,
    });
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const correlationId = randomUUID();
    const updated = await transitionSubscription(this.subscriptions, {
      subscriptionId: sub.id,
      from: sub.status,
      to: SubscriptionStatus.SUSPENDED,
      actorId: input.actorId,
      correlationId,
      reason: input.reason,
    });
    await this.subscriptions.createSuspension({
      subscriptionId: sub.id,
      reason: input.reason,
      requestedBy: input.actorId,
    });

    if (input.syncBb !== false) {
      const tenantRef = await resolveSubscriptionTenantRef({
        subscriptions: this.subscriptions,
        associations: this.associations,
        subscriptionId: sub.id,
        metadata: sub.metadata as Record<string, unknown> | undefined,
      });
      if (tenantRef) {
        await syncBbTenantLifecycle({
          bbClient: this.bbClient,
          action: 'suspend',
          tenantId: tenantRef,
          reason: input.reason,
          correlationId,
        });
      }
    }

    await enqueueSubscription(
      this.outbox,
      createSubscriptionSuspendedEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: sub.id,
        reason: input.reason,
      }),
    );
    return updated;
  }
}

export class ReactivateSubscriptionUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly bbClient?: ControlV1BusinessBackendClient,
    private readonly associations?: SubscriptionTenantAssociationPort,
    private readonly publishEntitlements?: {
      execute(input: {
        actorId: string;
        subscriptionId: string;
        snapshotId?: string;
      }): Promise<unknown>;
    },
  ) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    syncBb?: boolean;
    republishEntitlements?: boolean;
  }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const correlationId = randomUUID();
    const suspensions = await this.subscriptions.listSuspensions(sub.id);
    const activeSuspension = suspensions.find((s) => s.status === 'ACTIVE');
    if (activeSuspension) {
      await this.subscriptions.updateSuspension(activeSuspension.id, {
        status: 'LIFTED',
        liftedAt: new Date(),
      });
      await this.subscriptions.appendLifecycleEvent({
        subscriptionId: sub.id,
        eventType: 'SUSPENSION_LIFTED',
        payload: { suspensionId: activeSuspension.id, reason: 'reactivation' },
        actorId: input.actorId,
        correlationId,
      });
    }

    // PAST_DUE → ACTIVE is allowed by transition map; SUSPENDED → ACTIVE too.
    const updated = await transitionSubscription(this.subscriptions, {
      subscriptionId: sub.id,
      from: sub.status,
      to: SubscriptionStatus.ACTIVE,
      actorId: input.actorId,
      correlationId,
    });

    if (input.syncBb !== false) {
      const tenantRef = await resolveSubscriptionTenantRef({
        subscriptions: this.subscriptions,
        associations: this.associations,
        subscriptionId: sub.id,
        metadata: sub.metadata as Record<string, unknown> | undefined,
      });
      if (tenantRef) {
        await syncBbTenantLifecycle({
          bbClient: this.bbClient,
          action: 'resume',
          tenantId: tenantRef,
          reason: 'reactivation',
          correlationId,
        });
      }
    }

    if (input.republishEntitlements !== false && this.publishEntitlements) {
      const snapshot = await this.subscriptions.getLatestSnapshot(sub.id);
      if (snapshot) {
        await this.publishEntitlements.execute({
          actorId: input.actorId,
          subscriptionId: sub.id,
          snapshotId: snapshot.id,
        });
      }
    }

    await enqueueSubscription(
      this.outbox,
      createSubscriptionReactivatedEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: sub.id,
      }),
    );
    return updated;
  }
}

export class CancelSubscriptionUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    reason: string;
    noticeDays?: number;
  }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const correlationId = randomUUID();
    const noticeDays = input.noticeDays ?? 0;
    const targetStatus =
      noticeDays > 0 ? SubscriptionStatus.PENDING_CANCELLATION : SubscriptionStatus.CANCELLED;
    const effectiveAt =
      noticeDays > 0
        ? new Date(Date.now() + noticeDays * 24 * 60 * 60 * 1000)
        : new Date();
    const updated = await transitionSubscription(this.subscriptions, {
      subscriptionId: sub.id,
      from: sub.status,
      to: targetStatus,
      actorId: input.actorId,
      correlationId,
      reason: input.reason,
    });
    await this.subscriptions.createCancellation({
      subscriptionId: sub.id,
      reason: input.reason,
      noticeDays: noticeDays > 0 ? noticeDays : null,
      effectiveAt,
      requestedBy: input.actorId,
      status: noticeDays > 0 ? 'REQUESTED' : 'EFFECTIVE',
    });
    await enqueueSubscription(
      this.outbox,
      createSubscriptionCancelledEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: sub.id,
        reason: input.reason,
      }),
    );
    return updated;
  }
}

export class TerminateSubscriptionUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: { actorId: string; subscriptionId: string; reason?: string }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const correlationId = randomUUID();
    const updated = await transitionSubscription(this.subscriptions, {
      subscriptionId: sub.id,
      from: sub.status,
      to: SubscriptionStatus.TERMINATED,
      actorId: input.actorId,
      correlationId,
      reason: input.reason,
    });
    await enqueueSubscription(
      this.outbox,
      createSubscriptionTerminatedEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: sub.id,
        reason: input.reason,
      }),
    );
    return updated;
  }
}

export class AddSubscriptionItemUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    itemType: string;
    productId?: string | null;
    offerRef?: string | null;
    quantity?: number;
    snapshot?: Record<string, unknown>;
    available?: boolean;
    eligible?: boolean;
  }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const items = await this.subscriptions.listItems(sub.id);
    assertSingleProductSubscription({
      productId: sub.productId,
      itemProductIds: [...items.map((i) => i.productId), input.productId],
    });
    if (input.itemType === SubscriptionItemType.ADDON) {
      assertAddonCompatible({
        addonProductId: input.productId,
        subscriptionProductId: sub.productId,
        available: input.available,
        eligible: input.eligible,
      });
    }
    return this.subscriptions.addItem({
      subscriptionId: sub.id,
      itemType: input.itemType,
      productId: input.productId ?? sub.productId,
      offerRef: input.offerRef,
      quantity: input.quantity,
      snapshot: input.snapshot,
    });
  }
}

export class ListSubscriptionItemsUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  async execute(subscriptionId: string) {
    return this.subscriptions.listItems(subscriptionId);
  }
}

export class CalculateAndSnapshotEntitlementsUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    reason?: string;
    correlationId?: string;
  }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const items = await this.subscriptions.listItems(sub.id);
    const extensions =
      (sub.enterpriseProfile.contractualExtensions as EntitlementSource[] | undefined) ?? [];
    const sources = collectEntitlementSourcesFromItems(items, extensions);
    const resolved = resolveEffectiveEntitlements(sources);
    const correlationId = input.correlationId ?? randomUUID();
    const snapshot = await this.subscriptions.createEntitlementSnapshot({
      subscriptionId: sub.id,
      entitlements: { resolved },
      reason: input.reason,
      correlationId,
      calculationVersion: 'p5-v1',
      sourceOfferVersions: {
        items: items.map((i) => ({ id: i.id, version: i.version, offerRef: i.offerRef })),
      },
    });
    await enqueueSubscription(
      this.outbox,
      createEntitlementSnapshotCreatedEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: sub.id,
        snapshotId: snapshot.id,
        version: snapshot.version,
      }),
    );
    return snapshot;
  }
}

export class ListEntitlementSnapshotsUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  execute(subscriptionId: string) {
    return this.subscriptions.listSnapshots(subscriptionId);
  }
}

export class PublishEntitlementsUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly bbClient?: ControlV1BusinessBackendClient,
  ) {}

  async execute(input: { actorId: string; subscriptionId: string; snapshotId?: string }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const snapshot = input.snapshotId
      ? (await this.subscriptions.listSnapshots(sub.id)).find((s) => s.id === input.snapshotId)
      : await this.subscriptions.getLatestSnapshot(sub.id);
    if (!snapshot) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'No entitlement snapshot to publish');
    }

    const resolved = resolvedFromSnapshotEntitlements(
      snapshot.entitlements as Record<string, unknown>,
    );
    const projection = projectResolvedEntitlementsToBbControl(resolved);
    const emptiness = assessEntitlementPayload(projection.entitlements, projection.grants);
    if (emptiness.empty) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Cannot publish empty entitlements to BB (${emptiness.reason}). Calculate snapshot from plan/add-ons first (RGOM-E7).`,
        [{ code: 'EMPTY_ENTITLEMENTS_FORBIDDEN', reason: emptiness.reason }],
      );
    }

    const correlationId = randomUUID();
    const publication = await this.subscriptions.createPublication({
      subscriptionId: sub.id,
      snapshotId: snapshot.id,
      status: 'REQUESTED',
      correlationId,
    });

    let externalAck = 'CONTROL_PLANE_RECORDED';
    let status: 'PUBLISHED' | 'FAILED' = 'PUBLISHED';

    if (this.bbClient?.isConfigured()) {
      const existingReqs = await this.subscriptions.listProvisioningRequests(sub.id);
      const tenantId =
        existingReqs.map((r) => r.tenantRef).find((t): t is string => !!t?.trim()) ??
        (typeof sub.metadata?.tenantRef === 'string' && sub.metadata.tenantRef.trim()
          ? sub.metadata.tenantRef.trim()
          : null) ??
        (typeof sub.metadata?.tenantId === 'string' && sub.metadata.tenantId.trim()
          ? sub.metadata.tenantId.trim()
          : null);
      if (!tenantId) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Cannot publish entitlements to BB: tenantRef missing (provision first)',
        );
      }
      const contentHash = createHash('sha256')
        .update(JSON.stringify({ entitlements: projection.entitlements, grants: projection.grants }))
        .digest('hex');
      const res = await this.bbClient.putEntitlements(
        tenantId,
        {
          entitlement_version: snapshot.version,
          entitlements: {
            ...projection.entitlements,
            grants: [...projection.grants],
            contentHash,
          },
          grants: [...projection.grants],
          contentHash,
        },
        correlationId.slice(0, 128),
      );
      if (!res.ok) {
        status = 'FAILED';
        externalAck = `BB_HTTP_${res.status}`;
        await this.subscriptions.updatePublication(publication.id, {
          status,
          externalAck,
        });
        throw new DomainError(
          ErrorCode.DEPENDENCY_UNAVAILABLE,
          `BB entitlements publish failed: HTTP ${res.status}`,
          [{ status: res.status, body: res.body }],
        );
      }
      externalAck = `BB_ACCEPTED_${res.status}`;
    }

    const published = await this.subscriptions.updatePublication(publication.id, {
      status,
      publishedAt: new Date(),
      externalAck,
    });
    await enqueueSubscription(
      this.outbox,
      createEntitlementsPublishedEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: sub.id,
        snapshotId: snapshot.id,
        publicationId: published.id,
      }),
    );
    return published;
  }
}

export class CreateChangeRequestUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  execute(input: {
    actorId: string;
    subscriptionId: string;
    changeType: string;
    proposedConfig?: Record<string, unknown>;
    reason?: string;
  }) {
    return this.subscriptions.createChangeRequest({
      subscriptionId: input.subscriptionId,
      changeType: input.changeType,
      proposedConfig: input.proposedConfig,
      requestedBy: input.actorId,
      reason: input.reason,
      correlationId: randomUUID(),
    });
  }
}

export class ExecuteChangeRequestUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly associations?: SubscriptionTenantAssociationPort,
    private readonly publishEntitlements?: PublishEntitlementsUseCase,
    private readonly commercial?: CommercialRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    changeId: string;
    /** When false, skip BB publish after recalculate (default: publish when client configured). */
    publishToBb?: boolean;
  }) {
    const change =
      (await this.subscriptions.getChangeRequest(input.changeId)) ??
      (await this.subscriptions.listChangeRequests(input.subscriptionId)).find(
        (c) => c.id === input.changeId,
      );
    if (!change || change.subscriptionId !== input.subscriptionId) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Change request not found');
    }
    if (change.approvalStatus !== 'APPROVED' && change.approvalStatus !== 'NOT_REQUIRED') {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Change must be approved before execution');
    }
    const correlationId = randomUUID();
    await this.subscriptions.updateChangeRequest(change.id, {
      executionStatus: 'IN_PROGRESS',
    });

    const activeAssociation = this.associations
      ? await this.associations.getActiveBySubscription(input.subscriptionId)
      : null;
    const proposedTenantId =
      typeof change.proposedConfig.productTenantId === 'string'
        ? change.proposedConfig.productTenantId
        : typeof change.proposedConfig.tenantId === 'string'
          ? change.proposedConfig.tenantId
          : null;
    assertPlanChangeKeepsProductTenant({
      changeType: change.changeType,
      activeAssociation,
      proposedProductTenantId: proposedTenantId,
    });

    const patch = change.proposedConfig;
    const subPatch: Parameters<SubscriptionRepositoryPort['updateSubscription']>[1] = {};
    if (typeof patch.planId === 'string') subPatch.planId = patch.planId;
    if (typeof patch.packageId === 'string') subPatch.packageId = patch.packageId;
    if (typeof patch.billingFrequency === 'string') {
      subPatch.billingFrequency = patch.billingFrequency;
    }
    if (Object.keys(subPatch).length) {
      await this.subscriptions.updateSubscription(input.subscriptionId, subPatch);
    }
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');

    if (change.changeType === SubscriptionChangeType.PLAN_CHANGE) {
      const items = await this.subscriptions.listItems(sub.id);
      for (const item of items) {
        if (
          item.status === 'ACTIVE' &&
          (item.itemType === SubscriptionItemType.PLAN ||
            item.itemType === SubscriptionItemType.PACKAGE)
        ) {
          await this.subscriptions.updateItemStatus(item.id, 'REMOVED', new Date());
        }
      }
      const planCode =
        (typeof patch.planCode === 'string' && patch.planCode) ||
        (typeof patch.offerRef === 'string' && patch.offerRef) ||
        (typeof patch.planId === 'string' && patch.planId) ||
        null;
      const sqlRows = await loadSqlCapabilityRows(this.commercial, planCode);
      const catalogCapabilities = mergeSqlCapabilityRowsIntoCatalogCapabilities(
        resolveCommercialCatalogEntitlements({ planCode }),
        sqlRows,
      );
      const capabilities =
        (Array.isArray(patch.capabilities) ? patch.capabilities : null) ??
        (catalogCapabilities.length ? catalogCapabilities : null) ??
        [];
      if (!capabilities.length) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'PLAN_CHANGE requires proposedConfig.capabilities or a known commercial planCode (SYNTIX_* / OKAPI_*)',
          [{ code: 'PLAN_CHANGE_CAPABILITIES_REQUIRED' }],
        );
      }
      await this.subscriptions.addItem({
        subscriptionId: sub.id,
        itemType: SubscriptionItemType.PLAN,
        productId: sub.productId,
        offerRef: planCode,
        quantity: typeof patch.quantity === 'number' ? patch.quantity : undefined,
        snapshot: {
          ...patch,
          planCode,
          capabilities,
        },
      });
    } else if (change.changeType === SubscriptionChangeType.ADDON_ADD) {
      assertAddonCompatible({
        addonProductId:
          typeof patch.productId === 'string' ? patch.productId : sub.productId,
        subscriptionProductId: sub.productId,
        available: patch.available !== false,
        eligible: patch.eligible !== false,
      });
      const capabilities = Array.isArray(patch.capabilities) ? patch.capabilities : [];
      await this.subscriptions.addItem({
        subscriptionId: sub.id,
        itemType: SubscriptionItemType.ADDON,
        productId: sub.productId,
        offerRef:
          (patch.offerRef as string | undefined) ??
          (patch.addonCode as string | undefined) ??
          null,
        quantity: typeof patch.quantity === 'number' ? patch.quantity : undefined,
        snapshot: { ...patch, capabilities },
      });
    } else if (change.changeType === SubscriptionChangeType.ADDON_REMOVE) {
      const itemId = typeof patch.itemId === 'string' ? patch.itemId : null;
      const offerRef = typeof patch.offerRef === 'string' ? patch.offerRef : null;
      const items = await this.subscriptions.listItems(sub.id);
      const target = itemId
        ? items.find((i) => i.id === itemId)
        : items.find(
            (i) =>
              i.itemType === SubscriptionItemType.ADDON &&
              i.status === 'ACTIVE' &&
              (offerRef == null || i.offerRef === offerRef),
          );
      if (!target) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'ADDON_REMOVE requires itemId or matching active add-on offerRef',
        );
      }
      await this.subscriptions.updateItemStatus(target.id, 'REMOVED', new Date());
    }

    const snapshotter = new CalculateAndSnapshotEntitlementsUseCase(
      this.subscriptions,
      this.outbox,
    );
    const snapshot = await snapshotter.execute({
      actorId: input.actorId,
      subscriptionId: sub.id,
      reason: `change:${change.id}`,
      correlationId,
    });

    let publication: unknown = null;
    if (input.publishToBb !== false && this.publishEntitlements) {
      publication = await this.publishEntitlements.execute({
        actorId: input.actorId,
        subscriptionId: sub.id,
        snapshotId: snapshot.id,
      });
    }

    const scheduled = await this.subscriptions.listScheduledChanges(change.id);
    const pendingSchedule = scheduled.find((s) => s.status === 'SCHEDULED');
    if (pendingSchedule) {
      await this.subscriptions.markScheduledExecuted(pendingSchedule.id);
    }
    const updated = await this.subscriptions.updateChangeRequest(change.id, {
      executionStatus: 'COMPLETED',
    });
    await enqueueSubscription(
      this.outbox,
      createSubscriptionChangedEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: input.subscriptionId,
        changeRequestId: change.id,
        changeType: change.changeType,
      }),
    );
    return {
      change: updated,
      snapshot,
      publication,
      association: activeAssociation,
      productTenantRetained: activeAssociation?.productTenantId ?? null,
      note: 'Entitlements recalculated without creating a new product tenant',
    };
  }
}

export class ListChangeRequestsUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  execute(subscriptionId: string) {
    return this.subscriptions.listChangeRequests(subscriptionId);
  }
}

export class RenewSubscriptionUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: { actorId: string; subscriptionId: string; renewalId?: string }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const renewals = await this.subscriptions.listRenewals(sub.id);
    const offered = input.renewalId
      ? renewals.find((r) => r.id === input.renewalId)
      : renewals.find((r) => r.renewalStatus === 'OFFERED' || r.renewalStatus === 'IN_PROGRESS');
    if (!offered) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'No renewal offer to confirm');
    }
    const periods = await this.subscriptions.listPeriods(sub.id);
    const nextNumber = (periods[periods.length - 1]?.periodNumber ?? 0) + 1;
    const freq = (sub.billingFrequency ?? 'MONTHLY') as
      | 'MONTHLY'
      | 'QUARTERLY'
      | 'SEMI_ANNUAL'
      | 'ANNUAL'
      | 'CUSTOM';
    const periodStart = sub.currentPeriodEnd ?? new Date();
    const periodEnd = nextPeriodEnd({ from: periodStart, billingFrequency: freq });
    const period = await this.subscriptions.createPeriod({
      subscriptionId: sub.id,
      periodNumber: nextNumber,
      startsAt: periodStart,
      endsAt: periodEnd,
      status: 'OPEN',
      billingFrequency: sub.billingFrequency,
    });
    const renewal = await this.subscriptions.updateRenewal(offered.id, {
      renewalStatus: 'COMPLETED',
      renewedPeriodStart: periodStart,
      renewedPeriodEnd: periodEnd,
    });
    await this.subscriptions.updateSubscription(sub.id, {
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      renewalAt: periodEnd,
    });
    const correlationId = randomUUID();
    await enqueueSubscription(
      this.outbox,
      createSubscriptionRenewedEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: sub.id,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      }),
    );
    return { renewal, period };
  }
}

export class ListRenewalsUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  execute(subscriptionId: string) {
    return this.subscriptions.listRenewals(subscriptionId);
  }
}

export class StartTrialUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    accountId: string;
    productId: string;
    subscriptionId?: string;
    durationDays?: number;
    packageId?: string;
  }) {
    assertTrialNotPaid({ isTrial: true, labelAsPaid: false });
    const start = new Date();
    const end = new Date(start);
    const days = input.durationDays ?? 14;
    end.setUTCDate(end.getUTCDate() + days);
    const trial = await this.subscriptions.createTrial({
      accountId: input.accountId,
      productId: input.productId,
      subscriptionId: input.subscriptionId ?? null,
      packageId: input.packageId,
      status: 'ACTIVE',
      startAt: start,
      endAt: end,
      durationDays: days,
      ownerAdministratorId: input.actorId,
    });
    if (input.subscriptionId) {
      const sub = await this.subscriptions.getById(input.subscriptionId);
      if (sub) {
        const correlationIdTrial = randomUUID();
        await transitionSubscription(this.subscriptions, {
          subscriptionId: sub.id,
          from: sub.status,
          to: SubscriptionStatus.TRIALING,
          actorId: input.actorId,
          correlationId: correlationIdTrial,
        });
      }
    }
    const correlationId = randomUUID();
    await enqueueSubscription(
      this.outbox,
      createTrialStartedEvent({
        actorId: input.actorId,
        correlationId,
        trialId: trial.id,
        subscriptionId: input.subscriptionId ?? trial.subscriptionId ?? trial.id,
      }),
    );
    return trial;
  }
}

export class ListTrialsUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  execute(opts?: Parameters<SubscriptionRepositoryPort['listTrials']>[0]) {
    return this.subscriptions.listTrials(opts);
  }
}

export class ConvertTrialUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: { actorId: string; trialId: string; subscriptionId: string }) {
    const trial = await this.subscriptions.getTrialById(input.trialId);
    if (!trial) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Trial not found');
    const updated = await this.subscriptions.updateTrial(trial.id, {
      status: 'CONVERTED',
      conversionSubscriptionId: input.subscriptionId,
    });
    const correlationId = randomUUID();
    await enqueueSubscription(
      this.outbox,
      createTrialConvertedEvent({
        actorId: input.actorId,
        correlationId,
        trialId: trial.id,
        subscriptionId: input.subscriptionId,
      }),
    );
    return updated;
  }
}

export class ExpireTrialUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  execute(trialId: string) {
    return this.subscriptions.updateTrial(trialId, { status: 'EXPIRED' });
  }
}

export class RequestBillingCoordinationUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly billing?: SubscriptionBillingCoordinationPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    billingAccountRef?: string;
  }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const correlationId = randomUUID();
    let outcome = 'REQUESTED';
    let externalRef: string | null = null;
    let failureMessage: string | null = null;
    if (this.billing) {
      const result = await this.billing.requestCoordination({
        subscriptionId: sub.id,
        subscriptionNumber: sub.subscriptionNumber,
        accountId: sub.accountId,
        productId: sub.productId,
        correlationId,
        billingAccountRef: input.billingAccountRef,
      });
      if (result.outcome === 'UNAVAILABLE') {
        outcome = 'UNAVAILABLE';
        failureMessage = result.failureMessage;
      } else {
        externalRef = result.externalRef ?? null;
      }
    }
    const coord = await this.subscriptions.createBillingCoordination({
      subscriptionId: sub.id,
      outcome,
      billingAccountRef: input.billingAccountRef ?? null,
      externalRef,
      failureMessage,
      correlationId,
    });
    await enqueueSubscription(
      this.outbox,
      createBillingCoordinationRequestedEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: sub.id,
        coordinationId: coord.id,
      }),
    );
    return coord;
  }
}

export class ConfirmBillingCoordinationUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly billing?: BillingRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    coordinationId: string;
    externalRef?: string;
    /** Ops override — default false (fail-closed when billingRequired). */
    allowWithoutCollectedCash?: boolean;
  }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const coords = await this.subscriptions.listBillingCoordination(sub.id);
    const coord = coords.find((c) => c.id === input.coordinationId);
    if (!coord) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Billing coordination not found');

    if (this.billing && sub.billingRequired) {
      const account = await this.billing.getBillingAccountForSubscription(sub.id);
      const intents = account
        ? await this.billing.listPaymentIntents({
            billingAccountId: account.id,
            limit: 100,
          })
        : [];
      assertBillingConfirmRequiresCollectedPayment({
        billingRequired: sub.billingRequired,
        paymentIntentStatuses: intents.map((i) => i.status),
        allowWithoutCollectedCash: input.allowWithoutCollectedCash === true,
      });
    }

    const updated = await this.subscriptions.updateBillingCoordination(coord.id, {
      outcome: 'CONFIRMED',
      externalRef: input.externalRef ?? coord.externalRef,
      confirmedAt: new Date(),
    });
    await this.subscriptions.updateSubscription(sub.id, { billingConfirmed: true });
    const correlationId = randomUUID();
    await enqueueSubscription(
      this.outbox,
      createBillingCoordinationConfirmedEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: sub.id,
        coordinationId: coord.id,
      }),
    );
    return {
      confirmed: true,
      coordination: updated,
      note: sub.billingRequired
        ? 'Billing confirmed with collected payment proof required (fail-closed)'
        : 'Explicit API confirmation — billing not required on subscription',
    };
  }
}

export class RequestProvisioningUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly provisioning?: SubscriptionProvisioningCoordinationPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly commercial?: CommercialRepositoryPort,
  ) {}

  async execute(input: { actorId: string; subscriptionId: string }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const correlationId = randomUUID();

    const existingReqs = await this.subscriptions.listProvisioningRequests(sub.id);
    const existingTenantRef =
      existingReqs.map((r) => r.tenantRef).find((t): t is string => !!t?.trim()) ??
      (typeof sub.metadata?.tenantRef === 'string' && sub.metadata.tenantRef.trim()
        ? sub.metadata.tenantRef.trim()
        : null) ??
      (typeof sub.metadata?.tenantId === 'string' && sub.metadata.tenantId.trim()
        ? sub.metadata.tenantId.trim()
        : null) ??
      (typeof sub.metadata?.tenant_id === 'string' && sub.metadata.tenant_id.trim()
        ? sub.metadata.tenant_id.trim()
        : null);

    const payload: Record<string, unknown> = {
      tenantId: existingTenantRef ?? undefined,
      productId: sub.productId,
      subscriptionId: sub.id,
      note: 'edge_provisioning_payload',
    };

    const meta = (sub.metadata ?? {}) as Record<string, unknown>;
    if (typeof meta.productCode === 'string' && meta.productCode.trim()) {
      payload.product_code = meta.productCode.trim();
    } else if (typeof meta.product_code === 'string' && meta.product_code.trim()) {
      payload.product_code = meta.product_code.trim();
    }
    if (typeof meta.profileCode === 'string' && meta.profileCode.trim()) {
      payload.profile_code = meta.profileCode.trim();
    } else if (typeof meta.profile_code === 'string' && meta.profile_code.trim()) {
      payload.profile_code = meta.profile_code.trim();
    }
    if (typeof meta.adminEmail === 'string' && meta.adminEmail.trim()) {
      payload.adminEmail = meta.adminEmail.trim();
    }
    if (typeof meta.adminName === 'string' && meta.adminName.trim()) {
      payload.adminName = meta.adminName.trim();
    }

    // RGOM-E7 — attach real entitlement projection when subscription items resolve.
    // Fallback: commercial planCode (catalogue universel) → mêmes caps tous verticaux.
    try {
      let items = await this.subscriptions.listItems(sub.id);
      const extensions =
        (sub.enterpriseProfile?.contractualExtensions as EntitlementSource[] | undefined) ??
        [];
      let built = buildBbEntitlementProjectionFromItems({ items, contractualExtensions: extensions });
      if (built.empty) {
        const planCode =
          extractCommercialPlanCode(meta, sub.commercialSnapshot as Record<string, unknown>) ??
          items.map((i) => i.offerRef).find((r) => !!commercialPlanEntitlementSnapshot(r ?? '')) ??
          null;
        const catalog = planCode ? commercialPlanEntitlementSnapshot(planCode) : null;
        const sqlRows = await loadSqlCapabilityRows(this.commercial, planCode);
        const capabilities = mergeSqlCapabilityRowsIntoCatalogCapabilities(
          resolveCommercialCatalogEntitlements({ planCode }),
          sqlRows,
        );
        if (catalog || capabilities.length) {
          if (!payload.product_code && catalog) payload.product_code = catalog.productFamily;
          if (!payload.profile_code && catalog?.profileCode) {
            payload.profile_code = catalog.profileCode;
          }
          built = buildBbEntitlementProjectionFromItems({
            items: [
              {
                itemType: 'PLAN',
                offerRef: catalog?.planCode ?? planCode,
                snapshot: { capabilities: capabilities.length ? capabilities : catalog?.capabilities ?? [] },
              },
            ],
            contractualExtensions: extensions,
          });
        }
      }
      if (built.empty) {
        payload.entitlementProjection = {
          empty: true,
          reason: built.emptyReason,
        };
      } else {
        payload.entitlements = {
          ...built.projection.entitlements,
          grants: built.projection.grants,
        };
        payload.grants = built.projection.grants;
        payload.entitlement_version = 1;
        payload.entitlementProjection = {
          capabilityCount: built.resolved.length,
          empty: false,
        };
      }
    } catch (err) {
      payload.entitlementProjection = {
        empty: true,
        reason: 'resolve_failed',
        message: err instanceof Error ? err.message : String(err),
      };
    }

    let outcome = 'REQUESTED';
    let externalRef: string | null = null;
    let failureMessage: string | null = null;
    if (this.provisioning) {
      const result = await this.provisioning.requestProvisioning({
        subscriptionId: sub.id,
        subscriptionNumber: sub.subscriptionNumber,
        accountId: sub.accountId,
        productId: sub.productId,
        correlationId,
        payload,
      });
      if (result.outcome === 'UNAVAILABLE') {
        outcome = 'UNAVAILABLE';
        failureMessage = result.failureMessage;
      } else {
        outcome = result.outcome;
        externalRef = result.externalRef ?? null;
      }
    }
    const req = await this.subscriptions.createProvisioningRequest({
      subscriptionId: sub.id,
      correlationId,
      outcome,
      externalRef,
      tenantRef: externalRef ?? existingTenantRef,
      failureMessage,
      payload,
    });
    await enqueueSubscription(
      this.outbox,
      createProvisioningRequestedEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: sub.id,
        requestId: req.id,
      }),
    );
    return req;
  }
}

export class CompleteProvisioningUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly bindAssociation?: BindSubscriptionTenantAssociationUseCase,
    private readonly provisioning?: SubscriptionProvisioningCoordinationPort,
  ) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    requestId: string;
    tenantRef?: string;
    externalRef?: string;
    /** When true, skip BB ready poll (already verified by AdvanceProvisioningAfterPaid). */
    skipReadyPoll?: boolean;
  }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');

    const tenantRef = input.tenantRef?.trim() || input.externalRef?.trim() || null;

    if (!input.skipReadyPoll && this.provisioning && tenantRef) {
      const poll = await this.provisioning.completeProvisioning({
        subscriptionId: sub.id,
        requestId: input.requestId,
        tenantRef,
        externalRef: input.externalRef,
      });
      if (poll.outcome === 'NOT_COMPLETE') {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          poll.failureMessage ?? 'BB tenant not ready yet',
          [{ code: poll.failureCode ?? 'TENANT_NOT_READY' }],
        );
      }
      if (poll.outcome === 'UNAVAILABLE') {
        throw new DomainError(
          ErrorCode.DEPENDENCY_UNAVAILABLE,
          poll.failureMessage ?? 'Provisioning completion unavailable',
          [{ code: poll.failureCode ?? 'PROVISIONING_COMPLETE_UNAVAILABLE' }],
        );
      }
    }

    await this.subscriptions.updateProvisioningRequest(input.requestId, {
      outcome: 'COMPLETE',
      tenantRef: tenantRef,
      externalRef: input.externalRef ?? null,
      completedAt: new Date(),
    });
    await this.subscriptions.updateSubscription(sub.id, { provisioningConfirmed: true });
    const correlationId = randomUUID();
    await enqueueSubscription(
      this.outbox,
      createProvisioningCompletedEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: sub.id,
        requestId: input.requestId,
      }),
    );

    let association: unknown = null;
    if (tenantRef && this.bindAssociation) {
      association = await this.bindAssociation.execute({
        actorId: input.actorId,
        subscriptionId: sub.id,
        productTenantRef: tenantRef,
        supersedeExisting: true,
        correlationId,
      });
    }

    return {
      completed: true,
      association,
      tenantRef,
      note: 'Provisioning confirmed — BB ready polled when adapter supports it',
    };
  }
}

export class ResolveSubscriptionIdempotencyUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}

  async execute<T extends Record<string, unknown>>(input: {
    idempotencyKey?: string | null;
    operation: string;
    resourceType: string;
    run: () => Promise<{ resourceId?: string | null; body: T }>;
  }): Promise<T> {
    if (!input.idempotencyKey?.trim()) {
      return (await input.run()).body;
    }
    const begin = await this.subscriptions.beginIdempotency({
      idempotencyKey: input.idempotencyKey.trim(),
      operation: input.operation,
      resourceType: input.resourceType,
    });
    if (begin.replay && Object.keys(begin.responseSnapshot).length > 0) {
      return begin.responseSnapshot as T;
    }
    const result = await input.run();
    await this.subscriptions.completeIdempotency({
      idempotencyKey: input.idempotencyKey.trim(),
      resourceId: result.resourceId ?? null,
      responseSnapshot: result.body,
    });
    return result.body;
  }
}

export class GetSubscriptionOverviewUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  execute(verticalId?: string) {
    return this.subscriptions.getOverviewStats(verticalId);
  }
}

export class GetSubscriptionAnalyticsUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  async execute(verticalId?: string) {
    const stats = await this.subscriptions.getOverviewStats(verticalId);
    return {
      ...stats,
      recognizedRevenue: null,
      label: 'CONTRACTUAL_COUNTS_ONLY',
      disclaimer: 'Not recognized revenue; invoicing is P6',
    };
  }
}

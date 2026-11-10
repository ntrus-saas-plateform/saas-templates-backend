import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import type { SubscriptionRepositoryPort } from '../../domain/ports/subscription-repository.port.js';
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
  EntitlementCapabilityKind,
  type EntitlementSource,
  nextPeriodEnd,
  resolveEffectiveEntitlements,
  SubscriptionChangeType,
  SubscriptionItemType,
  SubscriptionStatus,
} from '../../domain/subscription/subscription.entity.js';
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

    const planId = (pkg.offerConfiguration as Record<string, unknown>)?.planId as string | undefined;
    const packageId = (pkg.offerConfiguration as Record<string, unknown>)?.solutionPackageId as
      | string
      | undefined;

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
      createdBy: input.actorId,
      status: SubscriptionStatus.DRAFT,
    });

    if (planId || packageId) {
      await this.subscriptions.addItem({
        subscriptionId: sub.id,
        itemType: packageId ? SubscriptionItemType.PACKAGE : SubscriptionItemType.PLAN,
        productId,
        offerRef: planId ?? packageId ?? null,
        snapshot: (pkg.offerConfiguration as Record<string, unknown>) ?? {},
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
  ) {}

  async execute(input: {
    actorId: string;
    accountId: string;
    productId: string;
    contractId?: string | null;
    planId?: string | null;
    packageId?: string | null;
    currency?: string;
    billingFrequency?: string | null;
    correlationId?: string;
    enterpriseProfile?: Record<string, unknown>;
  }) {
    assertSingleProductSubscription({ productId: input.productId });
    const correlationId = input.correlationId ?? randomUUID();
    const sub = await this.subscriptions.createSubscription({
      ...input,
      correlationId,
      status: SubscriptionStatus.DRAFT,
      createdBy: input.actorId,
    });
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
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  async execute(subscriptionId: string) {
    const sub = await this.subscriptions.getById(subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const [items, periods, snapshot, statusHistory, lifecycle] = await Promise.all([
      this.subscriptions.listItems(subscriptionId),
      this.subscriptions.listPeriods(subscriptionId),
      this.subscriptions.getLatestSnapshot(subscriptionId),
      this.subscriptions.listStatusHistory(subscriptionId),
      this.subscriptions.listLifecycleEvents(subscriptionId),
    ]);
    return {
      subscription: sub,
      items,
      periods,
      latestEntitlements: snapshot,
      timeline: lifecycle,
      statusHistory,
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

export class SuspendSubscriptionUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: { actorId: string; subscriptionId: string; reason: string }) {
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
  ) {}

  async execute(input: { actorId: string; subscriptionId: string }) {
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
    const updated = await transitionSubscription(this.subscriptions, {
      subscriptionId: sub.id,
      from: sub.status,
      to: SubscriptionStatus.ACTIVE,
      actorId: input.actorId,
      correlationId,
    });
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
    const sources: EntitlementSource[] = [];

    for (const item of items) {
      const caps = (item.snapshot.capabilities as EntitlementSource[] | undefined) ?? [];
      for (const cap of caps) {
        sources.push({
          ...cap,
          sourceType:
            item.itemType === 'ADDON'
              ? 'ADDON'
              : item.itemType === 'PACKAGE'
                ? 'PACKAGE'
                : 'PLAN',
          sourceRef: item.offerRef,
        });
      }
      if (!caps.length && item.entitlementRef) {
        sources.push({
          sourceType: 'PLAN',
          sourceRef: item.entitlementRef,
          capabilityCode: item.entitlementRef,
          kind: EntitlementCapabilityKind.FEATURE_FLAG,
          enabled: true,
        });
      }
    }

    const extensions =
      (sub.enterpriseProfile.contractualExtensions as EntitlementSource[] | undefined) ?? [];
    for (const ext of extensions) {
      sources.push({ ...ext, sourceType: 'CONTRACTUAL_EXTENSION' });
    }

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
    const correlationId = randomUUID();
    const publication = await this.subscriptions.createPublication({
      subscriptionId: sub.id,
      snapshotId: snapshot.id,
      status: 'REQUESTED',
      correlationId,
    });
    const published = await this.subscriptions.updatePublication(publication.id, {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      externalAck: 'CONTROL_PLANE_RECORDED',
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
  ) {}

  async execute(input: { actorId: string; subscriptionId: string; changeId: string }) {
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
    if (
      change.changeType === SubscriptionChangeType.ADDON_ADD ||
      change.changeType === SubscriptionChangeType.PLAN_CHANGE
    ) {
      await this.subscriptions.addItem({
        subscriptionId: sub.id,
        itemType:
          change.changeType === SubscriptionChangeType.ADDON_ADD
            ? SubscriptionItemType.ADDON
            : patch.packageId
              ? SubscriptionItemType.PACKAGE
              : SubscriptionItemType.PLAN,
        productId: sub.productId,
        offerRef:
          (patch.offerRef as string | undefined) ??
          (patch.planId as string | undefined) ??
          (patch.packageId as string | undefined) ??
          null,
        quantity: typeof patch.quantity === 'number' ? patch.quantity : undefined,
        snapshot: patch,
      });
    }
    if (change.changeType === SubscriptionChangeType.ADDON_REMOVE) {
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
    const snapshotter = new CalculateAndSnapshotEntitlementsUseCase(this.subscriptions, this.outbox);
    await snapshotter.execute({
      actorId: input.actorId,
      subscriptionId: sub.id,
      reason: `change:${change.id}`,
      correlationId,
    });
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
    return updated;
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
  ) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    coordinationId: string;
    externalRef?: string;
  }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const coords = await this.subscriptions.listBillingCoordination(sub.id);
    const coord = coords.find((c) => c.id === input.coordinationId);
    if (!coord) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Billing coordination not found');
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
      note: 'Explicit API confirmation only — not payment collected',
    };
  }
}

export class RequestProvisioningUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly provisioning?: SubscriptionProvisioningCoordinationPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: { actorId: string; subscriptionId: string }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const correlationId = randomUUID();
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
      failureMessage,
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
  ) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    requestId: string;
    tenantRef?: string;
    externalRef?: string;
  }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    await this.subscriptions.updateProvisioningRequest(input.requestId, {
      outcome: 'COMPLETE',
      tenantRef: input.tenantRef ?? null,
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
    return {
      completed: true,
      note: 'Provisioning confirmed via explicit API — does not imply tenant runtime active',
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
  execute() {
    return this.subscriptions.getOverviewStats();
  }
}

export class GetSubscriptionAnalyticsUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  async execute() {
    const stats = await this.subscriptions.getOverviewStats();
    return {
      ...stats,
      recognizedRevenue: null,
      label: 'CONTRACTUAL_COUNTS_ONLY',
      disclaimer: 'Not recognized revenue; invoicing is P6',
    };
  }
}

import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';

export const EDGE_SUBSCRIPTION_OUTBOX_TENANT = 'edge-control-plane';

function subscriptionEvent<T>(params: {
  eventType: string;
  actorId: string;
  correlationId: string;
  aggregateType: string;
  aggregateId: string;
  payload: T;
}): IntegrationEvent<T> {
  return {
    eventId: randomUUID(),
    eventType: params.eventType,
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: EDGE_SUBSCRIPTION_OUTBOX_TENANT,
    organizationId: null,
    correlationId: params.correlationId,
    causationId: null,
    traceId: null,
    actor: { type: 'user', id: params.actorId },
    source: 'okapi-edge',
    aggregateType: params.aggregateType,
    aggregateId: params.aggregateId,
    payload: params.payload,
  };
}

export function createSubscriptionCreatedEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
  accountId: string;
  productId: string;
  salesOrderId?: string | null;
}) {
  return subscriptionEvent({
    eventType: 'subscription.created.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SUBSCRIPTION',
    aggregateId: params.subscriptionId,
    payload: {
      subscriptionId: params.subscriptionId,
      accountId: params.accountId,
      productId: params.productId,
      salesOrderId: params.salesOrderId ?? null,
    },
  });
}

export function createSubscriptionSubmittedEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
}) {
  return subscriptionEvent({
    eventType: 'subscription.submitted_for_approval.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SUBSCRIPTION',
    aggregateId: params.subscriptionId,
    payload: { subscriptionId: params.subscriptionId },
  });
}

export function createSubscriptionApprovedEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
}) {
  return subscriptionEvent({
    eventType: 'subscription.approved.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SUBSCRIPTION',
    aggregateId: params.subscriptionId,
    payload: { subscriptionId: params.subscriptionId },
  });
}

export function createSubscriptionActivationRequestedEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
}) {
  return subscriptionEvent({
    eventType: 'subscription.activation.requested.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SUBSCRIPTION',
    aggregateId: params.subscriptionId,
    payload: { subscriptionId: params.subscriptionId },
  });
}

export function createSubscriptionActivatedEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
}) {
  return subscriptionEvent({
    eventType: 'subscription.activated.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SUBSCRIPTION',
    aggregateId: params.subscriptionId,
    payload: {
      subscriptionId: params.subscriptionId,
      note: 'Activated only after defined gates passed',
    },
  });
}

export function createSubscriptionActivationFailedEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
  reason?: string | null;
}) {
  return subscriptionEvent({
    eventType: 'subscription.activation.failed.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SUBSCRIPTION',
    aggregateId: params.subscriptionId,
    payload: {
      subscriptionId: params.subscriptionId,
      reason: params.reason ?? null,
    },
  });
}

export function createSubscriptionSuspendedEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
  reason: string;
}) {
  return subscriptionEvent({
    eventType: 'subscription.suspended.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SUBSCRIPTION',
    aggregateId: params.subscriptionId,
    payload: { subscriptionId: params.subscriptionId, reason: params.reason },
  });
}

export function createSubscriptionReactivatedEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
}) {
  return subscriptionEvent({
    eventType: 'subscription.reactivated.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SUBSCRIPTION',
    aggregateId: params.subscriptionId,
    payload: { subscriptionId: params.subscriptionId },
  });
}

export function createSubscriptionCancelledEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
  reason?: string | null;
}) {
  return subscriptionEvent({
    eventType: 'subscription.cancelled.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SUBSCRIPTION',
    aggregateId: params.subscriptionId,
    payload: {
      subscriptionId: params.subscriptionId,
      reason: params.reason ?? null,
    },
  });
}

export function createSubscriptionTerminatedEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
  reason?: string | null;
}) {
  return subscriptionEvent({
    eventType: 'subscription.terminated.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SUBSCRIPTION',
    aggregateId: params.subscriptionId,
    payload: {
      subscriptionId: params.subscriptionId,
      reason: params.reason ?? null,
    },
  });
}

export function createSubscriptionRenewedEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
  periodStart: string;
  periodEnd: string;
}) {
  return subscriptionEvent({
    eventType: 'subscription.renewed.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SUBSCRIPTION',
    aggregateId: params.subscriptionId,
    payload: {
      subscriptionId: params.subscriptionId,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
    },
  });
}

export function createSubscriptionChangedEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
  changeRequestId: string;
  changeType: string;
}) {
  return subscriptionEvent({
    eventType: 'subscription.changed.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SUBSCRIPTION',
    aggregateId: params.subscriptionId,
    payload: {
      subscriptionId: params.subscriptionId,
      changeRequestId: params.changeRequestId,
      changeType: params.changeType,
    },
  });
}

export function createSubscriptionChangeApprovedEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
  changeRequestId: string;
}) {
  return subscriptionEvent({
    eventType: 'subscription.change.approved.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SUBSCRIPTION_CHANGE',
    aggregateId: params.changeRequestId,
    payload: {
      subscriptionId: params.subscriptionId,
      changeRequestId: params.changeRequestId,
    },
  });
}

export function createSubscriptionHandoffConsumedEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
  handoffId: string;
}) {
  return subscriptionEvent({
    eventType: 'subscription.handoff.consumed.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SUBSCRIPTION',
    aggregateId: params.subscriptionId,
    payload: {
      subscriptionId: params.subscriptionId,
      handoffId: params.handoffId,
    },
  });
}

export function createEntitlementsReconciledEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
  snapshotId: string;
  publicationId: string;
}) {
  return subscriptionEvent({
    eventType: 'entitlement.reconciled.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'ENTITLEMENT_PUBLICATION',
    aggregateId: params.publicationId,
    payload: {
      subscriptionId: params.subscriptionId,
      snapshotId: params.snapshotId,
      publicationId: params.publicationId,
    },
  });
}

export function createBillingCoordinationConfirmedEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
  coordinationId: string;
}) {
  return subscriptionEvent({
    eventType: 'subscription.billing_coordination.confirmed.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SUBSCRIPTION_BILLING',
    aggregateId: params.coordinationId,
    payload: {
      subscriptionId: params.subscriptionId,
      coordinationId: params.coordinationId,
    },
  });
}

export function createProvisioningCompletedEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
  requestId: string;
}) {
  return subscriptionEvent({
    eventType: 'subscription.provisioning.completed.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SUBSCRIPTION_PROVISIONING',
    aggregateId: params.requestId,
    payload: {
      subscriptionId: params.subscriptionId,
      requestId: params.requestId,
    },
  });
}

export function createEntitlementSnapshotCreatedEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
  snapshotId: string;
  version: number;
}) {
  return subscriptionEvent({
    eventType: 'entitlement.snapshot.created.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'ENTITLEMENT_SNAPSHOT',
    aggregateId: params.snapshotId,
    payload: {
      subscriptionId: params.subscriptionId,
      snapshotId: params.snapshotId,
      version: params.version,
    },
  });
}

export function createEntitlementsPublishedEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
  snapshotId: string;
  publicationId: string;
}) {
  return subscriptionEvent({
    eventType: 'entitlement.published.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'ENTITLEMENT_PUBLICATION',
    aggregateId: params.publicationId,
    payload: {
      subscriptionId: params.subscriptionId,
      snapshotId: params.snapshotId,
      publicationId: params.publicationId,
    },
  });
}

export function createBillingCoordinationRequestedEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
  coordinationId: string;
}) {
  return subscriptionEvent({
    eventType: 'subscription.billing_coordination.requested.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SUBSCRIPTION_BILLING',
    aggregateId: params.coordinationId,
    payload: {
      subscriptionId: params.subscriptionId,
      coordinationId: params.coordinationId,
      note: 'P5 does not create invoices or collect payments',
    },
  });
}

export function createProvisioningRequestedEvent(params: {
  actorId: string;
  correlationId: string;
  subscriptionId: string;
  requestId: string;
}) {
  return subscriptionEvent({
    eventType: 'subscription.provisioning.requested.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'SUBSCRIPTION_PROVISIONING',
    aggregateId: params.requestId,
    payload: {
      subscriptionId: params.subscriptionId,
      requestId: params.requestId,
      note: 'P5 does not create tenants or Keycloak orgs',
    },
  });
}

export function createTrialStartedEvent(params: {
  actorId: string;
  correlationId: string;
  trialId: string;
  subscriptionId: string;
}) {
  return subscriptionEvent({
    eventType: 'subscription.trial.started.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'TRIAL',
    aggregateId: params.trialId,
    payload: {
      trialId: params.trialId,
      subscriptionId: params.subscriptionId,
    },
  });
}

export function createTrialConvertedEvent(params: {
  actorId: string;
  correlationId: string;
  trialId: string;
  subscriptionId: string;
}) {
  return subscriptionEvent({
    eventType: 'subscription.trial.converted.v1',
    actorId: params.actorId,
    correlationId: params.correlationId,
    aggregateType: 'TRIAL',
    aggregateId: params.trialId,
    payload: {
      trialId: params.trialId,
      subscriptionId: params.subscriptionId,
    },
  });
}

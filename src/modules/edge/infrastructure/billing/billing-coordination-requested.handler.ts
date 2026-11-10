import { Injectable } from '@nestjs/common';
import type { IntegrationEventHandler } from '../../../../core/domain/ports/integration-event-handler.port.js';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import { IngestSubscriptionBillingCoordinationUseCase } from '../../application/billing/billing.use-cases.js';

type BillingCoordinationRequestedPayload = {
  subscriptionId?: string;
  coordinationId?: string;
};

/**
 * P5 → P6: subscription.billing_coordination.requested.v1 creates/links billing account and schedule.
 */
@Injectable()
export class BillingCoordinationRequestedHandler implements IntegrationEventHandler {
  constructor(
    private readonly ingest: IngestSubscriptionBillingCoordinationUseCase,
  ) {}

  supports(eventType: string): boolean {
    return eventType === 'subscription.billing_coordination.requested.v1';
  }

  async handle(event: IntegrationEvent): Promise<void> {
    const payload = event.payload as BillingCoordinationRequestedPayload;
    const subscriptionId = payload.subscriptionId;
    if (!subscriptionId) return;

    const actorId =
      event.actor?.id && event.actor.id !== 'system'
        ? event.actor.id
        : 'system:billing-coordination-requested';

    await this.ingest.execute({
      actorId,
      subscriptionId,
      coordinationId: payload.coordinationId ?? null,
    });
  }
}

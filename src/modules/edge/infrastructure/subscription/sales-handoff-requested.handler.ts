import { Injectable } from '@nestjs/common';
import type { IntegrationEventHandler } from '../../../../core/domain/ports/integration-event-handler.port.js';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import { CreateSubscriptionFromHandoffUseCase } from '../../application/subscription/subscription.use-cases.js';

type SalesHandoffRequestedPayload = {
  handoffId?: string;
  salesOrderId?: string;
};

/**
 * P4 → P5 bridge: handoff requested creates or resumes subscription draft (idempotent on correlationId).
 */
@Injectable()
export class SalesHandoffRequestedHandler implements IntegrationEventHandler {
  constructor(
    private readonly createFromHandoff: CreateSubscriptionFromHandoffUseCase,
  ) {}

  supports(eventType: string): boolean {
    return eventType === 'sales.handoff.requested.v1';
  }

  async handle(event: IntegrationEvent): Promise<void> {
    const payload = event.payload as SalesHandoffRequestedPayload;
    const handoffId = payload.handoffId;
    if (!handoffId) return;

    const actorId =
      event.actor?.id && event.actor.id !== 'system'
        ? event.actor.id
        : 'system:sales-handoff-requested';

    await this.createFromHandoff.execute({
      actorId,
      handoffId,
      acceptHandoff: false,
    });
  }
}

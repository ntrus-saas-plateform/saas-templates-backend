import { Injectable } from '@nestjs/common';
import type { IntegrationEventHandler } from '../../../../core/domain/ports/integration-event-handler.port.js';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import { ReceiveSalesLeadUseCase } from '../../application/sales/sales.use-cases.js';

type MarketingLeadQualifiedPayload = {
  leadId?: string;
  score?: number;
  modelVersion?: number;
};

/**
 * Idempotent P3 → P4 bridge: MQL outbox events land in the sales lead inbox.
 * Duplicate deliveries reuse unique(marketing_lead_id) via ReceiveSalesLeadUseCase.
 */
@Injectable()
export class MarketingLeadQualifiedSalesHandler implements IntegrationEventHandler {
  constructor(private readonly receiveSalesLead: ReceiveSalesLeadUseCase) {}

  supports(eventType: string): boolean {
    return eventType === 'marketing.lead.qualified.v1';
  }

  async handle(event: IntegrationEvent): Promise<void> {
    const payload = event.payload as MarketingLeadQualifiedPayload;
    const marketingLeadId = payload.leadId;
    if (!marketingLeadId) return;

    const actorId =
      event.actor?.id && event.actor.id !== 'system'
        ? event.actor.id
        : 'system:marketing-lead-qualified';

    await this.receiveSalesLead.execute({
      actorId,
      marketingLeadId,
      salesPriority: payload.score != null && payload.score >= 80 ? 'HIGH' : 'MEDIUM',
    });
  }
}

import { Injectable, Optional } from '@nestjs/common';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import {
  buildAcquisitionOutboxEvent,
  EDGE_P10_OUTBOX_TENANT,
} from '../../domain/acquisition/acquisition.events.js';
import type {
  AcquisitionNotificationPort,
  AcquisitionQueueEmailInput,
  AcquisitionQueueEmailResult,
} from '../../domain/acquisition/acquisition-notification.port.js';

export const ACQUISITION_COMMUNICATION_DISPATCH =
  'edge.p10.communication.dispatch' as const;

/**
 * Honest notification adapter — enqueues dispatch outbox events only.
 * Does not mark DELIVERED; delivery proof is a separate status update path.
 */
@Injectable()
export class AcquisitionNotificationAdapter implements AcquisitionNotificationPort {
  constructor(
    @Optional() private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async queueEmail(input: AcquisitionQueueEmailInput): Promise<AcquisitionQueueEmailResult> {
    if (!input.templateCode?.trim() || !input.to?.trim()) {
      throw new Error('templateCode and to required for queueEmail');
    }
    const eventType = ACQUISITION_COMMUNICATION_DISPATCH;
    const event = buildAcquisitionOutboxEvent({
      eventType,
      aggregateId: input.communicationId?.trim() || input.correlationId,
      aggregateType: 'acquisition_communication',
      correlationId: input.correlationId,
      payload: {
        channel: 'EMAIL',
        templateCode: input.templateCode.trim(),
        to: input.to.trim(),
        communicationId: input.communicationId ?? null,
        prospectId: input.prospectId ?? null,
        applicationId: input.applicationId ?? null,
        payload: input.payload ?? {},
        // Honest: enqueue ≠ delivery
        deliveryStatus: 'QUEUED',
      },
    });

    if (this.outbox) {
      await this.outbox.runWithOutbox(EDGE_P10_OUTBOX_TENANT, async (_client, enqueue) => {
        await enqueue(event);
      });
    }

    return {
      enqueued: true,
      eventType,
      deliveryStatus: 'QUEUED',
    };
  }
}

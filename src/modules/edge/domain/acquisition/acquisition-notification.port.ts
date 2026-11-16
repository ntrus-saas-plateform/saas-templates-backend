/**
 * Outbound communication adapter for P10 acquisition.
 * Queueing is not delivery proof — status updates (SENT/DELIVERED/FAILED)
 * must come from provider evidence via MarkCommunicationStatusUseCase.
 */

export const ACQUISITION_NOTIFICATION_PORT = Symbol('ACQUISITION_NOTIFICATION_PORT');

export type AcquisitionQueueEmailInput = {
  templateCode: string;
  to: string;
  payload: Record<string, unknown>;
  correlationId: string;
  communicationId?: string | null;
  prospectId?: string | null;
  applicationId?: string | null;
};

export type AcquisitionQueueEmailResult = {
  enqueued: true;
  eventType: string;
  /** Never claims DELIVERED — queue only. */
  deliveryStatus: 'QUEUED';
};

export interface AcquisitionNotificationPort {
  queueEmail(input: AcquisitionQueueEmailInput): Promise<AcquisitionQueueEmailResult>;
}

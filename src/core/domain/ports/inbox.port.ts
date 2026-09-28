export interface InboxDeduplicatorPort {
  tryClaim(tenantId: string, messageId: string, consumerId: string): Promise<boolean>;
  /** Removes a failed claim so RabbitMQ redelivery can be processed again. */
  releaseClaim(tenantId: string, messageId: string, consumerId: string): Promise<void>;
}

export const INBOX_DEDUPLICATOR_PORT = Symbol('INBOX_DEDUPLICATOR_PORT');

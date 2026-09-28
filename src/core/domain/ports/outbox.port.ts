import type { IntegrationEvent } from '../events/integration-event.js';

export enum OutboxStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
  DEAD_LETTER = 'DEAD_LETTER',
}

export interface OutboxMessage {
  readonly id: string;
  readonly eventType: string;
  readonly payload: IntegrationEvent;
  readonly status: OutboxStatus;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly tenantId: string;
  readonly organizationId: string | null;
  readonly correlationId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly publishedAt: Date | null;
  readonly lastError: string | null;
}

export interface OutboxStorePort {
  enqueue(tenantId: string, event: IntegrationEvent, client?: unknown): Promise<string>;
  fetchPending(tenantId: string, limit: number): Promise<readonly OutboxMessage[]>;
  markPublished(tenantId: string, id: string): Promise<void>;
  markFailed(tenantId: string, id: string, error: string): Promise<void>;
  markDeadLetter(tenantId: string, id: string, error: string): Promise<void>;
  /** List dead-lettered outbox rows (req 35). */
  listDeadLetter?(
    tenantId: string,
    params?: { limit?: number; offset?: number; organizationId?: string | null },
  ): Promise<readonly OutboxMessage[]>;
  /**
   * Controlled replay: reset DEAD_LETTER / FAILED → PENDING (req 36).
   * Consumers must remain idempotent — replay must not double-apply business ops.
   */
  replay?(tenantId: string, id: string): Promise<OutboxMessage | null>;
}

export const OUTBOX_STORE_PORT = Symbol('OUTBOX_STORE_PORT');

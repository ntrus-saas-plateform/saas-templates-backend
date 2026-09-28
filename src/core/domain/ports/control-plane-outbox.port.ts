import type { IntegrationEvent } from '../events/integration-event.js';
import type { OutboxMessage } from './outbox.port.js';

export interface ControlPlaneOutboxStorePort {
  enqueue(tenantId: string, event: IntegrationEvent, client?: unknown): Promise<string>;
  fetchPending(tenantId: string, limit: number): Promise<readonly OutboxMessage[]>;
  markPublished(tenantId: string, id: string): Promise<void>;
  markFailed(tenantId: string, id: string, error: string): Promise<void>;
  markDeadLetter(tenantId: string, id: string, error: string): Promise<void>;
}

export const CONTROL_PLANE_OUTBOX_STORE_PORT = Symbol('CONTROL_PLANE_OUTBOX_STORE_PORT');

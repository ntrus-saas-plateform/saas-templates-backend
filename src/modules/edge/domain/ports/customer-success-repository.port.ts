import type { AhaProductSegment } from '../customer-success/aha-moments.js';
import type {
  AdoptionEventRecord,
  AdoptionEventSource,
} from '../customer-success/adoption-events.js';

export const CUSTOMER_SUCCESS_REPOSITORY_PORT = Symbol('CUSTOMER_SUCCESS_REPOSITORY_PORT');

export type PersistAdoptionEventInput = {
  readonly subscriptionId: string;
  readonly productTenantRef: string | null;
  readonly eventCode: string;
  readonly productSegment: AhaProductSegment;
  readonly occurredAt: Date;
  readonly source: AdoptionEventSource;
  readonly correlationId: string | null;
  readonly payload: Record<string, unknown>;
};

export interface CustomerSuccessRepositoryPort {
  insertAdoptionEvent(input: PersistAdoptionEventInput): Promise<AdoptionEventRecord>;
  listAdoptionEvents(input: {
    subscriptionId: string;
    limit?: number;
  }): Promise<AdoptionEventRecord[]>;
}

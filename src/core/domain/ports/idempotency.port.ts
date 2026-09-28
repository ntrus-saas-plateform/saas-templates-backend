export type IdempotencyAcquireResult =
  | { type: 'acquired' }
  | { type: 'replay'; record: IdempotencyRecord }
  | { type: 'conflict' };

export interface IdempotencyRecord {
  readonly key: string;
  readonly tenantId: string;
  readonly requestHash: string;
  readonly statusCode: number;
  readonly responseBody: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface IdempotencyStorePort {
  acquire(
    key: string,
    tenantId: string,
    requestHash: string,
  ): Promise<IdempotencyAcquireResult>;
  complete(
    key: string,
    tenantId: string,
    statusCode: number,
    responseBody: string,
  ): Promise<void>;
  find(key: string, tenantId: string): Promise<IdempotencyRecord | null>;
}

export const IDEMPOTENCY_STORE_PORT = Symbol('IDEMPOTENCY_STORE_PORT');

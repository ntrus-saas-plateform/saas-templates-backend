import type {
  ControlCallbackRecord,
  ControlCallbackStatus,
  ControlExchangeRecord,
  ControlExchangeStatus,
  CredentialBindingRecord,
  NegotiatedContractRecord,
  ProductControlCapabilityRecord,
  ProductControlEndpointRecord,
  ProductControlEndpointStatus,
  ProductControlHealthCheckRecord,
  ProductControlReconciliationRecord,
} from './product-control.types.js';

export const PRODUCT_CONTROL_REPOSITORY_PORT = Symbol('PRODUCT_CONTROL_REPOSITORY_PORT');

export type ProductControlHistoryInsert = {
  resourceType: string;
  resourceId: string;
  fromStatus: string | null;
  toStatus: string | null;
  action: string;
  reason: string | null;
  actorId: string;
  details?: Record<string, unknown>;
};

export type ControlExchangeAttemptInsert = {
  exchangeId: string;
  attemptNumber: number;
  outcome: string;
  httpStatus?: number | null;
  errorClassification?: string | null;
  durationMs?: number | null;
  requestDigest?: string | null;
  responseDigest?: string | null;
  diagnostics?: Record<string, unknown>;
  completedAt?: Date | null;
};

export interface ProductControlRepositoryPort {
  findEndpointById(
    id: string,
    client?: unknown,
  ): Promise<ProductControlEndpointRecord | null>;

  /** Row lock for quarantine-safe dispatch. */
  findEndpointByIdForUpdate(
    id: string,
    client?: unknown,
  ): Promise<ProductControlEndpointRecord | null>;

  findEndpointByCode(
    code: string,
    client?: unknown,
  ): Promise<ProductControlEndpointRecord | null>;

  listEndpoints(
    filter: {
      productId?: string;
      platformId?: string;
      status?: ProductControlEndpointStatus;
      limit?: number;
      offset?: number;
    },
    client?: unknown,
  ): Promise<ProductControlEndpointRecord[]>;

  insertEndpoint(
    row: Omit<
      ProductControlEndpointRecord,
      'id' | 'createdAt' | 'updatedAt' | 'version'
    > & { id?: string },
    client?: unknown,
  ): Promise<ProductControlEndpointRecord>;

  updateEndpointStatus(
    id: string,
    fromStatus: ProductControlEndpointStatus,
    toStatus: ProductControlEndpointStatus,
    expectedVersion: number,
    patch: Partial<
      Pick<
        ProductControlEndpointRecord,
        | 'contractFingerprint'
        | 'identityFingerprint'
        | 'lastHandshakeAt'
        | 'lastHandshakeStatus'
        | 'lastHandshakeError'
        | 'lastHealthCheckAt'
        | 'lastHealthStatus'
        | 'updatedBy'
        | 'metadata'
      >
    >,
    client?: unknown,
  ): Promise<ProductControlEndpointRecord>;

  insertNegotiatedContract(
    row: Omit<NegotiatedContractRecord, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    },
    client?: unknown,
  ): Promise<NegotiatedContractRecord>;

  replaceCapabilities(
    endpointId: string,
    capabilities: Array<{ capabilityCode: string; metadata?: Record<string, unknown> }>,
    client?: unknown,
  ): Promise<ProductControlCapabilityRecord[]>;

  listCapabilities(
    endpointId: string,
    client?: unknown,
  ): Promise<ProductControlCapabilityRecord[]>;

  insertExchange(
    row: Omit<ControlExchangeRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
    },
    client?: unknown,
  ): Promise<ControlExchangeRecord>;

  updateExchangeStatus(
    id: string,
    fromStatus: ControlExchangeStatus,
    toStatus: ControlExchangeStatus,
    expectedVersion: number,
    patch: Partial<
      Pick<
        ControlExchangeRecord,
        | 'attemptCount'
        | 'httpStatus'
        | 'errorClassification'
        | 'durationMs'
        | 'retryEligible'
        | 'reconciliationStatus'
        | 'responseDigest'
        | 'responseTimestamp'
        | 'responsePayload'
        | 'diagnostics'
      >
    >,
    client?: unknown,
  ): Promise<ControlExchangeRecord>;

  findExchangeById(
    id: string,
    client?: unknown,
  ): Promise<ControlExchangeRecord | null>;

  findExchangeByIdempotencyKey(
    idempotencyKey: string,
    client?: unknown,
  ): Promise<ControlExchangeRecord | null>;

  listExchanges(
    filter: {
      endpointId?: string;
      status?: ControlExchangeStatus;
      limit?: number;
      offset?: number;
    },
    client?: unknown,
  ): Promise<ControlExchangeRecord[]>;

  insertExchangeAttempt(
    row: ControlExchangeAttemptInsert,
    client?: unknown,
  ): Promise<void>;

  insertCallback(
    row: Omit<ControlCallbackRecord, 'id' | 'createdAt' | 'receivedAt'> & {
      id?: string;
      receivedAt?: Date;
    },
    client?: unknown,
  ): Promise<ControlCallbackRecord>;

  findCallbackByIdempotencyKey(
    idempotencyKey: string,
    client?: unknown,
  ): Promise<ControlCallbackRecord | null>;

  updateCallbackStatus(
    id: string,
    status: ControlCallbackStatus,
    patch?: Partial<Pick<ControlCallbackRecord, 'signatureValid' | 'rejectionReason' | 'exchangeId'>>,
    client?: unknown,
  ): Promise<ControlCallbackRecord>;

  insertHealthCheck(
    row: Omit<ProductControlHealthCheckRecord, 'id' | 'createdAt' | 'checkedAt'> & {
      id?: string;
      checkedAt?: Date;
    },
    client?: unknown,
  ): Promise<ProductControlHealthCheckRecord>;

  insertReconciliation(
    row: Omit<
      ProductControlReconciliationRecord,
      'id' | 'createdAt' | 'updatedAt' | 'openedAt'
    > & { id?: string; openedAt?: Date },
    client?: unknown,
  ): Promise<ProductControlReconciliationRecord>;

  updateReconciliation(
    id: string,
    patch: Partial<
      Pick<
        ProductControlReconciliationRecord,
        'status' | 'resolvedAt' | 'resolvedBy' | 'resolutionNotes' | 'details'
      >
    >,
    client?: unknown,
  ): Promise<ProductControlReconciliationRecord>;

  findOpenReconciliationByExchangeId(
    exchangeId: string,
    client?: unknown,
  ): Promise<ProductControlReconciliationRecord | null>;

  upsertCredentialBinding(
    row: Omit<CredentialBindingRecord, 'id' | 'createdAt' | 'updatedAt' | 'boundAt'> & {
      id?: string;
      boundAt?: Date;
    },
    client?: unknown,
  ): Promise<CredentialBindingRecord>;

  findCredentialBinding(
    endpointId: string,
    credentialRef: string,
    client?: unknown,
  ): Promise<CredentialBindingRecord | null>;

  insertHistory(row: ProductControlHistoryInsert, client?: unknown): Promise<void>;
}

import type { ProductControlDiscoveryDocument } from './product-control.types.js';

export const PRODUCT_CONTROL_CLIENT_PORT = Symbol('PRODUCT_CONTROL_CLIENT_PORT');

export type ProductControlClientRequest = {
  endpointId: string;
  baseUrl: string;
  apiVersion: string;
  contractVersion: string;
  credentialRef: string;
  authProfile: string;
  operationCode: string;
  requestId: string;
  correlationId: string;
  causationId?: string | null;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  deadlineAt?: Date;
};

export type ProductControlClientResponse = {
  httpStatus: number;
  body: Record<string, unknown>;
  responseDigest?: string;
  durationMs: number;
  discovery?: ProductControlDiscoveryDocument;
};

/**
 * Typed outbound Product Control client.
 * Implementations must enforce TLS, allowlists, timeouts, size limits —
 * secrets resolved via CredentialProviderPort only.
 */
export interface ProductControlClientPort {
  handshake(req: ProductControlClientRequest): Promise<ProductControlClientResponse>;
  discoverContract(req: ProductControlClientRequest): Promise<ProductControlClientResponse>;
  discoverCapabilities(
    req: ProductControlClientRequest,
  ): Promise<ProductControlClientResponse>;
  verifyConnectivity(
    req: ProductControlClientRequest,
  ): Promise<ProductControlClientResponse>;
  verifyHealth(req: ProductControlClientRequest): Promise<ProductControlClientResponse>;
  verifyConformance(
    req: ProductControlClientRequest,
  ): Promise<ProductControlClientResponse>;
}

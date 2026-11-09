import type {
  BackendBindingType,
  BusinessBackend,
  ProductBackendBinding,
} from '../backend/business-backend.entity.js';

export interface CreateBackendParams {
  code: string;
  name: string;
  description?: string | null;
  backendType?: string | null;
  lifecycleStatus?: string;
  deploymentModes?: readonly unknown[];
  supportedProtocols?: readonly unknown[];
  supportedApiVersions?: readonly unknown[];
  supportedEventVersions?: readonly unknown[];
  securityProfile?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CreateBindingParams {
  productId: string;
  productVersionId?: string | null;
  backendId: string;
  bindingType: BackendBindingType;
  deploymentMode?: string | null;
  compatibilityStatus?: string | null;
  effectiveFrom?: Date | null;
  metadata?: Record<string, unknown>;
}

export interface BackendRepositoryPort {
  findById(id: string): Promise<BusinessBackend | null>;
  findByCode(code: string): Promise<BusinessBackend | null>;
  list(): Promise<readonly BusinessBackend[]>;
  create(params: CreateBackendParams): Promise<BusinessBackend>;
  listBindingsByProduct(productId: string): Promise<readonly ProductBackendBinding[]>;
  createBinding(params: CreateBindingParams): Promise<ProductBackendBinding>;
}

export const BACKEND_REPOSITORY_PORT = Symbol('BACKEND_REPOSITORY_PORT');

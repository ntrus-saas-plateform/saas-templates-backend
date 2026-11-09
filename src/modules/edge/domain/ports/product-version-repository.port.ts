import type {
  EdgeProductVersion,
  ProductReleaseType,
  ProductVersionStatus,
} from '../product/product-version.entity.js';

export interface CreateProductVersionParams {
  productId: string;
  version: string;
  releaseName?: string | null;
  description?: string | null;
  releaseType: ProductReleaseType;
  apiCompatibility?: string | null;
  eventCompatibility?: string | null;
  minimumBackendVersion?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
}

export interface UpdateProductVersionParams {
  releaseName?: string | null;
  description?: string | null;
  apiCompatibility?: string | null;
  eventCompatibility?: string | null;
  minimumBackendVersion?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ProductVersionRepositoryPort {
  findById(id: string): Promise<EdgeProductVersion | null>;
  listByProduct(productId: string): Promise<readonly EdgeProductVersion[]>;
  create(params: CreateProductVersionParams): Promise<EdgeProductVersion>;
  update(id: string, params: UpdateProductVersionParams): Promise<EdgeProductVersion>;
  updateStatus(
    id: string,
    status: ProductVersionStatus,
    extras?: {
      releaseDate?: Date | null;
      effectiveFrom?: Date | null;
      deprecatedAt?: Date | null;
      retiredAt?: Date | null;
    },
  ): Promise<EdgeProductVersion>;
}

export const PRODUCT_VERSION_REPOSITORY_PORT = Symbol('PRODUCT_VERSION_REPOSITORY_PORT');

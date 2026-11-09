import type {
  CompatibilityStatus,
  CompatibilityTargetType,
  ProductCompatibility,
} from '../product/product-compatibility.entity.js';

export interface UpsertCompatibilityParams {
  productId: string;
  productVersionId?: string | null;
  targetType: CompatibilityTargetType;
  targetId: string;
  status: CompatibilityStatus;
  justification?: string | null;
  restrictions?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
  validatedBy?: string | null;
  validatedAt?: Date | null;
}

export interface CompatibilityRepositoryPort {
  listByProduct(productId: string): Promise<readonly ProductCompatibility[]>;
  upsert(params: UpsertCompatibilityParams): Promise<ProductCompatibility>;
}

export const COMPATIBILITY_REPOSITORY_PORT = Symbol('COMPATIBILITY_REPOSITORY_PORT');

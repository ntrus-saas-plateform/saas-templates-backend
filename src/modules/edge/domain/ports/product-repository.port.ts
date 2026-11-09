import type {
  CommercialAvailability,
  EdgeProduct,
  ProductLifecycleStatus,
} from '../product/product.entity.js';

export interface CreateProductParams {
  code: string;
  slug: string;
  name: string;
  shortDescription?: string | null;
  description?: string | null;
  verticalId: string;
  productType?: string | null;
  technicalStatus?: string | null;
  commercialAvailability?: CommercialAvailability;
  iconRef?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
}

export interface UpdateProductParams {
  name?: string;
  shortDescription?: string | null;
  description?: string | null;
  productType?: string | null;
  technicalStatus?: string | null;
  commercialAvailability?: CommercialAvailability;
  defaultVersionId?: string | null;
  iconRef?: string | null;
  metadata?: Record<string, unknown>;
  updatedBy?: string | null;
}

export interface ProductRepositoryPort {
  findById(id: string): Promise<EdgeProduct | null>;
  findByCode(code: string): Promise<EdgeProduct | null>;
  list(params: {
    page: number;
    limit: number;
    verticalId?: string;
    status?: ProductLifecycleStatus;
  }): Promise<{ items: readonly EdgeProduct[]; total: number }>;
  create(params: CreateProductParams): Promise<EdgeProduct>;
  update(id: string, params: UpdateProductParams): Promise<EdgeProduct>;
  updateLifecycle(
    id: string,
    status: ProductLifecycleStatus,
    extras?: { updatedBy?: string | null; defaultVersionId?: string | null },
  ): Promise<EdgeProduct>;
}

export const PRODUCT_REPOSITORY_PORT = Symbol('PRODUCT_REPOSITORY_PORT');

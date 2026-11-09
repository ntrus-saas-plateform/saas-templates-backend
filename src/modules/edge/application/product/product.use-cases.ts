import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  assertProductLifecycleTransition,
  CommercialAvailability,
  isProductMutable,
  ProductLifecycleStatus,
  type EdgeProduct,
} from '../../domain/product/product.entity.js';
import {
  assertProductVerticalAccess,
  resolveProductListVerticalFilter,
} from '../../domain/product/product-vertical-access.js';
import type { ProductRepositoryPort } from '../../domain/ports/product-repository.port.js';
import type { VerticalRepositoryPort } from '../../domain/ports/vertical-repository.port.js';

export class CreateProductUseCase {
  constructor(
    private readonly products: ProductRepositoryPort,
    private readonly verticals: VerticalRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    scopeVerticalId?: string | null;
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
  }): Promise<EdgeProduct> {
    assertProductVerticalAccess({
      scopeVerticalId: input.scopeVerticalId,
      productVerticalId: input.verticalId,
      action: 'create',
    });
    const vertical = await this.verticals.findById(input.verticalId);
    if (!vertical) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Vertical not found');
    if (await this.products.findByCode(input.code)) {
      throw new DomainError(ErrorCode.CONFLICT, 'Product code already exists');
    }
    return this.products.create({
      ...input,
      createdBy: input.actorId,
    });
  }
}

export class UpdateProductUseCase {
  constructor(private readonly products: ProductRepositoryPort) {}

  async execute(input: {
    id: string;
    actorId: string;
    scopeVerticalId?: string | null;
    name?: string;
    shortDescription?: string | null;
    description?: string | null;
    productType?: string | null;
    technicalStatus?: string | null;
    commercialAvailability?: CommercialAvailability;
    iconRef?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<EdgeProduct> {
    const current = await this.products.findById(input.id);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    assertProductVerticalAccess({
      scopeVerticalId: input.scopeVerticalId,
      productVerticalId: current.verticalId,
      action: 'update',
    });
    if (!isProductMutable(current.lifecycleStatus)) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        `Cannot update product in status ${current.lifecycleStatus}`,
      );
    }
    const updated = await this.products.update(input.id, {
      ...input,
      updatedBy: input.actorId,
    });
    if (current.lifecycleStatus === ProductLifecycleStatus.DRAFT) {
      assertProductLifecycleTransition(
        current.lifecycleStatus,
        ProductLifecycleStatus.CONFIGURING,
      );
      return this.products.updateLifecycle(updated.id, ProductLifecycleStatus.CONFIGURING, {
        updatedBy: input.actorId,
      });
    }
    return updated;
  }
}

export class GetProductUseCase {
  constructor(private readonly products: ProductRepositoryPort) {}

  async execute(
    id: string,
    scopeVerticalId?: string | null,
  ): Promise<EdgeProduct> {
    const product = await this.products.findById(id);
    if (!product) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    assertProductVerticalAccess({
      scopeVerticalId,
      productVerticalId: product.verticalId,
      action: 'read',
    });
    return product;
  }
}

export class ListProductsUseCase {
  constructor(private readonly products: ProductRepositoryPort) {}

  async execute(input: {
    page: number;
    limit: number;
    verticalId?: string;
    status?: ProductLifecycleStatus;
    scopeVerticalId?: string | null;
  }) {
    const verticalId = resolveProductListVerticalFilter({
      scopeVerticalId: input.scopeVerticalId,
      requestedVerticalId: input.verticalId,
    });
    return this.products.list({
      page: input.page,
      limit: input.limit,
      verticalId,
      status: input.status,
    });
  }
}

export class TransitionProductLifecycleUseCase {
  constructor(private readonly products: ProductRepositoryPort) {}

  async execute(input: {
    id: string;
    actorId: string;
    toStatus: ProductLifecycleStatus;
    scopeVerticalId?: string | null;
  }): Promise<EdgeProduct> {
    const current = await this.products.findById(input.id);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    assertProductVerticalAccess({
      scopeVerticalId: input.scopeVerticalId,
      productVerticalId: current.verticalId,
      action: 'lifecycle',
    });
    assertProductLifecycleTransition(current.lifecycleStatus, input.toStatus);
    return this.products.updateLifecycle(current.id, input.toStatus, {
      updatedBy: input.actorId,
    });
  }
}

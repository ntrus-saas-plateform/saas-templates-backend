import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type {
  CompatibilityStatus,
  CompatibilityTargetType,
  ProductCompatibility,
} from '../../domain/product/product-compatibility.entity.js';
import type { CompatibilityRepositoryPort } from '../../domain/ports/compatibility-repository.port.js';
import type { ProductRepositoryPort } from '../../domain/ports/product-repository.port.js';

export class UpsertCompatibilityUseCase {
  constructor(
    private readonly products: ProductRepositoryPort,
    private readonly compatibilities: CompatibilityRepositoryPort,
  ) {}

  async execute(input: {
    productId: string;
    productVersionId?: string | null;
    targetType: CompatibilityTargetType;
    targetId: string;
    status: CompatibilityStatus;
    justification?: string | null;
    restrictions?: Record<string, unknown>;
    evidence?: Record<string, unknown>;
    validatedBy?: string | null;
  }): Promise<ProductCompatibility> {
    if (!(await this.products.findById(input.productId))) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    }
    return this.compatibilities.upsert({
      ...input,
      validatedAt: input.validatedBy ? new Date() : null,
    });
  }
}

export class ListCompatibilitiesByProductUseCase {
  constructor(private readonly compatibilities: CompatibilityRepositoryPort) {}

  async execute(productId: string) {
    return this.compatibilities.listByProduct(productId);
  }
}

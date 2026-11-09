import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  BackendBindingType,
  type BusinessBackend,
  type ProductBackendBinding,
} from '../../domain/backend/business-backend.entity.js';
import type { BackendRepositoryPort } from '../../domain/ports/backend-repository.port.js';
import type { ProductRepositoryPort } from '../../domain/ports/product-repository.port.js';

export class CreateBackendUseCase {
  constructor(private readonly backends: BackendRepositoryPort) {}

  async execute(input: {
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
  }): Promise<BusinessBackend> {
    if (await this.backends.findByCode(input.code)) {
      throw new DomainError(ErrorCode.CONFLICT, 'Backend code already exists');
    }
    return this.backends.create(input);
  }
}

export class ListBackendsUseCase {
  constructor(private readonly backends: BackendRepositoryPort) {}

  async execute() {
    return this.backends.list();
  }
}

export class GetBackendUseCase {
  constructor(private readonly backends: BackendRepositoryPort) {}

  async execute(id: string): Promise<BusinessBackend> {
    const backend = await this.backends.findById(id);
    if (!backend) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Backend not found');
    return backend;
  }
}

export class CreateProductBackendBindingUseCase {
  constructor(
    private readonly products: ProductRepositoryPort,
    private readonly backends: BackendRepositoryPort,
  ) {}

  async execute(input: {
    productId: string;
    productVersionId?: string | null;
    backendId: string;
    bindingType: BackendBindingType;
    deploymentMode?: string | null;
    compatibilityStatus?: string | null;
    effectiveFrom?: Date | null;
    metadata?: Record<string, unknown>;
  }): Promise<ProductBackendBinding> {
    if (!(await this.products.findById(input.productId))) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    }
    if (!(await this.backends.findById(input.backendId))) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Backend not found');
    }
    return this.backends.createBinding(input);
  }
}

export class ListProductBackendBindingsUseCase {
  constructor(private readonly backends: BackendRepositoryPort) {}

  async execute(productId: string) {
    return this.backends.listBindingsByProduct(productId);
  }
}

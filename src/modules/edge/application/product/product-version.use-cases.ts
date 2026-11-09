import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  assertProductVersionTransition,
  assertPublishedImmutable,
  ProductReleaseType,
  ProductVersionStatus,
  type EdgeProductVersion,
} from '../../domain/product/product-version.entity.js';
import { assertProductVerticalAccess } from '../../domain/product/product-vertical-access.js';
import type { ProductRepositoryPort } from '../../domain/ports/product-repository.port.js';
import type { ProductVersionRepositoryPort } from '../../domain/ports/product-version-repository.port.js';

export class CreateProductVersionUseCase {
  constructor(
    private readonly products: ProductRepositoryPort,
    private readonly versions: ProductVersionRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    scopeVerticalId?: string | null;
    productId: string;
    version: string;
    releaseName?: string | null;
    description?: string | null;
    releaseType: ProductReleaseType;
    apiCompatibility?: string | null;
    eventCompatibility?: string | null;
    minimumBackendVersion?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<EdgeProductVersion> {
    const product = await this.products.findById(input.productId);
    if (!product) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    assertProductVerticalAccess({
      scopeVerticalId: input.scopeVerticalId,
      productVerticalId: product.verticalId,
      action: 'create_version',
    });
    const existing = await this.versions.listByProduct(input.productId);
    if (existing.some((v) => v.version === input.version)) {
      throw new DomainError(ErrorCode.CONFLICT, 'Product version already exists');
    }
    return this.versions.create({
      productId: input.productId,
      version: input.version,
      releaseName: input.releaseName,
      description: input.description,
      releaseType: input.releaseType,
      apiCompatibility: input.apiCompatibility,
      eventCompatibility: input.eventCompatibility,
      minimumBackendVersion: input.minimumBackendVersion,
      metadata: input.metadata,
      createdBy: input.actorId,
    });
  }
}

export class UpdateProductVersionDraftUseCase {
  constructor(
    private readonly products: ProductRepositoryPort,
    private readonly versions: ProductVersionRepositoryPort,
  ) {}

  async execute(input: {
    id: string;
    scopeVerticalId?: string | null;
    releaseName?: string | null;
    description?: string | null;
    apiCompatibility?: string | null;
    eventCompatibility?: string | null;
    minimumBackendVersion?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<EdgeProductVersion> {
    const current = await this.versions.findById(input.id);
    if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product version not found');
    const product = await this.products.findById(current.productId);
    if (!product) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    assertProductVerticalAccess({
      scopeVerticalId: input.scopeVerticalId,
      productVerticalId: product.verticalId,
      action: 'update_version',
    });
    assertPublishedImmutable(current.status);
    return this.versions.update(input.id, input);
  }
}

export class GetProductVersionUseCase {
  constructor(
    private readonly products: ProductRepositoryPort,
    private readonly versions: ProductVersionRepositoryPort,
  ) {}

  async execute(
    id: string,
    scopeVerticalId?: string | null,
  ): Promise<EdgeProductVersion> {
    const version = await this.versions.findById(id);
    if (!version) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product version not found');
    const product = await this.products.findById(version.productId);
    if (!product) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    assertProductVerticalAccess({
      scopeVerticalId,
      productVerticalId: product.verticalId,
      action: 'read_version',
    });
    return version;
  }
}

export class ListProductVersionsUseCase {
  constructor(
    private readonly products: ProductRepositoryPort,
    private readonly versions: ProductVersionRepositoryPort,
  ) {}

  async execute(productId: string, scopeVerticalId?: string | null) {
    const product = await this.products.findById(productId);
    if (!product) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    assertProductVerticalAccess({
      scopeVerticalId,
      productVerticalId: product.verticalId,
      action: 'list_versions',
    });
    return this.versions.listByProduct(productId);
  }
}

export class PublishProductVersionUseCase {
  constructor(
    private readonly products: ProductRepositoryPort,
    private readonly versions: ProductVersionRepositoryPort,
  ) {}

  async execute(input: {
    productId: string;
    versionId: string;
    actorId: string;
    scopeVerticalId?: string | null;
  }): Promise<EdgeProductVersion> {
    const product = await this.products.findById(input.productId);
    if (!product) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    assertProductVerticalAccess({
      scopeVerticalId: input.scopeVerticalId,
      productVerticalId: product.verticalId,
      action: 'publish_version',
    });
    const version = await this.versions.findById(input.versionId);
    if (!version || version.productId !== input.productId) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product version not found');
    }
    if (version.status === ProductVersionStatus.PUBLISHED) {
      return version;
    }
    assertProductVersionTransition(version.status, ProductVersionStatus.PUBLISHED);
    const published = await this.versions.updateStatus(version.id, ProductVersionStatus.PUBLISHED, {
      releaseDate: new Date(),
      effectiveFrom: new Date(),
    });
    if (!product.defaultVersionId) {
      await this.products.update(product.id, {
        defaultVersionId: published.id,
        updatedBy: input.actorId,
      });
    }
    return published;
  }
}

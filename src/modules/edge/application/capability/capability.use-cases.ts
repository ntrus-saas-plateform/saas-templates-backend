import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  assertNoCapabilityDependencyCycle,
  CapabilityDependencyKind,
  CapabilityMappingClassification,
  type CapabilityDependency,
  type ProductCapabilityMapping,
  type TechnicalCapability,
} from '../../domain/capability/technical-capability.entity.js';
import type { CapabilityRepositoryPort } from '../../domain/ports/capability-repository.port.js';
import type { ProductRepositoryPort } from '../../domain/ports/product-repository.port.js';

export class CreateCapabilityUseCase {
  constructor(private readonly capabilities: CapabilityRepositoryPort) {}

  async execute(input: {
    code: string;
    name: string;
    description?: string | null;
    category?: string | null;
    technicalStatus?: string | null;
    commercialAvailability?: string | null;
    ownerRef?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<TechnicalCapability> {
    if (await this.capabilities.findByCode(input.code)) {
      throw new DomainError(ErrorCode.CONFLICT, 'Capability code already exists');
    }
    return this.capabilities.create(input);
  }
}

export class ListCapabilitiesUseCase {
  constructor(private readonly capabilities: CapabilityRepositoryPort) {}

  async execute() {
    return this.capabilities.list();
  }
}

export class GetCapabilityUseCase {
  constructor(private readonly capabilities: CapabilityRepositoryPort) {}

  async execute(id: string): Promise<TechnicalCapability> {
    const cap = await this.capabilities.findById(id);
    if (!cap) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Capability not found');
    return cap;
  }
}

export class AddCapabilityDependencyUseCase {
  constructor(private readonly capabilities: CapabilityRepositoryPort) {}

  async execute(input: {
    capabilityId: string;
    dependsOnCapabilityId: string;
    dependencyKind: CapabilityDependencyKind;
    minVersion?: string | null;
  }): Promise<CapabilityDependency> {
    const cap = await this.capabilities.findById(input.capabilityId);
    if (!cap) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Capability not found');
    const dep = await this.capabilities.findById(input.dependsOnCapabilityId);
    if (!dep) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Dependency capability not found');
    const edges = await this.capabilities.listDependencies();
    assertNoCapabilityDependencyCycle(
      edges.map((e) => ({
        capabilityId: e.capabilityId,
        dependsOnCapabilityId: e.dependsOnCapabilityId,
      })),
      input.capabilityId,
      input.dependsOnCapabilityId,
    );
    return this.capabilities.addDependency(input);
  }
}

export class UpsertProductCapabilityMappingUseCase {
  constructor(
    private readonly products: ProductRepositoryPort,
    private readonly capabilities: CapabilityRepositoryPort,
  ) {}

  async execute(input: {
    productId: string;
    productVersionId?: string | null;
    capabilityId: string;
    classification: CapabilityMappingClassification;
    technicalStatus?: string | null;
    commercialAvailability?: string | null;
    restrictions?: Record<string, unknown>;
  }): Promise<ProductCapabilityMapping> {
    if (!(await this.products.findById(input.productId))) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    }
    if (!(await this.capabilities.findById(input.capabilityId))) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Capability not found');
    }
    return this.capabilities.upsertMapping(input);
  }
}

export class ListProductCapabilityMappingsUseCase {
  constructor(private readonly capabilities: CapabilityRepositoryPort) {}

  async execute(productId: string) {
    return this.capabilities.listMappingsByProduct(productId);
  }
}

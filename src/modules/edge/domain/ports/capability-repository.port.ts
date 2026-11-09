import type {
  CapabilityDependency,
  CapabilityDependencyKind,
  CapabilityMappingClassification,
  ProductCapabilityMapping,
  TechnicalCapability,
} from '../capability/technical-capability.entity.js';

export interface CreateCapabilityParams {
  code: string;
  name: string;
  description?: string | null;
  category?: string | null;
  technicalStatus?: string | null;
  commercialAvailability?: string | null;
  ownerRef?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AddDependencyParams {
  capabilityId: string;
  dependsOnCapabilityId: string;
  dependencyKind: CapabilityDependencyKind;
  minVersion?: string | null;
}

export interface UpsertCapabilityMappingParams {
  productId: string;
  productVersionId?: string | null;
  capabilityId: string;
  classification: CapabilityMappingClassification;
  technicalStatus?: string | null;
  commercialAvailability?: string | null;
  restrictions?: Record<string, unknown>;
}

export interface CapabilityRepositoryPort {
  findById(id: string): Promise<TechnicalCapability | null>;
  findByCode(code: string): Promise<TechnicalCapability | null>;
  list(): Promise<readonly TechnicalCapability[]>;
  create(params: CreateCapabilityParams): Promise<TechnicalCapability>;
  listDependencies(capabilityId?: string): Promise<readonly CapabilityDependency[]>;
  addDependency(params: AddDependencyParams): Promise<CapabilityDependency>;
  listMappingsByProduct(productId: string): Promise<readonly ProductCapabilityMapping[]>;
  upsertMapping(params: UpsertCapabilityMappingParams): Promise<ProductCapabilityMapping>;
}

export const CAPABILITY_REPOSITORY_PORT = Symbol('CAPABILITY_REPOSITORY_PORT');

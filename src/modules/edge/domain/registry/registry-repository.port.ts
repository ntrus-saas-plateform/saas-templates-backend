import type {
  CompatibilityEvaluation,
  DeploymentProfile,
  ProductControlContract,
  ProductPlatform,
  ProductRegistryRecord,
  ProductTechnicalVersion,
  RegistryHistoryEntry,
  RegistryResourceType,
  RuntimeEnvironment,
} from './registry.types.js';

export const REGISTRY_REPOSITORY_PORT = Symbol('REGISTRY_REPOSITORY_PORT');

export type ListFilter = {
  limit?: number;
  offset?: number;
  status?: string;
  q?: string;
};

export interface RegistryRepositoryPort {
  // Product registry
  createProductRegistry(
    input: Omit<ProductRegistryRecord, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'provisionable'> & {
      provisionable?: boolean;
    },
    client?: unknown,
  ): Promise<ProductRegistryRecord>;
  updateProductRegistry(
    id: string,
    patch: Partial<ProductRegistryRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<ProductRegistryRecord>;
  getProductRegistry(id: string): Promise<ProductRegistryRecord | null>;
  getProductRegistryByProductId(productId: string): Promise<ProductRegistryRecord | null>;
  listProductRegistries(filter: ListFilter): Promise<{ items: ProductRegistryRecord[]; total: number }>;

  createTechnicalVersion(
    input: Omit<ProductTechnicalVersion, 'id' | 'createdAt' | 'updatedAt'>,
    client?: unknown,
  ): Promise<ProductTechnicalVersion>;
  updateTechnicalVersion(
    id: string,
    patch: Partial<ProductTechnicalVersion>,
    client?: unknown,
  ): Promise<ProductTechnicalVersion>;
  getTechnicalVersion(id: string): Promise<ProductTechnicalVersion | null>;
  listTechnicalVersions(
    productRegistryId: string,
    filter?: ListFilter,
  ): Promise<{ items: ProductTechnicalVersion[]; total: number }>;

  createPlatform(
    input: Omit<ProductPlatform, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
    client?: unknown,
  ): Promise<ProductPlatform>;
  updatePlatform(
    id: string,
    patch: Partial<ProductPlatform>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<ProductPlatform>;
  getPlatform(id: string): Promise<ProductPlatform | null>;
  listPlatforms(filter: ListFilter): Promise<{ items: ProductPlatform[]; total: number }>;
  countActiveDependenciesOnPlatform(platformId: string, client?: unknown): Promise<number>;

  createEnvironment(
    input: Omit<RuntimeEnvironment, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
    client?: unknown,
  ): Promise<RuntimeEnvironment>;
  updateEnvironment(
    id: string,
    patch: Partial<RuntimeEnvironment>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<RuntimeEnvironment>;
  getEnvironment(id: string): Promise<RuntimeEnvironment | null>;
  listEnvironments(
    filter: ListFilter & { platformId?: string },
  ): Promise<{ items: RuntimeEnvironment[]; total: number }>;

  updateProfile(
    id: string,
    patch: Partial<DeploymentProfile>,
    client?: unknown,
  ): Promise<DeploymentProfile>;
  getProfile(id: string): Promise<DeploymentProfile | null>;
  getProfileByCode(code: string): Promise<DeploymentProfile | null>;
  listProfiles(filter: ListFilter): Promise<{ items: DeploymentProfile[]; total: number }>;

  createContract(
    input: Omit<ProductControlContract, 'id' | 'createdAt' | 'updatedAt'>,
    client?: unknown,
  ): Promise<ProductControlContract>;
  updateContract(
    id: string,
    patch: Partial<ProductControlContract>,
    client?: unknown,
  ): Promise<ProductControlContract>;
  getContract(id: string): Promise<ProductControlContract | null>;
  listContracts(
    filter: ListFilter & { productId?: string; platformId?: string },
  ): Promise<{ items: ProductControlContract[]; total: number }>;
  countPublishedContractsForPlatform(platformId: string, client?: unknown): Promise<number>;

  saveCompatibilityEvaluation(
    input: Omit<CompatibilityEvaluation, 'id' | 'createdAt'>,
    client?: unknown,
  ): Promise<CompatibilityEvaluation>;
  listCompatibilityEvaluations(
    filter: ListFilter,
  ): Promise<{ items: CompatibilityEvaluation[]; total: number }>;
  getCompatibilityEvaluation(id: string): Promise<CompatibilityEvaluation | null>;

  appendHistory(
    entry: Omit<RegistryHistoryEntry, 'id' | 'createdAt'>,
    client?: unknown,
  ): Promise<RegistryHistoryEntry>;
  listHistory(
    filter: ListFilter & { resourceType?: RegistryResourceType; resourceId?: string },
  ): Promise<{ items: RegistryHistoryEntry[]; total: number }>;
}

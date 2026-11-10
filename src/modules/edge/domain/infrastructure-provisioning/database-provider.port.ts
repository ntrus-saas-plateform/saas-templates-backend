import type {
  DatabaseEngine,
  InfrastructureProviderRecord,
  ResourceType,
} from './infrastructure.types.js';

export const INFRASTRUCTURE_PROVIDER_PORT = Symbol('INFRASTRUCTURE_PROVIDER_PORT');
export const INFRASTRUCTURE_PROVIDER_REGISTRY_PORT = Symbol(
  'INFRASTRUCTURE_PROVIDER_REGISTRY_PORT',
);

export type ProvisionNetworkInput = {
  tenantId: string;
  productId: string;
  region: string;
  denyByDefault: boolean;
  publicEndpointAllowed: boolean;
  cidrBlock?: string;
};

export type ProvisionNetworkResult = {
  providerResourceId: string;
  configuration: Record<string, unknown>;
  fingerprint: string;
  evidence: Record<string, unknown>;
};

export type ProvisionStorageInput = {
  tenantId: string;
  productId: string;
  region: string;
  sizeGb: number;
  encrypted: boolean;
};

export type ProvisionStorageResult = {
  providerResourceId: string;
  configuration: Record<string, unknown>;
  fingerprint: string;
  evidence: Record<string, unknown>;
};

export type ProvisionComputeInput = {
  tenantId: string;
  productId: string;
  region: string;
  requirements: Record<string, unknown>;
};

export type ProvisionComputeResult = {
  providerResourceId: string;
  configuration: Record<string, unknown>;
  fingerprint: string;
  evidence: Record<string, unknown>;
  /** When profile does not require compute, adapter may skip with explicit skip. */
  skipped?: boolean;
};

export type ObserveResourceResult = {
  exists: boolean;
  configuration: Record<string, unknown>;
  status: string;
  evidence: Record<string, unknown>;
};

export interface InfrastructureProviderAdapter {
  readonly providerCode: string;
  describe(): Promise<InfrastructureProviderRecord>;
  provisionNetwork(input: ProvisionNetworkInput): Promise<ProvisionNetworkResult>;
  provisionStorage(input: ProvisionStorageInput): Promise<ProvisionStorageResult>;
  provisionCompute(input: ProvisionComputeInput): Promise<ProvisionComputeResult>;
  observeResource(providerResourceId: string, resourceType: ResourceType): Promise<ObserveResourceResult>;
  deprovisionResource(providerResourceId: string, resourceType: ResourceType): Promise<{ evidence: Record<string, unknown> }>;
  adminConnectionRefFor(engine: DatabaseEngine): string;
}

export interface InfrastructureProviderRegistryPort {
  get(providerCode: string): InfrastructureProviderAdapter | null;
  getById(providerId: string): Promise<InfrastructureProviderAdapter | null>;
  list(): Promise<InfrastructureProviderRecord[]>;
}

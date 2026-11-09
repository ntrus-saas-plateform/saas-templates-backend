import type { IntegrationContract } from '../contract/integration-contract.entity.js';

export interface CreateContractParams {
  code: string;
  name: string;
  contractType?: string | null;
  version: string;
  ownerRef?: string | null;
  description?: string | null;
  schemaRef?: string | null;
  compatibilityPolicy?: string | null;
  status?: string;
  effectiveFrom?: Date | null;
  documentationRef?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ContractRepositoryPort {
  findById(id: string): Promise<IntegrationContract | null>;
  findByCode(code: string): Promise<IntegrationContract | null>;
  list(): Promise<readonly IntegrationContract[]>;
  create(params: CreateContractParams): Promise<IntegrationContract>;
}

export const CONTRACT_REPOSITORY_PORT = Symbol('CONTRACT_REPOSITORY_PORT');

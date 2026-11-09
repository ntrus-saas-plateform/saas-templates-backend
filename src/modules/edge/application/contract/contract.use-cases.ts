import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { IntegrationContract } from '../../domain/contract/integration-contract.entity.js';
import type { ContractRepositoryPort } from '../../domain/ports/contract-repository.port.js';

export class CreateContractUseCase {
  constructor(private readonly contracts: ContractRepositoryPort) {}

  async execute(input: {
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
  }): Promise<IntegrationContract> {
    if (await this.contracts.findByCode(input.code)) {
      throw new DomainError(ErrorCode.CONFLICT, 'Contract code already exists');
    }
    return this.contracts.create(input);
  }
}

export class ListContractsUseCase {
  constructor(private readonly contracts: ContractRepositoryPort) {}

  async execute() {
    return this.contracts.list();
  }
}

export class GetContractUseCase {
  constructor(private readonly contracts: ContractRepositoryPort) {}

  async execute(id: string): Promise<IntegrationContract> {
    const contract = await this.contracts.findById(id);
    if (!contract) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Contract not found');
    return contract;
  }
}

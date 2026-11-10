import type {
  InfrastructureProviderAdapter,
  InfrastructureProviderRegistryPort,
} from '../../domain/infrastructure-provisioning/database-provider.port.js';
import type { InfrastructureRepositoryPort } from '../../domain/infrastructure-provisioning/infrastructure-repository.port.js';
import {
  LOCAL_MANAGED_PROVIDER_CODE,
  type InfrastructureProviderRecord,
} from '../../domain/infrastructure-provisioning/infrastructure.types.js';
import { LocalManagedInfrastructureProvider } from './local-managed.provider.js';

export class LocalInfrastructureProviderRegistry implements InfrastructureProviderRegistryPort {
  private readonly byCode = new Map<string, InfrastructureProviderAdapter>();

  constructor(
    private readonly repo: InfrastructureRepositoryPort,
    localProvider: LocalManagedInfrastructureProvider = new LocalManagedInfrastructureProvider({
      postgresql: process.env.EDGE_P76_PG_ADMIN_URL,
      mongodb: process.env.EDGE_P76_MONGO_ADMIN_URL,
      surrealdb: process.env.EDGE_P76_SURREAL_ADMIN_URL,
    }),
  ) {
    this.byCode.set(LOCAL_MANAGED_PROVIDER_CODE, localProvider);
  }

  get(providerCode: string): InfrastructureProviderAdapter | null {
    return this.byCode.get(providerCode) ?? null;
  }

  async getById(providerId: string): Promise<InfrastructureProviderAdapter | null> {
    const record = await this.repo.getProviderById(providerId);
    if (!record) return null;
    return this.get(record.code);
  }

  async list(): Promise<InfrastructureProviderRecord[]> {
    const fromDb = await this.repo.listProviders();
    if (fromDb.length > 0) return fromDb;
    const local = this.get(LOCAL_MANAGED_PROVIDER_CODE);
    return local ? [await local.describe()] : [];
  }

  register(adapter: InfrastructureProviderAdapter): void {
    this.byCode.set(adapter.providerCode, adapter);
  }
}

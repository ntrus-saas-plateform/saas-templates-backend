import type {
  PlatformServiceRecord,
  ServiceCatalogSearchFilter,
  ServiceDependencyRecord,
} from './service-catalog.types.js';

export const SERVICE_CATALOG_REPOSITORY_PORT = Symbol('SERVICE_CATALOG_REPOSITORY_PORT');

export interface ServiceCatalogRepositoryPort {
  createService(
    input: Omit<PlatformServiceRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<PlatformServiceRecord>;

  getById(id: string): Promise<PlatformServiceRecord | null>;
  getByCode(serviceCode: string): Promise<PlatformServiceRecord | null>;

  search(
    filter: ServiceCatalogSearchFilter,
  ): Promise<{ items: PlatformServiceRecord[]; total: number }>;

  updateService(
    id: string,
    patch: Partial<PlatformServiceRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<PlatformServiceRecord>;

  listDependencies(serviceId: string): Promise<ServiceDependencyRecord[]>;
  listDependents(serviceId: string): Promise<ServiceDependencyRecord[]>;

  addDependency(
    input: Omit<ServiceDependencyRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ServiceDependencyRecord>;

  removeDependency(
    serviceId: string,
    dependsOnServiceId: string,
    dependencyType: string,
    client?: unknown,
  ): Promise<void>;

  appendActivity(
    input: {
      serviceId: string;
      eventType: string;
      action: string;
      actorId: string | null;
      outcome?: string;
      details?: Record<string, unknown>;
      correlationId?: string | null;
    },
    client?: unknown,
  ): Promise<void>;
}

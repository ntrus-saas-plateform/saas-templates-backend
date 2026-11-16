import type {
  LifecycleEvidenceRecord,
  LifecycleRunRecord,
  TenantLifecycleRecord,
} from './lifecycle.types.js';

export const LIFECYCLE_REPOSITORY_PORT = Symbol('LIFECYCLE_REPOSITORY_PORT');

export interface LifecycleRepositoryPort {
  createRecord(
    input: Omit<TenantLifecycleRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<TenantLifecycleRecord>;
  getRecord(id: string): Promise<TenantLifecycleRecord | null>;
  getActiveRecord(
    tenantId: string,
    productId: string,
  ): Promise<TenantLifecycleRecord | null>;
  listRecords(filter: {
    tenantId?: string;
    productId?: string;
    status?: string;
    activationRecordId?: string;
    provisioningRequestId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: TenantLifecycleRecord[]; total: number }>;
  updateRecord(
    id: string,
    patch: Partial<TenantLifecycleRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<TenantLifecycleRecord>;

  createRun(
    input: Omit<LifecycleRunRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<LifecycleRunRecord>;
  listRuns(lifecycleRecordId: string, limit?: number): Promise<LifecycleRunRecord[]>;
  updateRun(
    id: string,
    patch: Partial<LifecycleRunRecord>,
    client?: unknown,
  ): Promise<LifecycleRunRecord>;

  createEvidence(
    input: Omit<LifecycleEvidenceRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<LifecycleEvidenceRecord>;
  listEvidence(filter: {
    lifecycleRecordId?: string;
    limit?: number;
  }): Promise<LifecycleEvidenceRecord[]>;

  appendHistory(
    input: {
      resourceType: string;
      resourceId: string;
      tenantId?: string | null;
      fromStatus?: string | null;
      toStatus?: string | null;
      action: string;
      reason?: string | null;
      actorId: string;
      details?: Record<string, unknown>;
    },
    client?: unknown,
  ): Promise<void>;
}

import type {
  ActivationEvidenceRecord,
  ActivationRecordRecord,
  ActivationRunRecord,
  ReadinessCheckRecord,
  TenantReadinessEvaluationRecord,
} from './activation.types.js';

export const ACTIVATION_REPOSITORY_PORT = Symbol('ACTIVATION_REPOSITORY_PORT');

export interface ActivationRepositoryPort {
  createEvaluation(
    input: Omit<TenantReadinessEvaluationRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<TenantReadinessEvaluationRecord>;
  getEvaluation(id: string): Promise<TenantReadinessEvaluationRecord | null>;
  listEvaluations(filter: {
    tenantId?: string;
    productId?: string;
    status?: string;
    provisioningRequestId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: TenantReadinessEvaluationRecord[]; total: number }>;
  updateEvaluation(
    id: string,
    patch: Partial<TenantReadinessEvaluationRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<TenantReadinessEvaluationRecord>;

  upsertCheck(
    input: Omit<ReadinessCheckRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ReadinessCheckRecord>;
  listChecks(evaluationId: string): Promise<ReadinessCheckRecord[]>;
  getCheck(
    evaluationId: string,
    checkCode: string,
  ): Promise<ReadinessCheckRecord | null>;

  createActivationRecord(
    input: Omit<ActivationRecordRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<ActivationRecordRecord>;
  getActivationRecord(id: string): Promise<ActivationRecordRecord | null>;
  getActiveActivationRecord(
    tenantId: string,
    productId: string,
  ): Promise<ActivationRecordRecord | null>;
  listActivationRecords(filter: {
    tenantId?: string;
    productId?: string;
    status?: string;
    provisioningRequestId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ActivationRecordRecord[]; total: number }>;
  updateActivationRecord(
    id: string,
    patch: Partial<ActivationRecordRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<ActivationRecordRecord>;

  createRun(
    input: Omit<ActivationRunRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ActivationRunRecord>;
  listRuns(activationRecordId: string, limit?: number): Promise<ActivationRunRecord[]>;
  updateRun(
    id: string,
    patch: Partial<ActivationRunRecord>,
    client?: unknown,
  ): Promise<ActivationRunRecord>;

  createEvidence(
    input: Omit<ActivationEvidenceRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ActivationEvidenceRecord>;
  listEvidence(filter: {
    activationRecordId?: string;
    evaluationId?: string;
    limit?: number;
  }): Promise<ActivationEvidenceRecord[]>;

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

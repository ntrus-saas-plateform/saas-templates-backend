import type {
  ReconciliationEvidenceRecord,
  ReconciliationFindingRecord,
  ReconciliationPolicyRecord,
  ReconciliationRemediationRecord,
  ReconciliationRunRecord,
  ReconciliationWaiverRecord,
} from './reconciliation.types.js';

export const RECONCILIATION_REPOSITORY_PORT = Symbol('RECONCILIATION_REPOSITORY_PORT');

export interface ReconciliationRepositoryPort {
  createPolicy(
    input: Omit<ReconciliationPolicyRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<ReconciliationPolicyRecord>;
  getPolicy(id: string): Promise<ReconciliationPolicyRecord | null>;
  getPolicyByCode(code: string): Promise<ReconciliationPolicyRecord | null>;
  listPolicies(filter: {
    status?: string;
    scope?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ReconciliationPolicyRecord[]; total: number }>;
  updatePolicy(
    id: string,
    patch: Partial<ReconciliationPolicyRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<ReconciliationPolicyRecord>;

  createRun(
    input: Omit<ReconciliationRunRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ReconciliationRunRecord>;
  getRun(id: string): Promise<ReconciliationRunRecord | null>;
  listRuns(filter: {
    tenantId?: string;
    productId?: string;
    status?: string;
    policyId?: string;
    providerCode?: string;
    provisioningRequestId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ReconciliationRunRecord[]; total: number }>;
  updateRun(
    id: string,
    patch: Partial<ReconciliationRunRecord>,
    client?: unknown,
  ): Promise<ReconciliationRunRecord>;

  createFinding(
    input: Omit<ReconciliationFindingRecord, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    },
    client?: unknown,
  ): Promise<ReconciliationFindingRecord>;
  createFindings(
    inputs: Array<
      Omit<ReconciliationFindingRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    >,
    client?: unknown,
  ): Promise<ReconciliationFindingRecord[]>;
  getFinding(id: string): Promise<ReconciliationFindingRecord | null>;
  listFindings(filter: {
    runId?: string;
    tenantId?: string;
    status?: string;
    observationClass?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ReconciliationFindingRecord[]; total: number }>;
  updateFinding(
    id: string,
    patch: Partial<ReconciliationFindingRecord>,
    client?: unknown,
  ): Promise<ReconciliationFindingRecord>;

  createRemediation(
    input: Omit<ReconciliationRemediationRecord, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    },
    client?: unknown,
  ): Promise<ReconciliationRemediationRecord>;
  getRemediation(id: string): Promise<ReconciliationRemediationRecord | null>;
  listRemediations(filter: {
    runId?: string;
    findingId?: string;
    status?: string;
    limit?: number;
  }): Promise<ReconciliationRemediationRecord[]>;
  updateRemediation(
    id: string,
    patch: Partial<ReconciliationRemediationRecord>,
    client?: unknown,
  ): Promise<ReconciliationRemediationRecord>;

  createWaiver(
    input: Omit<ReconciliationWaiverRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ReconciliationWaiverRecord>;
  getWaiver(id: string): Promise<ReconciliationWaiverRecord | null>;
  listWaivers(filter: {
    findingId?: string;
    tenantId?: string;
    status?: string;
    limit?: number;
  }): Promise<ReconciliationWaiverRecord[]>;
  listActiveWaivers(filter: {
    tenantId?: string | null;
    productId?: string | null;
    findingId?: string | null;
    now?: Date;
  }): Promise<ReconciliationWaiverRecord[]>;
  updateWaiver(
    id: string,
    patch: Partial<ReconciliationWaiverRecord>,
    client?: unknown,
  ): Promise<ReconciliationWaiverRecord>;

  createEvidence(
    input: Omit<ReconciliationEvidenceRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ReconciliationEvidenceRecord>;
  listEvidence(filter: {
    runId?: string;
    findingId?: string;
    remediationId?: string;
    limit?: number;
  }): Promise<ReconciliationEvidenceRecord[]>;

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

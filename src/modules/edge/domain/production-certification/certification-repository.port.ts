import type {
  CertificationEvidenceItemRecord,
  CertificationEvidenceRecord,
  CertificationPackageRecord,
  CertificationRunRecord,
} from './certification.types.js';

export const CERTIFICATION_REPOSITORY_PORT = Symbol('CERTIFICATION_REPOSITORY_PORT');

export interface CertificationRepositoryPort {
  createPackage(
    input: Omit<
      CertificationPackageRecord,
      'id' | 'createdAt' | 'updatedAt' | 'version'
    > & { id?: string; version?: number },
    client?: unknown,
  ): Promise<CertificationPackageRecord>;
  getPackage(id: string): Promise<CertificationPackageRecord | null>;
  getPackageByCode(code: string): Promise<CertificationPackageRecord | null>;
  listPackages(filter: {
    status?: string;
    productId?: string;
    deploymentProfileCode?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: CertificationPackageRecord[]; total: number }>;
  updatePackage(
    id: string,
    patch: Partial<CertificationPackageRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<CertificationPackageRecord>;

  upsertEvidenceItem(
    input: Omit<CertificationEvidenceItemRecord, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    },
    client?: unknown,
  ): Promise<CertificationEvidenceItemRecord>;
  getEvidenceItem(id: string): Promise<CertificationEvidenceItemRecord | null>;
  listEvidenceItems(filter: {
    packageId: string;
    required?: boolean;
    status?: string;
    limit?: number;
  }): Promise<CertificationEvidenceItemRecord[]>;
  updateEvidenceItem(
    id: string,
    patch: Partial<CertificationEvidenceItemRecord>,
    client?: unknown,
  ): Promise<CertificationEvidenceItemRecord>;

  createRun(
    input: Omit<CertificationRunRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<CertificationRunRecord>;
  getRun(id: string): Promise<CertificationRunRecord | null>;
  listRuns(filter: {
    packageId?: string;
    operation?: string;
    outcome?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: CertificationRunRecord[]; total: number }>;
  updateRun(
    id: string,
    patch: Partial<CertificationRunRecord>,
    client?: unknown,
  ): Promise<CertificationRunRecord>;

  createEvidence(
    input: Omit<CertificationEvidenceRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<CertificationEvidenceRecord>;
  listEvidence(filter: {
    packageId?: string;
    workflowId?: string;
    limit?: number;
  }): Promise<CertificationEvidenceRecord[]>;

  appendHistory(
    input: {
      resourceType: string;
      resourceId: string;
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

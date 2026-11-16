import type {
  ExperienceApplicationRecord,
  ExperienceApplicationVersionRecord,
  ExperienceCertificateRecord,
  ExperienceClientRegistrationRecord,
  ExperienceDeploymentRunRecord,
  ExperienceDomainBindingRecord,
  ExperienceEvidenceRecord,
  ExperienceProfileRecord,
  TenantApplicationBindingRecord,
  TenantExperienceAssignmentRecord,
} from './experience.types.js';

export const EXPERIENCE_REPOSITORY_PORT = Symbol('EXPERIENCE_REPOSITORY_PORT');

export interface ExperienceRepositoryPort {
  createProfile(
    input: Omit<ExperienceProfileRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<ExperienceProfileRecord>;
  getProfile(id: string): Promise<ExperienceProfileRecord | null>;
  getProfileByCode(code: string): Promise<ExperienceProfileRecord | null>;
  listProfiles(filter: {
    limit?: number;
    offset?: number;
    status?: string;
    q?: string;
    productId?: string;
  }): Promise<{ items: ExperienceProfileRecord[]; total: number }>;
  updateProfile(
    id: string,
    patch: Partial<ExperienceProfileRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<ExperienceProfileRecord>;
  publishProfile(
    id: string,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<ExperienceProfileRecord>;

  createApplication(
    input: Omit<
      ExperienceApplicationRecord,
      'id' | 'createdAt' | 'updatedAt' | 'version' | 'latestVersion'
    > & {
      id?: string;
      version?: number;
      latestVersion?: number;
      draftManifest: Record<string, unknown>;
      checksum: string;
      productVersion?: string | null;
      runtimeVersion?: string | null;
      apiCompatibilityVersion?: string | null;
      deploymentProfileCode?: string | null;
      configurationBundleCode?: string | null;
      entitlementSnapshotVersion?: string | null;
    },
    client?: unknown,
  ): Promise<{
    application: ExperienceApplicationRecord;
    version: ExperienceApplicationVersionRecord;
  }>;
  getApplication(id: string): Promise<ExperienceApplicationRecord | null>;
  getApplicationByCode(code: string): Promise<ExperienceApplicationRecord | null>;
  listApplications(filter: {
    limit?: number;
    offset?: number;
    status?: string;
    q?: string;
    productId?: string;
    experienceProfileId?: string;
  }): Promise<{ items: ExperienceApplicationRecord[]; total: number }>;
  getApplicationVersion(
    applicationId: string,
    versionNumber: number,
  ): Promise<ExperienceApplicationVersionRecord | null>;
  publishApplicationVersion(
    applicationId: string,
    versionNumber: number,
    expectedApplicationVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<ExperienceApplicationRecord>;

  createAssignment(
    input: Omit<TenantExperienceAssignmentRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<TenantExperienceAssignmentRecord>;
  getAssignment(id: string): Promise<TenantExperienceAssignmentRecord | null>;
  getActiveAssignment(
    tenantId: string,
    productId: string,
  ): Promise<TenantExperienceAssignmentRecord | null>;
  listAssignments(filter: {
    tenantId?: string;
    productId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: TenantExperienceAssignmentRecord[]; total: number }>;
  updateAssignment(
    id: string,
    patch: Partial<TenantExperienceAssignmentRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<TenantExperienceAssignmentRecord>;

  createApplicationBinding(
    input: Omit<TenantApplicationBindingRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<TenantApplicationBindingRecord>;
  listApplicationBindings(assignmentId: string): Promise<TenantApplicationBindingRecord[]>;
  updateApplicationBinding(
    id: string,
    patch: Partial<TenantApplicationBindingRecord>,
    client?: unknown,
  ): Promise<TenantApplicationBindingRecord>;

  createClientRegistration(
    input: Omit<ExperienceClientRegistrationRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<ExperienceClientRegistrationRecord>;
  getClientRegistration(id: string): Promise<ExperienceClientRegistrationRecord | null>;
  listClientRegistrations(assignmentId: string): Promise<ExperienceClientRegistrationRecord[]>;
  updateClientRegistration(
    id: string,
    patch: Partial<ExperienceClientRegistrationRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<ExperienceClientRegistrationRecord>;

  createDomainBinding(
    input: Omit<ExperienceDomainBindingRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<ExperienceDomainBindingRecord>;
  getDomainBinding(id: string): Promise<ExperienceDomainBindingRecord | null>;
  getDomainByHostname(hostname: string): Promise<ExperienceDomainBindingRecord | null>;
  listDomainBindings(assignmentId: string): Promise<ExperienceDomainBindingRecord[]>;
  updateDomainBinding(
    id: string,
    patch: Partial<ExperienceDomainBindingRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<ExperienceDomainBindingRecord>;

  createCertificate(
    input: Omit<ExperienceCertificateRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<ExperienceCertificateRecord>;
  listCertificates(domainBindingId: string): Promise<ExperienceCertificateRecord[]>;

  createDeploymentRun(
    input: Omit<ExperienceDeploymentRunRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ExperienceDeploymentRunRecord>;
  listDeploymentRuns(
    assignmentId: string,
    limit?: number,
  ): Promise<ExperienceDeploymentRunRecord[]>;

  createEvidence(
    input: Omit<ExperienceEvidenceRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ExperienceEvidenceRecord>;
  listEvidence(assignmentId: string, limit?: number): Promise<ExperienceEvidenceRecord[]>;

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

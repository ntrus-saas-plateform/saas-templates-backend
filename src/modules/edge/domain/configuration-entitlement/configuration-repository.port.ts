import type {
  ConfigurationBundleRecord,
  ConfigurationBundleVersionRecord,
  ConfigurationDeploymentRunRecord,
  ConfigurationEvidenceRecord,
  ConfigurationSchemaRecord,
  ConfigurationTemplateRecord,
  ConfigurationTemplateVersionRecord,
  EntitlementDeploymentRecord,
  TenantConfigurationAssignmentRecord,
} from './configuration.types.js';

export const CONFIGURATION_REPOSITORY_PORT = Symbol('CONFIGURATION_REPOSITORY_PORT');

export interface ConfigurationRepositoryPort {
  createSchema(
    input: Omit<ConfigurationSchemaRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<ConfigurationSchemaRecord>;
  getSchema(id: string): Promise<ConfigurationSchemaRecord | null>;
  getSchemaByCode(code: string, schemaVersion?: number): Promise<ConfigurationSchemaRecord | null>;
  listSchemas(filter: { limit?: number; offset?: number; status?: string; q?: string }): Promise<{
    items: ConfigurationSchemaRecord[];
    total: number;
  }>;

  createTemplate(
    input: Omit<ConfigurationTemplateRecord, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'latestVersion'> & {
      id?: string;
      version?: number;
      latestVersion?: number;
      draftPayload: Record<string, unknown>;
      checksum: string;
    },
    client?: unknown,
  ): Promise<{ template: ConfigurationTemplateRecord; version: ConfigurationTemplateVersionRecord }>;
  getTemplate(id: string): Promise<ConfigurationTemplateRecord | null>;
  getTemplateByCode(code: string): Promise<ConfigurationTemplateRecord | null>;
  listTemplates(filter: { limit?: number; offset?: number; status?: string; q?: string }): Promise<{
    items: ConfigurationTemplateRecord[];
    total: number;
  }>;
  getTemplateVersion(
    templateId: string,
    versionNumber: number,
  ): Promise<ConfigurationTemplateVersionRecord | null>;
  publishTemplateVersion(
    templateId: string,
    versionNumber: number,
    expectedTemplateVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<ConfigurationTemplateRecord>;

  createBundle(
    input: Omit<ConfigurationBundleRecord, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'latestVersion'> & {
      id?: string;
      version?: number;
      latestVersion?: number;
      draft: {
        templateRefs: Array<{ templateId: string; versionNumber: number }>;
        dependencyRefs?: string[];
        payload: Record<string, unknown>;
        checksum: string;
        rolloutPolicy?: Record<string, unknown>;
      };
    },
    client?: unknown,
  ): Promise<{ bundle: ConfigurationBundleRecord; version: ConfigurationBundleVersionRecord }>;
  getBundle(id: string): Promise<ConfigurationBundleRecord | null>;
  getBundleByCode(code: string): Promise<ConfigurationBundleRecord | null>;
  listBundles(filter: { limit?: number; offset?: number; status?: string; q?: string }): Promise<{
    items: ConfigurationBundleRecord[];
    total: number;
  }>;
  getBundleVersion(
    bundleId: string,
    versionNumber: number,
  ): Promise<ConfigurationBundleVersionRecord | null>;
  publishBundleVersion(
    bundleId: string,
    versionNumber: number,
    expectedBundleVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<ConfigurationBundleRecord>;

  createAssignment(
    input: Omit<TenantConfigurationAssignmentRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<TenantConfigurationAssignmentRecord>;
  getAssignment(id: string): Promise<TenantConfigurationAssignmentRecord | null>;
  getActiveAssignment(
    tenantId: string,
    productId: string,
  ): Promise<TenantConfigurationAssignmentRecord | null>;
  listAssignments(filter: {
    tenantId?: string;
    productId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: TenantConfigurationAssignmentRecord[]; total: number }>;
  updateAssignment(
    id: string,
    patch: Partial<TenantConfigurationAssignmentRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<TenantConfigurationAssignmentRecord>;

  createEntitlementDeployment(
    input: Omit<EntitlementDeploymentRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<EntitlementDeploymentRecord>;
  getEntitlementByDigest(
    tenantId: string,
    productId: string,
    payloadDigest: string,
  ): Promise<EntitlementDeploymentRecord | null>;
  listEntitlementDeployments(
    assignmentId: string,
    limit?: number,
  ): Promise<EntitlementDeploymentRecord[]>;
  updateEntitlementDeployment(
    id: string,
    patch: Partial<EntitlementDeploymentRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<EntitlementDeploymentRecord>;

  createDeploymentRun(
    input: Omit<ConfigurationDeploymentRunRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ConfigurationDeploymentRunRecord>;
  listDeploymentRuns(
    assignmentId: string,
    limit?: number,
  ): Promise<ConfigurationDeploymentRunRecord[]>;

  createEvidence(
    input: Omit<ConfigurationEvidenceRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ConfigurationEvidenceRecord>;
  listEvidence(assignmentId: string, limit?: number): Promise<ConfigurationEvidenceRecord[]>;

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

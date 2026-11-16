import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type { ExperienceRepositoryPort } from '../../domain/product-experience/experience-repository.port.js';
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
} from '../../domain/product-experience/experience.types.js';
import {
  ApplicationStatus,
  ExperienceAssignmentStatus,
  ExperienceErrorCode,
  ExperienceProfileStatus,
  ExperienceVersionStatus,
} from '../../domain/product-experience/experience.types.js';

type Row = Record<string, unknown>;

function str(v: unknown): string {
  return v == null ? '' : String(v);
}
function strOrNull(v: unknown): string | null {
  return v == null ? null : String(v);
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function asDate(v: unknown): Date {
  return v instanceof Date ? v : new Date(String(v));
}
function asDateOrNull(v: unknown): Date | null {
  return v == null ? null : asDate(v);
}
function asJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}

/**
 * P7.9 PostgreSQL repository — mirrors migration 104 / P7.8 configuration patterns.
 * Optimistic concurrency (version column) + transactional client passthrough.
 */
@Injectable()
export class PgExperienceRepository implements ExperienceRepositoryPort {
  constructor(private readonly cpDb: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.cpDb.getPool();
  }

  private async q<T extends Row = Row>(sql: string, params: unknown[] = [], client?: unknown) {
    const executor = client ? (client as PoolClient) : this.pool;
    return (await executor.query(sql, params)).rows as T[];
  }

  private conflict(): never {
    throw new DomainError(ErrorCode.CONFLICT, 'Optimistic lock conflict on experience resource');
  }

  private notFound(label = 'Experience resource'): never {
    throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, `${label} not found`);
  }

  private rethrow(err: unknown, message: string, collisionCode = 'EXPERIENCE_COLLISION'): never {
    const code = (err as { code?: string } | null)?.code;
    if (code === '23505') {
      throw new DomainError(ErrorCode.CONFLICT, message, [{ code: collisionCode }]);
    }
    if (code === '40001') this.conflict();
    throw err;
  }

  // -------------------------------------------------------------------------
  // Profiles
  // -------------------------------------------------------------------------

  private mapProfile(row: Row): ExperienceProfileRecord {
    return {
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      description: strOrNull(row.description),
      productId: strOrNull(row.product_id),
      profileStatus: str(row.profile_status),
      compatibleRuntimeCodes: asJson(row.compatible_runtime_codes, []).map(String),
      compatibleDeploymentProfileCodes: asJson(row.compatible_deployment_profile_codes, []).map(
        String,
      ),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  async createProfile(
    input: Omit<ExperienceProfileRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<ExperienceProfileRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_experience_profiles (
           id, code, name, description, product_id, profile_status,
           compatible_runtime_codes, compatible_deployment_profile_codes,
           metadata, created_by, updated_by, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
           $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, COALESCE($12, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.code,
          input.name,
          input.description,
          input.productId,
          input.profileStatus ?? ExperienceProfileStatus.DRAFT,
          JSON.stringify(input.compatibleRuntimeCodes ?? []),
          JSON.stringify(input.compatibleDeploymentProfileCodes ?? []),
          JSON.stringify(input.metadata ?? {}),
          input.createdBy,
          input.updatedBy,
          input.version ?? 1,
        ],
        client,
      );
      return this.mapProfile(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Experience profile code already exists');
    }
  }

  async getProfile(id: string): Promise<ExperienceProfileRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_experience_profiles WHERE id = $1`, [id]);
    return rows[0] ? this.mapProfile(rows[0]) : null;
  }

  async getProfileByCode(code: string): Promise<ExperienceProfileRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_experience_profiles WHERE code = $1`, [code]);
    return rows[0] ? this.mapProfile(rows[0]) : null;
  }

  async listProfiles(filter: {
    limit?: number;
    offset?: number;
    status?: string;
    q?: string;
    productId?: string;
  }): Promise<{ items: ExperienceProfileRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`profile_status = $${params.length}`);
    }
    if (filter.productId) {
      params.push(filter.productId);
      where.push(`product_id = $${params.length}`);
    }
    if (filter.q) {
      params.push(`%${filter.q}%`);
      where.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p7_experience_profiles ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_experience_profiles ${clause}
       ORDER BY code LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapProfile(r)), total: num(countRows[0]?.c) };
  }

  async updateProfile(
    id: string,
    patch: Partial<ExperienceProfileRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<ExperienceProfileRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_experience_profiles SET
         name = COALESCE($3, name),
         description = COALESCE($4, description),
         product_id = COALESCE($5, product_id),
         profile_status = COALESCE($6, profile_status),
         compatible_runtime_codes = COALESCE($7::jsonb, compatible_runtime_codes),
         compatible_deployment_profile_codes = COALESCE($8::jsonb, compatible_deployment_profile_codes),
         metadata = COALESCE($9::jsonb, metadata),
         version = version + 1,
         updated_by = $10,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.name ?? null,
        patch.description === undefined ? null : patch.description,
        patch.productId === undefined ? null : patch.productId,
        patch.profileStatus ?? null,
        patch.compatibleRuntimeCodes
          ? JSON.stringify(patch.compatibleRuntimeCodes)
          : null,
        patch.compatibleDeploymentProfileCodes
          ? JSON.stringify(patch.compatibleDeploymentProfileCodes)
          : null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        actorId,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapProfile(rows[0]);
  }

  async publishProfile(
    id: string,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<ExperienceProfileRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_experience_profiles SET
         profile_status = $3,
         version = version + 1,
         updated_by = $4,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [id, expectedVersion, ExperienceProfileStatus.PUBLISHED, actorId],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapProfile(rows[0]);
  }

  // -------------------------------------------------------------------------
  // Applications + versions
  // -------------------------------------------------------------------------

  private mapApplication(row: Row): ExperienceApplicationRecord {
    return {
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      description: strOrNull(row.description),
      productId: strOrNull(row.product_id),
      applicationKind: str(row.application_kind),
      experienceProfileId: strOrNull(row.experience_profile_id),
      applicationStatus: str(row.application_status),
      latestVersion: num(row.latest_version),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapApplicationVersion(row: Row): ExperienceApplicationVersionRecord {
    return {
      id: str(row.id),
      applicationId: str(row.application_id),
      versionNumber: num(row.version_number),
      productVersion: strOrNull(row.product_version),
      runtimeVersion: strOrNull(row.runtime_version),
      apiCompatibilityVersion: strOrNull(row.api_compatibility_version),
      deploymentProfileCode: strOrNull(row.deployment_profile_code),
      configurationBundleCode: strOrNull(row.configuration_bundle_code),
      entitlementSnapshotVersion: strOrNull(row.entitlement_snapshot_version),
      manifest: asJson(row.manifest, {}),
      checksum: str(row.checksum),
      status: str(row.status),
      publishedAt: asDateOrNull(row.published_at),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
    };
  }

  async createApplication(
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
  }> {
    try {
      const appRows = await this.q(
        `INSERT INTO edge_p7_experience_applications (
           id, code, name, description, product_id, application_kind,
           experience_profile_id, application_status, latest_version,
           metadata, created_by, updated_by, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
           $7, $8, 1, $9::jsonb, $10, $10, COALESCE($11, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.code,
          input.name,
          input.description,
          input.productId,
          input.applicationKind,
          input.experienceProfileId,
          input.applicationStatus ?? ApplicationStatus.DRAFT,
          JSON.stringify(input.metadata ?? {}),
          input.createdBy,
          input.version ?? 1,
        ],
        client,
      );
      const application = this.mapApplication(appRows[0]!);
      const versionRows = await this.q(
        `INSERT INTO edge_p7_experience_application_versions (
           application_id, version_number, product_version, runtime_version,
           api_compatibility_version, deployment_profile_code, configuration_bundle_code,
           entitlement_snapshot_version, manifest, checksum, status, created_by
         ) VALUES (
           $1, 1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11
         ) RETURNING *`,
        [
          application.id,
          input.productVersion ?? null,
          input.runtimeVersion ?? null,
          input.apiCompatibilityVersion ?? null,
          input.deploymentProfileCode ?? null,
          input.configurationBundleCode ?? null,
          input.entitlementSnapshotVersion ?? null,
          JSON.stringify(input.draftManifest ?? {}),
          input.checksum,
          ExperienceVersionStatus.DRAFT,
          input.createdBy,
        ],
        client,
      );
      return { application, version: this.mapApplicationVersion(versionRows[0]!) };
    } catch (err) {
      this.rethrow(err, 'Experience application code already exists');
    }
  }

  async getApplication(id: string): Promise<ExperienceApplicationRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_experience_applications WHERE id = $1`, [id]);
    return rows[0] ? this.mapApplication(rows[0]) : null;
  }

  async getApplicationByCode(code: string): Promise<ExperienceApplicationRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_experience_applications WHERE code = $1`, [
      code,
    ]);
    return rows[0] ? this.mapApplication(rows[0]) : null;
  }

  async listApplications(filter: {
    limit?: number;
    offset?: number;
    status?: string;
    q?: string;
    productId?: string;
    experienceProfileId?: string;
  }): Promise<{ items: ExperienceApplicationRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`application_status = $${params.length}`);
    }
    if (filter.productId) {
      params.push(filter.productId);
      where.push(`product_id = $${params.length}`);
    }
    if (filter.experienceProfileId) {
      params.push(filter.experienceProfileId);
      where.push(`experience_profile_id = $${params.length}`);
    }
    if (filter.q) {
      params.push(`%${filter.q}%`);
      where.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p7_experience_applications ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_experience_applications ${clause}
       ORDER BY code LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapApplication(r)), total: num(countRows[0]?.c) };
  }

  async getApplicationVersion(
    applicationId: string,
    versionNumber: number,
  ): Promise<ExperienceApplicationVersionRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_experience_application_versions
       WHERE application_id = $1 AND version_number = $2`,
      [applicationId, versionNumber],
    );
    return rows[0] ? this.mapApplicationVersion(rows[0]) : null;
  }

  async publishApplicationVersion(
    applicationId: string,
    versionNumber: number,
    expectedApplicationVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<ExperienceApplicationRecord> {
    const verRows = await this.q(
      `UPDATE edge_p7_experience_application_versions SET
         status = $3, published_at = NOW()
       WHERE application_id = $1 AND version_number = $2 AND status IN ('DRAFT','VALIDATED')
       RETURNING *`,
      [applicationId, versionNumber, ExperienceVersionStatus.PUBLISHED],
      client,
    );
    if (!verRows[0]) this.notFound('Application version');

    await this.q(
      `UPDATE edge_p7_experience_application_versions SET status = $3
       WHERE application_id = $1 AND version_number <> $2 AND status = $4`,
      [
        applicationId,
        versionNumber,
        ExperienceVersionStatus.SUPERSEDED,
        ExperienceVersionStatus.PUBLISHED,
      ],
      client,
    );

    const rows = await this.q(
      `UPDATE edge_p7_experience_applications SET
         application_status = $3,
         latest_version = GREATEST(latest_version, $4),
         version = version + 1,
         updated_by = $5,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        applicationId,
        expectedApplicationVersion,
        ApplicationStatus.PUBLISHED,
        versionNumber,
        actorId,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapApplication(rows[0]);
  }

  // -------------------------------------------------------------------------
  // Assignments
  // -------------------------------------------------------------------------

  private mapAssignment(row: Row): TenantExperienceAssignmentRecord {
    return {
      id: str(row.id),
      tenantId: str(row.tenant_id),
      productId: str(row.product_id),
      subscriptionId: strOrNull(row.subscription_id),
      accountId: strOrNull(row.account_id),
      experienceProfileId: strOrNull(row.experience_profile_id),
      assignmentStatus: str(row.assignment_status),
      authorizationRowId: strOrNull(row.authorization_row_id),
      authorizationVersion: row.authorization_version == null ? null : num(row.authorization_version),
      provisioningRequestId: strOrNull(row.provisioning_request_id),
      workflowId: strOrNull(row.workflow_id),
      desiredManifest: asJson(row.desired_manifest, {}),
      appliedManifest: asJson(row.applied_manifest, {}),
      appliedChecksum: strOrNull(row.applied_checksum),
      driftStatus: str(row.drift_status),
      lastDeployedAt: asDateOrNull(row.last_deployed_at),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  async createAssignment(
    input: Omit<TenantExperienceAssignmentRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<TenantExperienceAssignmentRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_tenant_experience_assignments (
           id, tenant_id, product_id, subscription_id, account_id, experience_profile_id,
           assignment_status, authorization_row_id, authorization_version,
           provisioning_request_id, workflow_id, desired_manifest, applied_manifest,
           applied_checksum, drift_status, last_deployed_at, metadata,
           created_by, updated_by, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb,
           $14, $15, $16, $17::jsonb, $18, $19, COALESCE($20, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.tenantId,
          input.productId,
          input.subscriptionId,
          input.accountId,
          input.experienceProfileId,
          input.assignmentStatus ?? ExperienceAssignmentStatus.ASSIGNED,
          input.authorizationRowId,
          input.authorizationVersion,
          input.provisioningRequestId,
          input.workflowId,
          JSON.stringify(input.desiredManifest ?? {}),
          JSON.stringify(input.appliedManifest ?? {}),
          input.appliedChecksum,
          input.driftStatus,
          input.lastDeployedAt,
          JSON.stringify(input.metadata ?? {}),
          input.createdBy,
          input.updatedBy,
          input.version ?? 1,
        ],
        client,
      );
      return this.mapAssignment(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Active tenant experience assignment already exists');
    }
  }

  async getAssignment(id: string): Promise<TenantExperienceAssignmentRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_tenant_experience_assignments WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapAssignment(rows[0]) : null;
  }

  async getActiveAssignment(
    tenantId: string,
    productId: string,
  ): Promise<TenantExperienceAssignmentRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_tenant_experience_assignments
       WHERE tenant_id = $1 AND product_id = $2
         AND assignment_status IN ('ASSIGNED','PROVISIONING','READY')
       ORDER BY created_at DESC LIMIT 1`,
      [tenantId, productId],
    );
    return rows[0] ? this.mapAssignment(rows[0]) : null;
  }

  async listAssignments(filter: {
    tenantId?: string;
    productId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: TenantExperienceAssignmentRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.tenantId) {
      params.push(filter.tenantId);
      where.push(`tenant_id = $${params.length}`);
    }
    if (filter.productId) {
      params.push(filter.productId);
      where.push(`product_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p7_tenant_experience_assignments ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_tenant_experience_assignments ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapAssignment(r)), total: num(countRows[0]?.c) };
  }

  async updateAssignment(
    id: string,
    patch: Partial<TenantExperienceAssignmentRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<TenantExperienceAssignmentRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_tenant_experience_assignments SET
         experience_profile_id = COALESCE($3, experience_profile_id),
         assignment_status = COALESCE($4, assignment_status),
         authorization_row_id = COALESCE($5, authorization_row_id),
         authorization_version = COALESCE($6, authorization_version),
         provisioning_request_id = COALESCE($7, provisioning_request_id),
         workflow_id = COALESCE($8, workflow_id),
         desired_manifest = COALESCE($9::jsonb, desired_manifest),
         applied_manifest = COALESCE($10::jsonb, applied_manifest),
         applied_checksum = COALESCE($11, applied_checksum),
         drift_status = COALESCE($12, drift_status),
         last_deployed_at = COALESCE($13, last_deployed_at),
         metadata = COALESCE($14::jsonb, metadata),
         subscription_id = COALESCE($15, subscription_id),
         account_id = COALESCE($16, account_id),
         version = version + 1,
         updated_by = $17,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.experienceProfileId === undefined ? null : patch.experienceProfileId,
        patch.assignmentStatus ?? null,
        patch.authorizationRowId === undefined ? null : patch.authorizationRowId,
        patch.authorizationVersion === undefined ? null : patch.authorizationVersion,
        patch.provisioningRequestId === undefined ? null : patch.provisioningRequestId,
        patch.workflowId === undefined ? null : patch.workflowId,
        patch.desiredManifest ? JSON.stringify(patch.desiredManifest) : null,
        patch.appliedManifest ? JSON.stringify(patch.appliedManifest) : null,
        patch.appliedChecksum === undefined ? null : patch.appliedChecksum,
        patch.driftStatus ?? null,
        patch.lastDeployedAt === undefined ? null : patch.lastDeployedAt,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        patch.subscriptionId === undefined ? null : patch.subscriptionId,
        patch.accountId === undefined ? null : patch.accountId,
        actorId,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapAssignment(rows[0]);
  }

  // -------------------------------------------------------------------------
  // Application bindings
  // -------------------------------------------------------------------------

  private mapApplicationBinding(row: Row): TenantApplicationBindingRecord {
    return {
      id: str(row.id),
      assignmentId: str(row.assignment_id),
      tenantId: str(row.tenant_id),
      applicationId: str(row.application_id),
      applicationVersion: num(row.application_version),
      bindingStatus: str(row.binding_status),
      clientRegistrationId: strOrNull(row.client_registration_id),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  async createApplicationBinding(
    input: Omit<TenantApplicationBindingRecord, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    },
    client?: unknown,
  ): Promise<TenantApplicationBindingRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_tenant_application_bindings (
           id, assignment_id, tenant_id, application_id, application_version,
           binding_status, client_registration_id, metadata
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8::jsonb
         ) RETURNING *`,
        [
          input.id ?? null,
          input.assignmentId,
          input.tenantId,
          input.applicationId,
          input.applicationVersion,
          input.bindingStatus,
          input.clientRegistrationId,
          JSON.stringify(input.metadata ?? {}),
        ],
        client,
      );
      return this.mapApplicationBinding(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Tenant application binding already exists');
    }
  }

  async listApplicationBindings(assignmentId: string): Promise<TenantApplicationBindingRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_tenant_application_bindings
       WHERE assignment_id = $1 ORDER BY created_at ASC`,
      [assignmentId],
    );
    return rows.map((r) => this.mapApplicationBinding(r));
  }

  async updateApplicationBinding(
    id: string,
    patch: Partial<TenantApplicationBindingRecord>,
    client?: unknown,
  ): Promise<TenantApplicationBindingRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_tenant_application_bindings SET
         application_version = COALESCE($2, application_version),
         binding_status = COALESCE($3, binding_status),
         client_registration_id = COALESCE($4, client_registration_id),
         metadata = COALESCE($5::jsonb, metadata),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.applicationVersion ?? null,
        patch.bindingStatus ?? null,
        patch.clientRegistrationId === undefined ? null : patch.clientRegistrationId,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
      ],
      client,
    );
    if (!rows[0]) this.notFound('Application binding');
    return this.mapApplicationBinding(rows[0]);
  }

  // -------------------------------------------------------------------------
  // Client registrations
  // -------------------------------------------------------------------------

  private mapClient(row: Row): ExperienceClientRegistrationRecord {
    return {
      id: str(row.id),
      assignmentId: str(row.assignment_id),
      tenantId: str(row.tenant_id),
      applicationBindingId: strOrNull(row.application_binding_id),
      clientId: str(row.client_id),
      clientKind: str(row.client_kind),
      keycloakTopologyId: strOrNull(row.keycloak_topology_id),
      keycloakClientRef: strOrNull(row.keycloak_client_ref),
      redirectUris: asJson(row.redirect_uris, []).map(String),
      postLogoutRedirectUris: asJson(row.post_logout_redirect_uris, []).map(String),
      webOrigins: asJson(row.web_origins, []).map(String),
      audiences: asJson(row.audiences, []).map(String),
      scopes: asJson(row.scopes, []).map(String),
      credentialRef: strOrNull(row.credential_ref),
      registrationStatus: str(row.registration_status),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  async createClientRegistration(
    input: Omit<
      ExperienceClientRegistrationRecord,
      'id' | 'createdAt' | 'updatedAt' | 'version'
    > & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<ExperienceClientRegistrationRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_experience_client_registrations (
           id, assignment_id, tenant_id, application_binding_id, client_id, client_kind,
           keycloak_topology_id, keycloak_client_ref, redirect_uris, post_logout_redirect_uris,
           web_origins, audiences, scopes, credential_ref, registration_status,
           metadata, created_by, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
           $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14, $15,
           $16::jsonb, $17, COALESCE($18, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.assignmentId,
          input.tenantId,
          input.applicationBindingId,
          input.clientId,
          input.clientKind,
          input.keycloakTopologyId,
          input.keycloakClientRef,
          JSON.stringify(input.redirectUris ?? []),
          JSON.stringify(input.postLogoutRedirectUris ?? []),
          JSON.stringify(input.webOrigins ?? []),
          JSON.stringify(input.audiences ?? []),
          JSON.stringify(input.scopes ?? []),
          input.credentialRef,
          input.registrationStatus,
          JSON.stringify(input.metadata ?? {}),
          input.createdBy,
          input.version ?? 1,
        ],
        client,
      );
      return this.mapClient(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Experience client registration already exists for tenant/client');
    }
  }

  async getClientRegistration(id: string): Promise<ExperienceClientRegistrationRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_experience_client_registrations WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapClient(rows[0]) : null;
  }

  async listClientRegistrations(
    assignmentId: string,
  ): Promise<ExperienceClientRegistrationRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_experience_client_registrations
       WHERE assignment_id = $1 ORDER BY created_at ASC`,
      [assignmentId],
    );
    return rows.map((r) => this.mapClient(r));
  }

  async updateClientRegistration(
    id: string,
    patch: Partial<ExperienceClientRegistrationRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<ExperienceClientRegistrationRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_experience_client_registrations SET
         application_binding_id = COALESCE($3, application_binding_id),
         client_kind = COALESCE($4, client_kind),
         keycloak_topology_id = COALESCE($5, keycloak_topology_id),
         keycloak_client_ref = COALESCE($6, keycloak_client_ref),
         redirect_uris = COALESCE($7::jsonb, redirect_uris),
         post_logout_redirect_uris = COALESCE($8::jsonb, post_logout_redirect_uris),
         web_origins = COALESCE($9::jsonb, web_origins),
         audiences = COALESCE($10::jsonb, audiences),
         scopes = COALESCE($11::jsonb, scopes),
         credential_ref = COALESCE($12, credential_ref),
         registration_status = COALESCE($13, registration_status),
         metadata = COALESCE($14::jsonb, metadata),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.applicationBindingId === undefined ? null : patch.applicationBindingId,
        patch.clientKind ?? null,
        patch.keycloakTopologyId === undefined ? null : patch.keycloakTopologyId,
        patch.keycloakClientRef === undefined ? null : patch.keycloakClientRef,
        patch.redirectUris ? JSON.stringify(patch.redirectUris) : null,
        patch.postLogoutRedirectUris ? JSON.stringify(patch.postLogoutRedirectUris) : null,
        patch.webOrigins ? JSON.stringify(patch.webOrigins) : null,
        patch.audiences ? JSON.stringify(patch.audiences) : null,
        patch.scopes ? JSON.stringify(patch.scopes) : null,
        patch.credentialRef === undefined ? null : patch.credentialRef,
        patch.registrationStatus ?? null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapClient(rows[0]);
  }

  // -------------------------------------------------------------------------
  // Domain bindings
  // -------------------------------------------------------------------------

  private mapDomain(row: Row): ExperienceDomainBindingRecord {
    return {
      id: str(row.id),
      assignmentId: str(row.assignment_id),
      tenantId: str(row.tenant_id),
      hostname: str(row.hostname),
      domainKind: str(row.domain_kind),
      ownershipStatus: str(row.ownership_status),
      ownershipToken: strOrNull(row.ownership_token),
      dnsStatus: str(row.dns_status),
      tlsStatus: str(row.tls_status),
      certificateRef: strOrNull(row.certificate_ref),
      routeStatus: str(row.route_status),
      bindingStatus: str(row.binding_status),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  async createDomainBinding(
    input: Omit<ExperienceDomainBindingRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<ExperienceDomainBindingRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_experience_domain_bindings (
           id, assignment_id, tenant_id, hostname, domain_kind, ownership_status,
           ownership_token, dns_status, tls_status, certificate_ref, route_status,
           binding_status, metadata, created_by, updated_by, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, COALESCE($16, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.assignmentId,
          input.tenantId,
          input.hostname,
          input.domainKind,
          input.ownershipStatus,
          input.ownershipToken,
          input.dnsStatus,
          input.tlsStatus,
          input.certificateRef,
          input.routeStatus,
          input.bindingStatus,
          JSON.stringify(input.metadata ?? {}),
          input.createdBy,
          input.updatedBy,
          input.version ?? 1,
        ],
        client,
      );
      return this.mapDomain(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Experience domain hostname already bound', ExperienceErrorCode.HOSTNAME_CONFLICT);
    }
  }

  async getDomainBinding(id: string): Promise<ExperienceDomainBindingRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_experience_domain_bindings WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapDomain(rows[0]) : null;
  }

  async getDomainByHostname(hostname: string): Promise<ExperienceDomainBindingRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_experience_domain_bindings WHERE hostname = $1`,
      [hostname.toLowerCase()],
    );
    return rows[0] ? this.mapDomain(rows[0]) : null;
  }

  async listDomainBindings(assignmentId: string): Promise<ExperienceDomainBindingRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_experience_domain_bindings
       WHERE assignment_id = $1 ORDER BY created_at ASC`,
      [assignmentId],
    );
    return rows.map((r) => this.mapDomain(r));
  }

  async updateDomainBinding(
    id: string,
    patch: Partial<ExperienceDomainBindingRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<ExperienceDomainBindingRecord> {
    try {
      const rows = await this.q(
        `UPDATE edge_p7_experience_domain_bindings SET
           ownership_status = COALESCE($3, ownership_status),
           ownership_token = COALESCE($4, ownership_token),
           dns_status = COALESCE($5, dns_status),
           tls_status = COALESCE($6, tls_status),
           certificate_ref = COALESCE($7, certificate_ref),
           route_status = COALESCE($8, route_status),
           binding_status = COALESCE($9, binding_status),
           domain_kind = COALESCE($10, domain_kind),
           metadata = COALESCE($11::jsonb, metadata),
           version = version + 1,
           updated_by = $12,
           updated_at = NOW()
         WHERE id = $1 AND version = $2
         RETURNING *`,
        [
          id,
          expectedVersion,
          patch.ownershipStatus ?? null,
          patch.ownershipToken === undefined ? null : patch.ownershipToken,
          patch.dnsStatus ?? null,
          patch.tlsStatus ?? null,
          patch.certificateRef === undefined ? null : patch.certificateRef,
          patch.routeStatus ?? null,
          patch.bindingStatus ?? null,
          patch.domainKind ?? null,
          patch.metadata ? JSON.stringify(patch.metadata) : null,
          actorId,
        ],
        client,
      );
      if (!rows[0]) this.conflict();
      return this.mapDomain(rows[0]);
    } catch (err) {
      this.rethrow(err, 'Experience domain hostname already bound', ExperienceErrorCode.HOSTNAME_CONFLICT);
    }
  }

  // -------------------------------------------------------------------------
  // Certificates
  // -------------------------------------------------------------------------

  private mapCertificate(row: Row): ExperienceCertificateRecord {
    return {
      id: str(row.id),
      domainBindingId: str(row.domain_binding_id),
      tenantId: str(row.tenant_id),
      certificateRef: str(row.certificate_ref),
      issuer: strOrNull(row.issuer),
      notBefore: asDateOrNull(row.not_before),
      notAfter: asDateOrNull(row.not_after),
      fingerprintSha256: strOrNull(row.fingerprint_sha256),
      certificateStatus: str(row.certificate_status),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  async createCertificate(
    input: Omit<ExperienceCertificateRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<ExperienceCertificateRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_experience_certificates (
         id, domain_binding_id, tenant_id, certificate_ref, issuer,
         not_before, not_after, fingerprint_sha256, certificate_status, metadata
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5,
         $6, $7, $8, $9, $10::jsonb
       ) RETURNING *`,
      [
        input.id ?? null,
        input.domainBindingId,
        input.tenantId,
        input.certificateRef,
        input.issuer,
        input.notBefore,
        input.notAfter,
        input.fingerprintSha256,
        input.certificateStatus,
        JSON.stringify(input.metadata ?? {}),
      ],
      client,
    );
    return this.mapCertificate(rows[0]!);
  }

  async listCertificates(domainBindingId: string): Promise<ExperienceCertificateRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_experience_certificates
       WHERE domain_binding_id = $1 ORDER BY created_at DESC`,
      [domainBindingId],
    );
    return rows.map((r) => this.mapCertificate(r));
  }

  // -------------------------------------------------------------------------
  // Deployment runs / evidence / history
  // -------------------------------------------------------------------------

  private mapRun(row: Row): ExperienceDeploymentRunRecord {
    return {
      id: str(row.id),
      assignmentId: str(row.assignment_id),
      tenantId: str(row.tenant_id),
      productId: str(row.product_id),
      operation: str(row.operation),
      workflowId: strOrNull(row.workflow_id),
      outcome: str(row.outcome),
      errorCode: strOrNull(row.error_code),
      errorMessage: strOrNull(row.error_message),
      observedState: asJson(row.observed_state, {}),
      evidence: asJson(row.evidence, {}),
      startedAt: asDate(row.started_at),
      finishedAt: asDateOrNull(row.finished_at),
      performedBy: strOrNull(row.performed_by),
      correlationId: strOrNull(row.correlation_id),
      createdAt: asDate(row.created_at),
    };
  }

  private mapEvidence(row: Row): ExperienceEvidenceRecord {
    return {
      id: str(row.id),
      assignmentId: strOrNull(row.assignment_id),
      tenantId: strOrNull(row.tenant_id),
      workflowId: strOrNull(row.workflow_id),
      stepKey: strOrNull(row.step_key),
      operation: str(row.operation),
      outcome: str(row.outcome),
      evidence: asJson(row.evidence, {}),
      errorCode: strOrNull(row.error_code),
      errorMessage: strOrNull(row.error_message),
      durationMs: row.duration_ms == null ? null : num(row.duration_ms),
      performedBy: strOrNull(row.performed_by),
      createdAt: asDate(row.created_at),
    };
  }

  async createDeploymentRun(
    input: Omit<ExperienceDeploymentRunRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ExperienceDeploymentRunRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_experience_deployment_runs (
         id, assignment_id, tenant_id, product_id, operation, workflow_id,
         outcome, error_code, error_message, observed_state, evidence,
         started_at, finished_at, performed_by, correlation_id
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
         $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13, $14, $15
       ) RETURNING *`,
      [
        input.id ?? null,
        input.assignmentId,
        input.tenantId,
        input.productId,
        input.operation,
        input.workflowId,
        input.outcome,
        input.errorCode,
        input.errorMessage,
        JSON.stringify(input.observedState ?? {}),
        JSON.stringify(input.evidence ?? {}),
        input.startedAt,
        input.finishedAt,
        input.performedBy,
        input.correlationId,
      ],
      client,
    );
    return this.mapRun(rows[0]!);
  }

  async listDeploymentRuns(
    assignmentId: string,
    limit = 50,
  ): Promise<ExperienceDeploymentRunRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_experience_deployment_runs
       WHERE assignment_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [assignmentId, Math.min(Math.max(limit, 1), 200)],
    );
    return rows.map((r) => this.mapRun(r));
  }

  async createEvidence(
    input: Omit<ExperienceEvidenceRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ExperienceEvidenceRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_experience_evidence (
         id, assignment_id, tenant_id, workflow_id, step_key, operation, outcome,
         evidence, error_code, error_message, duration_ms, performed_by
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7,
         $8::jsonb, $9, $10, $11, $12
       ) RETURNING *`,
      [
        input.id ?? null,
        input.assignmentId,
        input.tenantId,
        input.workflowId,
        input.stepKey,
        input.operation,
        input.outcome,
        JSON.stringify(input.evidence ?? {}),
        input.errorCode,
        input.errorMessage,
        input.durationMs,
        input.performedBy,
      ],
      client,
    );
    return this.mapEvidence(rows[0]!);
  }

  async listEvidence(assignmentId: string, limit = 50): Promise<ExperienceEvidenceRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_experience_evidence
       WHERE assignment_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [assignmentId, Math.min(Math.max(limit, 1), 500)],
    );
    return rows.map((r) => this.mapEvidence(r));
  }

  async appendHistory(
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
  ): Promise<void> {
    await this.q(
      `INSERT INTO edge_p7_experience_history (
         resource_type, resource_id, tenant_id, from_status, to_status,
         action, reason, actor_id, details
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [
        input.resourceType,
        input.resourceId,
        input.tenantId ?? null,
        input.fromStatus ?? null,
        input.toStatus ?? null,
        input.action,
        input.reason ?? null,
        input.actorId,
        JSON.stringify(input.details ?? {}),
      ],
      client,
    );
  }
}

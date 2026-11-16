import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type { ConfigurationRepositoryPort } from '../../domain/configuration-entitlement/configuration-repository.port.js';
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
} from '../../domain/configuration-entitlement/configuration.types.js';
import {
  AssignmentStatus,
  ConfigurationBundleStatus,
  ConfigurationTemplateStatus,
  VersionRecordStatus,
} from '../../domain/configuration-entitlement/configuration.types.js';

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
 * P7.8 PostgreSQL repository — mirrors migration 103.
 * Optimistic concurrency (version column) + transactional client passthrough.
 */
@Injectable()
export class PgConfigurationEntitlementRepository implements ConfigurationRepositoryPort {
  constructor(private readonly cpDb: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.cpDb.getPool();
  }

  private async q<T extends Row = Row>(sql: string, params: unknown[] = [], client?: unknown) {
    const executor = client ? (client as PoolClient) : this.pool;
    return (await executor.query(sql, params)).rows as T[];
  }

  private conflict(): never {
    throw new DomainError(ErrorCode.CONFLICT, 'Optimistic lock conflict on configuration resource');
  }

  private notFound(label = 'Configuration resource'): never {
    throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, `${label} not found`);
  }

  private rethrow(err: unknown, message: string): never {
    const code = (err as { code?: string } | null)?.code;
    if (code === '23505') {
      throw new DomainError(ErrorCode.CONFLICT, message, [{ code: 'CONFIGURATION_COLLISION' }]);
    }
    if (code === '40001') this.conflict();
    throw err;
  }

  // -------------------------------------------------------------------------
  // Schemas
  // -------------------------------------------------------------------------

  private mapSchema(row: Row): ConfigurationSchemaRecord {
    return {
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      description: strOrNull(row.description),
      productId: strOrNull(row.product_id),
      schemaVersion: num(row.schema_version),
      jsonSchema: asJson(row.json_schema, {}),
      checksum: str(row.checksum),
      status: str(row.status),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  async createSchema(
    input: Omit<ConfigurationSchemaRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<ConfigurationSchemaRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_configuration_schemas (
           id, code, name, description, product_id, schema_version, json_schema,
           checksum, status, metadata, created_by
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7::jsonb,
           $8, $9, $10::jsonb, $11
         ) RETURNING *`,
        [
          input.id ?? null,
          input.code,
          input.name,
          input.description,
          input.productId,
          input.schemaVersion,
          JSON.stringify(input.jsonSchema ?? {}),
          input.checksum,
          input.status,
          JSON.stringify(input.metadata ?? {}),
          input.createdBy,
        ],
        client,
      );
      return this.mapSchema(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Configuration schema code/version already exists');
    }
  }

  async getSchema(id: string): Promise<ConfigurationSchemaRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_configuration_schemas WHERE id = $1`, [id]);
    return rows[0] ? this.mapSchema(rows[0]) : null;
  }

  async getSchemaByCode(code: string, schemaVersion?: number): Promise<ConfigurationSchemaRecord | null> {
    if (schemaVersion != null) {
      const rows = await this.q(
        `SELECT * FROM edge_p7_configuration_schemas WHERE code = $1 AND schema_version = $2`,
        [code, schemaVersion],
      );
      return rows[0] ? this.mapSchema(rows[0]) : null;
    }
    const rows = await this.q(
      `SELECT * FROM edge_p7_configuration_schemas
       WHERE code = $1 ORDER BY schema_version DESC LIMIT 1`,
      [code],
    );
    return rows[0] ? this.mapSchema(rows[0]) : null;
  }

  async listSchemas(filter: {
    limit?: number;
    offset?: number;
    status?: string;
    q?: string;
  }): Promise<{ items: ConfigurationSchemaRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter.q) {
      params.push(`%${filter.q}%`);
      where.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p7_configuration_schemas ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_configuration_schemas ${clause}
       ORDER BY code, schema_version DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapSchema(r)), total: num(countRows[0]?.c) };
  }

  // -------------------------------------------------------------------------
  // Templates
  // -------------------------------------------------------------------------

  private mapTemplate(row: Row): ConfigurationTemplateRecord {
    return {
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      description: strOrNull(row.description),
      productId: strOrNull(row.product_id),
      schemaId: str(row.schema_id),
      runtimeProfileCode: strOrNull(row.runtime_profile_code),
      deploymentProfileCode: strOrNull(row.deployment_profile_code),
      templateStatus: str(row.template_status),
      latestVersion: num(row.latest_version),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapTemplateVersion(row: Row): ConfigurationTemplateVersionRecord {
    return {
      id: str(row.id),
      templateId: str(row.template_id),
      versionNumber: num(row.version_number),
      payload: asJson(row.payload, {}),
      checksum: str(row.checksum),
      status: str(row.status),
      publishedAt: asDateOrNull(row.published_at),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
    };
  }

  async createTemplate(
    input: Omit<
      ConfigurationTemplateRecord,
      'id' | 'createdAt' | 'updatedAt' | 'version' | 'latestVersion'
    > & {
      id?: string;
      version?: number;
      latestVersion?: number;
      draftPayload: Record<string, unknown>;
      checksum: string;
    },
    client?: unknown,
  ): Promise<{ template: ConfigurationTemplateRecord; version: ConfigurationTemplateVersionRecord }> {
    try {
      const templateRows = await this.q(
        `INSERT INTO edge_p7_configuration_templates (
           id, code, name, description, product_id, schema_id,
           runtime_profile_code, deployment_profile_code, template_status,
           latest_version, metadata, created_by, updated_by, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
           $7, $8, $9, 1, $10::jsonb, $11, $11, COALESCE($12, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.code,
          input.name,
          input.description,
          input.productId,
          input.schemaId,
          input.runtimeProfileCode,
          input.deploymentProfileCode,
          input.templateStatus ?? ConfigurationTemplateStatus.DRAFT,
          JSON.stringify(input.metadata ?? {}),
          input.createdBy,
          input.version ?? 1,
        ],
        client,
      );
      const template = this.mapTemplate(templateRows[0]!);
      const versionRows = await this.q(
        `INSERT INTO edge_p7_configuration_template_versions (
           template_id, version_number, payload, checksum, status, created_by
         ) VALUES ($1, 1, $2::jsonb, $3, $4, $5) RETURNING *`,
        [
          template.id,
          JSON.stringify(input.draftPayload ?? {}),
          input.checksum,
          VersionRecordStatus.DRAFT,
          input.createdBy,
        ],
        client,
      );
      return { template, version: this.mapTemplateVersion(versionRows[0]!) };
    } catch (err) {
      this.rethrow(err, 'Configuration template code already exists');
    }
  }

  async getTemplate(id: string): Promise<ConfigurationTemplateRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_configuration_templates WHERE id = $1`, [id]);
    return rows[0] ? this.mapTemplate(rows[0]) : null;
  }

  async getTemplateByCode(code: string): Promise<ConfigurationTemplateRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_configuration_templates WHERE code = $1`, [code]);
    return rows[0] ? this.mapTemplate(rows[0]) : null;
  }

  async listTemplates(filter: {
    limit?: number;
    offset?: number;
    status?: string;
    q?: string;
  }): Promise<{ items: ConfigurationTemplateRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`template_status = $${params.length}`);
    }
    if (filter.q) {
      params.push(`%${filter.q}%`);
      where.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p7_configuration_templates ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_configuration_templates ${clause}
       ORDER BY code LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapTemplate(r)), total: num(countRows[0]?.c) };
  }

  async getTemplateVersion(
    templateId: string,
    versionNumber: number,
  ): Promise<ConfigurationTemplateVersionRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_configuration_template_versions
       WHERE template_id = $1 AND version_number = $2`,
      [templateId, versionNumber],
    );
    return rows[0] ? this.mapTemplateVersion(rows[0]) : null;
  }

  async publishTemplateVersion(
    templateId: string,
    versionNumber: number,
    expectedTemplateVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<ConfigurationTemplateRecord> {
    const verRows = await this.q(
      `UPDATE edge_p7_configuration_template_versions SET
         status = $3, published_at = NOW()
       WHERE template_id = $1 AND version_number = $2 AND status IN ('DRAFT','VALIDATED')
       RETURNING *`,
      [templateId, versionNumber, VersionRecordStatus.PUBLISHED],
      client,
    );
    if (!verRows[0]) this.notFound('Template version');

    await this.q(
      `UPDATE edge_p7_configuration_template_versions SET status = $3
       WHERE template_id = $1 AND version_number <> $2 AND status = $4`,
      [templateId, versionNumber, VersionRecordStatus.SUPERSEDED, VersionRecordStatus.PUBLISHED],
      client,
    );

    const rows = await this.q(
      `UPDATE edge_p7_configuration_templates SET
         template_status = $3,
         latest_version = GREATEST(latest_version, $4),
         version = version + 1,
         updated_by = $5,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        templateId,
        expectedTemplateVersion,
        ConfigurationTemplateStatus.PUBLISHED,
        versionNumber,
        actorId,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapTemplate(rows[0]);
  }

  // -------------------------------------------------------------------------
  // Bundles
  // -------------------------------------------------------------------------

  private mapBundle(row: Row): ConfigurationBundleRecord {
    return {
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      description: strOrNull(row.description),
      productId: strOrNull(row.product_id),
      bundleStatus: str(row.bundle_status),
      latestVersion: num(row.latest_version),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapBundleVersion(row: Row): ConfigurationBundleVersionRecord {
    return {
      id: str(row.id),
      bundleId: str(row.bundle_id),
      versionNumber: num(row.version_number),
      templateRefs: asJson(row.template_refs, []),
      dependencyRefs: asJson(row.dependency_refs, []).map(String),
      payload: asJson(row.payload, {}),
      checksum: str(row.checksum),
      status: str(row.status),
      rolloutPolicy: asJson(row.rollout_policy, { strategy: 'ATOMIC' }),
      publishedAt: asDateOrNull(row.published_at),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
    };
  }

  async createBundle(
    input: Omit<
      ConfigurationBundleRecord,
      'id' | 'createdAt' | 'updatedAt' | 'version' | 'latestVersion'
    > & {
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
  ): Promise<{ bundle: ConfigurationBundleRecord; version: ConfigurationBundleVersionRecord }> {
    try {
      const bundleRows = await this.q(
        `INSERT INTO edge_p7_configuration_bundles (
           id, code, name, description, product_id, bundle_status,
           latest_version, metadata, created_by, updated_by, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
           1, $7::jsonb, $8, $8, COALESCE($9, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.code,
          input.name,
          input.description,
          input.productId,
          input.bundleStatus ?? ConfigurationBundleStatus.DRAFT,
          JSON.stringify(input.metadata ?? {}),
          input.createdBy,
          input.version ?? 1,
        ],
        client,
      );
      const bundle = this.mapBundle(bundleRows[0]!);
      const versionRows = await this.q(
        `INSERT INTO edge_p7_configuration_bundle_versions (
           bundle_id, version_number, template_refs, dependency_refs, payload,
           checksum, status, rollout_policy, created_by
         ) VALUES ($1, 1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6, $7::jsonb, $8)
         RETURNING *`,
        [
          bundle.id,
          JSON.stringify(input.draft.templateRefs ?? []),
          JSON.stringify(input.draft.dependencyRefs ?? []),
          JSON.stringify(input.draft.payload ?? {}),
          input.draft.checksum,
          VersionRecordStatus.DRAFT,
          JSON.stringify(input.draft.rolloutPolicy ?? { strategy: 'ATOMIC' }),
          input.createdBy,
        ],
        client,
      );
      return { bundle, version: this.mapBundleVersion(versionRows[0]!) };
    } catch (err) {
      this.rethrow(err, 'Configuration bundle code already exists');
    }
  }

  async getBundle(id: string): Promise<ConfigurationBundleRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_configuration_bundles WHERE id = $1`, [id]);
    return rows[0] ? this.mapBundle(rows[0]) : null;
  }

  async getBundleByCode(code: string): Promise<ConfigurationBundleRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_configuration_bundles WHERE code = $1`, [code]);
    return rows[0] ? this.mapBundle(rows[0]) : null;
  }

  async listBundles(filter: {
    limit?: number;
    offset?: number;
    status?: string;
    q?: string;
  }): Promise<{ items: ConfigurationBundleRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`bundle_status = $${params.length}`);
    }
    if (filter.q) {
      params.push(`%${filter.q}%`);
      where.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p7_configuration_bundles ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_configuration_bundles ${clause}
       ORDER BY code LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapBundle(r)), total: num(countRows[0]?.c) };
  }

  async getBundleVersion(
    bundleId: string,
    versionNumber: number,
  ): Promise<ConfigurationBundleVersionRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_configuration_bundle_versions
       WHERE bundle_id = $1 AND version_number = $2`,
      [bundleId, versionNumber],
    );
    return rows[0] ? this.mapBundleVersion(rows[0]) : null;
  }

  async publishBundleVersion(
    bundleId: string,
    versionNumber: number,
    expectedBundleVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<ConfigurationBundleRecord> {
    const verRows = await this.q(
      `UPDATE edge_p7_configuration_bundle_versions SET
         status = $3, published_at = NOW()
       WHERE bundle_id = $1 AND version_number = $2 AND status IN ('DRAFT','VALIDATED')
       RETURNING *`,
      [bundleId, versionNumber, VersionRecordStatus.PUBLISHED],
      client,
    );
    if (!verRows[0]) this.notFound('Bundle version');

    await this.q(
      `UPDATE edge_p7_configuration_bundle_versions SET status = $3
       WHERE bundle_id = $1 AND version_number <> $2 AND status = $4`,
      [bundleId, versionNumber, VersionRecordStatus.SUPERSEDED, VersionRecordStatus.PUBLISHED],
      client,
    );

    const rows = await this.q(
      `UPDATE edge_p7_configuration_bundles SET
         bundle_status = $3,
         latest_version = GREATEST(latest_version, $4),
         version = version + 1,
         updated_by = $5,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        bundleId,
        expectedBundleVersion,
        ConfigurationBundleStatus.PUBLISHED,
        versionNumber,
        actorId,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapBundle(rows[0]);
  }

  // -------------------------------------------------------------------------
  // Assignments
  // -------------------------------------------------------------------------

  private mapAssignment(row: Row): TenantConfigurationAssignmentRecord {
    return {
      id: str(row.id),
      tenantId: str(row.tenant_id),
      productId: str(row.product_id),
      subscriptionId: strOrNull(row.subscription_id),
      accountId: strOrNull(row.account_id),
      bundleId: str(row.bundle_id),
      bundleVersion: num(row.bundle_version),
      bundleChecksum: str(row.bundle_checksum),
      assignmentStatus: str(row.assignment_status),
      desiredConfig: asJson(row.desired_config, {}),
      appliedConfig: asJson(row.applied_config, {}),
      appliedChecksum: strOrNull(row.applied_checksum),
      entitlementSnapshotRef: strOrNull(row.entitlement_snapshot_ref),
      entitlementVersion: strOrNull(row.entitlement_version),
      authorizationRowId: strOrNull(row.authorization_row_id),
      authorizationVersion: row.authorization_version == null ? null : num(row.authorization_version),
      provisioningRequestId: strOrNull(row.provisioning_request_id),
      workflowId: strOrNull(row.workflow_id),
      deploymentStrategy: str(row.deployment_strategy),
      driftStatus: str(row.drift_status),
      lastDeployedAt: asDateOrNull(row.last_deployed_at),
      lastReconciledAt: asDateOrNull(row.last_reconciled_at),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  async createAssignment(
    input: Omit<TenantConfigurationAssignmentRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<TenantConfigurationAssignmentRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_tenant_configuration_assignments (
           id, tenant_id, product_id, subscription_id, account_id, bundle_id,
           bundle_version, bundle_checksum, assignment_status, desired_config,
           applied_config, applied_checksum, entitlement_snapshot_ref, entitlement_version,
           authorization_row_id, authorization_version, provisioning_request_id, workflow_id,
           deployment_strategy, drift_status, last_deployed_at, last_reconciled_at,
           metadata, created_by, updated_by, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
           $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13, $14,
           $15, $16, $17, $18, $19, $20, $21, $22,
           $23::jsonb, $24, $25, COALESCE($26, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.tenantId,
          input.productId,
          input.subscriptionId,
          input.accountId,
          input.bundleId,
          input.bundleVersion,
          input.bundleChecksum,
          input.assignmentStatus ?? AssignmentStatus.ASSIGNED,
          JSON.stringify(input.desiredConfig ?? {}),
          JSON.stringify(input.appliedConfig ?? {}),
          input.appliedChecksum,
          input.entitlementSnapshotRef,
          input.entitlementVersion,
          input.authorizationRowId,
          input.authorizationVersion,
          input.provisioningRequestId,
          input.workflowId,
          input.deploymentStrategy,
          input.driftStatus,
          input.lastDeployedAt,
          input.lastReconciledAt,
          JSON.stringify(input.metadata ?? {}),
          input.createdBy,
          input.updatedBy,
          input.version ?? 1,
        ],
        client,
      );
      return this.mapAssignment(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Active tenant configuration assignment already exists');
    }
  }

  async getAssignment(id: string): Promise<TenantConfigurationAssignmentRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_tenant_configuration_assignments WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapAssignment(rows[0]) : null;
  }

  async getActiveAssignment(
    tenantId: string,
    productId: string,
  ): Promise<TenantConfigurationAssignmentRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_tenant_configuration_assignments
       WHERE tenant_id = $1 AND product_id = $2
         AND assignment_status IN ('ASSIGNED','DEPLOYING','DEPLOYED','ROLLBACK_PENDING')
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
  }): Promise<{ items: TenantConfigurationAssignmentRecord[]; total: number }> {
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
      `SELECT COUNT(*)::int AS c FROM edge_p7_tenant_configuration_assignments ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_tenant_configuration_assignments ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapAssignment(r)), total: num(countRows[0]?.c) };
  }

  async updateAssignment(
    id: string,
    patch: Partial<TenantConfigurationAssignmentRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<TenantConfigurationAssignmentRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_tenant_configuration_assignments SET
         assignment_status = COALESCE($3, assignment_status),
         desired_config = COALESCE($4::jsonb, desired_config),
         applied_config = COALESCE($5::jsonb, applied_config),
         applied_checksum = COALESCE($6, applied_checksum),
         entitlement_snapshot_ref = COALESCE($7, entitlement_snapshot_ref),
         entitlement_version = COALESCE($8, entitlement_version),
         authorization_row_id = COALESCE($9, authorization_row_id),
         authorization_version = COALESCE($10, authorization_version),
         provisioning_request_id = COALESCE($11, provisioning_request_id),
         workflow_id = COALESCE($12, workflow_id),
         deployment_strategy = COALESCE($13, deployment_strategy),
         drift_status = COALESCE($14, drift_status),
         last_deployed_at = COALESCE($15, last_deployed_at),
         last_reconciled_at = COALESCE($16, last_reconciled_at),
         metadata = COALESCE($17::jsonb, metadata),
         bundle_id = COALESCE($18, bundle_id),
         bundle_version = COALESCE($19, bundle_version),
         bundle_checksum = COALESCE($20, bundle_checksum),
         version = version + 1,
         updated_by = $21,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.assignmentStatus ?? null,
        patch.desiredConfig ? JSON.stringify(patch.desiredConfig) : null,
        patch.appliedConfig ? JSON.stringify(patch.appliedConfig) : null,
        patch.appliedChecksum === undefined ? null : patch.appliedChecksum,
        patch.entitlementSnapshotRef === undefined ? null : patch.entitlementSnapshotRef,
        patch.entitlementVersion === undefined ? null : patch.entitlementVersion,
        patch.authorizationRowId === undefined ? null : patch.authorizationRowId,
        patch.authorizationVersion === undefined ? null : patch.authorizationVersion,
        patch.provisioningRequestId === undefined ? null : patch.provisioningRequestId,
        patch.workflowId === undefined ? null : patch.workflowId,
        patch.deploymentStrategy ?? null,
        patch.driftStatus ?? null,
        patch.lastDeployedAt === undefined ? null : patch.lastDeployedAt,
        patch.lastReconciledAt === undefined ? null : patch.lastReconciledAt,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        patch.bundleId ?? null,
        patch.bundleVersion ?? null,
        patch.bundleChecksum ?? null,
        actorId,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapAssignment(rows[0]);
  }

  // -------------------------------------------------------------------------
  // Entitlement deployments
  // -------------------------------------------------------------------------

  private mapEntitlement(row: Row): EntitlementDeploymentRecord {
    return {
      id: str(row.id),
      assignmentId: str(row.assignment_id),
      tenantId: str(row.tenant_id),
      productId: str(row.product_id),
      subscriptionId: strOrNull(row.subscription_id),
      entitlementSnapshotRef: str(row.entitlement_snapshot_ref),
      entitlementVersion: str(row.entitlement_version),
      payloadDigest: str(row.payload_digest),
      capabilities: asJson(row.capabilities, {}),
      featureFlags: asJson(row.feature_flags, {}),
      quotas: asJson(row.quotas, {}),
      limits: asJson(row.limits, {}),
      deploymentStatus: str(row.deployment_status),
      source: str(row.source),
      workflowId: strOrNull(row.workflow_id),
      evidence: asJson(row.evidence, {}),
      deployedAt: asDateOrNull(row.deployed_at),
      revokedAt: asDateOrNull(row.revoked_at),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  async createEntitlementDeployment(
    input: Omit<EntitlementDeploymentRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<EntitlementDeploymentRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_entitlement_deployments (
           id, assignment_id, tenant_id, product_id, subscription_id,
           entitlement_snapshot_ref, entitlement_version, payload_digest,
           capabilities, feature_flags, quotas, limits, deployment_status,
           source, workflow_id, evidence, deployed_at, revoked_at, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5,
           $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13,
           $14, $15, $16::jsonb, $17, $18, COALESCE($19, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.assignmentId,
          input.tenantId,
          input.productId,
          input.subscriptionId,
          input.entitlementSnapshotRef,
          input.entitlementVersion,
          input.payloadDigest,
          JSON.stringify(input.capabilities ?? {}),
          JSON.stringify(input.featureFlags ?? {}),
          JSON.stringify(input.quotas ?? {}),
          JSON.stringify(input.limits ?? {}),
          input.deploymentStatus,
          input.source,
          input.workflowId,
          JSON.stringify(input.evidence ?? {}),
          input.deployedAt,
          input.revokedAt,
          input.version ?? 1,
        ],
        client,
      );
      return this.mapEntitlement(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Entitlement deployment digest collision');
    }
  }

  async getEntitlementByDigest(
    tenantId: string,
    productId: string,
    payloadDigest: string,
  ): Promise<EntitlementDeploymentRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_entitlement_deployments
       WHERE tenant_id = $1 AND product_id = $2 AND payload_digest = $3
         AND deployment_status IN ('PENDING','VALIDATING','DEPLOYING','DEPLOYED')
       ORDER BY created_at DESC LIMIT 1`,
      [tenantId, productId, payloadDigest],
    );
    return rows[0] ? this.mapEntitlement(rows[0]) : null;
  }

  async listEntitlementDeployments(
    assignmentId: string,
    limit = 50,
  ): Promise<EntitlementDeploymentRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_entitlement_deployments
       WHERE assignment_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [assignmentId, Math.min(Math.max(limit, 1), 200)],
    );
    return rows.map((r) => this.mapEntitlement(r));
  }

  async updateEntitlementDeployment(
    id: string,
    patch: Partial<EntitlementDeploymentRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<EntitlementDeploymentRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_entitlement_deployments SET
         deployment_status = COALESCE($3, deployment_status),
         capabilities = COALESCE($4::jsonb, capabilities),
         feature_flags = COALESCE($5::jsonb, feature_flags),
         quotas = COALESCE($6::jsonb, quotas),
         limits = COALESCE($7::jsonb, limits),
         workflow_id = COALESCE($8, workflow_id),
         evidence = COALESCE($9::jsonb, evidence),
         deployed_at = COALESCE($10, deployed_at),
         revoked_at = COALESCE($11, revoked_at),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.deploymentStatus ?? null,
        patch.capabilities ? JSON.stringify(patch.capabilities) : null,
        patch.featureFlags ? JSON.stringify(patch.featureFlags) : null,
        patch.quotas ? JSON.stringify(patch.quotas) : null,
        patch.limits ? JSON.stringify(patch.limits) : null,
        patch.workflowId === undefined ? null : patch.workflowId,
        patch.evidence ? JSON.stringify(patch.evidence) : null,
        patch.deployedAt === undefined ? null : patch.deployedAt,
        patch.revokedAt === undefined ? null : patch.revokedAt,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapEntitlement(rows[0]);
  }

  // -------------------------------------------------------------------------
  // Deployment runs / evidence / history
  // -------------------------------------------------------------------------

  private mapRun(row: Row): ConfigurationDeploymentRunRecord {
    return {
      id: str(row.id),
      assignmentId: str(row.assignment_id),
      tenantId: str(row.tenant_id),
      productId: str(row.product_id),
      operation: str(row.operation),
      strategy: str(row.strategy),
      workflowId: strOrNull(row.workflow_id),
      fromBundleVersion: row.from_bundle_version == null ? null : num(row.from_bundle_version),
      toBundleVersion: row.to_bundle_version == null ? null : num(row.to_bundle_version),
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

  private mapEvidence(row: Row): ConfigurationEvidenceRecord {
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
    input: Omit<ConfigurationDeploymentRunRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ConfigurationDeploymentRunRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_configuration_deployment_runs (
         id, assignment_id, tenant_id, product_id, operation, strategy, workflow_id,
         from_bundle_version, to_bundle_version, outcome, error_code, error_message,
         observed_state, evidence, started_at, finished_at, performed_by, correlation_id
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15, $16, $17, $18
       ) RETURNING *`,
      [
        input.id ?? null,
        input.assignmentId,
        input.tenantId,
        input.productId,
        input.operation,
        input.strategy,
        input.workflowId,
        input.fromBundleVersion,
        input.toBundleVersion,
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
  ): Promise<ConfigurationDeploymentRunRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_configuration_deployment_runs
       WHERE assignment_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [assignmentId, Math.min(Math.max(limit, 1), 200)],
    );
    return rows.map((r) => this.mapRun(r));
  }

  async createEvidence(
    input: Omit<ConfigurationEvidenceRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ConfigurationEvidenceRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_configuration_evidence (
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

  async listEvidence(assignmentId: string, limit = 50): Promise<ConfigurationEvidenceRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_configuration_evidence
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
      `INSERT INTO edge_p7_configuration_history (
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

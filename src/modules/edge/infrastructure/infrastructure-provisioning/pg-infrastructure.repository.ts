import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  CreateDatabaseRow,
  CreateInfraResourceRow,
  CreatePlanRow,
  InfrastructureRepositoryPort,
} from '../../domain/infrastructure-provisioning/infrastructure-repository.port.js';
import {
  DatabaseEngine,
  DatabaseTopology,
  DriftStatus,
  InfrastructureProviderKind,
  ProviderOperationalStatus,
  ResourcePlanStatus,
  ResourceStatus,
  ResourceType,
  BackupStatus,
  type DatabaseResourceRecord,
  type InfrastructureProviderRecord,
  type InfrastructureResourceRecord,
  type ResourceBackupRecord,
  type ResourceHistoryRecord,
  type ResourcePlanRecord,
} from '../../domain/infrastructure-provisioning/infrastructure.types.js';

type Row = Record<string, unknown>;

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
function asDate(v: unknown): Date {
  if (v instanceof Date) return v;
  return new Date(String(v));
}
function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function str(v: unknown): string {
  return String(v);
}
function optStr(v: unknown): string | null {
  return v == null ? null : String(v);
}

@Injectable()
export class PgInfrastructureRepository implements InfrastructureRepositoryPort {
  constructor(private readonly cpDb: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.cpDb.getPool();
  }

  private async q<T extends Row = Row>(sql: string, params: unknown[] = [], client?: unknown) {
    const executor = client ? (client as PoolClient) : this.pool;
    const res = await executor.query(sql, params);
    return res.rows as T[];
  }

  private mapProvider(r: Row): InfrastructureProviderRecord {
    return {
      id: str(r.id),
      code: str(r.code),
      name: str(r.name),
      providerVersion: str(r.provider_version),
      providerKind: str(r.provider_kind) as InfrastructureProviderKind,
      operationalStatus: str(r.operational_status) as ProviderOperationalStatus,
      capabilities: asJson(r.capabilities, {
        encryption: false,
        backup: false,
        restore: false,
        highAvailability: false,
        privateNetworking: false,
        tlsRequired: true,
        operations: [],
      }),
      supportedRegions: asJson(r.supported_regions, []),
      supportedResourceTypes: asJson(r.supported_resource_types, []),
      supportedDatabaseEngines: asJson(r.supported_database_engines, []),
      metadata: asJson(r.metadata, {}),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  }

  private mapPlan(r: Row): ResourcePlanRecord {
    return {
      id: str(r.id),
      tenantId: str(r.tenant_id),
      productId: str(r.product_id),
      subscriptionId: optStr(r.subscription_id),
      authorizationId: optStr(r.authorization_id),
      authorizationVersion: r.authorization_version == null ? null : num(r.authorization_version),
      placementDecisionId: optStr(r.placement_decision_id),
      reservationId: optStr(r.reservation_id),
      providerId: str(r.provider_id),
      region: str(r.region),
      availabilityZone: optStr(r.availability_zone),
      deploymentProfileId: optStr(r.deployment_profile_id),
      deploymentProfileVersion:
        r.deployment_profile_version == null ? null : num(r.deployment_profile_version),
      runtimeProfileId: optStr(r.runtime_profile_id),
      databaseEngine: str(r.database_engine) as DatabaseEngine,
      databaseTopology: str(r.database_topology) as DatabaseTopology,
      computeRequirements: asJson(r.compute_requirements, {}),
      storageRequirements: asJson(r.storage_requirements, {}),
      networkRequirements: asJson(r.network_requirements, {}),
      backupPolicy: asJson(r.backup_policy, {}),
      encryptionPolicy: asJson(r.encryption_policy, {}),
      retentionPolicy: asJson(r.retention_policy, {}),
      estimatedCapacity: asJson(r.estimated_capacity, {}),
      resourceDependencies: asJson(r.resource_dependencies, []),
      securityClassification: str(r.security_classification),
      planFingerprint: str(r.plan_fingerprint),
      status: str(r.status) as ResourcePlanStatus,
      currentVersion: num(r.current_version),
      workflowId: optStr(r.workflow_id),
      validationErrors: asJson(r.validation_errors, []),
      metadata: asJson(r.metadata, {}),
      version: num(r.version),
      createdBy: optStr(r.created_by),
      updatedBy: optStr(r.updated_by),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  }

  private mapInfra(r: Row): InfrastructureResourceRecord {
    return {
      id: str(r.id),
      planId: str(r.plan_id),
      tenantId: str(r.tenant_id),
      productId: str(r.product_id),
      subscriptionId: optStr(r.subscription_id),
      providerId: str(r.provider_id),
      resourceType: str(r.resource_type) as ResourceType,
      providerResourceId: optStr(r.provider_resource_id),
      environment: str(r.environment),
      region: str(r.region),
      status: str(r.status) as ResourceStatus,
      configuration: asJson(r.configuration, {}),
      configurationFingerprint: optStr(r.configuration_fingerprint),
      ownership: asJson(r.ownership, {}),
      deletionProtection: Boolean(r.deletion_protection),
      healthStatus: str(r.health_status),
      driftStatus: str(r.drift_status) as DriftStatus,
      workflowId: optStr(r.workflow_id),
      lastReconciledAt: r.last_reconciled_at == null ? null : asDate(r.last_reconciled_at),
      evidence: asJson(r.evidence, {}),
      metadata: asJson(r.metadata, {}),
      version: num(r.version),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  }

  private mapDb(r: Row): DatabaseResourceRecord {
    return {
      id: str(r.id),
      resourceId: str(r.resource_id),
      planId: str(r.plan_id),
      tenantId: str(r.tenant_id),
      productId: str(r.product_id),
      subscriptionId: optStr(r.subscription_id),
      databaseEngine: str(r.database_engine) as DatabaseEngine,
      engineVersion: optStr(r.engine_version),
      providerId: str(r.provider_id),
      clusterId: optStr(r.cluster_id),
      databaseName: str(r.database_name),
      endpointRef: optStr(r.endpoint_ref),
      credentialRef: optStr(r.credential_ref),
      networkPolicy: asJson(r.network_policy, {}),
      encryptionPolicy: asJson(r.encryption_policy, {}),
      backupPolicy: asJson(r.backup_policy, {}),
      restorePolicy: asJson(r.restore_policy, {}),
      isolationVerified: Boolean(r.isolation_verified),
      connectivityVerified: Boolean(r.connectivity_verified),
      leastPrivilegeVerified: Boolean(r.least_privilege_verified),
      tlsRequired: Boolean(r.tls_required),
      publicEndpoint: Boolean(r.public_endpoint),
      status: str(r.status) as ResourceStatus,
      configurationFingerprint: optStr(r.configuration_fingerprint),
      workflowId: optStr(r.workflow_id),
      evidence: asJson(r.evidence, {}),
      metadata: asJson(r.metadata, {}),
      version: num(r.version),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  }

  private mapBackup(r: Row): ResourceBackupRecord {
    return {
      id: str(r.id),
      resourceId: str(r.resource_id),
      databaseResourceId: optStr(r.database_resource_id),
      providerBackupId: optStr(r.provider_backup_id),
      backupType: str(r.backup_type),
      status: str(r.status) as BackupStatus,
      integrityVerified: Boolean(r.integrity_verified),
      restorableVerified: Boolean(r.restorable_verified),
      encrypted: Boolean(r.encrypted),
      sizeBytes: r.size_bytes == null ? null : num(r.size_bytes),
      startedAt: asDate(r.started_at),
      completedAt: r.completed_at == null ? null : asDate(r.completed_at),
      expiresAt: r.expires_at == null ? null : asDate(r.expires_at),
      evidence: asJson(r.evidence, {}),
      metadata: asJson(r.metadata, {}),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  }

  async listProviders(client?: unknown): Promise<InfrastructureProviderRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_infrastructure_providers ORDER BY code`,
      [],
      client,
    );
    return rows.map((r) => this.mapProvider(r));
  }

  async getProviderById(id: string, client?: unknown) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_infrastructure_providers WHERE id = $1`,
      [id],
      client,
    );
    return rows[0] ? this.mapProvider(rows[0]) : null;
  }

  async getProviderByCode(code: string, client?: unknown) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_infrastructure_providers WHERE code = $1`,
      [code],
      client,
    );
    return rows[0] ? this.mapProvider(rows[0]) : null;
  }

  async createPlan(row: CreatePlanRow, actorId: string, client?: unknown) {
    const rows = await this.q(
      `INSERT INTO edge_p7_resource_plans (
        tenant_id, product_id, subscription_id, authorization_id, authorization_version,
        placement_decision_id, reservation_id, provider_id, region, availability_zone,
        deployment_profile_id, deployment_profile_version, runtime_profile_id,
        database_engine, database_topology, compute_requirements, storage_requirements,
        network_requirements, backup_policy, encryption_policy, retention_policy,
        estimated_capacity, resource_dependencies, security_classification, plan_fingerprint,
        status, created_by, updated_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,$18::jsonb,
        $19::jsonb,$20::jsonb,$21::jsonb,$22::jsonb,$23::jsonb,$24,$25,$26,$27,$27
      ) RETURNING *`,
      [
        row.tenantId,
        row.productId,
        row.subscriptionId ?? null,
        row.authorizationId ?? null,
        row.authorizationVersion ?? null,
        row.placementDecisionId ?? null,
        row.reservationId ?? null,
        row.providerId,
        row.region,
        row.availabilityZone ?? null,
        row.deploymentProfileId ?? null,
        row.deploymentProfileVersion ?? null,
        row.runtimeProfileId ?? null,
        row.databaseEngine,
        row.databaseTopology,
        JSON.stringify(row.computeRequirements ?? {}),
        JSON.stringify(row.storageRequirements ?? {}),
        JSON.stringify(row.networkRequirements ?? {}),
        JSON.stringify(row.backupPolicy ?? {}),
        JSON.stringify(row.encryptionPolicy ?? {}),
        JSON.stringify(row.retentionPolicy ?? {}),
        JSON.stringify(row.estimatedCapacity ?? {}),
        JSON.stringify(row.resourceDependencies ?? []),
        row.securityClassification,
        row.planFingerprint,
        row.status ?? ResourcePlanStatus.DRAFT,
        actorId,
      ],
      client,
    );
    return this.mapPlan(rows[0]);
  }

  async getPlan(id: string, client?: unknown) {
    const rows = await this.q(`SELECT * FROM edge_p7_resource_plans WHERE id = $1`, [id], client);
    return rows[0] ? this.mapPlan(rows[0]) : null;
  }

  async listPlans(filter: Parameters<InfrastructureRepositoryPort['listPlans']>[0], client?: unknown) {
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;
    const conds: string[] = [];
    const params: unknown[] = [];
    if (filter.tenantId) {
      params.push(filter.tenantId);
      conds.push(`tenant_id = $${params.length}`);
    }
    if (filter.productId) {
      params.push(filter.productId);
      conds.push(`product_id = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      conds.push(`status = $${params.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::text AS c FROM edge_p7_resource_plans ${where}`,
      params,
      client,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_resource_plans ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
      client,
    );
    return { items: rows.map((r) => this.mapPlan(r)), total: Number(countRows[0]?.c ?? 0) };
  }

  async updatePlanStatus(id: string, status: ResourcePlanStatus, patch: Partial<Pick<ResourcePlanRecord, 'validationErrors' | 'workflowId' | 'updatedBy'>>, expectedVersion: number, client?: unknown) {
    const rows = await this.q(
      `UPDATE edge_p7_resource_plans SET
        status = $2,
        validation_errors = COALESCE($3::jsonb, validation_errors),
        workflow_id = COALESCE($4, workflow_id),
        updated_by = COALESCE($5, updated_by),
        version = version + 1,
        updated_at = NOW()
       WHERE id = $1 AND version = $6
       RETURNING *`,
      [
        id,
        status,
        patch.validationErrors != null ? JSON.stringify(patch.validationErrors) : null,
        patch.workflowId ?? null,
        patch.updatedBy ?? null,
        expectedVersion,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.CONFLICT, 'Resource plan version conflict', [{ id }]);
    }
    return this.mapPlan(rows[0]);
  }

  async insertPlanVersion(planId: string, versionNumber: number, fingerprint: string, snapshot: Record<string, unknown>, validationStatus: 'PENDING' | 'VALID' | 'INVALID', actorId: string, client?: unknown) {
    await this.q(
      `INSERT INTO edge_p7_resource_plan_versions (
        plan_id, version_number, plan_fingerprint, snapshot, validation_status, validated_at, created_by
      ) VALUES (
        $1,$2,$3,$4::jsonb,$5::varchar,
        CASE WHEN $5::text = 'VALID' THEN NOW() ELSE NULL END,
        $6
      )`,
      [planId, versionNumber, fingerprint, JSON.stringify(snapshot), validationStatus, actorId],
      client,
    );
  }

  async createInfrastructureResource(row: CreateInfraResourceRow, client?: unknown) {
    const rows = await this.q(
      `INSERT INTO edge_p7_infrastructure_resources (
        plan_id, tenant_id, product_id, subscription_id, provider_id, resource_type,
        provider_resource_id, environment, region, status, configuration, configuration_fingerprint,
        ownership, deletion_protection, workflow_id, evidence, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13::jsonb,$14,$15,$16::jsonb,$17::jsonb)
      RETURNING *`,
      [
        row.planId,
        row.tenantId,
        row.productId,
        row.subscriptionId ?? null,
        row.providerId,
        row.resourceType,
        row.providerResourceId ?? null,
        row.environment,
        row.region,
        row.status ?? ResourceStatus.PLANNED,
        JSON.stringify(row.configuration ?? {}),
        row.configurationFingerprint ?? null,
        JSON.stringify(row.ownership ?? {}),
        row.deletionProtection ?? true,
        row.workflowId ?? null,
        JSON.stringify(row.evidence ?? {}),
        JSON.stringify(row.metadata ?? {}),
      ],
      client,
    );
    return this.mapInfra(rows[0]);
  }

  async getInfrastructureResource(id: string, client?: unknown) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_infrastructure_resources WHERE id = $1`,
      [id],
      client,
    );
    return rows[0] ? this.mapInfra(rows[0]) : null;
  }

  async listInfrastructureResources(filter: Parameters<InfrastructureRepositoryPort['listInfrastructureResources']>[0], client?: unknown) {
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;
    const conds: string[] = [];
    const params: unknown[] = [];
    if (filter.tenantId) {
      params.push(filter.tenantId);
      conds.push(`tenant_id = $${params.length}`);
    }
    if (filter.productId) {
      params.push(filter.productId);
      conds.push(`product_id = $${params.length}`);
    }
    if (filter.planId) {
      params.push(filter.planId);
      conds.push(`plan_id = $${params.length}`);
    }
    if (filter.resourceType) {
      params.push(filter.resourceType);
      conds.push(`resource_type = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      conds.push(`status = $${params.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::text AS c FROM edge_p7_infrastructure_resources ${where}`,
      params,
      client,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_infrastructure_resources ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
      client,
    );
    return { items: rows.map((r) => this.mapInfra(r)), total: Number(countRows[0]?.c ?? 0) };
  }

  async updateInfrastructureResource(id: string, patch: Parameters<InfrastructureRepositoryPort['updateInfrastructureResource']>[1], expectedVersion: number, client?: unknown) {
    const rows = await this.q(
      `UPDATE edge_p7_infrastructure_resources SET
        status = COALESCE($2, status),
        provider_resource_id = COALESCE($3, provider_resource_id),
        configuration = COALESCE($4::jsonb, configuration),
        configuration_fingerprint = COALESCE($5, configuration_fingerprint),
        health_status = COALESCE($6, health_status),
        drift_status = COALESCE($7, drift_status),
        evidence = COALESCE($8::jsonb, evidence),
        last_reconciled_at = COALESCE($9, last_reconciled_at),
        deletion_protection = COALESCE($10, deletion_protection),
        workflow_id = COALESCE($11, workflow_id),
        version = version + 1,
        updated_at = NOW()
       WHERE id = $1 AND version = $12
       RETURNING *`,
      [
        id,
        patch.status ?? null,
        patch.providerResourceId ?? null,
        patch.configuration != null ? JSON.stringify(patch.configuration) : null,
        patch.configurationFingerprint ?? null,
        patch.healthStatus ?? null,
        patch.driftStatus ?? null,
        patch.evidence != null ? JSON.stringify(patch.evidence) : null,
        patch.lastReconciledAt ?? null,
        patch.deletionProtection ?? null,
        patch.workflowId ?? null,
        expectedVersion,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.CONFLICT, 'Infrastructure resource version conflict', [{ id }]);
    }
    return this.mapInfra(rows[0]);
  }

  async createNetworkResource(resourceId: string, data: Parameters<InfrastructureRepositoryPort['createNetworkResource']>[1], client?: unknown) {
    await this.q(
      `INSERT INTO edge_p7_network_resources (
        resource_id, network_mode, cidr_block, deny_by_default, ingress_rules, egress_rules, public_endpoint_allowed
      ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)`,
      [
        resourceId,
        data.networkMode,
        data.cidrBlock ?? null,
        data.denyByDefault,
        JSON.stringify(data.ingressRules ?? []),
        JSON.stringify(data.egressRules ?? []),
        data.publicEndpointAllowed,
      ],
      client,
    );
  }

  async createStorageResource(resourceId: string, data: Parameters<InfrastructureRepositoryPort['createStorageResource']>[1], client?: unknown) {
    await this.q(
      `INSERT INTO edge_p7_storage_resources (resource_id, storage_class, size_gb, encrypted)
       VALUES ($1,$2,$3,$4)`,
      [resourceId, data.storageClass, data.sizeGb, data.encrypted],
      client,
    );
  }

  async createDatabaseResource(row: CreateDatabaseRow, client?: unknown) {
    const rows = await this.q(
      `INSERT INTO edge_p7_database_resources (
        resource_id, plan_id, tenant_id, product_id, subscription_id, database_engine, engine_version,
        provider_id, cluster_id, database_name, endpoint_ref, credential_ref, network_policy,
        encryption_policy, backup_policy, restore_policy, tls_required, status, workflow_id, evidence, metadata
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17,$18,$19,$20::jsonb,$21::jsonb
      ) RETURNING *`,
      [
        row.resourceId,
        row.planId,
        row.tenantId,
        row.productId,
        row.subscriptionId ?? null,
        row.databaseEngine,
        row.engineVersion ?? null,
        row.providerId,
        row.clusterId ?? null,
        row.databaseName,
        row.endpointRef ?? null,
        row.credentialRef ?? null,
        JSON.stringify(row.networkPolicy ?? {}),
        JSON.stringify(row.encryptionPolicy ?? {}),
        JSON.stringify(row.backupPolicy ?? {}),
        JSON.stringify(row.restorePolicy ?? {}),
        row.tlsRequired ?? true,
        row.status ?? ResourceStatus.PLANNED,
        row.workflowId ?? null,
        JSON.stringify(row.evidence ?? {}),
        JSON.stringify(row.metadata ?? {}),
      ],
      client,
    );
    return this.mapDb(rows[0]);
  }

  async getDatabaseResource(id: string, client?: unknown) {
    const rows = await this.q(`SELECT * FROM edge_p7_database_resources WHERE id = $1`, [id], client);
    return rows[0] ? this.mapDb(rows[0]) : null;
  }

  async getDatabaseByResourceId(resourceId: string, client?: unknown) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_database_resources WHERE resource_id = $1`,
      [resourceId],
      client,
    );
    return rows[0] ? this.mapDb(rows[0]) : null;
  }

  async listDatabaseResources(filter: Parameters<InfrastructureRepositoryPort['listDatabaseResources']>[0], client?: unknown) {
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;
    const conds: string[] = [];
    const params: unknown[] = [];
    if (filter.tenantId) {
      params.push(filter.tenantId);
      conds.push(`tenant_id = $${params.length}`);
    }
    if (filter.productId) {
      params.push(filter.productId);
      conds.push(`product_id = $${params.length}`);
    }
    if (filter.engine) {
      params.push(filter.engine);
      conds.push(`database_engine = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      conds.push(`status = $${params.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::text AS c FROM edge_p7_database_resources ${where}`,
      params,
      client,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_database_resources ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
      client,
    );
    return { items: rows.map((r) => this.mapDb(r)), total: Number(countRows[0]?.c ?? 0) };
  }

  async updateDatabaseResource(id: string, patch: Parameters<InfrastructureRepositoryPort['updateDatabaseResource']>[1], expectedVersion: number, client?: unknown) {
    const rows = await this.q(
      `UPDATE edge_p7_database_resources SET
        status = COALESCE($2, status),
        endpoint_ref = COALESCE($3, endpoint_ref),
        credential_ref = COALESCE($4, credential_ref),
        engine_version = COALESCE($5, engine_version),
        cluster_id = COALESCE($6, cluster_id),
        isolation_verified = COALESCE($7, isolation_verified),
        connectivity_verified = COALESCE($8, connectivity_verified),
        least_privilege_verified = COALESCE($9, least_privilege_verified),
        configuration_fingerprint = COALESCE($10, configuration_fingerprint),
        evidence = COALESCE($11::jsonb, evidence),
        backup_policy = COALESCE($12::jsonb, backup_policy),
        network_policy = COALESCE($13::jsonb, network_policy),
        encryption_policy = COALESCE($14::jsonb, encryption_policy),
        workflow_id = COALESCE($15, workflow_id),
        version = version + 1,
        updated_at = NOW()
       WHERE id = $1 AND version = $16
       RETURNING *`,
      [
        id,
        patch.status ?? null,
        patch.endpointRef ?? null,
        patch.credentialRef ?? null,
        patch.engineVersion ?? null,
        patch.clusterId ?? null,
        patch.isolationVerified ?? null,
        patch.connectivityVerified ?? null,
        patch.leastPrivilegeVerified ?? null,
        patch.configurationFingerprint ?? null,
        patch.evidence != null ? JSON.stringify(patch.evidence) : null,
        patch.backupPolicy != null ? JSON.stringify(patch.backupPolicy) : null,
        patch.networkPolicy != null ? JSON.stringify(patch.networkPolicy) : null,
        patch.encryptionPolicy != null ? JSON.stringify(patch.encryptionPolicy) : null,
        patch.workflowId ?? null,
        expectedVersion,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.CONFLICT, 'Database resource version conflict', [{ id }]);
    }
    return this.mapDb(rows[0]);
  }

  async createCredentialBinding(row: Parameters<InfrastructureRepositoryPort['createCredentialBinding']>[0], client?: unknown) {
    await this.q(
      `INSERT INTO edge_p7_resource_credentials (
        resource_id, database_resource_id, credential_ref, credential_kind, expires_at, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        row.resourceId,
        row.databaseResourceId ?? null,
        row.credentialRef,
        row.credentialKind,
        row.expiresAt ?? null,
        JSON.stringify(row.metadata ?? {}),
      ],
      client,
    );
  }

  async createBackup(row: Parameters<InfrastructureRepositoryPort['createBackup']>[0], client?: unknown) {
    const rows = await this.q(
      `INSERT INTO edge_p7_resource_backups (
        resource_id, database_resource_id, provider_backup_id, backup_type, status,
        integrity_verified, restorable_verified, encrypted, size_bytes, evidence, completed_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb, CASE WHEN $5 IN ('SUCCEEDED','VERIFIED') THEN NOW() ELSE NULL END)
      RETURNING *`,
      [
        row.resourceId,
        row.databaseResourceId ?? null,
        row.providerBackupId ?? null,
        row.backupType ?? 'FULL',
        row.status,
        row.integrityVerified ?? false,
        row.restorableVerified ?? false,
        row.encrypted ?? true,
        row.sizeBytes ?? null,
        JSON.stringify(row.evidence ?? {}),
      ],
      client,
    );
    return this.mapBackup(rows[0]);
  }

  async listBackups(resourceId: string, client?: unknown) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_resource_backups WHERE resource_id = $1 ORDER BY created_at DESC`,
      [resourceId],
      client,
    );
    return rows.map((r) => this.mapBackup(r));
  }

  async updateBackup(id: string, patch: Parameters<InfrastructureRepositoryPort['updateBackup']>[1], client?: unknown) {
    const rows = await this.q(
      `UPDATE edge_p7_resource_backups SET
        status = COALESCE($2, status),
        integrity_verified = COALESCE($3, integrity_verified),
        restorable_verified = COALESCE($4, restorable_verified),
        evidence = COALESCE($5::jsonb, evidence),
        completed_at = COALESCE($6, completed_at),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id,
        patch.status ?? null,
        patch.integrityVerified ?? null,
        patch.restorableVerified ?? null,
        patch.evidence != null ? JSON.stringify(patch.evidence) : null,
        patch.completedAt ?? null,
      ],
      client,
    );
    return this.mapBackup(rows[0]);
  }

  async createReconciliation(row: Parameters<InfrastructureRepositoryPort['createReconciliation']>[0], client?: unknown) {
    const rows = await this.q(
      `INSERT INTO edge_p7_resource_reconciliation (
        resource_id, status, drift_classification, expected_snapshot, observed_snapshot,
        remediation_action, actor_id, details
      ) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8::jsonb) RETURNING id`,
      [
        row.resourceId,
        row.status,
        row.driftClassification ?? null,
        JSON.stringify(row.expectedSnapshot ?? {}),
        JSON.stringify(row.observedSnapshot ?? {}),
        row.remediationAction ?? null,
        row.actorId ?? null,
        JSON.stringify(row.details ?? {}),
      ],
      client,
    );
    return { id: str(rows[0].id) };
  }

  async createHealthCheck(row: Parameters<InfrastructureRepositoryPort['createHealthCheck']>[0], client?: unknown) {
    await this.q(
      `INSERT INTO edge_p7_resource_health_checks (resource_id, check_type, result, details)
       VALUES ($1,$2,$3,$4::jsonb)`,
      [row.resourceId, row.checkType, row.result, JSON.stringify(row.details ?? {})],
      client,
    );
  }

  async appendHistory(row: Parameters<InfrastructureRepositoryPort['appendHistory']>[0], client?: unknown) {
    await this.q(
      `INSERT INTO edge_p7_resource_history (
        resource_type, resource_id, from_status, to_status, action, reason, actor_id, details
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        row.resourceType,
        row.resourceId,
        row.fromStatus,
        row.toStatus,
        row.action,
        row.reason,
        row.actorId,
        JSON.stringify(row.details ?? {}),
      ],
      client,
    );
  }

  async listHistory(resourceType: string, resourceId: string, limit = 50, client?: unknown) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_resource_history
       WHERE resource_type = $1 AND resource_id = $2
       ORDER BY created_at DESC LIMIT $3`,
      [resourceType, resourceId, limit],
      client,
    );
    return rows.map(
      (r): ResourceHistoryRecord => ({
        id: str(r.id),
        resourceType: str(r.resource_type),
        resourceId: str(r.resource_id),
        fromStatus: optStr(r.from_status),
        toStatus: optStr(r.to_status),
        action: str(r.action),
        reason: optStr(r.reason),
        actorId: str(r.actor_id),
        details: asJson(r.details, {}),
        createdAt: asDate(r.created_at),
      }),
    );
  }

  async countActiveDependencies(resourceId: string, client?: unknown) {
    const rows = await this.q(
      `SELECT COUNT(*)::text AS c FROM edge_p7_resource_dependencies d
       JOIN edge_p7_infrastructure_resources r ON r.id = d.resource_id
       WHERE d.depends_on_resource_id = $1 AND r.status NOT IN ('DEPROVISIONED','FAILED')`,
      [resourceId],
      client,
    );
    return Number(rows[0]?.c ?? 0);
  }

  async createDependency(resourceId: string, dependsOnResourceId: string, dependencyType: string, client?: unknown) {
    await this.q(
      `INSERT INTO edge_p7_resource_dependencies (resource_id, depends_on_resource_id, dependency_type)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [resourceId, dependsOnResourceId, dependencyType],
      client,
    );
  }

  async createAllocation(row: Parameters<InfrastructureRepositoryPort['createAllocation']>[0], client?: unknown) {
    await this.q(
      `INSERT INTO edge_p7_provider_allocations (
        provider_id, plan_id, reservation_id, allocation_ref, status, capacity_snapshot
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        row.providerId,
        row.planId,
        row.reservationId ?? null,
        row.allocationRef,
        row.status,
        JSON.stringify(row.capacitySnapshot ?? {}),
      ],
      client,
    );
  }
}

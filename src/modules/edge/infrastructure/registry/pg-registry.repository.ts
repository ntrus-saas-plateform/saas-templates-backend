import { Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type { RegistryRepositoryPort } from '../../domain/registry/registry-repository.port.js';
import type {
  CompatibilityEvaluation,
  DeploymentProfile,
  ProductControlContract,
  ProductPlatform,
  ProductRegistryRecord,
  ProductTechnicalVersion,
  RegistryHistoryEntry,
  RegistryResourceType,
  RuntimeEnvironment,
} from '../../domain/registry/registry.types.js';
import {
  CertificationStatus,
  CompatibilityResult,
  ControlContractStatus,
  DeploymentProfileCode,
  EnvironmentStatus,
  PlatformOperationalStatus,
  PlatformType,
  ProfileStatus,
  RegistryLifecycleStatus,
  RegistryResourceType as RRT,
  TechnicalVersionStatus,
  RuntimeEnvironmentType,
} from '../../domain/registry/registry.types.js';

@Injectable()
export class PgRegistryRepository implements RegistryRepositoryPort {
  constructor(private readonly cpDb: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.cpDb.getPool();
  }

  private async q<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ) {
    const res = await this.pool.query(sql, params);
    return res.rows as T[];
  }

  async createProductRegistry(input: Omit<
    ProductRegistryRecord,
    'id' | 'createdAt' | 'updatedAt' | 'version' | 'provisionable'
  > & { provisionable?: boolean }): Promise<ProductRegistryRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_product_registry (
         product_id, code, name, description, vertical_category, registry_status,
         certification_status, provisionable, technical_constraints, declared_capabilities,
         compatible_platform_ids, compatible_environment_ids, compatible_profile_ids,
         compatible_contract_ids, metadata, created_by, updated_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,FALSE,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14::jsonb,$15,$15
       ) RETURNING *`,
      [
        input.productId,
        input.code,
        input.name,
        input.description,
        input.verticalCategory,
        input.registryStatus,
        input.certificationStatus,
        JSON.stringify(input.technicalConstraints ?? {}),
        JSON.stringify(input.declaredCapabilities ?? []),
        input.compatiblePlatformIds ?? [],
        input.compatibleEnvironmentIds ?? [],
        input.compatibleProfileIds ?? [],
        input.compatibleContractIds ?? [],
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
    );
    return this.mapProduct(rows[0]!);
  }

  async updateProductRegistry(
    id: string,
    patch: Partial<ProductRegistryRecord>,
    expectedVersion: number,
  ): Promise<ProductRegistryRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_product_registry SET
         name = COALESCE($3, name),
         description = COALESCE($4, description),
         vertical_category = COALESCE($5, vertical_category),
         registry_status = COALESCE($6, registry_status),
         certification_status = COALESCE($7, certification_status),
         provisionable = COALESCE($8, provisionable),
         technical_constraints = COALESCE($9::jsonb, technical_constraints),
         declared_capabilities = COALESCE($10::jsonb, declared_capabilities),
         compatible_platform_ids = COALESCE($11, compatible_platform_ids),
         compatible_environment_ids = COALESCE($12, compatible_environment_ids),
         compatible_profile_ids = COALESCE($13, compatible_profile_ids),
         compatible_contract_ids = COALESCE($14, compatible_contract_ids),
         metadata = COALESCE($15::jsonb, metadata),
         updated_by = COALESCE($16, updated_by),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.name ?? null,
        patch.description ?? null,
        patch.verticalCategory ?? null,
        patch.registryStatus ?? null,
        patch.certificationStatus ?? null,
        patch.provisionable ?? null,
        patch.technicalConstraints ? JSON.stringify(patch.technicalConstraints) : null,
        patch.declaredCapabilities ? JSON.stringify(patch.declaredCapabilities) : null,
        patch.compatiblePlatformIds ?? null,
        patch.compatibleEnvironmentIds ?? null,
        patch.compatibleProfileIds ?? null,
        patch.compatibleContractIds ?? null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        patch.updatedBy ?? null,
      ],
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.CONFLICT, 'Product registry version conflict or missing');
    }
    return this.mapProduct(rows[0]);
  }

  async getProductRegistry(id: string) {
    const rows = await this.q(`SELECT * FROM edge_p7_product_registry WHERE id = $1`, [id]);
    return rows[0] ? this.mapProduct(rows[0]) : null;
  }

  async getProductRegistryByProductId(productId: string) {
    const rows = await this.q(`SELECT * FROM edge_p7_product_registry WHERE product_id = $1`, [
      productId,
    ]);
    return rows[0] ? this.mapProduct(rows[0]) : null;
  }

  async listProductRegistries(filter: { limit?: number; offset?: number; status?: string; q?: string }) {
    const limit = Math.min(filter.limit ?? 20, 100);
    const offset = filter.offset ?? 0;
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`registry_status = $${params.length}`);
    }
    if (filter.q?.trim()) {
      params.push(`%${filter.q.trim()}%`);
      where.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
    }
    const wh = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await this.q<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_p7_product_registry ${wh}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_product_registry ${wh}
       ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapProduct(r)), total: Number(count[0]?.c ?? 0) };
  }

  async createTechnicalVersion(
    input: Omit<ProductTechnicalVersion, 'id' | 'createdAt' | 'updatedAt'>,
  ) {
    const rows = await this.q(
      `INSERT INTO edge_p7_product_technical_versions (
         product_registry_id, technical_version, release_channel, version_status,
         compatible_contract_versions, compatible_profile_codes, compatible_runtime_types,
         schema_compatibility, api_compatibility, available_from, support_ends_at,
         certification_metadata, change_summary, immutable_after_publish, metadata,
         created_by, updated_by
       ) VALUES (
         $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,
         $12::jsonb,$13,$14,$15::jsonb,$16,$16
       ) RETURNING *`,
      [
        input.productRegistryId,
        input.technicalVersion,
        input.releaseChannel,
        input.versionStatus,
        JSON.stringify(input.compatibleContractVersions ?? []),
        JSON.stringify(input.compatibleProfileCodes ?? []),
        JSON.stringify(input.compatibleRuntimeTypes ?? []),
        JSON.stringify(input.schemaCompatibility ?? {}),
        JSON.stringify(input.apiCompatibility ?? {}),
        input.availableFrom,
        input.supportEndsAt,
        JSON.stringify(input.certificationMetadata ?? {}),
        input.changeSummary,
        input.immutableAfterPublish,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
    );
    return this.mapVersion(rows[0]!);
  }

  async updateTechnicalVersion(id: string, patch: Partial<ProductTechnicalVersion>) {
    const rows = await this.q(
      `UPDATE edge_p7_product_technical_versions SET
         release_channel = COALESCE($2, release_channel),
         version_status = COALESCE($3, version_status),
         compatible_contract_versions = COALESCE($4::jsonb, compatible_contract_versions),
         compatible_profile_codes = COALESCE($5::jsonb, compatible_profile_codes),
         compatible_runtime_types = COALESCE($6::jsonb, compatible_runtime_types),
         schema_compatibility = COALESCE($7::jsonb, schema_compatibility),
         api_compatibility = COALESCE($8::jsonb, api_compatibility),
         available_from = COALESCE($9, available_from),
         support_ends_at = COALESCE($10, support_ends_at),
         certification_metadata = COALESCE($11::jsonb, certification_metadata),
         change_summary = COALESCE($12, change_summary),
         metadata = COALESCE($13::jsonb, metadata),
         updated_by = COALESCE($14, updated_by),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id,
        patch.releaseChannel ?? null,
        patch.versionStatus ?? null,
        patch.compatibleContractVersions
          ? JSON.stringify(patch.compatibleContractVersions)
          : null,
        patch.compatibleProfileCodes ? JSON.stringify(patch.compatibleProfileCodes) : null,
        patch.compatibleRuntimeTypes ? JSON.stringify(patch.compatibleRuntimeTypes) : null,
        patch.schemaCompatibility ? JSON.stringify(patch.schemaCompatibility) : null,
        patch.apiCompatibility ? JSON.stringify(patch.apiCompatibility) : null,
        patch.availableFrom ?? null,
        patch.supportEndsAt ?? null,
        patch.certificationMetadata ? JSON.stringify(patch.certificationMetadata) : null,
        patch.changeSummary ?? null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        patch.updatedBy ?? null,
      ],
    );
    if (!rows[0]) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Technical version not found');
    return this.mapVersion(rows[0]);
  }

  async getTechnicalVersion(id: string) {
    const rows = await this.q(`SELECT * FROM edge_p7_product_technical_versions WHERE id = $1`, [
      id,
    ]);
    return rows[0] ? this.mapVersion(rows[0]) : null;
  }

  async listTechnicalVersions(
    productRegistryId: string,
    filter?: { limit?: number; offset?: number; status?: string },
  ) {
    const limit = Math.min(filter?.limit ?? 20, 100);
    const offset = filter?.offset ?? 0;
    const params: unknown[] = [productRegistryId];
    let wh = 'WHERE product_registry_id = $1';
    if (filter?.status) {
      params.push(filter.status);
      wh += ` AND version_status = $${params.length}`;
    }
    const count = await this.q<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_p7_product_technical_versions ${wh}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_product_technical_versions ${wh}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapVersion(r)), total: Number(count[0]?.c ?? 0) };
  }

  async createPlatform(input: Omit<ProductPlatform, 'id' | 'createdAt' | 'updatedAt' | 'version'>) {
    const rows = await this.q(
      `INSERT INTO edge_p7_product_platforms (
         code, name, description, platform_type, business_backend_id, allowed_product_ids,
         supported_environment_types, supported_profile_codes, connectivity_reference,
         secure_config_ref, integration_protocol_version, control_contract_version,
         certification_status, operational_status, declared_capabilities, constraints,
         metadata, created_by, updated_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17::jsonb,$18,$18
       ) RETURNING *`,
      [
        input.code,
        input.name,
        input.description,
        input.platformType,
        input.businessBackendId,
        input.allowedProductIds ?? [],
        JSON.stringify(input.supportedEnvironmentTypes ?? []),
        JSON.stringify(input.supportedProfileCodes ?? []),
        input.connectivityReference,
        input.secureConfigRef,
        input.integrationProtocolVersion,
        input.controlContractVersion,
        input.certificationStatus,
        input.operationalStatus,
        JSON.stringify(input.declaredCapabilities ?? []),
        JSON.stringify(input.constraints ?? {}),
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
    );
    return this.mapPlatform(rows[0]!);
  }

  async updatePlatform(id: string, patch: Partial<ProductPlatform>, expectedVersion: number) {
    const rows = await this.q(
      `UPDATE edge_p7_product_platforms SET
         name = COALESCE($3, name),
         description = COALESCE($4, description),
         allowed_product_ids = COALESCE($5, allowed_product_ids),
         supported_environment_types = COALESCE($6::jsonb, supported_environment_types),
         supported_profile_codes = COALESCE($7::jsonb, supported_profile_codes),
         connectivity_reference = COALESCE($8, connectivity_reference),
         secure_config_ref = COALESCE($9, secure_config_ref),
         integration_protocol_version = COALESCE($10, integration_protocol_version),
         control_contract_version = COALESCE($11, control_contract_version),
         certification_status = COALESCE($12, certification_status),
         operational_status = COALESCE($13, operational_status),
         declared_capabilities = COALESCE($14::jsonb, declared_capabilities),
         constraints = COALESCE($15::jsonb, constraints),
         metadata = COALESCE($16::jsonb, metadata),
         updated_by = COALESCE($17, updated_by),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.name ?? null,
        patch.description ?? null,
        patch.allowedProductIds ?? null,
        patch.supportedEnvironmentTypes
          ? JSON.stringify(patch.supportedEnvironmentTypes)
          : null,
        patch.supportedProfileCodes ? JSON.stringify(patch.supportedProfileCodes) : null,
        patch.connectivityReference ?? null,
        patch.secureConfigRef ?? null,
        patch.integrationProtocolVersion ?? null,
        patch.controlContractVersion ?? null,
        patch.certificationStatus ?? null,
        patch.operationalStatus ?? null,
        patch.declaredCapabilities ? JSON.stringify(patch.declaredCapabilities) : null,
        patch.constraints ? JSON.stringify(patch.constraints) : null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        patch.updatedBy ?? null,
      ],
    );
    if (!rows[0]) throw new DomainError(ErrorCode.CONFLICT, 'Platform version conflict or missing');
    return this.mapPlatform(rows[0]);
  }

  async getPlatform(id: string) {
    const rows = await this.q(`SELECT * FROM edge_p7_product_platforms WHERE id = $1`, [id]);
    return rows[0] ? this.mapPlatform(rows[0]) : null;
  }

  async listPlatforms(filter: { limit?: number; offset?: number; status?: string; q?: string }) {
    const limit = Math.min(filter.limit ?? 20, 100);
    const offset = filter.offset ?? 0;
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`operational_status = $${params.length}`);
    }
    if (filter.q?.trim()) {
      params.push(`%${filter.q.trim()}%`);
      where.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
    }
    const wh = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await this.q<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_p7_product_platforms ${wh}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_product_platforms ${wh}
       ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapPlatform(r)), total: Number(count[0]?.c ?? 0) };
  }

  async countActiveDependenciesOnPlatform(platformId: string) {
    const rows = await this.q<{ c: string }>(
      `SELECT (
         (SELECT COUNT(*) FROM edge_p7_runtime_environments
           WHERE platform_id = $1 AND environment_status NOT IN ('RETIRED'))
         +
         (SELECT COUNT(*) FROM edge_p7_product_control_contracts
           WHERE platform_id = $1 AND contract_status IN ('CERTIFIED','PUBLISHED'))
       )::text AS c`,
      [platformId],
    );
    return Number(rows[0]?.c ?? 0);
  }

  async createEnvironment(
    input: Omit<RuntimeEnvironment, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ) {
    const rows = await this.q(
      `INSERT INTO edge_p7_runtime_environments (
         platform_id, code, name, environment_type, region, geo_zone,
         security_classification, data_classification, available_capabilities,
         data_residency_constraints, backup_policy, availability_policy,
         allowed_profile_codes, environment_status, governance_metadata, metadata,
         created_by, updated_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15::jsonb,$16::jsonb,$17,$17
       ) RETURNING *`,
      [
        input.platformId,
        input.code,
        input.name,
        input.environmentType,
        input.region,
        input.geoZone,
        input.securityClassification,
        input.dataClassification,
        JSON.stringify(input.availableCapabilities ?? []),
        JSON.stringify(input.dataResidencyConstraints ?? {}),
        JSON.stringify(input.backupPolicy ?? {}),
        JSON.stringify(input.availabilityPolicy ?? {}),
        JSON.stringify(input.allowedProfileCodes ?? []),
        input.environmentStatus,
        JSON.stringify(input.governanceMetadata ?? {}),
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
    );
    return this.mapEnv(rows[0]!);
  }

  async updateEnvironment(
    id: string,
    patch: Partial<RuntimeEnvironment>,
    expectedVersion: number,
  ) {
    const rows = await this.q(
      `UPDATE edge_p7_runtime_environments SET
         name = COALESCE($3, name),
         region = COALESCE($4, region),
         geo_zone = COALESCE($5, geo_zone),
         security_classification = COALESCE($6, security_classification),
         data_classification = COALESCE($7, data_classification),
         available_capabilities = COALESCE($8::jsonb, available_capabilities),
         data_residency_constraints = COALESCE($9::jsonb, data_residency_constraints),
         backup_policy = COALESCE($10::jsonb, backup_policy),
         availability_policy = COALESCE($11::jsonb, availability_policy),
         allowed_profile_codes = COALESCE($12::jsonb, allowed_profile_codes),
         environment_status = COALESCE($13, environment_status),
         governance_metadata = COALESCE($14::jsonb, governance_metadata),
         metadata = COALESCE($15::jsonb, metadata),
         updated_by = COALESCE($16, updated_by),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.name ?? null,
        patch.region ?? null,
        patch.geoZone ?? null,
        patch.securityClassification ?? null,
        patch.dataClassification ?? null,
        patch.availableCapabilities ? JSON.stringify(patch.availableCapabilities) : null,
        patch.dataResidencyConstraints
          ? JSON.stringify(patch.dataResidencyConstraints)
          : null,
        patch.backupPolicy ? JSON.stringify(patch.backupPolicy) : null,
        patch.availabilityPolicy ? JSON.stringify(patch.availabilityPolicy) : null,
        patch.allowedProfileCodes ? JSON.stringify(patch.allowedProfileCodes) : null,
        patch.environmentStatus ?? null,
        patch.governanceMetadata ? JSON.stringify(patch.governanceMetadata) : null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        patch.updatedBy ?? null,
      ],
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.CONFLICT, 'Environment version conflict or missing');
    }
    return this.mapEnv(rows[0]);
  }

  async getEnvironment(id: string) {
    const rows = await this.q(`SELECT * FROM edge_p7_runtime_environments WHERE id = $1`, [id]);
    return rows[0] ? this.mapEnv(rows[0]) : null;
  }

  async listEnvironments(filter: {
    limit?: number;
    offset?: number;
    status?: string;
    q?: string;
    platformId?: string;
  }) {
    const limit = Math.min(filter.limit ?? 20, 100);
    const offset = filter.offset ?? 0;
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.platformId) {
      params.push(filter.platformId);
      where.push(`platform_id = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`environment_status = $${params.length}`);
    }
    if (filter.q?.trim()) {
      params.push(`%${filter.q.trim()}%`);
      where.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
    }
    const wh = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await this.q<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_p7_runtime_environments ${wh}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_runtime_environments ${wh}
       ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapEnv(r)), total: Number(count[0]?.c ?? 0) };
  }

  async updateProfile(id: string, patch: Partial<DeploymentProfile>) {
    const rows = await this.q(
      `UPDATE edge_p7_deployment_profiles SET
         name = COALESCE($2, name),
         description = COALESCE($3, description),
         technical_requirements = COALESCE($4::jsonb, technical_requirements),
         security_requirements = COALESCE($5::jsonb, security_requirements),
         isolation_model = COALESCE($6, isolation_model),
         connectivity_model = COALESCE($7, connectivity_model),
         network_constraints = COALESCE($8::jsonb, network_constraints),
         data_residency_constraints = COALESCE($9::jsonb, data_residency_constraints),
         backup_requirements = COALESCE($10::jsonb, backup_requirements),
         availability_requirements = COALESCE($11::jsonb, availability_requirements),
         disaster_recovery_requirements = COALESCE($12::jsonb, disaster_recovery_requirements),
         compatible_product_ids = COALESCE($13, compatible_product_ids),
         compatible_platform_types = COALESCE($14::jsonb, compatible_platform_types),
         compatible_environment_types = COALESCE($15::jsonb, compatible_environment_types),
         certification_status = COALESCE($16, certification_status),
         profile_status = COALESCE($17, profile_status),
         profile_version = profile_version + 1,
         metadata = COALESCE($18::jsonb, metadata),
         updated_by = COALESCE($19, updated_by),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id,
        patch.name ?? null,
        patch.description ?? null,
        patch.technicalRequirements ? JSON.stringify(patch.technicalRequirements) : null,
        patch.securityRequirements ? JSON.stringify(patch.securityRequirements) : null,
        patch.isolationModel ?? null,
        patch.connectivityModel ?? null,
        patch.networkConstraints ? JSON.stringify(patch.networkConstraints) : null,
        patch.dataResidencyConstraints
          ? JSON.stringify(patch.dataResidencyConstraints)
          : null,
        patch.backupRequirements ? JSON.stringify(patch.backupRequirements) : null,
        patch.availabilityRequirements
          ? JSON.stringify(patch.availabilityRequirements)
          : null,
        patch.disasterRecoveryRequirements
          ? JSON.stringify(patch.disasterRecoveryRequirements)
          : null,
        patch.compatibleProductIds ?? null,
        patch.compatiblePlatformTypes
          ? JSON.stringify(patch.compatiblePlatformTypes)
          : null,
        patch.compatibleEnvironmentTypes
          ? JSON.stringify(patch.compatibleEnvironmentTypes)
          : null,
        patch.certificationStatus ?? null,
        patch.profileStatus ?? null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        patch.updatedBy ?? null,
      ],
    );
    if (!rows[0]) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Deployment profile not found');
    return this.mapProfile(rows[0]);
  }

  async getProfile(id: string) {
    const rows = await this.q(`SELECT * FROM edge_p7_deployment_profiles WHERE id = $1`, [id]);
    return rows[0] ? this.mapProfile(rows[0]) : null;
  }

  async getProfileByCode(code: string) {
    const rows = await this.q(`SELECT * FROM edge_p7_deployment_profiles WHERE code = $1`, [code]);
    return rows[0] ? this.mapProfile(rows[0]) : null;
  }

  async listProfiles(filter: { limit?: number; offset?: number; status?: string; q?: string }) {
    const limit = Math.min(filter.limit ?? 20, 100);
    const offset = filter.offset ?? 0;
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`profile_status = $${params.length}`);
    }
    if (filter.q?.trim()) {
      params.push(`%${filter.q.trim()}%`);
      where.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
    }
    const wh = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await this.q<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_p7_deployment_profiles ${wh}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_deployment_profiles ${wh}
       ORDER BY code ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapProfile(r)), total: Number(count[0]?.c ?? 0) };
  }

  async createContract(input: Omit<ProductControlContract, 'id' | 'createdAt' | 'updatedAt'>) {
    const rows = await this.q(
      `INSERT INTO edge_p7_product_control_contracts (
         product_id, platform_id, contract_code, contract_version, schema_version,
         supported_capabilities, supported_control_operations, connectivity_model,
         s2s_auth_policy, signature_requirements, published_events, consumed_events,
         backward_compatible, forward_compatible, versioning_policy, effective_from,
         deprecated_at, contract_status, certification_evidence, immutable, metadata,
         created_by, updated_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,
         $13,$14,$15::jsonb,$16,$17,$18,$19::jsonb,$20,$21::jsonb,$22,$22
       ) RETURNING *`,
      [
        input.productId,
        input.platformId,
        input.contractCode,
        input.contractVersion,
        input.schemaVersion,
        JSON.stringify(input.supportedCapabilities ?? []),
        JSON.stringify(input.supportedControlOperations ?? []),
        input.connectivityModel,
        JSON.stringify(this.redactPolicy(input.s2sAuthPolicy)),
        JSON.stringify(input.signatureRequirements ?? {}),
        JSON.stringify(input.publishedEvents ?? []),
        JSON.stringify(input.consumedEvents ?? []),
        input.backwardCompatible,
        input.forwardCompatible,
        JSON.stringify(input.versioningPolicy ?? {}),
        input.effectiveFrom,
        input.deprecatedAt,
        input.contractStatus,
        JSON.stringify(input.certificationEvidence ?? {}),
        input.immutable,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
    );
    return this.mapContract(rows[0]!);
  }

  async updateContract(id: string, patch: Partial<ProductControlContract>) {
    const rows = await this.q(
      `UPDATE edge_p7_product_control_contracts SET
         supported_capabilities = COALESCE($2::jsonb, supported_capabilities),
         supported_control_operations = COALESCE($3::jsonb, supported_control_operations),
         connectivity_model = COALESCE($4, connectivity_model),
         s2s_auth_policy = COALESCE($5::jsonb, s2s_auth_policy),
         signature_requirements = COALESCE($6::jsonb, signature_requirements),
         published_events = COALESCE($7::jsonb, published_events),
         consumed_events = COALESCE($8::jsonb, consumed_events),
         backward_compatible = COALESCE($9, backward_compatible),
         forward_compatible = COALESCE($10, forward_compatible),
         versioning_policy = COALESCE($11::jsonb, versioning_policy),
         effective_from = COALESCE($12, effective_from),
         deprecated_at = COALESCE($13, deprecated_at),
         contract_status = COALESCE($14, contract_status),
         certification_evidence = COALESCE($15::jsonb, certification_evidence),
         immutable = COALESCE($16, immutable),
         metadata = COALESCE($17::jsonb, metadata),
         updated_by = COALESCE($18, updated_by),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id,
        patch.supportedCapabilities ? JSON.stringify(patch.supportedCapabilities) : null,
        patch.supportedControlOperations
          ? JSON.stringify(patch.supportedControlOperations)
          : null,
        patch.connectivityModel ?? null,
        patch.s2sAuthPolicy ? JSON.stringify(this.redactPolicy(patch.s2sAuthPolicy)) : null,
        patch.signatureRequirements ? JSON.stringify(patch.signatureRequirements) : null,
        patch.publishedEvents ? JSON.stringify(patch.publishedEvents) : null,
        patch.consumedEvents ? JSON.stringify(patch.consumedEvents) : null,
        patch.backwardCompatible ?? null,
        patch.forwardCompatible ?? null,
        patch.versioningPolicy ? JSON.stringify(patch.versioningPolicy) : null,
        patch.effectiveFrom ?? null,
        patch.deprecatedAt ?? null,
        patch.contractStatus ?? null,
        patch.certificationEvidence ? JSON.stringify(patch.certificationEvidence) : null,
        patch.immutable ?? null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        patch.updatedBy ?? null,
      ],
    );
    if (!rows[0]) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Control contract not found');
    return this.mapContract(rows[0]);
  }

  async getContract(id: string) {
    const rows = await this.q(`SELECT * FROM edge_p7_product_control_contracts WHERE id = $1`, [
      id,
    ]);
    return rows[0] ? this.mapContract(rows[0]) : null;
  }

  async listContracts(filter: {
    limit?: number;
    offset?: number;
    status?: string;
    q?: string;
    productId?: string;
    platformId?: string;
  }) {
    const limit = Math.min(filter.limit ?? 20, 100);
    const offset = filter.offset ?? 0;
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.productId) {
      params.push(filter.productId);
      where.push(`product_id = $${params.length}`);
    }
    if (filter.platformId) {
      params.push(filter.platformId);
      where.push(`platform_id = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`contract_status = $${params.length}`);
    }
    if (filter.q?.trim()) {
      params.push(`%${filter.q.trim()}%`);
      where.push(`(contract_code ILIKE $${params.length})`);
    }
    const wh = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await this.q<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_p7_product_control_contracts ${wh}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_product_control_contracts ${wh}
       ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapContract(r)), total: Number(count[0]?.c ?? 0) };
  }

  async countPublishedContractsForPlatform(platformId: string) {
    const rows = await this.q<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_p7_product_control_contracts
       WHERE platform_id = $1 AND contract_status IN ('CERTIFIED','PUBLISHED')`,
      [platformId],
    );
    return Number(rows[0]?.c ?? 0);
  }

  async saveCompatibilityEvaluation(input: Omit<CompatibilityEvaluation, 'id' | 'createdAt'>) {
    const rows = await this.q(
      `INSERT INTO edge_p7_compatibility_evaluations (
         correlation_id, product_registry_id, technical_version_id, platform_id,
         environment_id, profile_id, contract_id, result, rules_applied, reasons,
         examined_refs, evaluated_by, evaluated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13
       ) RETURNING *`,
      [
        input.correlationId,
        input.productRegistryId,
        input.technicalVersionId,
        input.platformId,
        input.environmentId,
        input.profileId,
        input.contractId,
        input.result,
        JSON.stringify(input.rulesApplied ?? []),
        JSON.stringify(input.reasons ?? []),
        JSON.stringify(input.examinedRefs ?? {}),
        input.evaluatedBy,
        input.evaluatedAt,
      ],
    );
    return this.mapEval(rows[0]!);
  }

  async listCompatibilityEvaluations(filter: {
    limit?: number;
    offset?: number;
    status?: string;
  }) {
    const limit = Math.min(filter.limit ?? 20, 100);
    const offset = filter.offset ?? 0;
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`result = $${params.length}`);
    }
    const wh = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await this.q<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_p7_compatibility_evaluations ${wh}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_compatibility_evaluations ${wh}
       ORDER BY evaluated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapEval(r)), total: Number(count[0]?.c ?? 0) };
  }

  async getCompatibilityEvaluation(id: string) {
    const rows = await this.q(`SELECT * FROM edge_p7_compatibility_evaluations WHERE id = $1`, [
      id,
    ]);
    return rows[0] ? this.mapEval(rows[0]) : null;
  }

  async appendHistory(entry: Omit<RegistryHistoryEntry, 'id' | 'createdAt'>) {
    const rows = await this.q(
      `INSERT INTO edge_p7_registry_history (
         resource_type, resource_id, from_status, to_status, action, reason, actor_id, details
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *`,
      [
        entry.resourceType,
        entry.resourceId,
        entry.fromStatus,
        entry.toStatus,
        entry.action,
        entry.reason,
        entry.actorId,
        JSON.stringify(entry.details ?? {}),
      ],
    );
    return this.mapHistory(rows[0]!);
  }

  async listHistory(filter: {
    limit?: number;
    offset?: number;
    resourceType?: RegistryResourceType;
    resourceId?: string;
  }) {
    const limit = Math.min(filter.limit ?? 20, 100);
    const offset = filter.offset ?? 0;
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.resourceType) {
      params.push(filter.resourceType);
      where.push(`resource_type = $${params.length}`);
    }
    if (filter.resourceId) {
      params.push(filter.resourceId);
      where.push(`resource_id = $${params.length}`);
    }
    const wh = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await this.q<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_p7_registry_history ${wh}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_registry_history ${wh}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapHistory(r)), total: Number(count[0]?.c ?? 0) };
  }

  private redactPolicy(policy: Record<string, unknown>): Record<string, unknown> {
    const clone = { ...policy };
    for (const key of Object.keys(clone)) {
      if (/secret|password|token|credential/i.test(key)) {
        clone[key] = '[REDACTED]';
      }
    }
    return clone;
  }

  private mapProduct(r: Record<string, unknown>): ProductRegistryRecord {
    return {
      id: String(r.id),
      productId: String(r.product_id),
      code: String(r.code),
      name: String(r.name),
      description: (r.description as string | null) ?? null,
      verticalCategory: (r.vertical_category as string | null) ?? null,
      registryStatus: r.registry_status as RegistryLifecycleStatus,
      certificationStatus: r.certification_status as CertificationStatus,
      provisionable: Boolean(r.provisionable),
      technicalConstraints: (r.technical_constraints as Record<string, unknown>) ?? {},
      declaredCapabilities: (r.declared_capabilities as unknown[]) ?? [],
      compatiblePlatformIds: (r.compatible_platform_ids as string[]) ?? [],
      compatibleEnvironmentIds: (r.compatible_environment_ids as string[]) ?? [],
      compatibleProfileIds: (r.compatible_profile_ids as string[]) ?? [],
      compatibleContractIds: (r.compatible_contract_ids as string[]) ?? [],
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      version: Number(r.version),
      createdBy: (r.created_by as string | null) ?? null,
      updatedBy: (r.updated_by as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapVersion(r: Record<string, unknown>): ProductTechnicalVersion {
    return {
      id: String(r.id),
      productRegistryId: String(r.product_registry_id),
      technicalVersion: String(r.technical_version),
      releaseChannel: String(r.release_channel),
      versionStatus: r.version_status as TechnicalVersionStatus,
      compatibleContractVersions: (r.compatible_contract_versions as unknown[]) ?? [],
      compatibleProfileCodes: (r.compatible_profile_codes as unknown[]) ?? [],
      compatibleRuntimeTypes: (r.compatible_runtime_types as unknown[]) ?? [],
      schemaCompatibility: (r.schema_compatibility as Record<string, unknown>) ?? {},
      apiCompatibility: (r.api_compatibility as Record<string, unknown>) ?? {},
      availableFrom: r.available_from ? new Date(String(r.available_from)) : null,
      supportEndsAt: r.support_ends_at ? new Date(String(r.support_ends_at)) : null,
      certificationMetadata: (r.certification_metadata as Record<string, unknown>) ?? {},
      changeSummary: (r.change_summary as string | null) ?? null,
      immutableAfterPublish: Boolean(r.immutable_after_publish),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdBy: (r.created_by as string | null) ?? null,
      updatedBy: (r.updated_by as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapPlatform(r: Record<string, unknown>): ProductPlatform {
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      description: (r.description as string | null) ?? null,
      platformType: r.platform_type as PlatformType,
      businessBackendId: (r.business_backend_id as string | null) ?? null,
      allowedProductIds: (r.allowed_product_ids as string[]) ?? [],
      supportedEnvironmentTypes: (r.supported_environment_types as unknown[]) ?? [],
      supportedProfileCodes: (r.supported_profile_codes as unknown[]) ?? [],
      connectivityReference: (r.connectivity_reference as string | null) ?? null,
      secureConfigRef: r.secure_config_ref ? '[CONFIGURED]' : null,
      integrationProtocolVersion: (r.integration_protocol_version as string | null) ?? null,
      controlContractVersion: (r.control_contract_version as string | null) ?? null,
      certificationStatus: r.certification_status as CertificationStatus,
      operationalStatus: r.operational_status as PlatformOperationalStatus,
      declaredCapabilities: (r.declared_capabilities as unknown[]) ?? [],
      constraints: (r.constraints as Record<string, unknown>) ?? {},
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      version: Number(r.version),
      createdBy: (r.created_by as string | null) ?? null,
      updatedBy: (r.updated_by as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapEnv(r: Record<string, unknown>): RuntimeEnvironment {
    return {
      id: String(r.id),
      platformId: String(r.platform_id),
      code: String(r.code),
      name: String(r.name),
      environmentType: r.environment_type as RuntimeEnvironmentType,
      region: (r.region as string | null) ?? null,
      geoZone: (r.geo_zone as string | null) ?? null,
      securityClassification: (r.security_classification as string | null) ?? null,
      dataClassification: (r.data_classification as string | null) ?? null,
      availableCapabilities: (r.available_capabilities as unknown[]) ?? [],
      dataResidencyConstraints: (r.data_residency_constraints as Record<string, unknown>) ?? {},
      backupPolicy: (r.backup_policy as Record<string, unknown>) ?? {},
      availabilityPolicy: (r.availability_policy as Record<string, unknown>) ?? {},
      allowedProfileCodes: (r.allowed_profile_codes as unknown[]) ?? [],
      environmentStatus: r.environment_status as EnvironmentStatus,
      governanceMetadata: (r.governance_metadata as Record<string, unknown>) ?? {},
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      version: Number(r.version),
      createdBy: (r.created_by as string | null) ?? null,
      updatedBy: (r.updated_by as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapProfile(r: Record<string, unknown>): DeploymentProfile {
    return {
      id: String(r.id),
      code: r.code as DeploymentProfileCode,
      name: String(r.name),
      description: (r.description as string | null) ?? null,
      technicalRequirements: (r.technical_requirements as Record<string, unknown>) ?? {},
      securityRequirements: (r.security_requirements as Record<string, unknown>) ?? {},
      isolationModel: String(r.isolation_model),
      connectivityModel: String(r.connectivity_model),
      networkConstraints: (r.network_constraints as Record<string, unknown>) ?? {},
      dataResidencyConstraints: (r.data_residency_constraints as Record<string, unknown>) ?? {},
      backupRequirements: (r.backup_requirements as Record<string, unknown>) ?? {},
      availabilityRequirements: (r.availability_requirements as Record<string, unknown>) ?? {},
      disasterRecoveryRequirements:
        (r.disaster_recovery_requirements as Record<string, unknown>) ?? {},
      compatibleProductIds: (r.compatible_product_ids as string[]) ?? [],
      compatiblePlatformTypes: (r.compatible_platform_types as unknown[]) ?? [],
      compatibleEnvironmentTypes: (r.compatible_environment_types as unknown[]) ?? [],
      certificationStatus: r.certification_status as CertificationStatus,
      profileStatus: r.profile_status as ProfileStatus,
      profileVersion: Number(r.profile_version),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdBy: (r.created_by as string | null) ?? null,
      updatedBy: (r.updated_by as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapContract(r: Record<string, unknown>): ProductControlContract {
    return {
      id: String(r.id),
      productId: String(r.product_id),
      platformId: String(r.platform_id),
      contractCode: String(r.contract_code),
      contractVersion: String(r.contract_version),
      schemaVersion: String(r.schema_version),
      supportedCapabilities: (r.supported_capabilities as unknown[]) ?? [],
      supportedControlOperations: (r.supported_control_operations as unknown[]) ?? [],
      connectivityModel: String(r.connectivity_model),
      s2sAuthPolicy: this.redactPolicy((r.s2s_auth_policy as Record<string, unknown>) ?? {}),
      signatureRequirements: (r.signature_requirements as Record<string, unknown>) ?? {},
      publishedEvents: (r.published_events as unknown[]) ?? [],
      consumedEvents: (r.consumed_events as unknown[]) ?? [],
      backwardCompatible: Boolean(r.backward_compatible),
      forwardCompatible: Boolean(r.forward_compatible),
      versioningPolicy: (r.versioning_policy as Record<string, unknown>) ?? {},
      effectiveFrom: r.effective_from ? new Date(String(r.effective_from)) : null,
      deprecatedAt: r.deprecated_at ? new Date(String(r.deprecated_at)) : null,
      contractStatus: r.contract_status as ControlContractStatus,
      certificationEvidence: (r.certification_evidence as Record<string, unknown>) ?? {},
      immutable: Boolean(r.immutable),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdBy: (r.created_by as string | null) ?? null,
      updatedBy: (r.updated_by as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapEval(r: Record<string, unknown>): CompatibilityEvaluation {
    return {
      id: String(r.id),
      correlationId: String(r.correlation_id),
      productRegistryId: (r.product_registry_id as string | null) ?? null,
      technicalVersionId: (r.technical_version_id as string | null) ?? null,
      platformId: (r.platform_id as string | null) ?? null,
      environmentId: (r.environment_id as string | null) ?? null,
      profileId: (r.profile_id as string | null) ?? null,
      contractId: (r.contract_id as string | null) ?? null,
      result: r.result as CompatibilityResult,
      rulesApplied: (r.rules_applied as string[]) ?? [],
      reasons: (r.reasons as string[]) ?? [],
      examinedRefs: (r.examined_refs as Record<string, unknown>) ?? {},
      evaluatedBy: (r.evaluated_by as string | null) ?? null,
      evaluatedAt: new Date(String(r.evaluated_at)),
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapHistory(r: Record<string, unknown>): RegistryHistoryEntry {
    return {
      id: String(r.id),
      resourceType: r.resource_type as typeof RRT[keyof typeof RRT],
      resourceId: String(r.resource_id),
      fromStatus: (r.from_status as string | null) ?? null,
      toStatus: (r.to_status as string | null) ?? null,
      action: String(r.action),
      reason: (r.reason as string | null) ?? null,
      actorId: String(r.actor_id),
      details: (r.details as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
    };
  }
}

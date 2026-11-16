import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type { ServiceCatalogRepositoryPort } from '../../domain/platform-operations/service-catalog-repository.port.js';
import type {
  PlatformServiceRecord,
  ServiceCatalogSearchFilter,
  ServiceDependencyRecord,
} from '../../domain/platform-operations/service-catalog.types.js';

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
function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function asDate(v: unknown): Date {
  return v instanceof Date ? v : new Date(String(v));
}
function asJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === 'object') return v as T;
  try {
    return JSON.parse(String(v)) as T;
  } catch {
    return fallback;
  }
}

@Injectable()
export class PgServiceCatalogRepository implements ServiceCatalogRepositoryPort {
  constructor(private readonly db: ControlPlaneDatabaseService) {}

  private async q<T extends Row = Row>(
    sql: string,
    params: unknown[] = [],
    client?: unknown,
  ): Promise<T[]> {
    if (client) {
      const result = await (client as PoolClient).query(sql, params);
      return result.rows as T[];
    }
    const pool = this.db.getPool();
    const result = await pool.query(sql, params);
    return result.rows as T[];
  }

  private mapService(row: Row): PlatformServiceRecord {
    return {
      id: str(row.id),
      serviceCode: str(row.service_code),
      serviceSlug: str(row.service_slug),
      displayName: str(row.display_name),
      description: strOrNull(row.description),
      category: str(row.category),
      serviceType: str(row.service_type),
      lifecycleStatus: str(row.lifecycle_status),
      observationStatus: str(row.observation_status),
      businessCriticality: str(row.business_criticality),
      technicalCriticality: str(row.technical_criticality),
      environment: str(row.environment),
      region: strOrNull(row.region),
      deploymentProfile: strOrNull(row.deployment_profile),
      runtimeTechnology: strOrNull(row.runtime_technology),
      currentVersion: strOrNull(row.current_version),
      serviceOwnerId: strOrNull(row.service_owner_id),
      technicalOwnerId: strOrNull(row.technical_owner_id),
      operationalTeam: strOrNull(row.operational_team),
      supportGroup: strOrNull(row.support_group),
      escalationPolicyRef: strOrNull(row.escalation_policy_ref),
      healthCheckRef: strOrNull(row.health_check_ref),
      monitoringConfigRef: strOrNull(row.monitoring_config_ref),
      sloRef: strOrNull(row.slo_ref),
      runbookRef: strOrNull(row.runbook_ref),
      rpoMinutes: numOrNull(row.rpo_minutes),
      rtoMinutes: numOrNull(row.rto_minutes),
      maintenancePolicyRef: strOrNull(row.maintenance_policy_ref),
      dataClassification: strOrNull(row.data_classification),
      securityClassification: strOrNull(row.security_classification),
      supportHours: strOrNull(row.support_hours),
      documentationUrl: strOrNull(row.documentation_url),
      p7ResourceRef: strOrNull(row.p7_resource_ref),
      p8ProjectionNote: strOrNull(row.p8_projection_note),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapDep(row: Row): ServiceDependencyRecord {
    return {
      id: str(row.id),
      serviceId: str(row.service_id),
      dependsOnServiceId: str(row.depends_on_service_id),
      dependencyType: str(row.dependency_type),
      criticality: str(row.criticality),
      description: strOrNull(row.description),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
    };
  }

  private conflict(): never {
    throw new DomainError(ErrorCode.CONFLICT, 'Optimistic concurrency conflict on platform service');
  }

  async createService(
    input: Omit<PlatformServiceRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<PlatformServiceRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p9_services (
         id, service_code, service_slug, display_name, description, category, service_type,
         lifecycle_status, observation_status, business_criticality, technical_criticality,
         environment, region, deployment_profile, runtime_technology, current_version,
         service_owner_id, technical_owner_id, operational_team, support_group,
         escalation_policy_ref, health_check_ref, monitoring_config_ref, slo_ref, runbook_ref,
         rpo_minutes, rto_minutes, maintenance_policy_ref, data_classification,
         security_classification, support_hours, documentation_url, p7_resource_ref,
         p8_projection_note, metadata, created_by, version
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
         $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
         $28, $29, $30, $31, $32, $33, $34, COALESCE($35::jsonb, '{}'::jsonb), $36,
         COALESCE($37, 1)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.serviceCode,
        input.serviceSlug,
        input.displayName,
        input.description,
        input.category,
        input.serviceType,
        input.lifecycleStatus,
        input.observationStatus,
        input.businessCriticality,
        input.technicalCriticality,
        input.environment,
        input.region,
        input.deploymentProfile,
        input.runtimeTechnology,
        input.currentVersion,
        input.serviceOwnerId,
        input.technicalOwnerId,
        input.operationalTeam,
        input.supportGroup,
        input.escalationPolicyRef,
        input.healthCheckRef,
        input.monitoringConfigRef,
        input.sloRef,
        input.runbookRef,
        input.rpoMinutes,
        input.rtoMinutes,
        input.maintenancePolicyRef,
        input.dataClassification,
        input.securityClassification,
        input.supportHours,
        input.documentationUrl,
        input.p7ResourceRef,
        input.p8ProjectionNote,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
        input.version ?? 1,
      ],
      client,
    );
    return this.mapService(rows[0]!);
  }

  async getById(id: string): Promise<PlatformServiceRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p9_services WHERE id = $1`, [id]);
    return rows[0] ? this.mapService(rows[0]) : null;
  }

  async getByCode(serviceCode: string): Promise<PlatformServiceRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p9_services WHERE service_code = $1`, [
      serviceCode,
    ]);
    return rows[0] ? this.mapService(rows[0]) : null;
  }

  async search(
    filter: ServiceCatalogSearchFilter,
  ): Promise<{ items: PlatformServiceRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];

    if (filter.q?.trim()) {
      params.push(`%${filter.q.trim()}%`);
      where.push(
        `(display_name ILIKE $${params.length} OR service_code ILIKE $${params.length} OR service_slug ILIKE $${params.length})`,
      );
    }
    if (filter.category) {
      params.push(filter.category);
      where.push(`category = $${params.length}`);
    }
    if (filter.lifecycleStatus) {
      params.push(filter.lifecycleStatus);
      where.push(`lifecycle_status = $${params.length}`);
    }
    if (filter.observationStatus) {
      params.push(filter.observationStatus);
      where.push(`observation_status = $${params.length}`);
    }
    if (filter.environment) {
      params.push(filter.environment);
      where.push(`environment = $${params.length}`);
    }
    if (filter.region) {
      params.push(filter.region);
      where.push(`region = $${params.length}`);
    }
    if (filter.operationalTeam) {
      params.push(filter.operationalTeam);
      where.push(`operational_team = $${params.length}`);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p9_services ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p9_services ${clause}
       ORDER BY display_name ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapService(r)), total: num(countRows[0]?.c) };
  }

  async updateService(
    id: string,
    patch: Partial<PlatformServiceRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<PlatformServiceRecord> {
    const rows = await this.q(
      `UPDATE edge_p9_services SET
         display_name = COALESCE($3, display_name),
         description = COALESCE($4, description),
         category = COALESCE($5, category),
         service_type = COALESCE($6, service_type),
         lifecycle_status = COALESCE($7, lifecycle_status),
         observation_status = COALESCE($8, observation_status),
         business_criticality = COALESCE($9, business_criticality),
         technical_criticality = COALESCE($10, technical_criticality),
         environment = COALESCE($11, environment),
         region = COALESCE($12, region),
         deployment_profile = COALESCE($13, deployment_profile),
         runtime_technology = COALESCE($14, runtime_technology),
         current_version = COALESCE($15, current_version),
         service_owner_id = COALESCE($16, service_owner_id),
         technical_owner_id = COALESCE($17, technical_owner_id),
         operational_team = COALESCE($18, operational_team),
         support_group = COALESCE($19, support_group),
         escalation_policy_ref = COALESCE($20, escalation_policy_ref),
         health_check_ref = COALESCE($21, health_check_ref),
         monitoring_config_ref = COALESCE($22, monitoring_config_ref),
         slo_ref = COALESCE($23, slo_ref),
         runbook_ref = COALESCE($24, runbook_ref),
         rpo_minutes = COALESCE($25, rpo_minutes),
         rto_minutes = COALESCE($26, rto_minutes),
         maintenance_policy_ref = COALESCE($27, maintenance_policy_ref),
         data_classification = COALESCE($28, data_classification),
         security_classification = COALESCE($29, security_classification),
         support_hours = COALESCE($30, support_hours),
         documentation_url = COALESCE($31, documentation_url),
         p7_resource_ref = COALESCE($32, p7_resource_ref),
         p8_projection_note = COALESCE($33, p8_projection_note),
         metadata = COALESCE($34::jsonb, metadata),
         version = version + 1,
         updated_by = $35,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.displayName ?? null,
        patch.description === undefined ? null : patch.description,
        patch.category ?? null,
        patch.serviceType ?? null,
        patch.lifecycleStatus ?? null,
        patch.observationStatus ?? null,
        patch.businessCriticality ?? null,
        patch.technicalCriticality ?? null,
        patch.environment ?? null,
        patch.region === undefined ? null : patch.region,
        patch.deploymentProfile === undefined ? null : patch.deploymentProfile,
        patch.runtimeTechnology === undefined ? null : patch.runtimeTechnology,
        patch.currentVersion === undefined ? null : patch.currentVersion,
        patch.serviceOwnerId === undefined ? null : patch.serviceOwnerId,
        patch.technicalOwnerId === undefined ? null : patch.technicalOwnerId,
        patch.operationalTeam === undefined ? null : patch.operationalTeam,
        patch.supportGroup === undefined ? null : patch.supportGroup,
        patch.escalationPolicyRef === undefined ? null : patch.escalationPolicyRef,
        patch.healthCheckRef === undefined ? null : patch.healthCheckRef,
        patch.monitoringConfigRef === undefined ? null : patch.monitoringConfigRef,
        patch.sloRef === undefined ? null : patch.sloRef,
        patch.runbookRef === undefined ? null : patch.runbookRef,
        patch.rpoMinutes === undefined ? null : patch.rpoMinutes,
        patch.rtoMinutes === undefined ? null : patch.rtoMinutes,
        patch.maintenancePolicyRef === undefined ? null : patch.maintenancePolicyRef,
        patch.dataClassification === undefined ? null : patch.dataClassification,
        patch.securityClassification === undefined ? null : patch.securityClassification,
        patch.supportHours === undefined ? null : patch.supportHours,
        patch.documentationUrl === undefined ? null : patch.documentationUrl,
        patch.p7ResourceRef === undefined ? null : patch.p7ResourceRef,
        patch.p8ProjectionNote === undefined ? null : patch.p8ProjectionNote,
        patch.metadata === undefined ? null : JSON.stringify(patch.metadata),
        actorId,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapService(rows[0]!);
  }

  async listDependencies(serviceId: string): Promise<ServiceDependencyRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p9_service_dependencies WHERE service_id = $1 ORDER BY created_at`,
      [serviceId],
    );
    return rows.map((r) => this.mapDep(r));
  }

  async listDependents(serviceId: string): Promise<ServiceDependencyRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p9_service_dependencies WHERE depends_on_service_id = $1 ORDER BY created_at`,
      [serviceId],
    );
    return rows.map((r) => this.mapDep(r));
  }

  async addDependency(
    input: Omit<ServiceDependencyRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ServiceDependencyRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p9_service_dependencies (
         id, service_id, depends_on_service_id, dependency_type, criticality, description, created_by
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7
       ) RETURNING *`,
      [
        input.id ?? null,
        input.serviceId,
        input.dependsOnServiceId,
        input.dependencyType,
        input.criticality,
        input.description,
        input.createdBy,
      ],
      client,
    );
    return this.mapDep(rows[0]!);
  }

  async removeDependency(
    serviceId: string,
    dependsOnServiceId: string,
    dependencyType: string,
    client?: unknown,
  ): Promise<void> {
    await this.q(
      `DELETE FROM edge_p9_service_dependencies
       WHERE service_id = $1 AND depends_on_service_id = $2 AND dependency_type = $3`,
      [serviceId, dependsOnServiceId, dependencyType],
      client,
    );
  }

  async appendActivity(
    input: {
      serviceId: string;
      eventType: string;
      action: string;
      actorId: string | null;
      outcome?: string;
      details?: Record<string, unknown>;
      correlationId?: string | null;
    },
    client?: unknown,
  ): Promise<void> {
    await this.q(
      `INSERT INTO edge_p9_service_activity (
         service_id, event_type, action, actor_id, outcome, details, correlation_id
       ) VALUES ($1, $2, $3, $4, $5, COALESCE($6::jsonb, '{}'::jsonb), $7)`,
      [
        input.serviceId,
        input.eventType,
        input.action,
        input.actorId,
        input.outcome ?? 'SUCCESS',
        JSON.stringify(input.details ?? {}),
        input.correlationId ?? null,
      ],
      client,
    );
  }
}

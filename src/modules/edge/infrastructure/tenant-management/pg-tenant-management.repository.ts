import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type { TenantManagementRepositoryPort } from '../../domain/tenant-management/tenant-management-repository.port.js';
import { coerceHealthOverallStatus } from '../../domain/tenant-management/tenant-management-policy.js';
import type {
  ActivityEventRecord,
  ApplicationRef,
  BulkOperationRecord,
  CommercialProjection,
  ConfigurationRef,
  ExceptionRecord,
  LegalHoldChangeRequestRecord,
  HealthSnapshotRecord,
  LifecycleRequestRecord,
  MigrationRequestRecord,
  RecoveryRequestRecord,
  ReconciliationFindingRecord,
  ReconciliationRunRecord,
  RiskAssessmentRecord,
  TechnicalResourceRef,
  TenantNoteRecord,
  TenantPortfolioMetrics,
  TenantRegistryRecord,
  TenantSearchFilter,
  TenantTagRecord,
  TerminationRequestRecord,
} from '../../domain/tenant-management/tenant-management.types.js';
import { HealthStatus } from '../../domain/tenant-management/tenant-management.types.js';

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
function asBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 't' || v === 'true' || v === 1) return true;
  if (v === 'f' || v === 'false' || v === 0) return false;
  return fallback;
}

const SEARCH_SORT_COLUMNS: Record<string, string> = {
  created_at: 'created_at',
  display_name: 'display_name',
  administrative_status: 'administrative_status',
  technical_status: 'technical_status',
  region: 'region',
  updated_at: 'updated_at',
};

const PROVISIONING_TECHNICAL_STATUSES = [
  'NOT_PROVISIONED',
  'PROVISIONING',
  'CONFIGURING',
  'DEPLOYING',
  'READINESS_PENDING',
] as const;

const OPEN_FINDING_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'REMEDIATING'] as const;

/**
 * P8 PostgreSQL repository — migration 108.
 */
@Injectable()
export class PgTenantManagementRepository implements TenantManagementRepositoryPort {
  constructor(private readonly cpDb: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.cpDb.getPool();
  }

  private async q<T extends Row = Row>(sql: string, params: unknown[] = [], client?: unknown) {
    const executor = client ? (client as PoolClient) : this.pool;
    return (await executor.query(sql, params)).rows as T[];
  }

  private conflict(): never {
    throw new DomainError(ErrorCode.CONFLICT, 'Optimistic lock conflict on tenant management resource');
  }

  private notFound(label = 'Tenant management resource'): never {
    throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, `${label} not found`);
  }

  private rethrow(err: unknown, message: string, collisionCode = 'TENANT_MANAGEMENT_COLLISION'): never {
    const code = (err as { code?: string } | null)?.code;
    if (code === '23505') {
      throw new DomainError(ErrorCode.CONFLICT, message, [{ code: collisionCode }]);
    }
    if (code === '40001') this.conflict();
    throw err;
  }

  private mapTenant(row: Row): TenantRegistryRecord {
    return {
      id: str(row.id),
      productTenantId: str(row.product_tenant_id),
      tenantCode: str(row.tenant_code),
      tenantSlug: str(row.tenant_slug),
      displayName: str(row.display_name),
      legalNameRef: strOrNull(row.legal_name_ref),
      productId: str(row.product_id),
      productCode: strOrNull(row.product_code),
      accountId: strOrNull(row.account_id),
      subscriptionId: strOrNull(row.subscription_id),
      classification: str(row.classification),
      segment: strOrNull(row.segment),
      deploymentProfile: strOrNull(row.deployment_profile),
      environmentClassification: str(row.environment_classification),
      region: strOrNull(row.region),
      administrativeStatus: str(row.administrative_status),
      technicalStatus: str(row.technical_status),
      governanceStatus: str(row.governance_status),
      healthStatus: str(row.health_status),
      riskLevel: str(row.risk_level),
      platformTenantRef: strOrNull(row.platform_tenant_ref),
      provisioningRequestId: strOrNull(row.provisioning_request_id),
      activationRecordId: strOrNull(row.activation_record_id),
      lifecycleRecordId: strOrNull(row.lifecycle_record_id),
      internalOwnerId: strOrNull(row.internal_owner_id),
      operationalTeam: strOrNull(row.operational_team),
      supportClassification: strOrNull(row.support_classification),
      locale: strOrNull(row.locale),
      timezone: strOrNull(row.timezone),
      defaultLanguage: strOrNull(row.default_language),
      dataResidencyRef: strOrNull(row.data_residency_ref),
      retentionPolicyRef: strOrNull(row.retention_policy_ref),
      securityPolicyRef: strOrNull(row.security_policy_ref),
      legalHold: asBool(row.legal_hold, false),
      deletionProtection: asBool(row.deletion_protection, true),
      lastAdminActivityAt: asDateOrNull(row.last_admin_activity_at),
      lastSyncedAt: asDateOrNull(row.last_synced_at),
      technicalObservedAt: asDateOrNull(row.technical_observed_at),
      healthObservedAt: asDateOrNull(row.health_observed_at),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapTag(row: Row): TenantTagRecord {
    return {
      id: str(row.id),
      tenantRegistryId: str(row.tenant_registry_id),
      tagKey: str(row.tag_key),
      tagValue: str(row.tag_value),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
    };
  }

  private mapNote(row: Row): TenantNoteRecord {
    return {
      id: str(row.id),
      tenantRegistryId: str(row.tenant_registry_id),
      noteType: str(row.note_type),
      body: str(row.body),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapLifecycleRequest(row: Row): LifecycleRequestRecord {
    return {
      id: str(row.id),
      tenantRegistryId: str(row.tenant_registry_id),
      productTenantId: str(row.product_tenant_id),
      requestType: str(row.request_type),
      status: str(row.status),
      justification: str(row.justification),
      riskAssessment: strOrNull(row.risk_assessment),
      requestedBy: str(row.requested_by),
      approverId: strOrNull(row.approver_id),
      approvedAt: asDateOrNull(row.approved_at),
      rejectedReason: strOrNull(row.rejected_reason),
      p7WorkflowId: strOrNull(row.p7_workflow_id),
      p7LifecycleRecordId: strOrNull(row.p7_lifecycle_record_id),
      p5SubscriptionId: strOrNull(row.p5_subscription_id),
      correlationId: strOrNull(row.correlation_id),
      idempotencyKey: str(row.idempotency_key),
      evidence: asJson(row.evidence, {}),
      result: asJson(row.result, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapLegalHoldChangeRequest(row: Row): LegalHoldChangeRequestRecord {
    return {
      id: str(row.id),
      tenantRegistryId: str(row.tenant_registry_id),
      action: str(row.action),
      status: str(row.status),
      justification: str(row.justification),
      requestedBy: str(row.requested_by),
      approverId: strOrNull(row.approver_id),
      approvedAt: asDateOrNull(row.approved_at),
      rejectedReason: strOrNull(row.rejected_reason),
      correlationId: strOrNull(row.correlation_id),
      idempotencyKey: str(row.idempotency_key),
      version: num(row.version),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapException(row: Row): ExceptionRecord {
    return {
      id: str(row.id),
      tenantRegistryId: str(row.tenant_registry_id),
      productTenantId: str(row.product_tenant_id),
      exceptionType: str(row.exception_type),
      status: str(row.status),
      description: str(row.description),
      businessJustification: str(row.business_justification),
      riskAssessment: strOrNull(row.risk_assessment),
      scope: asJson(row.scope, {}),
      conditions: asJson(row.conditions, {}),
      evidence: asJson(row.evidence, {}),
      requesterId: str(row.requester_id),
      approverId: strOrNull(row.approver_id),
      startsAt: asDate(row.starts_at),
      expiresAt: asDate(row.expires_at),
      approvedAt: asDateOrNull(row.approved_at),
      revokedAt: asDateOrNull(row.revoked_at),
      revokeReason: strOrNull(row.revoke_reason),
      correlationId: strOrNull(row.correlation_id),
      idempotencyKey: str(row.idempotency_key),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapMigrationRequest(row: Row): MigrationRequestRecord {
    return {
      id: str(row.id),
      tenantRegistryId: str(row.tenant_registry_id),
      productTenantId: str(row.product_tenant_id),
      migrationType: str(row.migration_type),
      status: str(row.status),
      justification: str(row.justification),
      impactAssessment: strOrNull(row.impact_assessment),
      compatibilityAssessment: strOrNull(row.compatibility_assessment),
      dataResidencyReview: strOrNull(row.data_residency_review),
      downtimeAssessment: strOrNull(row.downtime_assessment),
      targetRef: asJson(row.target_ref, {}),
      scheduleAt: asDateOrNull(row.schedule_at),
      requestedBy: str(row.requested_by),
      approverId: strOrNull(row.approver_id),
      approvedAt: asDateOrNull(row.approved_at),
      p7WorkflowId: strOrNull(row.p7_workflow_id),
      evidence: asJson(row.evidence, {}),
      result: asJson(row.result, {}),
      correlationId: strOrNull(row.correlation_id),
      idempotencyKey: str(row.idempotency_key),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapRecoveryRequest(row: Row): RecoveryRequestRecord {
    return {
      id: str(row.id),
      tenantRegistryId: str(row.tenant_registry_id),
      productTenantId: str(row.product_tenant_id),
      recoveryType: str(row.recovery_type),
      status: str(row.status),
      priority: str(row.priority),
      scope: asJson(row.scope, {}),
      backupRef: strOrNull(row.backup_ref),
      restorePointRef: strOrNull(row.restore_point_ref),
      justification: str(row.justification),
      rpoAssessment: strOrNull(row.rpo_assessment),
      rtoMeasurement: strOrNull(row.rto_measurement),
      requestedBy: str(row.requested_by),
      approverId: strOrNull(row.approver_id),
      approvedAt: asDateOrNull(row.approved_at),
      p7WorkflowId: strOrNull(row.p7_workflow_id),
      evidence: asJson(row.evidence, {}),
      result: asJson(row.result, {}),
      correlationId: strOrNull(row.correlation_id),
      idempotencyKey: str(row.idempotency_key),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapTerminationRequest(row: Row): TerminationRequestRecord {
    return {
      id: str(row.id),
      tenantRegistryId: str(row.tenant_registry_id),
      productTenantId: str(row.product_tenant_id),
      status: str(row.status),
      justification: str(row.justification),
      contractualCheck: asJson(row.contractual_check, {}),
      financialCheck: asJson(row.financial_check, {}),
      retentionEvaluation: asJson(row.retention_evaluation, {}),
      legalHold: Boolean(row.legal_hold),
      dataExportRef: strOrNull(row.data_export_ref),
      graceUntil: asDateOrNull(row.grace_until),
      requestedBy: str(row.requested_by),
      approverId: strOrNull(row.approver_id),
      approvedAt: asDateOrNull(row.approved_at),
      p7WorkflowId: strOrNull(row.p7_workflow_id),
      evidence: asJson(row.evidence, {}),
      result: asJson(row.result, {}),
      correlationId: strOrNull(row.correlation_id),
      idempotencyKey: str(row.idempotency_key),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapReconciliationRun(row: Row): ReconciliationRunRecord {
    return {
      id: str(row.id),
      mode: str(row.mode),
      status: str(row.status),
      scope: asJson(row.scope, {}),
      summary: asJson(row.summary, {}),
      startedBy: str(row.started_by),
      startedAt: asDate(row.started_at),
      finishedAt: asDateOrNull(row.finished_at),
      correlationId: strOrNull(row.correlation_id),
      createdAt: asDate(row.created_at),
    };
  }

  private mapFinding(row: Row): ReconciliationFindingRecord {
    return {
      id: str(row.id),
      runId: str(row.run_id),
      tenantRegistryId: strOrNull(row.tenant_registry_id),
      productTenantId: strOrNull(row.product_tenant_id),
      findingType: str(row.finding_type),
      severity: str(row.severity),
      status: str(row.status),
      description: str(row.description),
      recommendedAction: strOrNull(row.recommended_action),
      evidence: asJson(row.evidence, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapActivity(row: Row): ActivityEventRecord {
    return {
      id: str(row.id),
      tenantRegistryId: strOrNull(row.tenant_registry_id),
      productTenantId: strOrNull(row.product_tenant_id),
      eventType: str(row.event_type),
      action: str(row.action),
      actorId: strOrNull(row.actor_id),
      actorType: str(row.actor_type),
      source: str(row.source),
      outcome: str(row.outcome),
      reason: strOrNull(row.reason),
      correlationId: strOrNull(row.correlation_id),
      causationId: strOrNull(row.causation_id),
      beforeRef: row.before_ref == null ? null : asJson(row.before_ref, {}),
      afterRef: row.after_ref == null ? null : asJson(row.after_ref, {}),
      evidenceRef: strOrNull(row.evidence_ref),
      details: asJson(row.details, {}),
      createdAt: asDate(row.created_at),
    };
  }

  private tenantInsertValues(
    input: Omit<TenantRegistryRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
  ): unknown[] {
    return [
      input.id ?? null,
      input.productTenantId,
      input.tenantCode,
      input.tenantSlug,
      input.displayName,
      input.legalNameRef,
      input.productId,
      input.productCode,
      input.accountId,
      input.subscriptionId,
      input.classification,
      input.segment,
      input.deploymentProfile,
      input.environmentClassification,
      input.region,
      input.administrativeStatus,
      input.technicalStatus,
      input.governanceStatus,
      input.healthStatus,
      input.riskLevel,
      input.platformTenantRef,
      input.provisioningRequestId,
      input.activationRecordId,
      input.lifecycleRecordId,
      input.internalOwnerId,
      input.operationalTeam,
      input.supportClassification,
      input.locale,
      input.timezone,
      input.defaultLanguage,
      input.dataResidencyRef,
      input.retentionPolicyRef,
      input.securityPolicyRef,
      input.legalHold ?? false,
      input.deletionProtection ?? true,
      input.lastAdminActivityAt,
      input.lastSyncedAt,
      input.technicalObservedAt,
      input.healthObservedAt,
      JSON.stringify(input.metadata ?? {}),
      input.createdBy,
      input.updatedBy,
      input.version ?? 1,
    ];
  }

  private readonly tenantInsertSql = `INSERT INTO edge_p8_tenants (
    id, product_tenant_id, tenant_code, tenant_slug, display_name, legal_name_ref,
    product_id, product_code, account_id, subscription_id, classification, segment,
    deployment_profile, environment_classification, region, administrative_status,
    technical_status, governance_status, health_status, risk_level, platform_tenant_ref,
    provisioning_request_id, activation_record_id, lifecycle_record_id, internal_owner_id,
    operational_team, support_classification, locale, timezone, default_language,
    data_residency_ref, retention_policy_ref, security_policy_ref, legal_hold, deletion_protection,
    last_admin_activity_at, last_synced_at, technical_observed_at, health_observed_at,
    metadata, created_by, updated_by, version
  ) VALUES (
    COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
    $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33,
    $34, $35, $36, $37, $38, $39, $40::jsonb, $41, $42, COALESCE($43, 1)
  )`;

  async registerTenant(
    input: Omit<TenantRegistryRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<TenantRegistryRecord> {
    try {
      const rows = await this.q(
        `${this.tenantInsertSql} RETURNING *`,
        this.tenantInsertValues(input),
        client,
      );
      return this.mapTenant(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Tenant registry row already exists for code, slug, or product tenant id');
    }
  }

  async upsertByProductTenantId(
    input: Omit<TenantRegistryRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<TenantRegistryRecord> {
    try {
      const rows = await this.q(
        `${this.tenantInsertSql}
         ON CONFLICT (product_tenant_id) DO UPDATE SET
           tenant_code = EXCLUDED.tenant_code,
           tenant_slug = EXCLUDED.tenant_slug,
           display_name = EXCLUDED.display_name,
           legal_name_ref = EXCLUDED.legal_name_ref,
           product_id = EXCLUDED.product_id,
           product_code = EXCLUDED.product_code,
           account_id = EXCLUDED.account_id,
           subscription_id = EXCLUDED.subscription_id,
           classification = EXCLUDED.classification,
           segment = EXCLUDED.segment,
           deployment_profile = EXCLUDED.deployment_profile,
           environment_classification = EXCLUDED.environment_classification,
           region = EXCLUDED.region,
           administrative_status = EXCLUDED.administrative_status,
           technical_status = EXCLUDED.technical_status,
           governance_status = EXCLUDED.governance_status,
           health_status = EXCLUDED.health_status,
           risk_level = EXCLUDED.risk_level,
           platform_tenant_ref = EXCLUDED.platform_tenant_ref,
           provisioning_request_id = EXCLUDED.provisioning_request_id,
           activation_record_id = EXCLUDED.activation_record_id,
           lifecycle_record_id = EXCLUDED.lifecycle_record_id,
           internal_owner_id = EXCLUDED.internal_owner_id,
           operational_team = EXCLUDED.operational_team,
           support_classification = EXCLUDED.support_classification,
           locale = EXCLUDED.locale,
           timezone = EXCLUDED.timezone,
           default_language = EXCLUDED.default_language,
           data_residency_ref = EXCLUDED.data_residency_ref,
           retention_policy_ref = EXCLUDED.retention_policy_ref,
           security_policy_ref = EXCLUDED.security_policy_ref,
           legal_hold = EXCLUDED.legal_hold,
           deletion_protection = EXCLUDED.deletion_protection,
           last_admin_activity_at = EXCLUDED.last_admin_activity_at,
           last_synced_at = EXCLUDED.last_synced_at,
           technical_observed_at = EXCLUDED.technical_observed_at,
           health_observed_at = EXCLUDED.health_observed_at,
           metadata = EXCLUDED.metadata,
           updated_by = EXCLUDED.updated_by,
           version = edge_p8_tenants.version + 1,
           updated_at = NOW()
         RETURNING *`,
        this.tenantInsertValues(input),
        client,
      );
      return this.mapTenant(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Tenant registry upsert conflict on code or slug');
    }
  }

  async getById(id: string): Promise<TenantRegistryRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p8_tenants WHERE id = $1`, [id]);
    return rows[0] ? this.mapTenant(rows[0]) : null;
  }

  async getByProductTenantId(productTenantId: string): Promise<TenantRegistryRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p8_tenants WHERE product_tenant_id = $1`, [
      productTenantId,
    ]);
    return rows[0] ? this.mapTenant(rows[0]) : null;
  }

  async getByCode(tenantCode: string): Promise<TenantRegistryRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p8_tenants WHERE tenant_code = $1`, [tenantCode]);
    return rows[0] ? this.mapTenant(rows[0]) : null;
  }

  async search(
    filter: TenantSearchFilter,
  ): Promise<{ items: TenantRegistryRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];

    if (filter.q?.trim()) {
      params.push(`%${filter.q.trim()}%`);
      where.push(
        `(display_name ILIKE $${params.length}
          OR tenant_code ILIKE $${params.length}
          OR tenant_slug ILIKE $${params.length}
          OR product_tenant_id::text ILIKE $${params.length})`,
      );
    }
    if (filter.productId) {
      params.push(filter.productId);
      where.push(`product_id = $${params.length}`);
    }
    if (filter.accountId) {
      params.push(filter.accountId);
      where.push(`account_id = $${params.length}`);
    }
    if (filter.subscriptionId) {
      params.push(filter.subscriptionId);
      where.push(`subscription_id = $${params.length}`);
    }
    if (filter.region) {
      params.push(filter.region);
      where.push(`region = $${params.length}`);
    }
    if (filter.classification) {
      params.push(filter.classification);
      where.push(`classification = $${params.length}`);
    }
    if (filter.administrativeStatus) {
      params.push(filter.administrativeStatus);
      where.push(`administrative_status = $${params.length}`);
    }
    if (filter.technicalStatus) {
      params.push(filter.technicalStatus);
      where.push(`technical_status = $${params.length}`);
    }
    if (filter.governanceStatus) {
      params.push(filter.governanceStatus);
      where.push(`governance_status = $${params.length}`);
    }
    if (filter.healthStatus) {
      params.push(filter.healthStatus);
      where.push(`health_status = $${params.length}`);
    }
    if (filter.riskLevel) {
      params.push(filter.riskLevel);
      where.push(`risk_level = $${params.length}`);
    }
    if (filter.tagKey) {
      params.push(filter.tagKey);
      const tagKeyParam = params.length;
      if (filter.tagValue) {
        params.push(filter.tagValue);
        where.push(
          `EXISTS (
             SELECT 1 FROM edge_p8_tenant_tags tt
             WHERE tt.tenant_registry_id = edge_p8_tenants.id
               AND tt.tag_key = $${tagKeyParam}
               AND tt.tag_value = $${params.length}
           )`,
        );
      } else {
        where.push(
          `EXISTS (
             SELECT 1 FROM edge_p8_tenant_tags tt
             WHERE tt.tenant_registry_id = edge_p8_tenants.id
               AND tt.tag_key = $${tagKeyParam}
           )`,
        );
      }
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sortCol = SEARCH_SORT_COLUMNS[filter.sortBy ?? 'created_at'] ?? 'created_at';
    const sortDir = filter.sortDir === 'asc' ? 'ASC' : 'DESC';

    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p8_tenants ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p8_tenants ${clause}
       ORDER BY ${sortCol} ${sortDir} NULLS LAST
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapTenant(r)), total: num(countRows[0]?.c) };
  }

  async updateTenant(
    id: string,
    patch: Partial<TenantRegistryRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<TenantRegistryRecord> {
    const rows = await this.q(
      `UPDATE edge_p8_tenants SET
         tenant_code = COALESCE($3, tenant_code),
         tenant_slug = COALESCE($4, tenant_slug),
         display_name = COALESCE($5, display_name),
         legal_name_ref = COALESCE($6, legal_name_ref),
         product_code = COALESCE($7, product_code),
         account_id = COALESCE($8, account_id),
         subscription_id = COALESCE($9, subscription_id),
         classification = COALESCE($10, classification),
         segment = COALESCE($11, segment),
         deployment_profile = COALESCE($12, deployment_profile),
         environment_classification = COALESCE($13, environment_classification),
         region = COALESCE($14, region),
         administrative_status = COALESCE($15, administrative_status),
         technical_status = COALESCE($16, technical_status),
         governance_status = COALESCE($17, governance_status),
         health_status = COALESCE($18, health_status),
         risk_level = COALESCE($19, risk_level),
         platform_tenant_ref = COALESCE($20, platform_tenant_ref),
         provisioning_request_id = COALESCE($21, provisioning_request_id),
         activation_record_id = COALESCE($22, activation_record_id),
         lifecycle_record_id = COALESCE($23, lifecycle_record_id),
         internal_owner_id = COALESCE($24, internal_owner_id),
         operational_team = COALESCE($25, operational_team),
         support_classification = COALESCE($26, support_classification),
         locale = COALESCE($27, locale),
         timezone = COALESCE($28, timezone),
         default_language = COALESCE($29, default_language),
         data_residency_ref = COALESCE($30, data_residency_ref),
         retention_policy_ref = COALESCE($31, retention_policy_ref),
         security_policy_ref = COALESCE($32, security_policy_ref),
         legal_hold = COALESCE($33, legal_hold),
         deletion_protection = COALESCE($34, deletion_protection),
         last_admin_activity_at = COALESCE($35, last_admin_activity_at),
         last_synced_at = COALESCE($36, last_synced_at),
         technical_observed_at = COALESCE($37, technical_observed_at),
         health_observed_at = COALESCE($38, health_observed_at),
         metadata = COALESCE($39::jsonb, metadata),
         version = version + 1,
         updated_by = $40,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.tenantCode ?? null,
        patch.tenantSlug ?? null,
        patch.displayName ?? null,
        patch.legalNameRef === undefined ? null : patch.legalNameRef,
        patch.productCode === undefined ? null : patch.productCode,
        patch.accountId === undefined ? null : patch.accountId,
        patch.subscriptionId === undefined ? null : patch.subscriptionId,
        patch.classification ?? null,
        patch.segment === undefined ? null : patch.segment,
        patch.deploymentProfile === undefined ? null : patch.deploymentProfile,
        patch.environmentClassification ?? null,
        patch.region === undefined ? null : patch.region,
        patch.administrativeStatus ?? null,
        patch.technicalStatus ?? null,
        patch.governanceStatus ?? null,
        patch.healthStatus ?? null,
        patch.riskLevel ?? null,
        patch.platformTenantRef === undefined ? null : patch.platformTenantRef,
        patch.provisioningRequestId === undefined ? null : patch.provisioningRequestId,
        patch.activationRecordId === undefined ? null : patch.activationRecordId,
        patch.lifecycleRecordId === undefined ? null : patch.lifecycleRecordId,
        patch.internalOwnerId === undefined ? null : patch.internalOwnerId,
        patch.operationalTeam === undefined ? null : patch.operationalTeam,
        patch.supportClassification === undefined ? null : patch.supportClassification,
        patch.locale === undefined ? null : patch.locale,
        patch.timezone === undefined ? null : patch.timezone,
        patch.defaultLanguage === undefined ? null : patch.defaultLanguage,
        patch.dataResidencyRef === undefined ? null : patch.dataResidencyRef,
        patch.retentionPolicyRef === undefined ? null : patch.retentionPolicyRef,
        patch.securityPolicyRef === undefined ? null : patch.securityPolicyRef,
        patch.legalHold === undefined ? null : patch.legalHold,
        patch.deletionProtection === undefined ? null : patch.deletionProtection,
        patch.lastAdminActivityAt === undefined ? null : patch.lastAdminActivityAt,
        patch.lastSyncedAt === undefined ? null : patch.lastSyncedAt,
        patch.technicalObservedAt === undefined ? null : patch.technicalObservedAt,
        patch.healthObservedAt === undefined ? null : patch.healthObservedAt,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        actorId,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapTenant(rows[0]);
  }

  async listTags(tenantRegistryId: string): Promise<TenantTagRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p8_tenant_tags
       WHERE tenant_registry_id = $1 ORDER BY tag_key, tag_value`,
      [tenantRegistryId],
    );
    return rows.map((r) => this.mapTag(r));
  }

  async addTag(
    input: Omit<TenantTagRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<TenantTagRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p8_tenant_tags (
           id, tenant_registry_id, tag_key, tag_value, created_by
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5
         ) RETURNING *`,
        [input.id ?? null, input.tenantRegistryId, input.tagKey, input.tagValue, input.createdBy],
        client,
      );
      return this.mapTag(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Tenant tag already exists');
    }
  }

  async removeTag(
    tenantRegistryId: string,
    tagKey: string,
    tagValue: string,
    client?: unknown,
  ): Promise<void> {
    await this.q(
      `DELETE FROM edge_p8_tenant_tags
       WHERE tenant_registry_id = $1 AND tag_key = $2 AND tag_value = $3`,
      [tenantRegistryId, tagKey, tagValue],
      client,
    );
  }

  async listNotes(tenantRegistryId: string, limit = 50): Promise<TenantNoteRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p8_tenant_notes
       WHERE tenant_registry_id = $1 ORDER BY created_at DESC
       LIMIT $2`,
      [tenantRegistryId, Math.min(Math.max(limit, 1), 200)],
    );
    return rows.map((r) => this.mapNote(r));
  }

  async addNote(
    input: Omit<TenantNoteRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<TenantNoteRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p8_tenant_notes (
         id, tenant_registry_id, note_type, body, created_by
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5
       ) RETURNING *`,
      [
        input.id ?? null,
        input.tenantRegistryId,
        input.noteType,
        input.body,
        input.createdBy,
      ],
      client,
    );
    return this.mapNote(rows[0]!);
  }

  async createLifecycleRequest(
    input: Omit<LifecycleRequestRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<LifecycleRequestRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p8_lifecycle_requests (
           id, tenant_registry_id, product_tenant_id, request_type, status,
           justification, risk_assessment, requested_by, approver_id, approved_at,
           rejected_reason, p7_workflow_id, p7_lifecycle_record_id, p5_subscription_id,
           correlation_id, idempotency_key, evidence, result, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10,
           $11, $12, $13, $14, $15, $16, $17::jsonb, $18::jsonb, COALESCE($19, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.tenantRegistryId,
          input.productTenantId,
          input.requestType,
          input.status,
          input.justification,
          input.riskAssessment,
          input.requestedBy,
          input.approverId,
          input.approvedAt,
          input.rejectedReason,
          input.p7WorkflowId,
          input.p7LifecycleRecordId,
          input.p5SubscriptionId,
          input.correlationId,
          input.idempotencyKey,
          JSON.stringify(input.evidence ?? {}),
          JSON.stringify(input.result ?? {}),
          input.version ?? 1,
        ],
        client,
      );
      return this.mapLifecycleRequest(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Lifecycle request idempotency collision');
    }
  }

  async getLifecycleRequest(id: string): Promise<LifecycleRequestRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p8_lifecycle_requests WHERE id = $1`, [id]);
    return rows[0] ? this.mapLifecycleRequest(rows[0]) : null;
  }

  async getLifecycleRequestByIdempotency(key: string): Promise<LifecycleRequestRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p8_lifecycle_requests WHERE idempotency_key = $1`, [
      key,
    ]);
    return rows[0] ? this.mapLifecycleRequest(rows[0]) : null;
  }

  async listLifecycleRequests(filter: {
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: LifecycleRequestRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.tenantRegistryId) {
      params.push(filter.tenantRegistryId);
      where.push(`tenant_registry_id = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p8_lifecycle_requests ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p8_lifecycle_requests ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapLifecycleRequest(r)), total: num(countRows[0]?.c) };
  }

  async updateLifecycleRequest(
    id: string,
    patch: Partial<LifecycleRequestRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<LifecycleRequestRecord> {
    const rows = await this.q(
      `UPDATE edge_p8_lifecycle_requests SET
         status = COALESCE($3, status),
         justification = COALESCE($4, justification),
         risk_assessment = COALESCE($5, risk_assessment),
         approver_id = COALESCE($6, approver_id),
         approved_at = COALESCE($7, approved_at),
         rejected_reason = COALESCE($8, rejected_reason),
         p7_workflow_id = COALESCE($9, p7_workflow_id),
         p7_lifecycle_record_id = COALESCE($10, p7_lifecycle_record_id),
         p5_subscription_id = COALESCE($11, p5_subscription_id),
         correlation_id = COALESCE($12, correlation_id),
         evidence = COALESCE($13::jsonb, evidence),
         result = COALESCE($14::jsonb, result),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.status ?? null,
        patch.justification ?? null,
        patch.riskAssessment === undefined ? null : patch.riskAssessment,
        patch.approverId === undefined ? null : patch.approverId,
        patch.approvedAt === undefined ? null : patch.approvedAt,
        patch.rejectedReason === undefined ? null : patch.rejectedReason,
        patch.p7WorkflowId === undefined ? null : patch.p7WorkflowId,
        patch.p7LifecycleRecordId === undefined ? null : patch.p7LifecycleRecordId,
        patch.p5SubscriptionId === undefined ? null : patch.p5SubscriptionId,
        patch.correlationId === undefined ? null : patch.correlationId,
        patch.evidence ? JSON.stringify(patch.evidence) : null,
        patch.result ? JSON.stringify(patch.result) : null,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapLifecycleRequest(rows[0]);
  }

  async createException(
    input: Omit<ExceptionRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<ExceptionRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p8_exceptions (
           id, tenant_registry_id, product_tenant_id, exception_type, status,
           description, business_justification, risk_assessment, scope, conditions,
           evidence, requester_id, approver_id, starts_at, expires_at, approved_at,
           revoked_at, revoke_reason, correlation_id, idempotency_key, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb,
           $11::jsonb, $12, $13, $14, $15, $16, $17, $18, $19, $20, COALESCE($21, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.tenantRegistryId,
          input.productTenantId,
          input.exceptionType,
          input.status,
          input.description,
          input.businessJustification,
          input.riskAssessment,
          JSON.stringify(input.scope ?? {}),
          JSON.stringify(input.conditions ?? {}),
          JSON.stringify(input.evidence ?? {}),
          input.requesterId,
          input.approverId,
          input.startsAt,
          input.expiresAt,
          input.approvedAt,
          input.revokedAt,
          input.revokeReason,
          input.correlationId,
          input.idempotencyKey,
          input.version ?? 1,
        ],
        client,
      );
      return this.mapException(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Exception idempotency collision');
    }
  }

  async getException(id: string): Promise<ExceptionRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p8_exceptions WHERE id = $1`, [id]);
    return rows[0] ? this.mapException(rows[0]) : null;
  }

  async getExceptionByIdempotency(key: string): Promise<ExceptionRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p8_exceptions WHERE idempotency_key = $1`, [key]);
    return rows[0] ? this.mapException(rows[0]) : null;
  }

  async listExceptions(filter: {
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ExceptionRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.tenantRegistryId) {
      params.push(filter.tenantRegistryId);
      where.push(`tenant_registry_id = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(`SELECT COUNT(*)::int AS c FROM edge_p8_exceptions ${clause}`, params);
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p8_exceptions ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapException(r)), total: num(countRows[0]?.c) };
  }

  async updateException(
    id: string,
    patch: Partial<ExceptionRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<ExceptionRecord> {
    const rows = await this.q(
      `UPDATE edge_p8_exceptions SET
         status = COALESCE($3, status),
         description = COALESCE($4, description),
         business_justification = COALESCE($5, business_justification),
         risk_assessment = COALESCE($6, risk_assessment),
         scope = COALESCE($7::jsonb, scope),
         conditions = COALESCE($8::jsonb, conditions),
         evidence = COALESCE($9::jsonb, evidence),
         approver_id = COALESCE($10, approver_id),
         starts_at = COALESCE($11, starts_at),
         expires_at = COALESCE($12, expires_at),
         approved_at = COALESCE($13, approved_at),
         revoked_at = COALESCE($14, revoked_at),
         revoke_reason = COALESCE($15, revoke_reason),
         correlation_id = COALESCE($16, correlation_id),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.status ?? null,
        patch.description ?? null,
        patch.businessJustification ?? null,
        patch.riskAssessment === undefined ? null : patch.riskAssessment,
        patch.scope ? JSON.stringify(patch.scope) : null,
        patch.conditions ? JSON.stringify(patch.conditions) : null,
        patch.evidence ? JSON.stringify(patch.evidence) : null,
        patch.approverId === undefined ? null : patch.approverId,
        patch.startsAt === undefined ? null : patch.startsAt,
        patch.expiresAt === undefined ? null : patch.expiresAt,
        patch.approvedAt === undefined ? null : patch.approvedAt,
        patch.revokedAt === undefined ? null : patch.revokedAt,
        patch.revokeReason === undefined ? null : patch.revokeReason,
        patch.correlationId === undefined ? null : patch.correlationId,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapException(rows[0]);
  }

  async expireDueExceptions(now = new Date(), client?: unknown): Promise<number> {
    const rows = await this.q(
      `UPDATE edge_p8_exceptions SET
         status = 'EXPIRED',
         version = version + 1,
         updated_at = NOW()
       WHERE status IN ('APPROVED', 'ACTIVE') AND expires_at < $1
       RETURNING id`,
      [now],
      client,
    );
    return rows.length;
  }

  async createMigrationRequest(
    input: Omit<MigrationRequestRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<MigrationRequestRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p8_migration_requests (
           id, tenant_registry_id, product_tenant_id, migration_type, status,
           justification, impact_assessment, compatibility_assessment,
           data_residency_review, downtime_assessment, target_ref, schedule_at,
           requested_by, approver_id, approved_at, p7_workflow_id, evidence, result,
           correlation_id, idempotency_key, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10,
           $11::jsonb, $12, $13, $14, $15, $16, $17::jsonb, $18::jsonb, $19, $20,
           COALESCE($21, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.tenantRegistryId,
          input.productTenantId,
          input.migrationType,
          input.status,
          input.justification,
          input.impactAssessment,
          input.compatibilityAssessment,
          input.dataResidencyReview,
          input.downtimeAssessment,
          JSON.stringify(input.targetRef ?? {}),
          input.scheduleAt,
          input.requestedBy,
          input.approverId,
          input.approvedAt,
          input.p7WorkflowId,
          JSON.stringify(input.evidence ?? {}),
          JSON.stringify(input.result ?? {}),
          input.correlationId,
          input.idempotencyKey,
          input.version ?? 1,
        ],
        client,
      );
      return this.mapMigrationRequest(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Migration request idempotency collision');
    }
  }

  async getMigrationRequest(id: string): Promise<MigrationRequestRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p8_migration_requests WHERE id = $1`, [id]);
    return rows[0] ? this.mapMigrationRequest(rows[0]) : null;
  }

  async getMigrationByIdempotency(key: string): Promise<MigrationRequestRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p8_migration_requests WHERE idempotency_key = $1`,
      [key],
    );
    return rows[0] ? this.mapMigrationRequest(rows[0]) : null;
  }

  async listMigrationRequests(filter: {
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: MigrationRequestRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.tenantRegistryId) {
      params.push(filter.tenantRegistryId);
      where.push(`tenant_registry_id = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p8_migration_requests ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p8_migration_requests ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapMigrationRequest(r)), total: num(countRows[0]?.c) };
  }

  async updateMigrationRequest(
    id: string,
    patch: Partial<MigrationRequestRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<MigrationRequestRecord> {
    const rows = await this.q(
      `UPDATE edge_p8_migration_requests SET
         status = COALESCE($3, status),
         justification = COALESCE($4, justification),
         impact_assessment = COALESCE($5, impact_assessment),
         compatibility_assessment = COALESCE($6, compatibility_assessment),
         data_residency_review = COALESCE($7, data_residency_review),
         downtime_assessment = COALESCE($8, downtime_assessment),
         target_ref = COALESCE($9::jsonb, target_ref),
         schedule_at = COALESCE($10, schedule_at),
         approver_id = COALESCE($11, approver_id),
         approved_at = COALESCE($12, approved_at),
         p7_workflow_id = COALESCE($13, p7_workflow_id),
         evidence = COALESCE($14::jsonb, evidence),
         result = COALESCE($15::jsonb, result),
         correlation_id = COALESCE($16, correlation_id),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.status ?? null,
        patch.justification ?? null,
        patch.impactAssessment === undefined ? null : patch.impactAssessment,
        patch.compatibilityAssessment === undefined ? null : patch.compatibilityAssessment,
        patch.dataResidencyReview === undefined ? null : patch.dataResidencyReview,
        patch.downtimeAssessment === undefined ? null : patch.downtimeAssessment,
        patch.targetRef ? JSON.stringify(patch.targetRef) : null,
        patch.scheduleAt === undefined ? null : patch.scheduleAt,
        patch.approverId === undefined ? null : patch.approverId,
        patch.approvedAt === undefined ? null : patch.approvedAt,
        patch.p7WorkflowId === undefined ? null : patch.p7WorkflowId,
        patch.evidence ? JSON.stringify(patch.evidence) : null,
        patch.result ? JSON.stringify(patch.result) : null,
        patch.correlationId === undefined ? null : patch.correlationId,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapMigrationRequest(rows[0]);
  }

  async createRecoveryRequest(
    input: Omit<RecoveryRequestRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<RecoveryRequestRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p8_recovery_requests (
           id, tenant_registry_id, product_tenant_id, recovery_type, status, priority,
           scope, backup_ref, restore_point_ref, justification, rpo_assessment,
           rto_measurement, requested_by, approver_id, approved_at, p7_workflow_id,
           evidence, result, correlation_id, idempotency_key, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7::jsonb, $8, $9,
           $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18::jsonb, $19, $20,
           COALESCE($21, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.tenantRegistryId,
          input.productTenantId,
          input.recoveryType,
          input.status,
          input.priority,
          JSON.stringify(input.scope ?? {}),
          input.backupRef,
          input.restorePointRef,
          input.justification,
          input.rpoAssessment,
          input.rtoMeasurement,
          input.requestedBy,
          input.approverId,
          input.approvedAt,
          input.p7WorkflowId,
          JSON.stringify(input.evidence ?? {}),
          JSON.stringify(input.result ?? {}),
          input.correlationId,
          input.idempotencyKey,
          input.version ?? 1,
        ],
        client,
      );
      return this.mapRecoveryRequest(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Recovery request idempotency collision');
    }
  }

  async getRecoveryRequest(id: string): Promise<RecoveryRequestRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p8_recovery_requests WHERE id = $1`, [id]);
    return rows[0] ? this.mapRecoveryRequest(rows[0]) : null;
  }

  async getRecoveryByIdempotency(key: string): Promise<RecoveryRequestRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p8_recovery_requests WHERE idempotency_key = $1`, [
      key,
    ]);
    return rows[0] ? this.mapRecoveryRequest(rows[0]) : null;
  }

  async listRecoveryRequests(filter: {
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: RecoveryRequestRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.tenantRegistryId) {
      params.push(filter.tenantRegistryId);
      where.push(`tenant_registry_id = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p8_recovery_requests ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p8_recovery_requests ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapRecoveryRequest(r)), total: num(countRows[0]?.c) };
  }

  async updateRecoveryRequest(
    id: string,
    patch: Partial<RecoveryRequestRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<RecoveryRequestRecord> {
    const rows = await this.q(
      `UPDATE edge_p8_recovery_requests SET
         status = COALESCE($3, status),
         priority = COALESCE($4, priority),
         scope = COALESCE($5::jsonb, scope),
         backup_ref = COALESCE($6, backup_ref),
         restore_point_ref = COALESCE($7, restore_point_ref),
         justification = COALESCE($8, justification),
         rpo_assessment = COALESCE($9, rpo_assessment),
         rto_measurement = COALESCE($10, rto_measurement),
         approver_id = COALESCE($11, approver_id),
         approved_at = COALESCE($12, approved_at),
         p7_workflow_id = COALESCE($13, p7_workflow_id),
         evidence = COALESCE($14::jsonb, evidence),
         result = COALESCE($15::jsonb, result),
         correlation_id = COALESCE($16, correlation_id),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.status ?? null,
        patch.priority ?? null,
        patch.scope ? JSON.stringify(patch.scope) : null,
        patch.backupRef === undefined ? null : patch.backupRef,
        patch.restorePointRef === undefined ? null : patch.restorePointRef,
        patch.justification ?? null,
        patch.rpoAssessment === undefined ? null : patch.rpoAssessment,
        patch.rtoMeasurement === undefined ? null : patch.rtoMeasurement,
        patch.approverId === undefined ? null : patch.approverId,
        patch.approvedAt === undefined ? null : patch.approvedAt,
        patch.p7WorkflowId === undefined ? null : patch.p7WorkflowId,
        patch.evidence ? JSON.stringify(patch.evidence) : null,
        patch.result ? JSON.stringify(patch.result) : null,
        patch.correlationId === undefined ? null : patch.correlationId,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapRecoveryRequest(rows[0]);
  }

  async createTerminationRequest(
    input: Omit<TerminationRequestRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<TerminationRequestRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p8_termination_requests (
           id, tenant_registry_id, product_tenant_id, status, justification,
           contractual_check, financial_check, retention_evaluation, legal_hold,
           data_export_ref, grace_until, requested_by, approver_id, approved_at,
           p7_workflow_id, evidence, result, correlation_id, idempotency_key, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6::jsonb, $7::jsonb,
           $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb, $18, $19,
           COALESCE($20, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.tenantRegistryId,
          input.productTenantId,
          input.status,
          input.justification,
          JSON.stringify(input.contractualCheck ?? {}),
          JSON.stringify(input.financialCheck ?? {}),
          JSON.stringify(input.retentionEvaluation ?? {}),
          input.legalHold,
          input.dataExportRef,
          input.graceUntil,
          input.requestedBy,
          input.approverId,
          input.approvedAt,
          input.p7WorkflowId,
          JSON.stringify(input.evidence ?? {}),
          JSON.stringify(input.result ?? {}),
          input.correlationId,
          input.idempotencyKey,
          input.version ?? 1,
        ],
        client,
      );
      return this.mapTerminationRequest(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Termination request idempotency collision');
    }
  }

  async getTerminationRequest(id: string): Promise<TerminationRequestRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p8_termination_requests WHERE id = $1`, [id]);
    return rows[0] ? this.mapTerminationRequest(rows[0]) : null;
  }

  async getTerminationByIdempotency(key: string): Promise<TerminationRequestRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p8_termination_requests WHERE idempotency_key = $1`,
      [key],
    );
    return rows[0] ? this.mapTerminationRequest(rows[0]) : null;
  }

  async listTerminationRequests(filter: {
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: TerminationRequestRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.tenantRegistryId) {
      params.push(filter.tenantRegistryId);
      where.push(`tenant_registry_id = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p8_termination_requests ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p8_termination_requests ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapTerminationRequest(r)), total: num(countRows[0]?.c) };
  }

  async updateTerminationRequest(
    id: string,
    patch: Partial<TerminationRequestRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<TerminationRequestRecord> {
    const rows = await this.q(
      `UPDATE edge_p8_termination_requests SET
         status = COALESCE($3, status),
         justification = COALESCE($4, justification),
         contractual_check = COALESCE($5::jsonb, contractual_check),
         financial_check = COALESCE($6::jsonb, financial_check),
         retention_evaluation = COALESCE($7::jsonb, retention_evaluation),
         legal_hold = COALESCE($8, legal_hold),
         data_export_ref = COALESCE($9, data_export_ref),
         grace_until = COALESCE($10, grace_until),
         approver_id = COALESCE($11, approver_id),
         approved_at = COALESCE($12, approved_at),
         p7_workflow_id = COALESCE($13, p7_workflow_id),
         evidence = COALESCE($14::jsonb, evidence),
         result = COALESCE($15::jsonb, result),
         correlation_id = COALESCE($16, correlation_id),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.status ?? null,
        patch.justification ?? null,
        patch.contractualCheck ? JSON.stringify(patch.contractualCheck) : null,
        patch.financialCheck ? JSON.stringify(patch.financialCheck) : null,
        patch.retentionEvaluation ? JSON.stringify(patch.retentionEvaluation) : null,
        patch.legalHold === undefined ? null : patch.legalHold,
        patch.dataExportRef === undefined ? null : patch.dataExportRef,
        patch.graceUntil === undefined ? null : patch.graceUntil,
        patch.approverId === undefined ? null : patch.approverId,
        patch.approvedAt === undefined ? null : patch.approvedAt,
        patch.p7WorkflowId === undefined ? null : patch.p7WorkflowId,
        patch.evidence ? JSON.stringify(patch.evidence) : null,
        patch.result ? JSON.stringify(patch.result) : null,
        patch.correlationId === undefined ? null : patch.correlationId,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapTerminationRequest(rows[0]);
  }

  async createReconciliationRun(
    input: Omit<ReconciliationRunRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ReconciliationRunRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p8_reconciliation_runs (
         id, mode, status, scope, summary, started_by, started_at, finished_at, correlation_id
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9
       ) RETURNING *`,
      [
        input.id ?? null,
        input.mode,
        input.status,
        JSON.stringify(input.scope ?? {}),
        JSON.stringify(input.summary ?? {}),
        input.startedBy,
        input.startedAt,
        input.finishedAt,
        input.correlationId,
      ],
      client,
    );
    return this.mapReconciliationRun(rows[0]!);
  }

  async updateReconciliationRun(
    id: string,
    patch: Partial<ReconciliationRunRecord>,
    client?: unknown,
  ): Promise<ReconciliationRunRecord> {
    const rows = await this.q(
      `UPDATE edge_p8_reconciliation_runs SET
         mode = COALESCE($2, mode),
         status = COALESCE($3, status),
         scope = COALESCE($4::jsonb, scope),
         summary = COALESCE($5::jsonb, summary),
         finished_at = COALESCE($6, finished_at),
         correlation_id = COALESCE($7, correlation_id)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.mode ?? null,
        patch.status ?? null,
        patch.scope ? JSON.stringify(patch.scope) : null,
        patch.summary ? JSON.stringify(patch.summary) : null,
        patch.finishedAt === undefined ? null : patch.finishedAt,
        patch.correlationId === undefined ? null : patch.correlationId,
      ],
      client,
    );
    if (!rows[0]) this.notFound('Reconciliation run');
    return this.mapReconciliationRun(rows[0]);
  }

  async createFinding(
    input: Omit<ReconciliationFindingRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<ReconciliationFindingRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p8_reconciliation_findings (
         id, run_id, tenant_registry_id, product_tenant_id, finding_type, severity,
         status, description, recommended_action, evidence
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb
       ) RETURNING *`,
      [
        input.id ?? null,
        input.runId,
        input.tenantRegistryId,
        input.productTenantId,
        input.findingType,
        input.severity,
        input.status,
        input.description,
        input.recommendedAction,
        JSON.stringify(input.evidence ?? {}),
      ],
      client,
    );
    return this.mapFinding(rows[0]!);
  }

  async listFindings(filter: {
    runId?: string;
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ReconciliationFindingRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.runId) {
      params.push(filter.runId);
      where.push(`run_id = $${params.length}`);
    }
    if (filter.tenantRegistryId) {
      params.push(filter.tenantRegistryId);
      where.push(`tenant_registry_id = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p8_reconciliation_findings ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p8_reconciliation_findings ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapFinding(r)), total: num(countRows[0]?.c) };
  }

  async appendActivity(
    input: Omit<ActivityEventRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ActivityEventRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p8_activity_events (
         id, tenant_registry_id, product_tenant_id, event_type, action, actor_id, actor_type,
         source, outcome, reason, correlation_id, causation_id, before_ref, after_ref,
         evidence_ref, details
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
         $13::jsonb, $14::jsonb, $15, $16::jsonb
       ) RETURNING *`,
      [
        input.id ?? null,
        input.tenantRegistryId,
        input.productTenantId,
        input.eventType,
        input.action,
        input.actorId,
        input.actorType,
        input.source,
        input.outcome,
        input.reason,
        input.correlationId,
        input.causationId,
        input.beforeRef ? JSON.stringify(input.beforeRef) : null,
        input.afterRef ? JSON.stringify(input.afterRef) : null,
        input.evidenceRef,
        JSON.stringify(input.details ?? {}),
      ],
      client,
    );
    return this.mapActivity(rows[0]!);
  }

  async listActivity(filter: {
    tenantRegistryId?: string;
    productTenantId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ActivityEventRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.tenantRegistryId) {
      params.push(filter.tenantRegistryId);
      where.push(`tenant_registry_id = $${params.length}`);
    }
    if (filter.productTenantId) {
      params.push(filter.productTenantId);
      where.push(`product_tenant_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p8_activity_events ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p8_activity_events ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapActivity(r)), total: num(countRows[0]?.c) };
  }

  async portfolioMetrics(): Promise<TenantPortfolioMetrics> {
    const computedAt = new Date().toISOString();
    const provisioningList = PROVISIONING_TECHNICAL_STATUSES.map((s) => `'${s}'`).join(', ');
    const openFindingList = OPEN_FINDING_STATUSES.map((s) => `'${s}'`).join(', ');

    const summaryRows = await this.q<{
      total: number;
      active: number;
      provisioning: number;
      suspended: number;
      degraded: number;
      pending_review: number;
    }>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE administrative_status = 'ACTIVE')::int AS active,
         COUNT(*) FILTER (WHERE technical_status IN (${provisioningList}))::int AS provisioning,
         COUNT(*) FILTER (WHERE administrative_status = 'SUSPENDED')::int AS suspended,
         COUNT(*) FILTER (
           WHERE health_status IN ('DEGRADED','CRITICAL') OR technical_status = 'DEGRADED'
         )::int AS degraded,
         COUNT(*) FILTER (WHERE administrative_status = 'PENDING_REVIEW')::int AS pending_review
       FROM edge_p8_tenants`,
    );

    const exceptionRows = await this.q<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM edge_p8_exceptions WHERE status IN ('APPROVED','ACTIVE')`,
    );
    const findingRows = await this.q<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM edge_p8_reconciliation_findings
       WHERE status IN (${openFindingList})`,
    );

    const byProduct = await this.q<{ product_id: string; product_code: string | null; count: number }>(
      `SELECT product_id, MAX(product_code) AS product_code, COUNT(*)::int AS count
       FROM edge_p8_tenants
       GROUP BY product_id
       ORDER BY count DESC`,
    );
    const byRegion = await this.q<{ region: string; count: number }>(
      `SELECT COALESCE(region, 'UNKNOWN') AS region, COUNT(*)::int AS count
       FROM edge_p8_tenants
       GROUP BY COALESCE(region, 'UNKNOWN')
       ORDER BY count DESC`,
    );
    const byClassification = await this.q<{ classification: string; count: number }>(
      `SELECT classification, COUNT(*)::int AS count
       FROM edge_p8_tenants
       GROUP BY classification
       ORDER BY count DESC`,
    );
    const byAdministrativeStatus = await this.q<{ status: string; count: number }>(
      `SELECT administrative_status AS status, COUNT(*)::int AS count
       FROM edge_p8_tenants
       GROUP BY administrative_status
       ORDER BY count DESC`,
    );

    const summary = summaryRows[0];
    return {
      total: num(summary?.total),
      active: num(summary?.active),
      provisioning: num(summary?.provisioning),
      suspended: num(summary?.suspended),
      degraded: num(summary?.degraded),
      pendingReview: num(summary?.pending_review),
      exceptionsActive: num(exceptionRows[0]?.c),
      reconciliationOpen: num(findingRows[0]?.c),
      byProduct: byProduct.map((r) => ({
        productId: str(r.product_id),
        productCode: r.product_code == null ? null : str(r.product_code),
        count: num(r.count),
      })),
      byRegion: byRegion.map((r) => ({
        region: str(r.region),
        count: num(r.count),
      })),
      byClassification: byClassification.map((r) => ({
        classification: str(r.classification),
        count: num(r.count),
      })),
      byAdministrativeStatus: byAdministrativeStatus.map((r) => ({
        status: str(r.status),
        count: num(r.count),
      })),
      computedAt,
    };
  }

  async listDistinctProductTenantIdsFromP7(): Promise<
    Array<{
      productTenantId: string;
      productId: string | null;
      subscriptionId: string | null;
      accountId: string | null;
      lifecycleStatus: string | null;
      activationRecordId: string | null;
      lifecycleRecordId: string | null;
      provisioningRequestId: string | null;
    }>
  > {
    const rows = await this.q(
      `SELECT DISTINCT ON (product_tenant_id, product_id)
         product_tenant_id,
         product_id,
         subscription_id,
         account_id,
         lifecycle_status,
         activation_record_id,
         lifecycle_record_id,
         provisioning_request_id
       FROM (
         SELECT
           lr.tenant_id AS product_tenant_id,
           lr.product_id,
           lr.subscription_id,
           lr.account_id,
           lr.lifecycle_status,
           lr.activation_record_id,
           lr.id AS lifecycle_record_id,
           lr.provisioning_request_id,
           1 AS source_priority
         FROM edge_p7_tenant_lifecycle_records lr
         UNION ALL
         SELECT
           ar.tenant_id AS product_tenant_id,
           ar.product_id,
           ar.subscription_id,
           ar.account_id,
           NULL::varchar AS lifecycle_status,
           ar.id AS activation_record_id,
           NULL::uuid AS lifecycle_record_id,
           ar.provisioning_request_id,
           2 AS source_priority
         FROM edge_p7_activation_records ar
         WHERE NOT EXISTS (
           SELECT 1
           FROM edge_p7_tenant_lifecycle_records lr2
           WHERE lr2.tenant_id = ar.tenant_id AND lr2.product_id = ar.product_id
         )
       ) projected
       ORDER BY product_tenant_id, product_id, source_priority, lifecycle_record_id NULLS LAST`,
    );
    return rows.map((row) => ({
      productTenantId: str(row.product_tenant_id),
      productId: row.product_id == null ? null : str(row.product_id),
      subscriptionId: strOrNull(row.subscription_id),
      accountId: strOrNull(row.account_id),
      lifecycleStatus: strOrNull(row.lifecycle_status),
      activationRecordId: strOrNull(row.activation_record_id),
      lifecycleRecordId: strOrNull(row.lifecycle_record_id),
      provisioningRequestId: strOrNull(row.provisioning_request_id),
    }));
  }

  async listRegistryProductTenantIds(): Promise<string[]> {
    const rows = await this.q<{ product_tenant_id: string }>(
      `SELECT product_tenant_id::text FROM edge_p8_tenants ORDER BY created_at`,
    );
    return rows.map((r) => str(r.product_tenant_id));
  }

  private buildSearchWhere(filter: TenantSearchFilter): { clause: string; params: unknown[] } {
    const params: unknown[] = [];
    const where: string[] = [];

    if (filter.q?.trim()) {
      params.push(`%${filter.q.trim()}%`);
      where.push(
        `(display_name ILIKE $${params.length}
          OR tenant_code ILIKE $${params.length}
          OR tenant_slug ILIKE $${params.length}
          OR product_tenant_id::text ILIKE $${params.length})`,
      );
    }
    if (filter.productId) {
      params.push(filter.productId);
      where.push(`product_id = $${params.length}`);
    }
    if (filter.accountId) {
      params.push(filter.accountId);
      where.push(`account_id = $${params.length}`);
    }
    if (filter.subscriptionId) {
      params.push(filter.subscriptionId);
      where.push(`subscription_id = $${params.length}`);
    }
    if (filter.region) {
      params.push(filter.region);
      where.push(`region = $${params.length}`);
    }
    if (filter.classification) {
      params.push(filter.classification);
      where.push(`classification = $${params.length}`);
    }
    if (filter.administrativeStatus) {
      params.push(filter.administrativeStatus);
      where.push(`administrative_status = $${params.length}`);
    }
    if (filter.technicalStatus) {
      params.push(filter.technicalStatus);
      where.push(`technical_status = $${params.length}`);
    }
    if (filter.governanceStatus) {
      params.push(filter.governanceStatus);
      where.push(`governance_status = $${params.length}`);
    }
    if (filter.healthStatus) {
      params.push(filter.healthStatus);
      where.push(`health_status = $${params.length}`);
    }
    if (filter.riskLevel) {
      params.push(filter.riskLevel);
      where.push(`risk_level = $${params.length}`);
    }
    if (filter.tagKey) {
      params.push(filter.tagKey);
      const tagKeyParam = params.length;
      if (filter.tagValue) {
        params.push(filter.tagValue);
        where.push(
          `EXISTS (
             SELECT 1 FROM edge_p8_tenant_tags tt
             WHERE tt.tenant_registry_id = edge_p8_tenants.id
               AND tt.tag_key = $${tagKeyParam}
               AND tt.tag_value = $${params.length}
           )`,
        );
      } else {
        where.push(
          `EXISTS (
             SELECT 1 FROM edge_p8_tenant_tags tt
             WHERE tt.tenant_registry_id = edge_p8_tenants.id
               AND tt.tag_key = $${tagKeyParam}
           )`,
        );
      }
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return { clause, params };
  }

  private mapHealth(row: Row): HealthSnapshotRecord {
    return {
      id: str(row.id),
      tenantRegistryId: str(row.tenant_registry_id),
      productTenantId: str(row.product_tenant_id),
      overallStatus: str(row.overall_status),
      indicators: asJson(row.indicators, {}),
      sourceSystem: str(row.source_system),
      observedAt: asDate(row.observed_at),
      staleAfter: asDate(row.stale_after),
      createdAt: asDate(row.created_at),
    };
  }

  private mapRisk(row: Row): RiskAssessmentRecord {
    return {
      id: str(row.id),
      tenantRegistryId: str(row.tenant_registry_id),
      productTenantId: str(row.product_tenant_id),
      riskLevel: str(row.risk_level),
      score: row.score == null ? null : num(row.score),
      ruleVersion: str(row.rule_version),
      inputs: asJson(row.inputs, {}),
      result: asJson(row.result, {}),
      evidenceRefs: asJson(row.evidence_refs, []),
      reviewerId: strOrNull(row.reviewer_id),
      evaluatedAt: asDate(row.evaluated_at),
      createdAt: asDate(row.created_at),
    };
  }

  private mapBulk(row: Row): BulkOperationRecord {
    return {
      id: str(row.id),
      operationType: str(row.operation_type),
      status: str(row.status),
      previewCount: num(row.preview_count),
      filter: asJson(row.filter, {}),
      payload: asJson(row.payload, {}),
      results: asJson(row.results, []),
      requestedBy: str(row.requested_by),
      approverId: strOrNull(row.approver_id),
      correlationId: strOrNull(row.correlation_id),
      idempotencyKey: str(row.idempotency_key),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  async listReconciliationRuns(filter: {
    limit?: number;
    offset?: number;
  }): Promise<{ items: ReconciliationRunRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const countRows = await this.q<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM edge_p8_reconciliation_runs`,
    );
    const rows = await this.q(
      `SELECT * FROM edge_p8_reconciliation_runs
       ORDER BY started_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return { items: rows.map((r) => this.mapReconciliationRun(r)), total: num(countRows[0]?.c) };
  }

  async updateFindingStatus(
    id: string,
    status: string,
    client?: unknown,
  ): Promise<ReconciliationFindingRecord> {
    const rows = await this.q(
      `UPDATE edge_p8_reconciliation_findings
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status],
      client,
    );
    if (!rows[0]) this.notFound('Reconciliation finding');
    return this.mapFinding(rows[0]!);
  }

  async countOpenExceptions(tenantRegistryId: string): Promise<number> {
    const rows = await this.q<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM edge_p8_exceptions
       WHERE tenant_registry_id = $1 AND status IN ('ACTIVE','REQUESTED')`,
      [tenantRegistryId],
    );
    return num(rows[0]?.c);
  }

  async countActiveExceptions(tenantRegistryId: string): Promise<number> {
    const rows = await this.q<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM edge_p8_exceptions
       WHERE tenant_registry_id = $1 AND status IN ('ACTIVE','APPROVED')`,
      [tenantRegistryId],
    );
    return num(rows[0]?.c);
  }

  async createHealthSnapshot(
    input: Omit<HealthSnapshotRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<HealthSnapshotRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p8_health_snapshots (
         id, tenant_registry_id, product_tenant_id, overall_status, indicators,
         source_system, observed_at, stale_after
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5::jsonb, $6, $7, $8
       ) RETURNING *`,
      [
        input.id ?? null,
        input.tenantRegistryId,
        input.productTenantId,
        input.overallStatus,
        JSON.stringify(input.indicators ?? {}),
        input.sourceSystem,
        input.observedAt,
        input.staleAfter,
      ],
      client,
    );
    return this.mapHealth(rows[0]!);
  }

  async listHealthSnapshots(tenantRegistryId: string, limit = 50): Promise<HealthSnapshotRecord[]> {
    const capped = Math.min(Math.max(limit, 1), 200);
    const rows = await this.q(
      `SELECT * FROM edge_p8_health_snapshots
       WHERE tenant_registry_id = $1
       ORDER BY observed_at DESC
       LIMIT $2`,
      [tenantRegistryId, capped],
    );
    return rows.map((r) => this.mapHealth(r));
  }

  async getLatestHealthSnapshot(tenantRegistryId: string): Promise<HealthSnapshotRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p8_health_snapshots
       WHERE tenant_registry_id = $1
       ORDER BY observed_at DESC
       LIMIT 1`,
      [tenantRegistryId],
    );
    return rows[0] ? this.mapHealth(rows[0]) : null;
  }

  async updateTenantHealthFromSnapshot(
    tenantRegistryId: string,
    overallStatus: string,
    observedAt: Date,
    actorId: string,
    client?: unknown,
  ): Promise<TenantRegistryRecord> {
    const coerced = coerceHealthOverallStatus(overallStatus, observedAt);
    const effective =
      coerced === HealthStatus.HEALTHY &&
      Date.now() - observedAt.getTime() > 15 * 60 * 1000
        ? HealthStatus.STALE
        : coerced;
    const rows = await this.q(
      `UPDATE edge_p8_tenants
       SET health_status = $2,
           health_observed_at = $3,
           last_admin_activity_at = NOW(),
           version = version + 1,
           updated_by = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [tenantRegistryId, effective, observedAt, actorId],
      client,
    );
    if (!rows[0]) this.notFound('Tenant registry record');
    return this.mapTenant(rows[0]!);
  }

  async createRiskAssessment(
    input: Omit<RiskAssessmentRecord, 'id' | 'createdAt' | 'evaluatedAt'> & {
      id?: string;
      evaluatedAt?: Date;
    },
    client?: unknown,
  ): Promise<RiskAssessmentRecord> {
    const evaluatedAt = input.evaluatedAt ?? new Date();
    const rows = await this.q(
      `INSERT INTO edge_p8_risk_assessments (
         id, tenant_registry_id, product_tenant_id, risk_level, score, rule_version,
         inputs, result, evidence_refs, reviewer_id, evaluated_at
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
         $7::jsonb, $8::jsonb, $9::jsonb, $10, $11
       ) RETURNING *`,
      [
        input.id ?? null,
        input.tenantRegistryId,
        input.productTenantId,
        input.riskLevel,
        input.score ?? null,
        input.ruleVersion,
        JSON.stringify(input.inputs ?? {}),
        JSON.stringify(input.result ?? {}),
        JSON.stringify(input.evidenceRefs ?? []),
        input.reviewerId ?? null,
        evaluatedAt,
      ],
      client,
    );
    return this.mapRisk(rows[0]!);
  }

  async listRiskAssessments(tenantRegistryId: string, limit = 50): Promise<RiskAssessmentRecord[]> {
    const capped = Math.min(Math.max(limit, 1), 200);
    const rows = await this.q(
      `SELECT * FROM edge_p8_risk_assessments
       WHERE tenant_registry_id = $1
       ORDER BY evaluated_at DESC
       LIMIT $2`,
      [tenantRegistryId, capped],
    );
    return rows.map((r) => this.mapRisk(r));
  }

  async getLatestRiskAssessment(tenantRegistryId: string): Promise<RiskAssessmentRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p8_risk_assessments
       WHERE tenant_registry_id = $1
       ORDER BY evaluated_at DESC
       LIMIT 1`,
      [tenantRegistryId],
    );
    return rows[0] ? this.mapRisk(rows[0]) : null;
  }

  async updateTenantRiskLevel(
    tenantRegistryId: string,
    riskLevel: string,
    actorId: string,
    client?: unknown,
  ): Promise<TenantRegistryRecord> {
    const rows = await this.q(
      `UPDATE edge_p8_tenants
       SET risk_level = $2,
           last_admin_activity_at = NOW(),
           version = version + 1,
           updated_by = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [tenantRegistryId, riskLevel, actorId],
      client,
    );
    if (!rows[0]) this.notFound('Tenant registry record');
    return this.mapTenant(rows[0]!);
  }

  async createBulkOperation(
    input: Omit<BulkOperationRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<BulkOperationRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p8_bulk_operations (
         id, operation_type, status, preview_count, filter, payload, results,
         requested_by, approver_id, correlation_id, idempotency_key
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb,
         $8, $9, $10, $11
       ) RETURNING *`,
      [
        input.id ?? null,
        input.operationType,
        input.status,
        input.previewCount,
        JSON.stringify(input.filter ?? {}),
        JSON.stringify(input.payload ?? {}),
        JSON.stringify(input.results ?? []),
        input.requestedBy,
        input.approverId ?? null,
        input.correlationId ?? null,
        input.idempotencyKey,
      ],
      client,
    );
    return this.mapBulk(rows[0]!);
  }

  async getBulkOperation(id: string): Promise<BulkOperationRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p8_bulk_operations WHERE id = $1`, [id]);
    return rows[0] ? this.mapBulk(rows[0]) : null;
  }

  async getBulkOperationByIdempotency(key: string): Promise<BulkOperationRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p8_bulk_operations WHERE idempotency_key = $1`, [
      key,
    ]);
    return rows[0] ? this.mapBulk(rows[0]) : null;
  }

  async updateBulkOperation(
    id: string,
    patch: Partial<BulkOperationRecord>,
    client?: unknown,
  ): Promise<BulkOperationRecord> {
    const rows = await this.q(
      `UPDATE edge_p8_bulk_operations SET
         status = COALESCE($2, status),
         preview_count = COALESCE($3, preview_count),
         payload = COALESCE($4::jsonb, payload),
         results = COALESCE($5::jsonb, results),
         approver_id = COALESCE($6, approver_id),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.status ?? null,
        patch.previewCount ?? null,
        patch.payload ? JSON.stringify(patch.payload) : null,
        patch.results ? JSON.stringify(patch.results) : null,
        patch.approverId === undefined ? null : patch.approverId,
      ],
      client,
    );
    if (!rows[0]) this.notFound('Bulk operation');
    return this.mapBulk(rows[0]!);
  }

  async listBulkOperations(filter: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: BulkOperationRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM edge_p8_bulk_operations ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p8_bulk_operations ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapBulk(r)), total: num(countRows[0]?.c) };
  }

  async createAnalyticsSnapshot(snapshotKey: string, metrics: Record<string, unknown>): Promise<void> {
    await this.q(
      `INSERT INTO edge_p8_analytics_snapshots (snapshot_key, metrics, computed_at)
       VALUES ($1, $2::jsonb, NOW())`,
      [snapshotKey, JSON.stringify(metrics ?? {})],
    );
  }

  async exportTenantsCsv(filter: TenantSearchFilter, maxRows = 5000): Promise<string> {
    const limit = Math.min(Math.max(maxRows, 1), 5000);
    const { clause, params } = this.buildSearchWhere(filter);
    const sortBy = SEARCH_SORT_COLUMNS[filter.sortBy ?? 'created_at'] ?? 'created_at';
    const sortDir = filter.sortDir === 'asc' ? 'ASC' : 'DESC';
    params.push(limit);
    const rows = await this.q(
      `SELECT id, product_tenant_id, tenant_code, display_name, product_id, account_id,
              subscription_id, classification, region, administrative_status, technical_status,
              governance_status, health_status, risk_level, created_at
       FROM edge_p8_tenants ${clause}
       ORDER BY ${sortBy} ${sortDir}
       LIMIT $${params.length}`,
      params,
    );
    const header =
      'id,product_tenant_id,tenant_code,display_name,product_id,account_id,subscription_id,classification,region,administrative_status,technical_status,governance_status,health_status,risk_level,created_at';
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map((r) =>
      [
        r.id,
        r.product_tenant_id,
        r.tenant_code,
        r.display_name,
        r.product_id,
        r.account_id,
        r.subscription_id,
        r.classification,
        r.region,
        r.administrative_status,
        r.technical_status,
        r.governance_status,
        r.health_status,
        r.risk_level,
        r.created_at,
      ]
        .map(esc)
        .join(','),
    );
    return [header, ...lines].join('\n');
  }

  private async tableExists(tableName: string): Promise<boolean> {
    const rows = await this.q<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1
       ) AS exists`,
      [tableName],
    );
    return Boolean(rows[0]?.exists);
  }

  async getCommercialProjection(subscriptionId: string | null): Promise<CommercialProjection> {
    if (!subscriptionId) {
      return {
        availability: 'UNAVAILABLE',
        subscriptionStatus: null,
        planId: null,
        subscriptionNumber: null,
        billingFrequency: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      };
    }
    if (!(await this.tableExists('edge_subscriptions'))) {
      return {
        availability: 'UNAVAILABLE',
        subscriptionStatus: null,
        planId: null,
        subscriptionNumber: null,
        billingFrequency: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      };
    }
    const rows = await this.q(
      `SELECT status, plan_id, subscription_number, billing_frequency,
              current_period_start, current_period_end
       FROM edge_subscriptions WHERE id = $1`,
      [subscriptionId],
    );
    if (!rows[0]) {
      return {
        availability: 'PARTIAL',
        subscriptionStatus: null,
        planId: null,
        subscriptionNumber: null,
        billingFrequency: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      };
    }
    const row = rows[0];
    return {
      availability: 'AVAILABLE',
      subscriptionStatus: strOrNull(row.status),
      planId: row.plan_id == null ? null : str(row.plan_id),
      subscriptionNumber: strOrNull(row.subscription_number),
      billingFrequency: strOrNull(row.billing_frequency),
      currentPeriodStart: row.current_period_start
        ? asDate(row.current_period_start).toISOString()
        : null,
      currentPeriodEnd: row.current_period_end
        ? asDate(row.current_period_end).toISOString()
        : null,
    };
  }

  async getTechnicalResources(productTenantId: string): Promise<TechnicalResourceRef[]> {
    if (!(await this.tableExists('edge_p7_infrastructure_resources'))) {
      return [];
    }
    const rows = await this.q(
      `SELECT r.id, r.resource_type, r.status, r.region, p.code AS provider_code
       FROM edge_p7_infrastructure_resources r
       LEFT JOIN edge_p7_infrastructure_providers p ON p.id = r.provider_id
       WHERE r.tenant_id = $1
       ORDER BY r.updated_at DESC
       LIMIT 100`,
      [productTenantId],
    );
    return rows.map((r) => ({
      id: str(r.id),
      type: str(r.resource_type),
      status: str(r.status),
      region: strOrNull(r.region),
      provider: strOrNull(r.provider_code),
    }));
  }

  async getApplicationRefs(productTenantId: string): Promise<ApplicationRef[]> {
    if (!(await this.tableExists('edge_p7_tenant_experience_assignments'))) {
      return [];
    }
    const rows = await this.q(
      `SELECT tea.id AS assignment_id, tea.assignment_status,
              tab.id AS binding_id, tab.application_id, tab.application_version
       FROM edge_p7_tenant_experience_assignments tea
       LEFT JOIN edge_p7_tenant_application_bindings tab
         ON tab.assignment_id = tea.id
       WHERE tea.tenant_id = $1
       ORDER BY tea.updated_at DESC
       LIMIT 100`,
      [productTenantId],
    );
    return rows.map((r) => ({
      id: r.binding_id ? str(r.binding_id) : str(r.assignment_id),
      assignmentId: strOrNull(r.assignment_id),
      applicationId: strOrNull(r.application_id),
      status: str(r.assignment_status),
      version: r.application_version == null ? null : num(r.application_version),
    }));
  }

  async getConfigurationRefs(productTenantId: string): Promise<ConfigurationRef[]> {
    if (!(await this.tableExists('edge_p7_tenant_configuration_assignments'))) {
      return [];
    }
    const rows = await this.q(
      `SELECT id, bundle_id, assignment_status, bundle_version, drift_status
       FROM edge_p7_tenant_configuration_assignments
       WHERE tenant_id = $1
       ORDER BY updated_at DESC
       LIMIT 100`,
      [productTenantId],
    );
    return rows.map((r) => ({
      id: str(r.id),
      bundleId: str(r.bundle_id),
      status: str(r.assignment_status),
      bundleVersion: num(r.bundle_version),
      driftStatus: str(r.drift_status),
    }));
  }

  async updateLegalHold(
    id: string,
    legalHold: boolean,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<TenantRegistryRecord> {
    const rows = await this.q(
      `UPDATE edge_p8_tenants
       SET legal_hold = $3,
           version = version + 1,
           updated_by = $4,
           last_admin_activity_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [id, expectedVersion, legalHold, actorId],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapTenant(rows[0]!);
  }

  async updateGovernancePolicies(
    id: string,
    patch: {
      retentionPolicyRef?: string | null;
      securityPolicyRef?: string | null;
      dataResidencyRef?: string | null;
      deletionProtection?: boolean;
    },
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<TenantRegistryRecord> {
    const rows = await this.q(
      `UPDATE edge_p8_tenants SET
         retention_policy_ref = COALESCE($3, retention_policy_ref),
         security_policy_ref = COALESCE($4, security_policy_ref),
         data_residency_ref = COALESCE($5, data_residency_ref),
         deletion_protection = COALESCE($6, deletion_protection),
         version = version + 1,
         updated_by = $7,
         last_admin_activity_at = NOW(),
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.retentionPolicyRef === undefined ? null : patch.retentionPolicyRef,
        patch.securityPolicyRef === undefined ? null : patch.securityPolicyRef,
        patch.dataResidencyRef === undefined ? null : patch.dataResidencyRef,
        patch.deletionProtection === undefined ? null : patch.deletionProtection,
        actorId,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapTenant(rows[0]!);
  }

  async detectDuplicateRegistryRows(): Promise<
    Array<{ tenantCode: string; count: number; productTenantIds: string[] }>
  > {
    const rows = await this.q<{ tenant_code: string; c: number; ids: string[] }>(
      `SELECT tenant_code, COUNT(*)::int AS c,
              array_agg(product_tenant_id::text ORDER BY created_at) AS ids
       FROM edge_p8_tenants
       GROUP BY tenant_code
       HAVING COUNT(*) > 1`,
    );
    return rows.map((r) => ({
      tenantCode: str(r.tenant_code),
      count: num(r.c),
      productTenantIds: (r.ids ?? []).map((id) => str(id)),
    }));
  }

  async verifySubscriptionProduct(
    subscriptionId: string,
    productId: string,
    client?: unknown,
  ): Promise<'UNAVAILABLE_TABLE' | 'NOT_FOUND' | 'PRODUCT_MISMATCH' | 'VERIFIED'> {
    if (!(await this.tableExists('edge_subscriptions'))) {
      return 'UNAVAILABLE_TABLE';
    }
    const rows = await this.q<{ product_id: unknown }>(
      `SELECT product_id FROM edge_subscriptions WHERE id = $1`,
      [subscriptionId],
      client,
    );
    if (!rows[0]) return 'NOT_FOUND';
    if (str(rows[0].product_id) !== productId) return 'PRODUCT_MISMATCH';
    return 'VERIFIED';
  }

  async createLegalHoldChangeRequest(
    input: Omit<LegalHoldChangeRequestRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<LegalHoldChangeRequestRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p8_legal_hold_requests (
           id, tenant_registry_id, action, status, justification, requested_by,
           approver_id, approved_at, rejected_reason, correlation_id, idempotency_key, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
           COALESCE($12, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.tenantRegistryId,
          input.action,
          input.status,
          input.justification,
          input.requestedBy,
          input.approverId,
          input.approvedAt,
          input.rejectedReason,
          input.correlationId,
          input.idempotencyKey,
          input.version ?? 1,
        ],
        client,
      );
      return this.mapLegalHoldChangeRequest(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Legal hold change request idempotency collision');
    }
  }

  async getLegalHoldChangeRequest(id: string): Promise<LegalHoldChangeRequestRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p8_legal_hold_requests WHERE id = $1`, [id]);
    return rows[0] ? this.mapLegalHoldChangeRequest(rows[0]) : null;
  }

  async getLegalHoldChangeRequestByIdempotency(
    key: string,
  ): Promise<LegalHoldChangeRequestRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p8_legal_hold_requests WHERE idempotency_key = $1`,
      [key],
    );
    return rows[0] ? this.mapLegalHoldChangeRequest(rows[0]) : null;
  }

  async listLegalHoldChangeRequests(filter: {
    tenantRegistryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: LegalHoldChangeRequestRecord[]; total: number }> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter.tenantRegistryId) {
      params.push(filter.tenantRegistryId);
      clauses.push(`tenant_registry_id = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      clauses.push(`status = $${params.length}`);
    }
    const clause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.min(filter.limit ?? 50, 200);
    const offset = filter.offset ?? 0;
    const countRows = await this.q<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM edge_p8_legal_hold_requests ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p8_legal_hold_requests ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      items: rows.map((r) => this.mapLegalHoldChangeRequest(r)),
      total: num(countRows[0]?.c),
    };
  }

  async updateLegalHoldChangeRequest(
    id: string,
    patch: Partial<LegalHoldChangeRequestRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<LegalHoldChangeRequestRecord> {
    const rows = await this.q(
      `UPDATE edge_p8_legal_hold_requests SET
         status = COALESCE($3, status),
         approver_id = COALESCE($4, approver_id),
         approved_at = COALESCE($5, approved_at),
         rejected_reason = COALESCE($6, rejected_reason),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.status ?? null,
        patch.approverId === undefined ? null : patch.approverId,
        patch.approvedAt === undefined ? null : patch.approvedAt,
        patch.rejectedReason === undefined ? null : patch.rejectedReason,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapLegalHoldChangeRequest(rows[0]!);
  }

  async detectDuplicateAccountProductRefs(): Promise<
    Array<{ accountId: string; productId: string; productTenantIds: string[] }>
  > {
    const rows = await this.q<{ account_id: string; product_id: string; ids: string[] }>(
      `SELECT account_id::text, product_id::text,
              array_agg(DISTINCT product_tenant_id::text) AS ids
       FROM edge_p8_tenants
       WHERE account_id IS NOT NULL
       GROUP BY account_id, product_id
       HAVING COUNT(DISTINCT product_tenant_id) > 1`,
    );
    return rows.map((r) => ({
      accountId: str(r.account_id),
      productId: str(r.product_id),
      productTenantIds: (r.ids ?? []).map((id) => str(id)),
    }));
  }
}
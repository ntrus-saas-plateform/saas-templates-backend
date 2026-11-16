import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type { LifecycleRepositoryPort } from '../../domain/tenant-lifecycle/lifecycle-repository.port.js';
import type {
  LifecycleEvidenceRecord,
  LifecycleRunRecord,
  TenantLifecycleRecord,
} from '../../domain/tenant-lifecycle/lifecycle.types.js';
import { LifecycleStatus } from '../../domain/tenant-lifecycle/lifecycle.types.js';

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

/**
 * P7.11 PostgreSQL repository — migration 106.
 */
@Injectable()
export class PgLifecycleRepository implements LifecycleRepositoryPort {
  constructor(private readonly cpDb: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.cpDb.getPool();
  }

  private async q<T extends Row = Row>(sql: string, params: unknown[] = [], client?: unknown) {
    const executor = client ? (client as PoolClient) : this.pool;
    return (await executor.query(sql, params)).rows as T[];
  }

  private conflict(): never {
    throw new DomainError(ErrorCode.CONFLICT, 'Optimistic lock conflict on lifecycle resource');
  }

  private notFound(label = 'Lifecycle resource'): never {
    throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, `${label} not found`);
  }

  private rethrow(err: unknown, message: string, collisionCode = 'LIFECYCLE_COLLISION'): never {
    const code = (err as { code?: string } | null)?.code;
    if (code === '23505') {
      throw new DomainError(ErrorCode.CONFLICT, message, [{ code: collisionCode }]);
    }
    if (code === '40001') this.conflict();
    throw err;
  }

  private mapRecord(row: Row): TenantLifecycleRecord {
    return {
      id: str(row.id),
      tenantId: str(row.tenant_id),
      productId: str(row.product_id),
      subscriptionId: strOrNull(row.subscription_id),
      accountId: strOrNull(row.account_id),
      provisioningRequestId: str(row.provisioning_request_id),
      authorizationRowId: str(row.authorization_row_id),
      authorizationVersion: num(row.authorization_version),
      activationRecordId: str(row.activation_record_id),
      lifecycleStatus: str(row.lifecycle_status),
      workflowId: strOrNull(row.workflow_id),
      deletionProtection: asBool(row.deletion_protection, true),
      retentionPolicyRef: strOrNull(row.retention_policy_ref),
      exportEvidenceRef: strOrNull(row.export_evidence_ref),
      lastSuspendedAt: asDateOrNull(row.last_suspended_at),
      lastResumedAt: asDateOrNull(row.last_resumed_at),
      deprovisionedAt: asDateOrNull(row.deprovisioned_at),
      failureCode: strOrNull(row.failure_code),
      failureMessage: strOrNull(row.failure_message),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapRun(row: Row): LifecycleRunRecord {
    return {
      id: str(row.id),
      lifecycleRecordId: str(row.lifecycle_record_id),
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

  private mapEvidence(row: Row): LifecycleEvidenceRecord {
    return {
      id: str(row.id),
      lifecycleRecordId: strOrNull(row.lifecycle_record_id),
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

  async createRecord(
    input: Omit<TenantLifecycleRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<TenantLifecycleRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_tenant_lifecycle_records (
           id, tenant_id, product_id, subscription_id, account_id, provisioning_request_id,
           authorization_row_id, authorization_version, activation_record_id, lifecycle_status,
           workflow_id, deletion_protection, retention_policy_ref, export_evidence_ref,
           last_suspended_at, last_resumed_at, deprovisioned_at, failure_code, failure_message,
           metadata, created_by, updated_by, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
           $20::jsonb, $21, $22, COALESCE($23, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.tenantId,
          input.productId,
          input.subscriptionId,
          input.accountId,
          input.provisioningRequestId,
          input.authorizationRowId,
          input.authorizationVersion,
          input.activationRecordId,
          input.lifecycleStatus ?? LifecycleStatus.ACTIVE,
          input.workflowId,
          input.deletionProtection ?? true,
          input.retentionPolicyRef,
          input.exportEvidenceRef,
          input.lastSuspendedAt,
          input.lastResumedAt,
          input.deprovisionedAt,
          input.failureCode,
          input.failureMessage,
          JSON.stringify(input.metadata ?? {}),
          input.createdBy,
          input.updatedBy,
          input.version ?? 1,
        ],
        client,
      );
      return this.mapRecord(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Active lifecycle record already exists for tenant/product');
    }
  }

  async getRecord(id: string): Promise<TenantLifecycleRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_tenant_lifecycle_records WHERE id = $1`, [
      id,
    ]);
    return rows[0] ? this.mapRecord(rows[0]) : null;
  }

  async getActiveRecord(
    tenantId: string,
    productId: string,
  ): Promise<TenantLifecycleRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_tenant_lifecycle_records
       WHERE tenant_id = $1 AND product_id = $2
         AND lifecycle_status NOT IN ('DEPROVISIONED','DATA_PURGED')
       ORDER BY created_at DESC LIMIT 1`,
      [tenantId, productId],
    );
    return rows[0] ? this.mapRecord(rows[0]) : null;
  }

  async listRecords(filter: {
    tenantId?: string;
    productId?: string;
    status?: string;
    activationRecordId?: string;
    provisioningRequestId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: TenantLifecycleRecord[]; total: number }> {
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
    if (filter.status) {
      params.push(filter.status);
      where.push(`lifecycle_status = $${params.length}`);
    }
    if (filter.activationRecordId) {
      params.push(filter.activationRecordId);
      where.push(`activation_record_id = $${params.length}`);
    }
    if (filter.provisioningRequestId) {
      params.push(filter.provisioningRequestId);
      where.push(`provisioning_request_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p7_tenant_lifecycle_records ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_tenant_lifecycle_records ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapRecord(r)), total: num(countRows[0]?.c) };
  }

  async updateRecord(
    id: string,
    patch: Partial<TenantLifecycleRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<TenantLifecycleRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_tenant_lifecycle_records SET
         subscription_id = COALESCE($3, subscription_id),
         account_id = COALESCE($4, account_id),
         lifecycle_status = COALESCE($5, lifecycle_status),
         workflow_id = COALESCE($6, workflow_id),
         deletion_protection = COALESCE($7, deletion_protection),
         retention_policy_ref = COALESCE($8, retention_policy_ref),
         export_evidence_ref = COALESCE($9, export_evidence_ref),
         last_suspended_at = COALESCE($10, last_suspended_at),
         last_resumed_at = COALESCE($11, last_resumed_at),
         deprovisioned_at = COALESCE($12, deprovisioned_at),
         failure_code = COALESCE($13, failure_code),
         failure_message = COALESCE($14, failure_message),
         metadata = COALESCE($15::jsonb, metadata),
         authorization_row_id = COALESCE($16, authorization_row_id),
         authorization_version = COALESCE($17, authorization_version),
         version = version + 1,
         updated_by = $18,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.subscriptionId === undefined ? null : patch.subscriptionId,
        patch.accountId === undefined ? null : patch.accountId,
        patch.lifecycleStatus ?? null,
        patch.workflowId === undefined ? null : patch.workflowId,
        patch.deletionProtection === undefined ? null : patch.deletionProtection,
        patch.retentionPolicyRef === undefined ? null : patch.retentionPolicyRef,
        patch.exportEvidenceRef === undefined ? null : patch.exportEvidenceRef,
        patch.lastSuspendedAt === undefined ? null : patch.lastSuspendedAt,
        patch.lastResumedAt === undefined ? null : patch.lastResumedAt,
        patch.deprovisionedAt === undefined ? null : patch.deprovisionedAt,
        patch.failureCode === undefined ? null : patch.failureCode,
        patch.failureMessage === undefined ? null : patch.failureMessage,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        patch.authorizationRowId ?? null,
        patch.authorizationVersion === undefined ? null : patch.authorizationVersion,
        actorId,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapRecord(rows[0]);
  }

  async createRun(
    input: Omit<LifecycleRunRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<LifecycleRunRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_lifecycle_runs (
         id, lifecycle_record_id, tenant_id, product_id, operation,
         workflow_id, outcome, error_code, error_message, observed_state, evidence,
         started_at, finished_at, performed_by, correlation_id
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5,
         $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13, $14, $15
       ) RETURNING *`,
      [
        input.id ?? null,
        input.lifecycleRecordId,
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

  async listRuns(lifecycleRecordId: string, limit = 50): Promise<LifecycleRunRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_lifecycle_runs
       WHERE lifecycle_record_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [lifecycleRecordId, Math.min(Math.max(limit, 1), 200)],
    );
    return rows.map((r) => this.mapRun(r));
  }

  async updateRun(
    id: string,
    patch: Partial<LifecycleRunRecord>,
    client?: unknown,
  ): Promise<LifecycleRunRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_lifecycle_runs SET
         outcome = COALESCE($2, outcome),
         error_code = COALESCE($3, error_code),
         error_message = COALESCE($4, error_message),
         observed_state = COALESCE($5::jsonb, observed_state),
         evidence = COALESCE($6::jsonb, evidence),
         finished_at = COALESCE($7, finished_at)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.outcome ?? null,
        patch.errorCode === undefined ? null : patch.errorCode,
        patch.errorMessage === undefined ? null : patch.errorMessage,
        patch.observedState ? JSON.stringify(patch.observedState) : null,
        patch.evidence ? JSON.stringify(patch.evidence) : null,
        patch.finishedAt === undefined ? null : patch.finishedAt,
      ],
      client,
    );
    if (!rows[0]) this.notFound('Lifecycle run');
    return this.mapRun(rows[0]);
  }

  async createEvidence(
    input: Omit<LifecycleEvidenceRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<LifecycleEvidenceRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_lifecycle_evidence (
         id, lifecycle_record_id, tenant_id, workflow_id, step_key,
         operation, outcome, evidence, error_code, error_message, duration_ms, performed_by
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5,
         $6, $7, $8::jsonb, $9, $10, $11, $12
       ) RETURNING *`,
      [
        input.id ?? null,
        input.lifecycleRecordId,
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

  async listEvidence(filter: {
    lifecycleRecordId?: string;
    limit?: number;
  }): Promise<LifecycleEvidenceRecord[]> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 500);
    if (!filter.lifecycleRecordId) return [];
    const rows = await this.q(
      `SELECT * FROM edge_p7_lifecycle_evidence
       WHERE lifecycle_record_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [filter.lifecycleRecordId, limit],
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
      `INSERT INTO edge_p7_lifecycle_history (
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

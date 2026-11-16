import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type { ActivationRepositoryPort } from '../../domain/readiness-activation/activation-repository.port.js';
import type {
  ActivationEvidenceRecord,
  ActivationRecordRecord,
  ActivationRunRecord,
  ReadinessCheckRecord,
  TenantReadinessEvaluationRecord,
} from '../../domain/readiness-activation/activation.types.js';
import {
  ActivationRecordStatus,
  ReadinessCheckStatus,
  ReadinessEvaluationStatus,
} from '../../domain/readiness-activation/activation.types.js';

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
 * P7.10 PostgreSQL repository — mirrors migration 105 / P7.9 patterns.
 */
@Injectable()
export class PgActivationRepository implements ActivationRepositoryPort {
  constructor(private readonly cpDb: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.cpDb.getPool();
  }

  private async q<T extends Row = Row>(sql: string, params: unknown[] = [], client?: unknown) {
    const executor = client ? (client as PoolClient) : this.pool;
    return (await executor.query(sql, params)).rows as T[];
  }

  private conflict(): never {
    throw new DomainError(ErrorCode.CONFLICT, 'Optimistic lock conflict on activation resource');
  }

  private notFound(label = 'Activation resource'): never {
    throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, `${label} not found`);
  }

  private rethrow(err: unknown, message: string, collisionCode = 'ACTIVATION_COLLISION'): never {
    const code = (err as { code?: string } | null)?.code;
    if (code === '23505') {
      throw new DomainError(ErrorCode.CONFLICT, message, [{ code: collisionCode }]);
    }
    if (code === '40001') this.conflict();
    throw err;
  }

  // -------------------------------------------------------------------------
  // Evaluations
  // -------------------------------------------------------------------------

  private mapEvaluation(row: Row): TenantReadinessEvaluationRecord {
    return {
      id: str(row.id),
      tenantId: str(row.tenant_id),
      productId: str(row.product_id),
      subscriptionId: strOrNull(row.subscription_id),
      accountId: strOrNull(row.account_id),
      provisioningRequestId: str(row.provisioning_request_id),
      authorizationRowId: strOrNull(row.authorization_row_id),
      authorizationVersion: numOrNull(row.authorization_version),
      evaluationStatus: str(row.evaluation_status),
      workflowId: strOrNull(row.workflow_id),
      overallScore: numOrNull(row.overall_score),
      blockingCodes: asJson(row.blocking_codes, []).map(String),
      summary: asJson(row.summary, {}),
      evaluatedAt: asDateOrNull(row.evaluated_at),
      expiresAt: asDateOrNull(row.expires_at),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  async createEvaluation(
    input: Omit<TenantReadinessEvaluationRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<TenantReadinessEvaluationRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_tenant_readiness_evaluations (
           id, tenant_id, product_id, subscription_id, account_id, provisioning_request_id,
           authorization_row_id, authorization_version, evaluation_status, workflow_id,
           overall_score, blocking_codes, summary, evaluated_at, expires_at, metadata,
           created_by, updated_by, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14, $15, $16::jsonb,
           $17, $18, COALESCE($19, 1)
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
          input.evaluationStatus ?? ReadinessEvaluationStatus.PENDING,
          input.workflowId,
          input.overallScore,
          JSON.stringify(input.blockingCodes ?? []),
          JSON.stringify(input.summary ?? {}),
          input.evaluatedAt,
          input.expiresAt,
          JSON.stringify(input.metadata ?? {}),
          input.createdBy,
          input.updatedBy,
          input.version ?? 1,
        ],
        client,
      );
      return this.mapEvaluation(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Readiness evaluation conflict');
    }
  }

  async getEvaluation(id: string): Promise<TenantReadinessEvaluationRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_tenant_readiness_evaluations WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapEvaluation(rows[0]) : null;
  }

  async listEvaluations(filter: {
    tenantId?: string;
    productId?: string;
    status?: string;
    provisioningRequestId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: TenantReadinessEvaluationRecord[]; total: number }> {
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
      where.push(`evaluation_status = $${params.length}`);
    }
    if (filter.provisioningRequestId) {
      params.push(filter.provisioningRequestId);
      where.push(`provisioning_request_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p7_tenant_readiness_evaluations ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_tenant_readiness_evaluations ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapEvaluation(r)), total: num(countRows[0]?.c) };
  }

  async updateEvaluation(
    id: string,
    patch: Partial<TenantReadinessEvaluationRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<TenantReadinessEvaluationRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_tenant_readiness_evaluations SET
         subscription_id = COALESCE($3, subscription_id),
         account_id = COALESCE($4, account_id),
         authorization_row_id = COALESCE($5, authorization_row_id),
         authorization_version = COALESCE($6, authorization_version),
         evaluation_status = COALESCE($7, evaluation_status),
         workflow_id = COALESCE($8, workflow_id),
         overall_score = COALESCE($9, overall_score),
         blocking_codes = COALESCE($10::jsonb, blocking_codes),
         summary = COALESCE($11::jsonb, summary),
         evaluated_at = COALESCE($12, evaluated_at),
         expires_at = COALESCE($13, expires_at),
         metadata = COALESCE($14::jsonb, metadata),
         version = version + 1,
         updated_by = $15,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.subscriptionId === undefined ? null : patch.subscriptionId,
        patch.accountId === undefined ? null : patch.accountId,
        patch.authorizationRowId === undefined ? null : patch.authorizationRowId,
        patch.authorizationVersion === undefined ? null : patch.authorizationVersion,
        patch.evaluationStatus ?? null,
        patch.workflowId === undefined ? null : patch.workflowId,
        patch.overallScore === undefined ? null : patch.overallScore,
        patch.blockingCodes ? JSON.stringify(patch.blockingCodes) : null,
        patch.summary ? JSON.stringify(patch.summary) : null,
        patch.evaluatedAt === undefined ? null : patch.evaluatedAt,
        patch.expiresAt === undefined ? null : patch.expiresAt,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        actorId,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapEvaluation(rows[0]);
  }

  // -------------------------------------------------------------------------
  // Checks
  // -------------------------------------------------------------------------

  private mapCheck(row: Row): ReadinessCheckRecord {
    return {
      id: str(row.id),
      evaluationId: str(row.evaluation_id),
      tenantId: str(row.tenant_id),
      checkCode: str(row.check_code),
      checkPhase: str(row.check_phase),
      checkStatus: str(row.check_status),
      required: Boolean(row.required),
      message: strOrNull(row.message),
      evidenceRef: strOrNull(row.evidence_ref),
      details: asJson(row.details, {}),
      checkedAt: asDateOrNull(row.checked_at),
      createdAt: asDate(row.created_at),
    };
  }

  async upsertCheck(
    input: Omit<ReadinessCheckRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ReadinessCheckRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_readiness_checks (
         id, evaluation_id, tenant_id, check_code, check_phase, check_status,
         required, message, evidence_ref, details, checked_at
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
         $7, $8, $9, $10::jsonb, $11
       )
       ON CONFLICT (evaluation_id, check_code) DO UPDATE SET
         check_phase = EXCLUDED.check_phase,
         check_status = EXCLUDED.check_status,
         required = EXCLUDED.required,
         message = EXCLUDED.message,
         evidence_ref = EXCLUDED.evidence_ref,
         details = EXCLUDED.details,
         checked_at = EXCLUDED.checked_at
       RETURNING *`,
      [
        input.id ?? null,
        input.evaluationId,
        input.tenantId,
        input.checkCode,
        input.checkPhase,
        input.checkStatus ?? ReadinessCheckStatus.PENDING,
        input.required ?? true,
        input.message,
        input.evidenceRef,
        JSON.stringify(input.details ?? {}),
        input.checkedAt,
      ],
      client,
    );
    return this.mapCheck(rows[0]!);
  }

  async listChecks(evaluationId: string): Promise<ReadinessCheckRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_readiness_checks
       WHERE evaluation_id = $1 ORDER BY created_at ASC`,
      [evaluationId],
    );
    return rows.map((r) => this.mapCheck(r));
  }

  async getCheck(
    evaluationId: string,
    checkCode: string,
  ): Promise<ReadinessCheckRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_readiness_checks
       WHERE evaluation_id = $1 AND check_code = $2`,
      [evaluationId, checkCode],
    );
    return rows[0] ? this.mapCheck(rows[0]) : null;
  }

  // -------------------------------------------------------------------------
  // Activation records
  // -------------------------------------------------------------------------

  private mapActivation(row: Row): ActivationRecordRecord {
    return {
      id: str(row.id),
      tenantId: str(row.tenant_id),
      productId: str(row.product_id),
      subscriptionId: strOrNull(row.subscription_id),
      accountId: strOrNull(row.account_id),
      provisioningRequestId: str(row.provisioning_request_id),
      authorizationRowId: str(row.authorization_row_id),
      authorizationVersion: num(row.authorization_version),
      readinessEvaluationId: strOrNull(row.readiness_evaluation_id),
      activationStatus: str(row.activation_status),
      workflowId: strOrNull(row.workflow_id),
      activatedAt: asDateOrNull(row.activated_at),
      p5SignalEmittedAt: asDateOrNull(row.p5_signal_emitted_at),
      p5SignalEventId: strOrNull(row.p5_signal_event_id),
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

  async createActivationRecord(
    input: Omit<ActivationRecordRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<ActivationRecordRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_activation_records (
           id, tenant_id, product_id, subscription_id, account_id, provisioning_request_id,
           authorization_row_id, authorization_version, readiness_evaluation_id,
           activation_status, workflow_id, activated_at, p5_signal_emitted_at, p5_signal_event_id,
           failure_code, failure_message, metadata, created_by, updated_by, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18, $19, COALESCE($20, 1)
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
          input.readinessEvaluationId,
          input.activationStatus ?? ActivationRecordStatus.PENDING,
          input.workflowId,
          input.activatedAt,
          input.p5SignalEmittedAt,
          input.p5SignalEventId,
          input.failureCode,
          input.failureMessage,
          JSON.stringify(input.metadata ?? {}),
          input.createdBy,
          input.updatedBy,
          input.version ?? 1,
        ],
        client,
      );
      return this.mapActivation(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Active activation record already exists for tenant/product');
    }
  }

  async getActivationRecord(id: string): Promise<ActivationRecordRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_activation_records WHERE id = $1`, [id]);
    return rows[0] ? this.mapActivation(rows[0]) : null;
  }

  async getActiveActivationRecord(
    tenantId: string,
    productId: string,
  ): Promise<ActivationRecordRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_activation_records
       WHERE tenant_id = $1 AND product_id = $2
         AND activation_status IN (
           'PENDING','EVALUATING','READY_FOR_ACTIVATION','ACTIVATING','ACTIVE'
         )
       ORDER BY created_at DESC LIMIT 1`,
      [tenantId, productId],
    );
    return rows[0] ? this.mapActivation(rows[0]) : null;
  }

  async listActivationRecords(filter: {
    tenantId?: string;
    productId?: string;
    status?: string;
    provisioningRequestId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ActivationRecordRecord[]; total: number }> {
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
      where.push(`activation_status = $${params.length}`);
    }
    if (filter.provisioningRequestId) {
      params.push(filter.provisioningRequestId);
      where.push(`provisioning_request_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p7_activation_records ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_activation_records ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapActivation(r)), total: num(countRows[0]?.c) };
  }

  async updateActivationRecord(
    id: string,
    patch: Partial<ActivationRecordRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<ActivationRecordRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_activation_records SET
         subscription_id = COALESCE($3, subscription_id),
         account_id = COALESCE($4, account_id),
         readiness_evaluation_id = COALESCE($5, readiness_evaluation_id),
         activation_status = COALESCE($6, activation_status),
         workflow_id = COALESCE($7, workflow_id),
         activated_at = COALESCE($8, activated_at),
         p5_signal_emitted_at = COALESCE($9, p5_signal_emitted_at),
         p5_signal_event_id = COALESCE($10, p5_signal_event_id),
         failure_code = COALESCE($11, failure_code),
         failure_message = COALESCE($12, failure_message),
         metadata = COALESCE($13::jsonb, metadata),
         authorization_row_id = COALESCE($14, authorization_row_id),
         authorization_version = COALESCE($15, authorization_version),
         version = version + 1,
         updated_by = $16,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.subscriptionId === undefined ? null : patch.subscriptionId,
        patch.accountId === undefined ? null : patch.accountId,
        patch.readinessEvaluationId === undefined ? null : patch.readinessEvaluationId,
        patch.activationStatus ?? null,
        patch.workflowId === undefined ? null : patch.workflowId,
        patch.activatedAt === undefined ? null : patch.activatedAt,
        patch.p5SignalEmittedAt === undefined ? null : patch.p5SignalEmittedAt,
        patch.p5SignalEventId === undefined ? null : patch.p5SignalEventId,
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
    return this.mapActivation(rows[0]);
  }

  // -------------------------------------------------------------------------
  // Runs / evidence / history
  // -------------------------------------------------------------------------

  private mapRun(row: Row): ActivationRunRecord {
    return {
      id: str(row.id),
      activationRecordId: str(row.activation_record_id),
      evaluationId: strOrNull(row.evaluation_id),
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

  private mapEvidence(row: Row): ActivationEvidenceRecord {
    return {
      id: str(row.id),
      activationRecordId: strOrNull(row.activation_record_id),
      evaluationId: strOrNull(row.evaluation_id),
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

  async createRun(
    input: Omit<ActivationRunRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ActivationRunRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_activation_runs (
         id, activation_record_id, evaluation_id, tenant_id, product_id, operation,
         workflow_id, outcome, error_code, error_message, observed_state, evidence,
         started_at, finished_at, performed_by, correlation_id
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13, $14, $15, $16
       ) RETURNING *`,
      [
        input.id ?? null,
        input.activationRecordId,
        input.evaluationId,
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

  async listRuns(activationRecordId: string, limit = 50): Promise<ActivationRunRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_activation_runs
       WHERE activation_record_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [activationRecordId, Math.min(Math.max(limit, 1), 200)],
    );
    return rows.map((r) => this.mapRun(r));
  }

  async updateRun(
    id: string,
    patch: Partial<ActivationRunRecord>,
    client?: unknown,
  ): Promise<ActivationRunRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_activation_runs SET
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
    if (!rows[0]) this.notFound('Activation run');
    return this.mapRun(rows[0]);
  }

  async createEvidence(
    input: Omit<ActivationEvidenceRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ActivationEvidenceRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_activation_evidence (
         id, activation_record_id, evaluation_id, tenant_id, workflow_id, step_key,
         operation, outcome, evidence, error_code, error_message, duration_ms, performed_by
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
         $7, $8, $9::jsonb, $10, $11, $12, $13
       ) RETURNING *`,
      [
        input.id ?? null,
        input.activationRecordId,
        input.evaluationId,
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
    activationRecordId?: string;
    evaluationId?: string;
    limit?: number;
  }): Promise<ActivationEvidenceRecord[]> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 500);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.activationRecordId) {
      params.push(filter.activationRecordId);
      where.push(`activation_record_id = $${params.length}`);
    }
    if (filter.evaluationId) {
      params.push(filter.evaluationId);
      where.push(`evaluation_id = $${params.length}`);
    }
    if (where.length === 0) return [];
    params.push(limit);
    const rows = await this.q(
      `SELECT * FROM edge_p7_activation_evidence
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
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
      `INSERT INTO edge_p7_activation_history (
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

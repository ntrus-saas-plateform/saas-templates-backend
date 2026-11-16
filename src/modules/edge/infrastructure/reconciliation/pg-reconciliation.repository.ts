import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type { ReconciliationRepositoryPort } from '../../domain/reconciliation/reconciliation-repository.port.js';
import type {
  ReconciliationEvidenceRecord,
  ReconciliationFindingRecord,
  ReconciliationPolicyRecord,
  ReconciliationRemediationRecord,
  ReconciliationRunRecord,
  ReconciliationWaiverRecord,
} from '../../domain/reconciliation/reconciliation.types.js';
import {
  FindingStatus,
  ReconciliationRunStatus,
  RemediationStatus,
} from '../../domain/reconciliation/reconciliation.types.js';
import { isWaiverValid } from '../../domain/reconciliation/reconciliation-policy.js';

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
 * P7.13 PostgreSQL repository — migration 109.
 */
@Injectable()
export class PgReconciliationRepository implements ReconciliationRepositoryPort {
  constructor(private readonly cpDb: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.cpDb.getPool();
  }

  private async q<T extends Row = Row>(sql: string, params: unknown[] = [], client?: unknown) {
    const executor = client ? (client as PoolClient) : this.pool;
    return (await executor.query(sql, params)).rows as T[];
  }

  private conflict(): never {
    throw new DomainError(ErrorCode.CONFLICT, 'Optimistic lock conflict on reconciliation resource');
  }

  private rethrow(err: unknown, message: string, collisionCode = 'RECONCILIATION_COLLISION'): never {
    const code = (err as { code?: string } | null)?.code;
    if (code === '23505') {
      throw new DomainError(ErrorCode.CONFLICT, message, [{ code: collisionCode }]);
    }
    if (code === '40001') this.conflict();
    throw err;
  }

  private mapPolicy(row: Row): ReconciliationPolicyRecord {
    return {
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      description: strOrNull(row.description),
      scope: str(row.scope),
      autoRemediate: asBool(row.auto_remediate, false),
      requireApproval: asBool(row.require_approval, true),
      policyStatus: str(row.policy_status),
      rules: asJson(row.rules, {}),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapRun(row: Row): ReconciliationRunRecord {
    return {
      id: str(row.id),
      tenantId: strOrNull(row.tenant_id),
      productId: strOrNull(row.product_id),
      providerCode: strOrNull(row.provider_code),
      policyId: strOrNull(row.policy_id),
      triggerKind: str(row.trigger_kind),
      runStatus: str(row.run_status),
      provisioningRequestId: strOrNull(row.provisioning_request_id),
      authorizationRowId: strOrNull(row.authorization_row_id),
      authorizationVersion:
        row.authorization_version == null ? null : num(row.authorization_version),
      workflowId: strOrNull(row.workflow_id),
      desiredSnapshot: asJson(row.desired_snapshot, {}),
      observedSnapshot: asJson(row.observed_snapshot, {}),
      summary: asJson(row.summary, {}),
      driftCount: num(row.drift_count),
      startedAt: asDate(row.started_at),
      finishedAt: asDateOrNull(row.finished_at),
      performedBy: strOrNull(row.performed_by),
      correlationId: strOrNull(row.correlation_id),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
    };
  }

  private mapFinding(row: Row): ReconciliationFindingRecord {
    return {
      id: str(row.id),
      runId: str(row.run_id),
      tenantId: strOrNull(row.tenant_id),
      productId: strOrNull(row.product_id),
      findingCode: str(row.finding_code),
      resourceType: str(row.resource_type),
      resourceRef: strOrNull(row.resource_ref),
      severity: str(row.severity),
      findingStatus: str(row.finding_status),
      observationClass: str(row.observation_class),
      desiredState: asJson(row.desired_state, {}),
      observedState: asJson(row.observed_state, {}),
      lastKnownState: asJson(row.last_known_state, {}),
      autoRemediateEligible: asBool(row.auto_remediate_eligible, false),
      message: strOrNull(row.message),
      details: asJson(row.details, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapRemediation(row: Row): ReconciliationRemediationRecord {
    return {
      id: str(row.id),
      findingId: str(row.finding_id),
      runId: str(row.run_id),
      tenantId: strOrNull(row.tenant_id),
      remediationStatus: str(row.remediation_status),
      plan: asJson(row.plan, {}),
      workflowId: strOrNull(row.workflow_id),
      reversible: asBool(row.reversible, true),
      approvedBy: strOrNull(row.approved_by),
      approvedAt: asDateOrNull(row.approved_at),
      executedAt: asDateOrNull(row.executed_at),
      evidence: asJson(row.evidence, {}),
      errorCode: strOrNull(row.error_code),
      errorMessage: strOrNull(row.error_message),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapWaiver(row: Row): ReconciliationWaiverRecord {
    return {
      id: str(row.id),
      findingId: strOrNull(row.finding_id),
      tenantId: strOrNull(row.tenant_id),
      productId: strOrNull(row.product_id),
      waiverCode: str(row.waiver_code),
      reason: str(row.reason),
      waiverStatus: str(row.waiver_status),
      expiresAt: asDate(row.expires_at),
      createdBy: str(row.created_by),
      revokedBy: strOrNull(row.revoked_by),
      revokedAt: asDateOrNull(row.revoked_at),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
    };
  }

  private mapEvidence(row: Row): ReconciliationEvidenceRecord {
    return {
      id: str(row.id),
      runId: strOrNull(row.run_id),
      findingId: strOrNull(row.finding_id),
      remediationId: strOrNull(row.remediation_id),
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

  async createPolicy(
    input: Omit<ReconciliationPolicyRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<ReconciliationPolicyRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_reconciliation_policies (
           id, code, name, description, scope, auto_remediate, require_approval,
           policy_status, rules, metadata, created_by, updated_by, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7,
           $8, $9::jsonb, $10::jsonb, $11, $12, COALESCE($13, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.code,
          input.name,
          input.description,
          input.scope,
          input.autoRemediate,
          input.requireApproval,
          input.policyStatus,
          JSON.stringify(input.rules ?? {}),
          JSON.stringify(input.metadata ?? {}),
          input.createdBy,
          input.updatedBy,
          input.version ?? 1,
        ],
        client,
      );
      return this.mapPolicy(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Reconciliation policy code already exists');
    }
  }

  async getPolicy(id: string): Promise<ReconciliationPolicyRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_reconciliation_policies WHERE id = $1`, [id]);
    return rows[0] ? this.mapPolicy(rows[0]) : null;
  }

  async getPolicyByCode(code: string): Promise<ReconciliationPolicyRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_reconciliation_policies WHERE code = $1`, [
      code,
    ]);
    return rows[0] ? this.mapPolicy(rows[0]) : null;
  }

  async listPolicies(filter: {
    status?: string;
    scope?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ReconciliationPolicyRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`policy_status = $${params.length}`);
    }
    if (filter.scope) {
      params.push(filter.scope);
      where.push(`scope = $${params.length}`);
    }
    if (filter.q) {
      params.push(`%${filter.q}%`);
      where.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p7_reconciliation_policies ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_reconciliation_policies ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapPolicy(r)), total: num(countRows[0]?.c) };
  }

  async updatePolicy(
    id: string,
    patch: Partial<ReconciliationPolicyRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<ReconciliationPolicyRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_reconciliation_policies SET
         name = COALESCE($3, name),
         description = COALESCE($4, description),
         scope = COALESCE($5, scope),
         auto_remediate = COALESCE($6, auto_remediate),
         require_approval = COALESCE($7, require_approval),
         policy_status = COALESCE($8, policy_status),
         rules = COALESCE($9::jsonb, rules),
         metadata = COALESCE($10::jsonb, metadata),
         version = version + 1,
         updated_by = $11,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.name ?? null,
        patch.description === undefined ? null : patch.description,
        patch.scope ?? null,
        patch.autoRemediate === undefined ? null : patch.autoRemediate,
        patch.requireApproval === undefined ? null : patch.requireApproval,
        patch.policyStatus ?? null,
        patch.rules ? JSON.stringify(patch.rules) : null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        actorId,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapPolicy(rows[0]);
  }

  async createRun(
    input: Omit<ReconciliationRunRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ReconciliationRunRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_reconciliation_runs (
         id, tenant_id, product_id, provider_code, policy_id, trigger_kind, run_status,
         provisioning_request_id, authorization_row_id, authorization_version, workflow_id,
         desired_snapshot, observed_snapshot, summary, drift_count, started_at, finished_at,
         performed_by, correlation_id, metadata
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14::jsonb, $15, $16, $17,
         $18, $19, $20::jsonb
       ) RETURNING *`,
      [
        input.id ?? null,
        input.tenantId,
        input.productId,
        input.providerCode,
        input.policyId,
        input.triggerKind,
        input.runStatus ?? ReconciliationRunStatus.PENDING,
        input.provisioningRequestId,
        input.authorizationRowId,
        input.authorizationVersion,
        input.workflowId,
        JSON.stringify(input.desiredSnapshot ?? {}),
        JSON.stringify(input.observedSnapshot ?? {}),
        JSON.stringify(input.summary ?? {}),
        input.driftCount ?? 0,
        input.startedAt ?? new Date(),
        input.finishedAt,
        input.performedBy,
        input.correlationId,
        JSON.stringify(input.metadata ?? {}),
      ],
      client,
    );
    return this.mapRun(rows[0]!);
  }

  async getRun(id: string): Promise<ReconciliationRunRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_reconciliation_runs WHERE id = $1`, [id]);
    return rows[0] ? this.mapRun(rows[0]) : null;
  }

  async listRuns(filter: {
    tenantId?: string;
    productId?: string;
    status?: string;
    policyId?: string;
    providerCode?: string;
    provisioningRequestId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ReconciliationRunRecord[]; total: number }> {
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
      where.push(`run_status = $${params.length}`);
    }
    if (filter.policyId) {
      params.push(filter.policyId);
      where.push(`policy_id = $${params.length}`);
    }
    if (filter.providerCode) {
      params.push(filter.providerCode);
      where.push(`provider_code = $${params.length}`);
    }
    if (filter.provisioningRequestId) {
      params.push(filter.provisioningRequestId);
      where.push(`provisioning_request_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p7_reconciliation_runs ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_reconciliation_runs ${clause}
       ORDER BY started_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapRun(r)), total: num(countRows[0]?.c) };
  }

  async updateRun(
    id: string,
    patch: Partial<ReconciliationRunRecord>,
    client?: unknown,
  ): Promise<ReconciliationRunRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_reconciliation_runs SET
         run_status = COALESCE($2, run_status),
         workflow_id = COALESCE($3, workflow_id),
         desired_snapshot = COALESCE($4::jsonb, desired_snapshot),
         observed_snapshot = COALESCE($5::jsonb, observed_snapshot),
         summary = COALESCE($6::jsonb, summary),
         drift_count = COALESCE($7, drift_count),
         finished_at = COALESCE($8, finished_at),
         metadata = COALESCE($9::jsonb, metadata),
         authorization_row_id = COALESCE($10, authorization_row_id),
         authorization_version = COALESCE($11, authorization_version)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.runStatus ?? null,
        patch.workflowId === undefined ? null : patch.workflowId,
        patch.desiredSnapshot ? JSON.stringify(patch.desiredSnapshot) : null,
        patch.observedSnapshot ? JSON.stringify(patch.observedSnapshot) : null,
        patch.summary ? JSON.stringify(patch.summary) : null,
        patch.driftCount === undefined ? null : patch.driftCount,
        patch.finishedAt === undefined ? null : patch.finishedAt,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        patch.authorizationRowId === undefined ? null : patch.authorizationRowId,
        patch.authorizationVersion === undefined ? null : patch.authorizationVersion,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Reconciliation run not found');
    }
    return this.mapRun(rows[0]);
  }

  async createFinding(
    input: Omit<ReconciliationFindingRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<ReconciliationFindingRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_reconciliation_findings (
         id, run_id, tenant_id, product_id, finding_code, resource_type, resource_ref,
         severity, finding_status, observation_class, desired_state, observed_state,
         last_known_state, auto_remediate_eligible, message, details
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb, $14, $15, $16::jsonb
       ) RETURNING *`,
      [
        input.id ?? null,
        input.runId,
        input.tenantId,
        input.productId,
        input.findingCode,
        input.resourceType,
        input.resourceRef,
        input.severity,
        input.findingStatus ?? FindingStatus.OPEN,
        input.observationClass,
        JSON.stringify(input.desiredState ?? {}),
        JSON.stringify(input.observedState ?? {}),
        JSON.stringify(input.lastKnownState ?? {}),
        input.autoRemediateEligible,
        input.message,
        JSON.stringify(input.details ?? {}),
      ],
      client,
    );
    return this.mapFinding(rows[0]!);
  }

  async createFindings(
    inputs: Array<
      Omit<ReconciliationFindingRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    >,
    client?: unknown,
  ): Promise<ReconciliationFindingRecord[]> {
    const out: ReconciliationFindingRecord[] = [];
    for (const input of inputs) {
      out.push(await this.createFinding(input, client));
    }
    return out;
  }

  async getFinding(id: string): Promise<ReconciliationFindingRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_reconciliation_findings WHERE id = $1`, [id]);
    return rows[0] ? this.mapFinding(rows[0]) : null;
  }

  async listFindings(filter: {
    runId?: string;
    tenantId?: string;
    status?: string;
    observationClass?: string;
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
    if (filter.tenantId) {
      params.push(filter.tenantId);
      where.push(`tenant_id = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`finding_status = $${params.length}`);
    }
    if (filter.observationClass) {
      params.push(filter.observationClass);
      where.push(`observation_class = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p7_reconciliation_findings ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_reconciliation_findings ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapFinding(r)), total: num(countRows[0]?.c) };
  }

  async updateFinding(
    id: string,
    patch: Partial<ReconciliationFindingRecord>,
    client?: unknown,
  ): Promise<ReconciliationFindingRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_reconciliation_findings SET
         finding_status = COALESCE($2, finding_status),
         observation_class = COALESCE($3, observation_class),
         severity = COALESCE($4, severity),
         message = COALESCE($5, message),
         details = COALESCE($6::jsonb, details),
         auto_remediate_eligible = COALESCE($7, auto_remediate_eligible),
         observed_state = COALESCE($8::jsonb, observed_state),
         last_known_state = COALESCE($9::jsonb, last_known_state),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.findingStatus ?? null,
        patch.observationClass ?? null,
        patch.severity ?? null,
        patch.message === undefined ? null : patch.message,
        patch.details ? JSON.stringify(patch.details) : null,
        patch.autoRemediateEligible === undefined ? null : patch.autoRemediateEligible,
        patch.observedState ? JSON.stringify(patch.observedState) : null,
        patch.lastKnownState ? JSON.stringify(patch.lastKnownState) : null,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Reconciliation finding not found');
    }
    return this.mapFinding(rows[0]);
  }

  async createRemediation(
    input: Omit<ReconciliationRemediationRecord, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    },
    client?: unknown,
  ): Promise<ReconciliationRemediationRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_reconciliation_remediations (
         id, finding_id, run_id, tenant_id, remediation_status, plan, workflow_id,
         reversible, approved_by, approved_at, executed_at, evidence, error_code,
         error_message, created_by
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6::jsonb, $7,
         $8, $9, $10, $11, $12::jsonb, $13, $14, $15
       ) RETURNING *`,
      [
        input.id ?? null,
        input.findingId,
        input.runId,
        input.tenantId,
        input.remediationStatus ?? RemediationStatus.PENDING,
        JSON.stringify(input.plan ?? {}),
        input.workflowId,
        input.reversible,
        input.approvedBy,
        input.approvedAt,
        input.executedAt,
        JSON.stringify(input.evidence ?? {}),
        input.errorCode,
        input.errorMessage,
        input.createdBy,
      ],
      client,
    );
    return this.mapRemediation(rows[0]!);
  }

  async getRemediation(id: string): Promise<ReconciliationRemediationRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_reconciliation_remediations WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapRemediation(rows[0]) : null;
  }

  async listRemediations(filter: {
    runId?: string;
    findingId?: string;
    status?: string;
    limit?: number;
  }): Promise<ReconciliationRemediationRecord[]> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.runId) {
      params.push(filter.runId);
      where.push(`run_id = $${params.length}`);
    }
    if (filter.findingId) {
      params.push(filter.findingId);
      where.push(`finding_id = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`remediation_status = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit);
    const rows = await this.q(
      `SELECT * FROM edge_p7_reconciliation_remediations ${clause}
       ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    return rows.map((r) => this.mapRemediation(r));
  }

  async updateRemediation(
    id: string,
    patch: Partial<ReconciliationRemediationRecord>,
    client?: unknown,
  ): Promise<ReconciliationRemediationRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_reconciliation_remediations SET
         remediation_status = COALESCE($2, remediation_status),
         plan = COALESCE($3::jsonb, plan),
         workflow_id = COALESCE($4, workflow_id),
         reversible = COALESCE($5, reversible),
         approved_by = COALESCE($6, approved_by),
         approved_at = COALESCE($7, approved_at),
         executed_at = COALESCE($8, executed_at),
         evidence = COALESCE($9::jsonb, evidence),
         error_code = COALESCE($10, error_code),
         error_message = COALESCE($11, error_message),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.remediationStatus ?? null,
        patch.plan ? JSON.stringify(patch.plan) : null,
        patch.workflowId === undefined ? null : patch.workflowId,
        patch.reversible === undefined ? null : patch.reversible,
        patch.approvedBy === undefined ? null : patch.approvedBy,
        patch.approvedAt === undefined ? null : patch.approvedAt,
        patch.executedAt === undefined ? null : patch.executedAt,
        patch.evidence ? JSON.stringify(patch.evidence) : null,
        patch.errorCode === undefined ? null : patch.errorCode,
        patch.errorMessage === undefined ? null : patch.errorMessage,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Reconciliation remediation not found');
    }
    return this.mapRemediation(rows[0]);
  }

  async createWaiver(
    input: Omit<ReconciliationWaiverRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ReconciliationWaiverRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_reconciliation_waivers (
         id, finding_id, tenant_id, product_id, waiver_code, reason, waiver_status,
         expires_at, created_by, revoked_by, revoked_at, metadata
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12::jsonb
       ) RETURNING *`,
      [
        input.id ?? null,
        input.findingId,
        input.tenantId,
        input.productId,
        input.waiverCode,
        input.reason,
        input.waiverStatus,
        input.expiresAt,
        input.createdBy,
        input.revokedBy,
        input.revokedAt,
        JSON.stringify(input.metadata ?? {}),
      ],
      client,
    );
    return this.mapWaiver(rows[0]!);
  }

  async getWaiver(id: string): Promise<ReconciliationWaiverRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_reconciliation_waivers WHERE id = $1`, [id]);
    return rows[0] ? this.mapWaiver(rows[0]) : null;
  }

  async listWaivers(filter: {
    findingId?: string;
    tenantId?: string;
    status?: string;
    limit?: number;
  }): Promise<ReconciliationWaiverRecord[]> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.findingId) {
      params.push(filter.findingId);
      where.push(`finding_id = $${params.length}`);
    }
    if (filter.tenantId) {
      params.push(filter.tenantId);
      where.push(`tenant_id = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`waiver_status = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit);
    const rows = await this.q(
      `SELECT * FROM edge_p7_reconciliation_waivers ${clause}
       ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    return rows.map((r) => this.mapWaiver(r));
  }

  async listActiveWaivers(filter: {
    tenantId?: string | null;
    productId?: string | null;
    findingId?: string | null;
    now?: Date;
  }): Promise<ReconciliationWaiverRecord[]> {
    const now = filter.now ?? new Date();
    const params: unknown[] = ['ACTIVE', now];
    const where = [`waiver_status = $1`, `expires_at > $2`];
    if (filter.tenantId) {
      params.push(filter.tenantId);
      where.push(`(tenant_id IS NULL OR tenant_id = $${params.length})`);
    }
    if (filter.productId) {
      params.push(filter.productId);
      where.push(`(product_id IS NULL OR product_id = $${params.length})`);
    }
    if (filter.findingId) {
      params.push(filter.findingId);
      where.push(`(finding_id IS NULL OR finding_id = $${params.length})`);
    }
    const rows = await this.q(
      `SELECT * FROM edge_p7_reconciliation_waivers
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC`,
      params,
    );
    return rows.map((r) => this.mapWaiver(r)).filter((w) => isWaiverValid(w, now));
  }

  async updateWaiver(
    id: string,
    patch: Partial<ReconciliationWaiverRecord>,
    client?: unknown,
  ): Promise<ReconciliationWaiverRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_reconciliation_waivers SET
         waiver_status = COALESCE($2, waiver_status),
         revoked_by = COALESCE($3, revoked_by),
         revoked_at = COALESCE($4, revoked_at),
         metadata = COALESCE($5::jsonb, metadata),
         expires_at = COALESCE($6, expires_at)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.waiverStatus ?? null,
        patch.revokedBy === undefined ? null : patch.revokedBy,
        patch.revokedAt === undefined ? null : patch.revokedAt,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        patch.expiresAt === undefined ? null : patch.expiresAt,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Reconciliation waiver not found');
    }
    return this.mapWaiver(rows[0]);
  }

  async createEvidence(
    input: Omit<ReconciliationEvidenceRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ReconciliationEvidenceRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_reconciliation_evidence (
         id, run_id, finding_id, remediation_id, tenant_id, workflow_id, step_key,
         operation, outcome, evidence, error_code, error_message, duration_ms, performed_by
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7,
         $8, $9, $10::jsonb, $11, $12, $13, $14
       ) RETURNING *`,
      [
        input.id ?? null,
        input.runId,
        input.findingId,
        input.remediationId,
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
    runId?: string;
    findingId?: string;
    remediationId?: string;
    limit?: number;
  }): Promise<ReconciliationEvidenceRecord[]> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.runId) {
      params.push(filter.runId);
      where.push(`run_id = $${params.length}`);
    }
    if (filter.findingId) {
      params.push(filter.findingId);
      where.push(`finding_id = $${params.length}`);
    }
    if (filter.remediationId) {
      params.push(filter.remediationId);
      where.push(`remediation_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit);
    const rows = await this.q(
      `SELECT * FROM edge_p7_reconciliation_evidence ${clause}
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
      `INSERT INTO edge_p7_reconciliation_history (
         resource_type, resource_id, tenant_id, from_status, to_status,
         action, reason, actor_id, details
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
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

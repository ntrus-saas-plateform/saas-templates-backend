import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type { OnboardingRepositoryPort } from '../../domain/onboarding/onboarding-repository.port.js';
import type {
  OnboardingEvidenceRecord,
  OnboardingJourneyRecord,
  OnboardingRunRecord,
  OnboardingStepRecord,
  OnboardingTaskRecord,
  OnboardingTemplateRecord,
} from '../../domain/onboarding/onboarding.types.js';
import {
  OnboardingJourneyStatus,
  OnboardingTemplateStatus,
} from '../../domain/onboarding/onboarding.types.js';

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
 * P7.12 PostgreSQL repository — migration 107.
 */
@Injectable()
export class PgOnboardingRepository implements OnboardingRepositoryPort {
  constructor(private readonly cpDb: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.cpDb.getPool();
  }

  private async q<T extends Row = Row>(sql: string, params: unknown[] = [], client?: unknown) {
    const executor = client ? (client as PoolClient) : this.pool;
    return (await executor.query(sql, params)).rows as T[];
  }

  private conflict(): never {
    throw new DomainError(ErrorCode.CONFLICT, 'Optimistic lock conflict on onboarding resource');
  }

  private notFound(label = 'Onboarding resource'): never {
    throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, `${label} not found`);
  }

  private rethrow(err: unknown, message: string, collisionCode = 'ONBOARDING_COLLISION'): never {
    const code = (err as { code?: string } | null)?.code;
    if (code === '23505') {
      throw new DomainError(ErrorCode.CONFLICT, message, [{ code: collisionCode }]);
    }
    if (code === '40001') this.conflict();
    throw err;
  }

  private mapTemplate(row: Row): OnboardingTemplateRecord {
    return {
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      description: strOrNull(row.description),
      productId: strOrNull(row.product_id),
      deploymentProfileCode: strOrNull(row.deployment_profile_code),
      templateStatus: str(row.template_status),
      stepPlan: asJson(row.step_plan, []),
      slaPolicy: asJson(row.sla_policy, {}),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapJourney(row: Row): OnboardingJourneyRecord {
    return {
      id: str(row.id),
      tenantId: str(row.tenant_id),
      productId: str(row.product_id),
      subscriptionId: strOrNull(row.subscription_id),
      accountId: strOrNull(row.account_id),
      templateId: strOrNull(row.template_id),
      activationRecordId: str(row.activation_record_id),
      provisioningRequestId: str(row.provisioning_request_id),
      authorizationRowId: str(row.authorization_row_id),
      authorizationVersion: num(row.authorization_version),
      journeyStatus: str(row.journey_status),
      currentStepKey: strOrNull(row.current_step_key),
      workflowId: strOrNull(row.workflow_id),
      startedAt: asDateOrNull(row.started_at),
      closedAt: asDateOrNull(row.closed_at),
      handoverEvidenceRef: strOrNull(row.handover_evidence_ref),
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

  private mapStep(row: Row): OnboardingStepRecord {
    return {
      id: str(row.id),
      journeyId: str(row.journey_id),
      tenantId: str(row.tenant_id),
      stepKey: str(row.step_key),
      stepOrder: num(row.step_order),
      stepKind: str(row.step_kind),
      stepStatus: str(row.step_status),
      required: asBool(row.required, true),
      dependsOn: asJson(row.depends_on, []),
      message: strOrNull(row.message),
      evidenceRef: strOrNull(row.evidence_ref),
      details: asJson(row.details, {}),
      startedAt: asDateOrNull(row.started_at),
      finishedAt: asDateOrNull(row.finished_at),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapTask(row: Row): OnboardingTaskRecord {
    return {
      id: str(row.id),
      journeyId: str(row.journey_id),
      stepId: strOrNull(row.step_id),
      tenantId: str(row.tenant_id),
      taskCode: str(row.task_code),
      taskStatus: str(row.task_status),
      title: str(row.title),
      description: strOrNull(row.description),
      assigneeRef: strOrNull(row.assignee_ref),
      decisionReason: strOrNull(row.decision_reason),
      decidedBy: strOrNull(row.decided_by),
      decidedAt: asDateOrNull(row.decided_at),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapRun(row: Row): OnboardingRunRecord {
    return {
      id: str(row.id),
      journeyId: str(row.journey_id),
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

  private mapEvidence(row: Row): OnboardingEvidenceRecord {
    return {
      id: str(row.id),
      journeyId: strOrNull(row.journey_id),
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

  async createTemplate(
    input: Omit<OnboardingTemplateRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<OnboardingTemplateRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_onboarding_templates (
           id, code, name, description, product_id, deployment_profile_code,
           template_status, step_plan, sla_policy, metadata, created_by, updated_by, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
           $7, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, COALESCE($13, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.code,
          input.name,
          input.description,
          input.productId,
          input.deploymentProfileCode,
          input.templateStatus ?? OnboardingTemplateStatus.DRAFT,
          JSON.stringify(input.stepPlan ?? []),
          JSON.stringify(input.slaPolicy ?? {}),
          JSON.stringify(input.metadata ?? {}),
          input.createdBy,
          input.updatedBy,
          input.version ?? 1,
        ],
        client,
      );
      return this.mapTemplate(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Onboarding template code already exists');
    }
  }

  async getTemplate(id: string): Promise<OnboardingTemplateRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_onboarding_templates WHERE id = $1`, [id]);
    return rows[0] ? this.mapTemplate(rows[0]) : null;
  }

  async getTemplateByCode(code: string): Promise<OnboardingTemplateRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_onboarding_templates WHERE code = $1`, [
      code,
    ]);
    return rows[0] ? this.mapTemplate(rows[0]) : null;
  }

  async listTemplates(filter: {
    status?: string;
    productId?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: OnboardingTemplateRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`template_status = $${params.length}`);
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
      `SELECT COUNT(*)::int AS c FROM edge_p7_onboarding_templates ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_onboarding_templates ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapTemplate(r)), total: num(countRows[0]?.c) };
  }

  async updateTemplate(
    id: string,
    patch: Partial<OnboardingTemplateRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<OnboardingTemplateRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_onboarding_templates SET
         name = COALESCE($3, name),
         description = COALESCE($4, description),
         product_id = COALESCE($5, product_id),
         deployment_profile_code = COALESCE($6, deployment_profile_code),
         template_status = COALESCE($7, template_status),
         step_plan = COALESCE($8::jsonb, step_plan),
         sla_policy = COALESCE($9::jsonb, sla_policy),
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
        patch.productId === undefined ? null : patch.productId,
        patch.deploymentProfileCode === undefined ? null : patch.deploymentProfileCode,
        patch.templateStatus ?? null,
        patch.stepPlan ? JSON.stringify(patch.stepPlan) : null,
        patch.slaPolicy ? JSON.stringify(patch.slaPolicy) : null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        actorId,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapTemplate(rows[0]);
  }

  async createJourney(
    input: Omit<OnboardingJourneyRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<OnboardingJourneyRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_onboarding_journeys (
           id, tenant_id, product_id, subscription_id, account_id, template_id,
           activation_record_id, provisioning_request_id, authorization_row_id,
           authorization_version, journey_status, current_step_key, workflow_id,
           started_at, closed_at, handover_evidence_ref, failure_code, failure_message,
           metadata, created_by, updated_by, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
           $19::jsonb, $20, $21, COALESCE($22, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.tenantId,
          input.productId,
          input.subscriptionId,
          input.accountId,
          input.templateId,
          input.activationRecordId,
          input.provisioningRequestId,
          input.authorizationRowId,
          input.authorizationVersion,
          input.journeyStatus ?? OnboardingJourneyStatus.PENDING,
          input.currentStepKey,
          input.workflowId,
          input.startedAt,
          input.closedAt,
          input.handoverEvidenceRef,
          input.failureCode,
          input.failureMessage,
          JSON.stringify(input.metadata ?? {}),
          input.createdBy,
          input.updatedBy,
          input.version ?? 1,
        ],
        client,
      );
      return this.mapJourney(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Active onboarding journey already exists for tenant/product');
    }
  }

  async getJourney(id: string): Promise<OnboardingJourneyRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_onboarding_journeys WHERE id = $1`, [id]);
    return rows[0] ? this.mapJourney(rows[0]) : null;
  }

  async getActiveJourney(
    tenantId: string,
    productId: string,
  ): Promise<OnboardingJourneyRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_onboarding_journeys
       WHERE tenant_id = $1 AND product_id = $2
         AND journey_status NOT IN ('CLOSED','CANCELLED','SUPERSEDED')
       ORDER BY created_at DESC LIMIT 1`,
      [tenantId, productId],
    );
    return rows[0] ? this.mapJourney(rows[0]) : null;
  }

  async listJourneys(filter: {
    tenantId?: string;
    productId?: string;
    status?: string;
    activationRecordId?: string;
    templateId?: string;
    provisioningRequestId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: OnboardingJourneyRecord[]; total: number }> {
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
      where.push(`journey_status = $${params.length}`);
    }
    if (filter.activationRecordId) {
      params.push(filter.activationRecordId);
      where.push(`activation_record_id = $${params.length}`);
    }
    if (filter.templateId) {
      params.push(filter.templateId);
      where.push(`template_id = $${params.length}`);
    }
    if (filter.provisioningRequestId) {
      params.push(filter.provisioningRequestId);
      where.push(`provisioning_request_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p7_onboarding_journeys ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_onboarding_journeys ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapJourney(r)), total: num(countRows[0]?.c) };
  }

  async updateJourney(
    id: string,
    patch: Partial<OnboardingJourneyRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<OnboardingJourneyRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_onboarding_journeys SET
         subscription_id = COALESCE($3, subscription_id),
         account_id = COALESCE($4, account_id),
         template_id = COALESCE($5, template_id),
         journey_status = COALESCE($6, journey_status),
         current_step_key = COALESCE($7, current_step_key),
         workflow_id = COALESCE($8, workflow_id),
         started_at = COALESCE($9, started_at),
         closed_at = COALESCE($10, closed_at),
         handover_evidence_ref = COALESCE($11, handover_evidence_ref),
         failure_code = COALESCE($12, failure_code),
         failure_message = COALESCE($13, failure_message),
         metadata = COALESCE($14::jsonb, metadata),
         authorization_row_id = COALESCE($15, authorization_row_id),
         authorization_version = COALESCE($16, authorization_version),
         version = version + 1,
         updated_by = $17,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.subscriptionId === undefined ? null : patch.subscriptionId,
        patch.accountId === undefined ? null : patch.accountId,
        patch.templateId === undefined ? null : patch.templateId,
        patch.journeyStatus ?? null,
        patch.currentStepKey === undefined ? null : patch.currentStepKey,
        patch.workflowId === undefined ? null : patch.workflowId,
        patch.startedAt === undefined ? null : patch.startedAt,
        patch.closedAt === undefined ? null : patch.closedAt,
        patch.handoverEvidenceRef === undefined ? null : patch.handoverEvidenceRef,
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
    return this.mapJourney(rows[0]);
  }

  async createSteps(
    inputs: Array<
      Omit<OnboardingStepRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    >,
    client?: unknown,
  ): Promise<OnboardingStepRecord[]> {
    const out: OnboardingStepRecord[] = [];
    for (const input of inputs) {
      const rows = await this.q(
        `INSERT INTO edge_p7_onboarding_steps (
           id, journey_id, tenant_id, step_key, step_order, step_kind, step_status,
           required, depends_on, message, evidence_ref, details, started_at, finished_at
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7,
           $8, $9::jsonb, $10, $11, $12::jsonb, $13, $14
         ) RETURNING *`,
        [
          input.id ?? null,
          input.journeyId,
          input.tenantId,
          input.stepKey,
          input.stepOrder,
          input.stepKind,
          input.stepStatus,
          input.required,
          JSON.stringify(input.dependsOn ?? []),
          input.message,
          input.evidenceRef,
          JSON.stringify(input.details ?? {}),
          input.startedAt,
          input.finishedAt,
        ],
        client,
      );
      out.push(this.mapStep(rows[0]!));
    }
    return out;
  }

  async listSteps(journeyId: string): Promise<OnboardingStepRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_onboarding_steps
       WHERE journey_id = $1 ORDER BY step_order ASC`,
      [journeyId],
    );
    return rows.map((r) => this.mapStep(r));
  }

  async getStep(id: string): Promise<OnboardingStepRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_onboarding_steps WHERE id = $1`, [id]);
    return rows[0] ? this.mapStep(rows[0]) : null;
  }

  async updateStep(
    id: string,
    patch: Partial<OnboardingStepRecord>,
    client?: unknown,
  ): Promise<OnboardingStepRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_onboarding_steps SET
         step_status = COALESCE($2, step_status),
         message = COALESCE($3, message),
         evidence_ref = COALESCE($4, evidence_ref),
         details = COALESCE($5::jsonb, details),
         started_at = COALESCE($6, started_at),
         finished_at = COALESCE($7, finished_at),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.stepStatus ?? null,
        patch.message === undefined ? null : patch.message,
        patch.evidenceRef === undefined ? null : patch.evidenceRef,
        patch.details ? JSON.stringify(patch.details) : null,
        patch.startedAt === undefined ? null : patch.startedAt,
        patch.finishedAt === undefined ? null : patch.finishedAt,
      ],
      client,
    );
    if (!rows[0]) this.notFound('Onboarding step');
    return this.mapStep(rows[0]);
  }

  async createTask(
    input: Omit<OnboardingTaskRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<OnboardingTaskRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_onboarding_tasks (
         id, journey_id, step_id, tenant_id, task_code, task_status, title, description,
         assignee_ref, decision_reason, decided_by, decided_at, metadata
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, $12, $13::jsonb
       ) RETURNING *`,
      [
        input.id ?? null,
        input.journeyId,
        input.stepId,
        input.tenantId,
        input.taskCode,
        input.taskStatus,
        input.title,
        input.description,
        input.assigneeRef,
        input.decisionReason,
        input.decidedBy,
        input.decidedAt,
        JSON.stringify(input.metadata ?? {}),
      ],
      client,
    );
    return this.mapTask(rows[0]!);
  }

  async getTask(id: string): Promise<OnboardingTaskRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_onboarding_tasks WHERE id = $1`, [id]);
    return rows[0] ? this.mapTask(rows[0]) : null;
  }

  async listTasks(filter: {
    journeyId?: string;
    status?: string;
    limit?: number;
  }): Promise<OnboardingTaskRecord[]> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.journeyId) {
      params.push(filter.journeyId);
      where.push(`journey_id = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`task_status = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit);
    const rows = await this.q(
      `SELECT * FROM edge_p7_onboarding_tasks ${clause}
       ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    return rows.map((r) => this.mapTask(r));
  }

  async updateTask(
    id: string,
    patch: Partial<OnboardingTaskRecord>,
    client?: unknown,
  ): Promise<OnboardingTaskRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_onboarding_tasks SET
         task_status = COALESCE($2, task_status),
         assignee_ref = COALESCE($3, assignee_ref),
         decision_reason = COALESCE($4, decision_reason),
         decided_by = COALESCE($5, decided_by),
         decided_at = COALESCE($6, decided_at),
         metadata = COALESCE($7::jsonb, metadata),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.taskStatus ?? null,
        patch.assigneeRef === undefined ? null : patch.assigneeRef,
        patch.decisionReason === undefined ? null : patch.decisionReason,
        patch.decidedBy === undefined ? null : patch.decidedBy,
        patch.decidedAt === undefined ? null : patch.decidedAt,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
      ],
      client,
    );
    if (!rows[0]) this.notFound('Onboarding task');
    return this.mapTask(rows[0]);
  }

  async createRun(
    input: Omit<OnboardingRunRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<OnboardingRunRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_onboarding_runs (
         id, journey_id, tenant_id, product_id, operation,
         workflow_id, outcome, error_code, error_message, observed_state, evidence,
         started_at, finished_at, performed_by, correlation_id
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5,
         $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13, $14, $15
       ) RETURNING *`,
      [
        input.id ?? null,
        input.journeyId,
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

  async listRuns(journeyId: string, limit = 50): Promise<OnboardingRunRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_onboarding_runs
       WHERE journey_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [journeyId, Math.min(Math.max(limit, 1), 200)],
    );
    return rows.map((r) => this.mapRun(r));
  }

  async updateRun(
    id: string,
    patch: Partial<OnboardingRunRecord>,
    client?: unknown,
  ): Promise<OnboardingRunRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_onboarding_runs SET
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
    if (!rows[0]) this.notFound('Onboarding run');
    return this.mapRun(rows[0]);
  }

  async createEvidence(
    input: Omit<OnboardingEvidenceRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<OnboardingEvidenceRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_onboarding_evidence (
         id, journey_id, tenant_id, workflow_id, step_key,
         operation, outcome, evidence, error_code, error_message, duration_ms, performed_by
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5,
         $6, $7, $8::jsonb, $9, $10, $11, $12
       ) RETURNING *`,
      [
        input.id ?? null,
        input.journeyId,
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
    journeyId?: string;
    limit?: number;
  }): Promise<OnboardingEvidenceRecord[]> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 500);
    if (!filter.journeyId) return [];
    const rows = await this.q(
      `SELECT * FROM edge_p7_onboarding_evidence
       WHERE journey_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [filter.journeyId, limit],
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
      `INSERT INTO edge_p7_onboarding_history (
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

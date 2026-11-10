import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import { assertFencingToken, nextFencingToken } from '../../domain/workflow/fencing.js';
import { assertStepTransition } from '../../domain/workflow/workflow-lifecycle.js';
import type {
  ClaimStepResult,
  WorkflowListFilter,
  WorkflowRepositoryPort,
} from '../../domain/workflow/workflow-repository.port.js';
import {
  CompensationStatus,
  DeadLetterStatus,
  HumanTaskStatus,
  HumanTaskType,
  WorkerRegistryStatus,
  WorkflowDefinitionStatus,
  WorkflowHistoryResourceType,
  WorkflowInstanceState,
  WorkflowStepStatus,
  type WorkflowAttemptRecord,
  type WorkflowCheckpointRecord,
  type WorkflowCompensationRecord,
  type WorkflowDeadLetterRecord,
  type WorkflowDefinitionRecord,
  type WorkflowDefinitionSnapshot,
  type WorkflowDefinitionVersionRecord,
  type WorkflowHistoryEntry,
  type WorkflowHumanTaskRecord,
  type WorkflowInstanceRecord,
  type WorkflowStepRecord,
  type WorkflowWorkerRecord,
} from '../../domain/workflow/workflow.types.js';

type Row = Record<string, unknown>;

function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
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
function asDate(v: unknown): Date {
  return v instanceof Date ? v : new Date(String(v));
}
function asDateOrNull(v: unknown): Date | null {
  return v == null ? null : asDate(v);
}
function asStrOrNull(v: unknown): string | null {
  return v == null ? null : String(v);
}

@Injectable()
export class PgWorkflowRepository implements WorkflowRepositoryPort {
  constructor(private readonly cpDb: ControlPlaneDatabaseService) {}
  private get pool(): Pool {
    return this.cpDb.getPool();
  }
  private async q<T extends Row = Row>(sql: string, params: unknown[] = [], client?: unknown) {
    const executor = client ? (client as PoolClient) : this.pool;
    return (await executor.query(sql, params)).rows as T[];
  }
  private conflict(): never {
    throw new DomainError(ErrorCode.CONFLICT, 'Optimistic lock conflict on workflow resource');
  }

  private mapDefinition(r: Row): WorkflowDefinitionRecord {
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      description: asStrOrNull(r.description),
      domain: String(r.domain),
      definitionStatus: String(r.definition_status) as WorkflowDefinitionStatus,
      securityClassification: asStrOrNull(r.security_classification),
      createdBy: asStrOrNull(r.created_by),
      approvedBy: asStrOrNull(r.approved_by),
      publishedAt: asDateOrNull(r.published_at),
      version: num(r.version),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  }
  private mapDefinitionVersion(r: Row): WorkflowDefinitionVersionRecord {
    return {
      id: String(r.id),
      definitionId: String(r.definition_id),
      versionNumber: num(r.version_number),
      snapshot: asJson(r.snapshot, { steps: [] }),
      status: String(r.status) as WorkflowDefinitionStatus,
      publishedAt: asDateOrNull(r.published_at),
      createdAt: asDate(r.created_at),
    };
  }
  private mapInstance(r: Row): WorkflowInstanceRecord {
    return {
      id: String(r.id),
      definitionId: String(r.definition_id),
      definitionVersion: num(r.definition_version),
      definitionSnapshot: asJson(r.definition_snapshot, { steps: [] }),
      workflowType: String(r.workflow_type),
      businessReference: asStrOrNull(r.business_reference),
      provisioningRequestId: asStrOrNull(r.provisioning_request_id),
      placementDecisionId: asStrOrNull(r.placement_decision_id),
      authorizationRowId: asStrOrNull(r.authorization_row_id),
      authorizationId: asStrOrNull(r.authorization_id),
      authorizationVersion: r.authorization_version == null ? null : num(r.authorization_version),
      accountId: asStrOrNull(r.account_id),
      productId: asStrOrNull(r.product_id),
      subscriptionId: asStrOrNull(r.subscription_id),
      correlationId: String(r.correlation_id),
      causationId: asStrOrNull(r.causation_id),
      idempotencyKey: String(r.idempotency_key),
      inputSnapshot: asJson(r.input_snapshot, {}),
      state: String(r.state) as WorkflowInstanceState,
      currentStepKey: asStrOrNull(r.current_step_key),
      startedAt: asDateOrNull(r.started_at),
      completedAt: asDateOrNull(r.completed_at),
      deadlineAt: asDateOrNull(r.deadline_at),
      cancellationReason: asStrOrNull(r.cancellation_reason),
      failureDetails: asJson(r.failure_details, {}),
      initiatingActor: asStrOrNull(r.initiating_actor),
      executionContext: asJson(r.execution_context, {}),
      version: num(r.version),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  }
  private mapStep(r: Row): WorkflowStepRecord {
    return {
      id: String(r.id),
      workflowId: String(r.workflow_id),
      stepKey: String(r.step_key),
      stepType: String(r.step_type),
      handlerKey: String(r.handler_key),
      dependsOn: asJson(r.depends_on, []),
      inputSnapshot: asJson(r.input_snapshot, {}),
      outputSnapshot: asJson(r.output_snapshot, {}),
      status: String(r.status) as WorkflowStepStatus,
      attemptCount: num(r.attempt_count),
      maxAttempts: num(r.max_attempts),
      idempotencyKey: String(r.idempotency_key),
      ownerWorkerId: asStrOrNull(r.owner_worker_id),
      leaseExpiresAt: asDateOrNull(r.lease_expires_at),
      fencingToken: num(r.fencing_token),
      startedAt: asDateOrNull(r.started_at),
      finishedAt: asDateOrNull(r.finished_at),
      timeoutAt: asDateOrNull(r.timeout_at),
      errorClass: asStrOrNull(r.error_class),
      nextRetryAt: asDateOrNull(r.next_retry_at),
      compensationHandlerKey: asStrOrNull(r.compensation_handler_key),
      executionOrder: num(r.execution_order),
      version: num(r.version),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  }
  private mapAttempt(r: Row): WorkflowAttemptRecord {
    return {
      id: String(r.id),
      stepId: String(r.step_id),
      attemptNumber: num(r.attempt_number),
      workerId: String(r.worker_id),
      fencingToken: num(r.fencing_token),
      startedAt: asDate(r.started_at),
      endedAt: asDateOrNull(r.ended_at),
      result: asStrOrNull(r.result),
      errorClass: asStrOrNull(r.error_class),
      retryClassification: asStrOrNull(r.retry_classification),
      durationMs: r.duration_ms == null ? null : num(r.duration_ms),
      correlationId: asStrOrNull(r.correlation_id),
      diagnostics: asJson(r.diagnostics, {}),
      createdAt: asDate(r.created_at),
    };
  }
  private mapCheckpoint(r: Row): WorkflowCheckpointRecord {
    return {
      id: String(r.id),
      workflowId: String(r.workflow_id),
      stepId: asStrOrNull(r.step_id),
      sequence: num(r.sequence),
      definitionVersion: num(r.definition_version),
      stateSnapshot: asJson(r.state_snapshot, {}),
      outputRef: asStrOrNull(r.output_ref),
      integrityHash: asStrOrNull(r.integrity_hash),
      createdAt: asDate(r.created_at),
    };
  }
  private mapCompensation(r: Row): WorkflowCompensationRecord {
    return {
      id: String(r.id),
      stepId: String(r.step_id),
      workflowId: String(r.workflow_id),
      handlerKey: String(r.handler_key),
      input: asJson(r.input, {}),
      status: String(r.status) as CompensationStatus,
      attempts: num(r.attempts),
      timeoutAt: asDateOrNull(r.timeout_at),
      result: asJson(r.result, {}),
      failureDetails: asJson(r.failure_details, {}),
      executionOrder: num(r.execution_order),
      version: num(r.version),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  }
  private mapTask(r: Row): WorkflowHumanTaskRecord {
    return {
      id: String(r.id),
      workflowId: String(r.workflow_id),
      stepId: asStrOrNull(r.step_id),
      taskType: String(r.task_type) as HumanTaskType,
      requiredPermission: String(r.required_permission),
      assignee: asStrOrNull(r.assignee),
      dueAt: asDateOrNull(r.due_at),
      contextSnapshot: asJson(r.context_snapshot, {}),
      instructions: asStrOrNull(r.instructions),
      decision: asStrOrNull(r.decision),
      decisionReason: asStrOrNull(r.decision_reason),
      actorId: asStrOrNull(r.actor_id),
      status: String(r.status) as HumanTaskStatus,
      version: num(r.version),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  }
  private mapHistory(r: Row): WorkflowHistoryEntry {
    return {
      id: String(r.id),
      resourceType: String(r.resource_type) as WorkflowHistoryResourceType,
      resourceId: String(r.resource_id),
      workflowId: asStrOrNull(r.workflow_id),
      fromStatus: asStrOrNull(r.from_status),
      toStatus: asStrOrNull(r.to_status),
      action: String(r.action),
      reason: asStrOrNull(r.reason),
      actorId: String(r.actor_id),
      details: asJson(r.details, {}),
      createdAt: asDate(r.created_at),
    };
  }
  private mapDeadLetter(r: Row): WorkflowDeadLetterRecord {
    return {
      id: String(r.id),
      workflowId: String(r.workflow_id),
      stepId: asStrOrNull(r.step_id),
      reason: String(r.reason),
      payload: asJson(r.payload, {}),
      status: String(r.status) as DeadLetterStatus,
      createdAt: asDate(r.created_at),
      resolvedAt: asDateOrNull(r.resolved_at),
      resolvedBy: asStrOrNull(r.resolved_by),
    };
  }
  private mapWorker(r: Row): WorkflowWorkerRecord {
    return {
      id: String(r.id),
      workerId: String(r.worker_id),
      identity: String(r.identity),
      workerVersion: String(r.worker_version),
      status: String(r.status) as WorkerRegistryStatus,
      lastHeartbeatAt: asDate(r.last_heartbeat_at),
      metadata: asJson(r.metadata, {}),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  }

  async createDefinition(
    input: Omit<WorkflowDefinitionRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      version?: number;
      draftSnapshot: WorkflowDefinitionSnapshot;
    },
    client?: unknown,
  ) {
    const rows = await this.q(
      `INSERT INTO edge_p7_workflow_definitions (
         code, name, description, domain, definition_status, security_classification,
         created_by, approved_by, published_at, version
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        input.code,
        input.name,
        input.description,
        input.domain,
        input.definitionStatus,
        input.securityClassification,
        input.createdBy,
        input.approvedBy,
        input.publishedAt,
        input.version ?? 1,
      ],
      client,
    );
    const definition = this.mapDefinition(rows[0]!);
    const verRows = await this.q(
      `INSERT INTO edge_p7_workflow_definition_versions
         (definition_id, version_number, snapshot, status)
       VALUES ($1,1,$2::jsonb,$3) RETURNING *`,
      [definition.id, JSON.stringify(input.draftSnapshot), WorkflowDefinitionStatus.DRAFT],
      client,
    );
    return { definition, version: this.mapDefinitionVersion(verRows[0]!) };
  }

  async updateDefinitionDraft(
    id: string,
    patch: Partial<WorkflowDefinitionRecord> & { draftSnapshot?: WorkflowDefinitionSnapshot },
    expectedVersion: number,
    client?: unknown,
  ) {
    const rows = await this.q(
      `UPDATE edge_p7_workflow_definitions SET
         name = COALESCE($3, name),
         description = COALESCE($4, description),
         domain = COALESCE($5, domain),
         security_classification = COALESCE($6, security_classification),
         version = version + 1, updated_at = NOW()
       WHERE id = $1 AND version = $2 RETURNING *`,
      [
        id,
        expectedVersion,
        patch.name ?? null,
        patch.description ?? null,
        patch.domain ?? null,
        patch.securityClassification ?? null,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    if (patch.draftSnapshot) {
      await this.q(
        `UPDATE edge_p7_workflow_definition_versions SET snapshot = $2::jsonb
         WHERE definition_id = $1 AND status = 'DRAFT'
           AND version_number = (
             SELECT MAX(version_number) FROM edge_p7_workflow_definition_versions WHERE definition_id = $1
           )`,
        [id, JSON.stringify(patch.draftSnapshot)],
        client,
      );
    }
    return this.mapDefinition(rows[0]!);
  }

  async getDefinition(id: string) {
    const rows = await this.q(`SELECT * FROM edge_p7_workflow_definitions WHERE id = $1`, [id]);
    return rows[0] ? this.mapDefinition(rows[0]) : null;
  }
  async getDefinitionByCode(code: string) {
    const rows = await this.q(`SELECT * FROM edge_p7_workflow_definitions WHERE code = $1`, [code]);
    return rows[0] ? this.mapDefinition(rows[0]) : null;
  }
  async listDefinitions(filter: WorkflowListFilter) {
    const limit = Math.min(filter.limit ?? 20, 100);
    const offset = filter.offset ?? 0;
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`definition_status = $${params.length}`);
    }
    if (filter.q) {
      params.push(`%${filter.q}%`);
      where.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
    }
    const wh = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRows = await this.q(
      `SELECT COUNT(*)::text AS c FROM edge_p7_workflow_definitions ${wh}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_workflow_definitions ${wh}
       ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapDefinition(r)), total: num(totalRows[0]?.c) };
  }
  async getDefinitionVersion(definitionId: string, versionNumber: number) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_workflow_definition_versions
       WHERE definition_id = $1 AND version_number = $2`,
      [definitionId, versionNumber],
    );
    return rows[0] ? this.mapDefinitionVersion(rows[0]) : null;
  }
  async getLatestDefinitionVersion(definitionId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_workflow_definition_versions
       WHERE definition_id = $1 ORDER BY version_number DESC LIMIT 1`,
      [definitionId],
    );
    return rows[0] ? this.mapDefinitionVersion(rows[0]) : null;
  }
  async setDefinitionStatus(
    id: string,
    status: WorkflowDefinitionStatus,
    expectedVersion: number,
    meta: { approvedBy?: string | null; publishedAt?: Date | null },
    client?: unknown,
  ) {
    const rows = await this.q(
      `UPDATE edge_p7_workflow_definitions SET
         definition_status = $3,
         approved_by = COALESCE($4, approved_by),
         published_at = COALESCE($5, published_at),
         version = version + 1, updated_at = NOW()
       WHERE id = $1 AND version = $2 RETURNING *`,
      [id, expectedVersion, status, meta.approvedBy ?? null, meta.publishedAt ?? null],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapDefinition(rows[0]!);
  }
  async publishDefinitionVersion(
    definitionId: string,
    versionNumber: number,
    snapshot: WorkflowDefinitionSnapshot,
    client?: unknown,
  ) {
    const rows = await this.q(
      `INSERT INTO edge_p7_workflow_definition_versions
         (definition_id, version_number, snapshot, status, published_at)
       VALUES ($1,$2,$3::jsonb,'PUBLISHED',NOW())
       ON CONFLICT (definition_id, version_number) DO UPDATE SET
         snapshot = EXCLUDED.snapshot, status = 'PUBLISHED', published_at = NOW()
       RETURNING *`,
      [definitionId, versionNumber, JSON.stringify(snapshot)],
      client,
    );
    return this.mapDefinitionVersion(rows[0]!);
  }

  async createInstance(
    input: Omit<WorkflowInstanceRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      version?: number;
    },
    client?: unknown,
  ) {
    const rows = await this.q(
      `INSERT INTO edge_p7_workflow_instances (
         definition_id, definition_version, definition_snapshot, workflow_type, business_reference,
         provisioning_request_id, placement_decision_id, authorization_row_id, authorization_id,
         authorization_version, account_id, product_id, subscription_id, correlation_id, causation_id,
         idempotency_key, input_snapshot, state, current_step_key, started_at, completed_at,
         deadline_at, cancellation_reason, failure_details, initiating_actor, execution_context, version
       ) VALUES (
         $1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21,$22,$23,$24::jsonb,$25,$26::jsonb,$27
       ) RETURNING *`,
      [
        input.definitionId,
        input.definitionVersion,
        JSON.stringify(input.definitionSnapshot),
        input.workflowType,
        input.businessReference,
        input.provisioningRequestId,
        input.placementDecisionId,
        input.authorizationRowId,
        input.authorizationId,
        input.authorizationVersion,
        input.accountId,
        input.productId,
        input.subscriptionId,
        input.correlationId,
        input.causationId,
        input.idempotencyKey,
        JSON.stringify(input.inputSnapshot),
        input.state,
        input.currentStepKey,
        input.startedAt,
        input.completedAt,
        input.deadlineAt,
        input.cancellationReason,
        JSON.stringify(input.failureDetails),
        input.initiatingActor,
        JSON.stringify(input.executionContext),
        input.version ?? 1,
      ],
      client,
    );
    return this.mapInstance(rows[0]!);
  }
  async getInstance(id: string) {
    const rows = await this.q(`SELECT * FROM edge_p7_workflow_instances WHERE id = $1`, [id]);
    return rows[0] ? this.mapInstance(rows[0]) : null;
  }
  async getInstanceByIdempotencyKey(key: string) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_workflow_instances WHERE idempotency_key = $1`,
      [key],
    );
    return rows[0] ? this.mapInstance(rows[0]) : null;
  }
  async listInstances(filter: WorkflowListFilter & { workflowType?: string }) {
    const limit = Math.min(filter.limit ?? 20, 100);
    const offset = filter.offset ?? 0;
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`state = $${params.length}`);
    }
    if (filter.workflowType) {
      params.push(filter.workflowType);
      where.push(`workflow_type = $${params.length}`);
    }
    if (filter.q) {
      params.push(`%${filter.q}%`);
      where.push(
        `(idempotency_key ILIKE $${params.length} OR business_reference ILIKE $${params.length})`,
      );
    }
    const wh = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRows = await this.q(
      `SELECT COUNT(*)::text AS c FROM edge_p7_workflow_instances ${wh}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_workflow_instances ${wh}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapInstance(r)), total: num(totalRows[0]?.c) };
  }
  async updateInstanceState(
    id: string,
    patch: Partial<WorkflowInstanceRecord>,
    expectedVersion: number,
    client?: unknown,
  ) {
    const rows = await this.q(
      `UPDATE edge_p7_workflow_instances SET
         state = COALESCE($3, state),
         current_step_key = COALESCE($4, current_step_key),
         started_at = COALESCE($5, started_at),
         completed_at = COALESCE($6, completed_at),
         deadline_at = COALESCE($7, deadline_at),
         cancellation_reason = COALESCE($8, cancellation_reason),
         failure_details = COALESCE($9::jsonb, failure_details),
         execution_context = COALESCE($10::jsonb, execution_context),
         placement_decision_id = COALESCE($11, placement_decision_id),
         version = version + 1, updated_at = NOW()
       WHERE id = $1 AND version = $2 RETURNING *`,
      [
        id,
        expectedVersion,
        patch.state ?? null,
        patch.currentStepKey ?? null,
        patch.startedAt ?? null,
        patch.completedAt ?? null,
        patch.deadlineAt ?? null,
        patch.cancellationReason ?? null,
        patch.failureDetails ? JSON.stringify(patch.failureDetails) : null,
        patch.executionContext ? JSON.stringify(patch.executionContext) : null,
        patch.placementDecisionId ?? null,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapInstance(rows[0]!);
  }
  async listInstancesForReconcile(limit: number) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_workflow_instances
       WHERE state NOT IN ('SUCCEEDED','FAILED','CANCELLED','TIMED_OUT')
       ORDER BY updated_at ASC LIMIT $1`,
      [limit],
    );
    return rows.map((r) => this.mapInstance(r));
  }

  async createSteps(
    steps: Array<
      Omit<WorkflowStepRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & { version?: number }
    >,
    client?: unknown,
  ) {
    const out: WorkflowStepRecord[] = [];
    for (const s of steps) {
      const rows = await this.q(
        `INSERT INTO edge_p7_workflow_steps (
           workflow_id, step_key, step_type, handler_key, depends_on, input_snapshot, output_snapshot,
           status, attempt_count, max_attempts, idempotency_key, owner_worker_id, lease_expires_at,
           fencing_token, started_at, finished_at, timeout_at, error_class, next_retry_at,
           compensation_handler_key, execution_order, version
         ) VALUES (
           $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
         ) RETURNING *`,
        [
          s.workflowId,
          s.stepKey,
          s.stepType,
          s.handlerKey,
          JSON.stringify(s.dependsOn),
          JSON.stringify(s.inputSnapshot),
          JSON.stringify(s.outputSnapshot),
          s.status,
          s.attemptCount,
          s.maxAttempts,
          s.idempotencyKey,
          s.ownerWorkerId,
          s.leaseExpiresAt,
          s.fencingToken,
          s.startedAt,
          s.finishedAt,
          s.timeoutAt,
          s.errorClass,
          s.nextRetryAt,
          s.compensationHandlerKey,
          s.executionOrder,
          s.version ?? 1,
        ],
        client,
      );
      out.push(this.mapStep(rows[0]!));
    }
    return out;
  }
  async getStep(id: string) {
    const rows = await this.q(`SELECT * FROM edge_p7_workflow_steps WHERE id = $1`, [id]);
    return rows[0] ? this.mapStep(rows[0]) : null;
  }
  async listSteps(workflowId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_workflow_steps WHERE workflow_id = $1 ORDER BY execution_order ASC`,
      [workflowId],
    );
    return rows.map((r) => this.mapStep(r));
  }
  async updateStep(
    id: string,
    patch: Partial<WorkflowStepRecord>,
    expectedVersion: number,
    client?: unknown,
  ) {
    const rows = await this.q(
      `UPDATE edge_p7_workflow_steps SET
         status = COALESCE($3, status),
         input_snapshot = COALESCE($4::jsonb, input_snapshot),
         output_snapshot = COALESCE($5::jsonb, output_snapshot),
         attempt_count = COALESCE($6, attempt_count),
         owner_worker_id = COALESCE($7, owner_worker_id),
         lease_expires_at = COALESCE($8, lease_expires_at),
         fencing_token = COALESCE($9, fencing_token),
         started_at = COALESCE($10, started_at),
         finished_at = COALESCE($11, finished_at),
         timeout_at = COALESCE($12, timeout_at),
         error_class = COALESCE($13, error_class),
         next_retry_at = COALESCE($14, next_retry_at),
         version = version + 1, updated_at = NOW()
       WHERE id = $1 AND version = $2 RETURNING *`,
      [
        id,
        expectedVersion,
        patch.status ?? null,
        patch.inputSnapshot ? JSON.stringify(patch.inputSnapshot) : null,
        patch.outputSnapshot ? JSON.stringify(patch.outputSnapshot) : null,
        patch.attemptCount ?? null,
        patch.ownerWorkerId ?? null,
        patch.leaseExpiresAt === undefined ? null : patch.leaseExpiresAt,
        patch.fencingToken ?? null,
        patch.startedAt ?? null,
        patch.finishedAt ?? null,
        patch.timeoutAt ?? null,
        patch.errorClass ?? null,
        patch.nextRetryAt === undefined ? null : patch.nextRetryAt,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapStep(rows[0]!);
  }

  async claimStepForUpdateSkipLocked(params: {
    workerId: string;
    leaseMs: number;
    handlerKeys?: string[];
    client?: unknown;
  }): Promise<ClaimStepResult | null> {
    const run = async (client: PoolClient, ownTx: boolean) => {
      if (ownTx) await client.query('BEGIN');
      try {
        const eligible = await client.query(
          `SELECT s.*
           FROM edge_p7_workflow_steps s
           INNER JOIN edge_p7_workflow_instances w ON w.id = s.workflow_id
           WHERE s.status IN ('READY','RETRY_PENDING')
             AND (s.next_retry_at IS NULL OR s.next_retry_at <= NOW())
             AND w.state IN ('READY','RUNNING','RETRY_PENDING','WAITING')
             AND ($1::text[] IS NULL OR s.handler_key = ANY($1::text[]))
           ORDER BY s.created_at ASC
           FOR UPDATE OF s SKIP LOCKED
           LIMIT 1`,
          [params.handlerKeys ?? null],
        );
        if (!eligible.rows[0]) {
          if (ownTx) await client.query('COMMIT');
          return null;
        }
        const current = this.mapStep(eligible.rows[0] as Row);
        const fencing = nextFencingToken(current.fencingToken);
        const leaseExpires = new Date(Date.now() + params.leaseMs);
        assertStepTransition(current.status, WorkflowStepStatus.CLAIMED);
        const updated = await client.query(
          `UPDATE edge_p7_workflow_steps SET
             status = 'CLAIMED', owner_worker_id = $2, lease_expires_at = $3,
             fencing_token = $4, attempt_count = attempt_count + 1,
             started_at = COALESCE(started_at, NOW()), next_retry_at = NULL,
             version = version + 1, updated_at = NOW()
           WHERE id = $1 AND version = $5 RETURNING *`,
          [current.id, params.workerId, leaseExpires, fencing, current.version],
        );
        if (!updated.rows[0]) {
          throw new DomainError(ErrorCode.CONFLICT, 'Failed to claim step');
        }
        const step = this.mapStep(updated.rows[0] as Row);
        const attemptRes = await client.query(
          `INSERT INTO edge_p7_workflow_attempts
             (step_id, attempt_number, worker_id, fencing_token, started_at, result)
           VALUES ($1,$2,$3,$4,NOW(),'CLAIMED') RETURNING *`,
          [step.id, step.attemptCount, params.workerId, fencing],
        );
        const wfRes = await client.query(
          `SELECT * FROM edge_p7_workflow_instances WHERE id = $1`,
          [step.workflowId],
        );
        if (ownTx) await client.query('COMMIT');
        return {
          step,
          workflow: this.mapInstance(wfRes.rows[0] as Row),
          attempt: this.mapAttempt(attemptRes.rows[0] as Row),
        };
      } catch (e) {
        if (ownTx) await client.query('ROLLBACK');
        throw e;
      }
    };
    if (params.client) return run(params.client as PoolClient, false);
    const client = await this.pool.connect();
    try {
      return await run(client, true);
    } finally {
      client.release();
    }
  }

  async renewLease(params: {
    stepId: string;
    workerId: string;
    fencingToken: number;
    expectedVersion: number;
    leaseMs: number;
    client?: unknown;
  }) {
    const step = await this.getStep(params.stepId);
    if (!step) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Step not found');
    assertFencingToken(step.fencingToken, params.fencingToken);
    if (step.ownerWorkerId !== params.workerId) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'Worker does not own lease');
    }
    return this.updateStep(
      params.stepId,
      {
        leaseExpiresAt: new Date(Date.now() + params.leaseMs),
        status:
          step.status === WorkflowStepStatus.CLAIMED ? WorkflowStepStatus.RUNNING : step.status,
      },
      params.expectedVersion,
      params.client,
    );
  }

  async completeStep(params: {
    stepId: string;
    workerId: string;
    fencingToken: number;
    expectedVersion: number;
    outputSnapshot: Record<string, unknown>;
    client?: unknown;
  }) {
    const step = await this.getStep(params.stepId);
    if (!step) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Step not found');
    assertFencingToken(step.fencingToken, params.fencingToken);
    if (step.ownerWorkerId !== params.workerId) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'Worker does not own lease');
    }
    assertStepTransition(step.status, WorkflowStepStatus.SUCCEEDED);
    const updated = await this.updateStep(
      params.stepId,
      {
        status: WorkflowStepStatus.SUCCEEDED,
        outputSnapshot: params.outputSnapshot,
        finishedAt: new Date(),
        ownerWorkerId: params.workerId,
      },
      params.expectedVersion,
      params.client,
    );
    await this.q(
      `UPDATE edge_p7_workflow_attempts SET ended_at = NOW(), result = 'SUCCEEDED',
         duration_ms = GREATEST(0, (EXTRACT(EPOCH FROM (NOW() - started_at))*1000)::int)
       WHERE step_id = $1 AND attempt_number = $2 AND fencing_token = $3`,
      [params.stepId, step.attemptCount, params.fencingToken],
      params.client,
    );
    return updated;
  }

  async failStep(params: {
    stepId: string;
    workerId: string;
    fencingToken: number;
    expectedVersion: number;
    errorClass: string;
    diagnostics?: Record<string, unknown>;
    nextStatus: WorkflowStepStatus;
    nextRetryAt?: Date | null;
    client?: unknown;
  }) {
    const step = await this.getStep(params.stepId);
    if (!step) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Step not found');
    assertFencingToken(step.fencingToken, params.fencingToken);
    if (step.ownerWorkerId !== params.workerId) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'Worker does not own lease');
    }
    assertStepTransition(step.status, params.nextStatus);
    const updated = await this.updateStep(
      params.stepId,
      {
        status: params.nextStatus,
        errorClass: params.errorClass,
        nextRetryAt: params.nextRetryAt ?? null,
        finishedAt: params.nextStatus === WorkflowStepStatus.RETRY_PENDING ? null : new Date(),
      },
      params.expectedVersion,
      params.client,
    );
    await this.q(
      `UPDATE edge_p7_workflow_attempts SET ended_at = NOW(), result = 'FAILED',
         error_class = $4, diagnostics = $5::jsonb,
         duration_ms = GREATEST(0, (EXTRACT(EPOCH FROM (NOW() - started_at))*1000)::int)
       WHERE step_id = $1 AND attempt_number = $2 AND fencing_token = $3`,
      [
        params.stepId,
        step.attemptCount,
        params.fencingToken,
        params.errorClass,
        JSON.stringify(params.diagnostics ?? {}),
      ],
      params.client,
    );
    return updated;
  }

  async listExpiredLeases(now: Date, limit: number) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_workflow_steps
       WHERE status IN ('CLAIMED','RUNNING')
         AND lease_expires_at IS NOT NULL AND lease_expires_at < $1
       ORDER BY lease_expires_at ASC LIMIT $2`,
      [now, limit],
    );
    return rows.map((r) => this.mapStep(r));
  }
  async listDueRetries(now: Date, limit: number) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_workflow_steps
       WHERE status = 'RETRY_PENDING' AND next_retry_at IS NOT NULL AND next_retry_at <= $1
       ORDER BY next_retry_at ASC LIMIT $2`,
      [now, limit],
    );
    return rows.map((r) => this.mapStep(r));
  }

  async appendAttempt(
    input: Omit<WorkflowAttemptRecord, 'id' | 'createdAt'>,
    client?: unknown,
  ) {
    const rows = await this.q(
      `INSERT INTO edge_p7_workflow_attempts (
         step_id, attempt_number, worker_id, fencing_token, started_at, ended_at, result,
         error_class, retry_classification, duration_ms, correlation_id, diagnostics
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) RETURNING *`,
      [
        input.stepId,
        input.attemptNumber,
        input.workerId,
        input.fencingToken,
        input.startedAt,
        input.endedAt,
        input.result,
        input.errorClass,
        input.retryClassification,
        input.durationMs,
        input.correlationId,
        JSON.stringify(input.diagnostics),
      ],
      client,
    );
    return this.mapAttempt(rows[0]!);
  }
  async listAttempts(workflowId: string) {
    const rows = await this.q(
      `SELECT a.* FROM edge_p7_workflow_attempts a
       INNER JOIN edge_p7_workflow_steps s ON s.id = a.step_id
       WHERE s.workflow_id = $1 ORDER BY a.created_at ASC`,
      [workflowId],
    );
    return rows.map((r) => this.mapAttempt(r));
  }
  async createCheckpoint(
    input: Omit<WorkflowCheckpointRecord, 'id' | 'createdAt'>,
    client?: unknown,
  ) {
    const rows = await this.q(
      `INSERT INTO edge_p7_workflow_checkpoints
         (workflow_id, step_id, sequence, definition_version, state_snapshot, output_ref, integrity_hash)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7) RETURNING *`,
      [
        input.workflowId,
        input.stepId,
        input.sequence,
        input.definitionVersion,
        JSON.stringify(input.stateSnapshot),
        input.outputRef,
        input.integrityHash,
      ],
      client,
    );
    return this.mapCheckpoint(rows[0]!);
  }
  async listCheckpoints(workflowId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_workflow_checkpoints WHERE workflow_id = $1 ORDER BY sequence ASC`,
      [workflowId],
    );
    return rows.map((r) => this.mapCheckpoint(r));
  }

  async createCompensation(
    input: Omit<WorkflowCompensationRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      version?: number;
    },
    client?: unknown,
  ) {
    const rows = await this.q(
      `INSERT INTO edge_p7_workflow_compensations (
         step_id, workflow_id, handler_key, input, status, attempts, timeout_at, result,
         failure_details, execution_order, version
       ) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11) RETURNING *`,
      [
        input.stepId,
        input.workflowId,
        input.handlerKey,
        JSON.stringify(input.input),
        input.status,
        input.attempts,
        input.timeoutAt,
        JSON.stringify(input.result),
        JSON.stringify(input.failureDetails),
        input.executionOrder,
        input.version ?? 1,
      ],
      client,
    );
    return this.mapCompensation(rows[0]!);
  }
  async listCompensations(workflowId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_workflow_compensations WHERE workflow_id = $1 ORDER BY execution_order ASC`,
      [workflowId],
    );
    return rows.map((r) => this.mapCompensation(r));
  }
  async updateCompensation(
    id: string,
    patch: Partial<WorkflowCompensationRecord>,
    expectedVersion: number,
    client?: unknown,
  ) {
    const rows = await this.q(
      `UPDATE edge_p7_workflow_compensations SET
         status = COALESCE($3, status), attempts = COALESCE($4, attempts),
         result = COALESCE($5::jsonb, result),
         failure_details = COALESCE($6::jsonb, failure_details),
         version = version + 1, updated_at = NOW()
       WHERE id = $1 AND version = $2 RETURNING *`,
      [
        id,
        expectedVersion,
        patch.status ?? null,
        patch.attempts ?? null,
        patch.result ? JSON.stringify(patch.result) : null,
        patch.failureDetails ? JSON.stringify(patch.failureDetails) : null,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapCompensation(rows[0]!);
  }

  async createHumanTask(
    input: Omit<WorkflowHumanTaskRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      version?: number;
    },
    client?: unknown,
  ) {
    const rows = await this.q(
      `INSERT INTO edge_p7_workflow_human_tasks (
         workflow_id, step_id, task_type, required_permission, assignee, due_at, context_snapshot,
         instructions, decision, decision_reason, actor_id, status, version
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        input.workflowId,
        input.stepId,
        input.taskType,
        input.requiredPermission,
        input.assignee,
        input.dueAt,
        JSON.stringify(input.contextSnapshot),
        input.instructions,
        input.decision,
        input.decisionReason,
        input.actorId,
        input.status,
        input.version ?? 1,
      ],
      client,
    );
    return this.mapTask(rows[0]!);
  }
  async getHumanTask(id: string) {
    const rows = await this.q(`SELECT * FROM edge_p7_workflow_human_tasks WHERE id = $1`, [id]);
    return rows[0] ? this.mapTask(rows[0]) : null;
  }
  async listHumanTasks(filter: WorkflowListFilter & { workflowId?: string }) {
    const limit = Math.min(filter.limit ?? 20, 100);
    const offset = filter.offset ?? 0;
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter.workflowId) {
      params.push(filter.workflowId);
      where.push(`workflow_id = $${params.length}`);
    }
    const wh = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRows = await this.q(
      `SELECT COUNT(*)::text AS c FROM edge_p7_workflow_human_tasks ${wh}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_workflow_human_tasks ${wh}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapTask(r)), total: num(totalRows[0]?.c) };
  }
  async updateHumanTask(
    id: string,
    patch: Partial<WorkflowHumanTaskRecord>,
    expectedVersion: number,
    client?: unknown,
  ) {
    const rows = await this.q(
      `UPDATE edge_p7_workflow_human_tasks SET
         status = COALESCE($3, status), assignee = COALESCE($4, assignee),
         decision = COALESCE($5, decision), decision_reason = COALESCE($6, decision_reason),
         actor_id = COALESCE($7, actor_id), version = version + 1, updated_at = NOW()
       WHERE id = $1 AND version = $2 RETURNING *`,
      [
        id,
        expectedVersion,
        patch.status ?? null,
        patch.assignee ?? null,
        patch.decision ?? null,
        patch.decisionReason ?? null,
        patch.actorId ?? null,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapTask(rows[0]!);
  }
  async listExpiredHumanTasks(now: Date, limit: number) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_workflow_human_tasks
       WHERE status IN ('OPEN','ASSIGNED','IN_PROGRESS')
         AND due_at IS NOT NULL AND due_at < $1
       ORDER BY due_at ASC LIMIT $2`,
      [now, limit],
    );
    return rows.map((r) => this.mapTask(r));
  }

  async appendHistory(entry: Omit<WorkflowHistoryEntry, 'id' | 'createdAt'>, client?: unknown) {
    const rows = await this.q(
      `INSERT INTO edge_p7_workflow_history
         (resource_type, resource_id, workflow_id, from_status, to_status, action, reason, actor_id, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING *`,
      [
        entry.resourceType,
        entry.resourceId,
        entry.workflowId,
        entry.fromStatus,
        entry.toStatus,
        entry.action,
        entry.reason,
        entry.actorId,
        JSON.stringify(entry.details),
      ],
      client,
    );
    return this.mapHistory(rows[0]!);
  }
  async listHistory(
    filter: WorkflowListFilter & {
      workflowId?: string;
      resourceType?: WorkflowHistoryResourceType | string;
      resourceId?: string;
    },
  ) {
    const limit = Math.min(filter.limit ?? 20, 100);
    const offset = filter.offset ?? 0;
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.workflowId) {
      params.push(filter.workflowId);
      where.push(`workflow_id = $${params.length}`);
    }
    if (filter.resourceType) {
      params.push(filter.resourceType);
      where.push(`resource_type = $${params.length}`);
    }
    if (filter.resourceId) {
      params.push(filter.resourceId);
      where.push(`resource_id = $${params.length}`);
    }
    const wh = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRows = await this.q(
      `SELECT COUNT(*)::text AS c FROM edge_p7_workflow_history ${wh}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_workflow_history ${wh}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapHistory(r)), total: num(totalRows[0]?.c) };
  }
  async createDeadLetter(
    input: Omit<WorkflowDeadLetterRecord, 'id' | 'createdAt' | 'resolvedAt' | 'resolvedBy'>,
    client?: unknown,
  ) {
    const rows = await this.q(
      `INSERT INTO edge_p7_workflow_dead_letters (workflow_id, step_id, reason, payload, status)
       VALUES ($1,$2,$3,$4::jsonb,$5) RETURNING *`,
      [input.workflowId, input.stepId, input.reason, JSON.stringify(input.payload), input.status],
      client,
    );
    return this.mapDeadLetter(rows[0]!);
  }
  async listDeadLetters(filter: WorkflowListFilter) {
    const limit = Math.min(filter.limit ?? 20, 100);
    const offset = filter.offset ?? 0;
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    const wh = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRows = await this.q(
      `SELECT COUNT(*)::text AS c FROM edge_p7_workflow_dead_letters ${wh}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_workflow_dead_letters ${wh}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapDeadLetter(r)), total: num(totalRows[0]?.c) };
  }

  async upsertWorker(
    input: {
      workerId: string;
      identity: string;
      workerVersion: string;
      status?: WorkflowWorkerRecord['status'];
      metadata?: Record<string, unknown>;
    },
    client?: unknown,
  ) {
    const rows = await this.q(
      `INSERT INTO edge_p7_workflow_worker_registry
         (worker_id, identity, worker_version, status, last_heartbeat_at, metadata)
       VALUES ($1,$2,$3,$4,NOW(),$5::jsonb)
       ON CONFLICT (worker_id) DO UPDATE SET
         identity = EXCLUDED.identity, worker_version = EXCLUDED.worker_version,
         status = EXCLUDED.status, last_heartbeat_at = NOW(),
         metadata = EXCLUDED.metadata, updated_at = NOW()
       RETURNING *`,
      [
        input.workerId,
        input.identity,
        input.workerVersion,
        input.status ?? WorkerRegistryStatus.ACTIVE,
        JSON.stringify(input.metadata ?? {}),
      ],
      client,
    );
    return this.mapWorker(rows[0]!);
  }
  async heartbeatWorker(workerId: string, metadata?: Record<string, unknown>, client?: unknown) {
    const rows = await this.q(
      `UPDATE edge_p7_workflow_worker_registry SET
         last_heartbeat_at = NOW(),
         metadata = COALESCE($2::jsonb, metadata),
         updated_at = NOW()
       WHERE worker_id = $1 RETURNING *`,
      [workerId, metadata ? JSON.stringify(metadata) : null],
      client,
    );
    if (!rows[0]) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Worker not registered');
    return this.mapWorker(rows[0]!);
  }
  async getWorker(workerId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_workflow_worker_registry WHERE worker_id = $1`,
      [workerId],
    );
    return rows[0] ? this.mapWorker(rows[0]) : null;
  }
  async listWorkers(filter: WorkflowListFilter) {
    const limit = Math.min(filter.limit ?? 20, 100);
    const offset = filter.offset ?? 0;
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter.q) {
      params.push(`%${filter.q}%`);
      where.push(`(worker_id ILIKE $${params.length} OR identity ILIKE $${params.length})`);
    }
    const wh = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRows = await this.q(
      `SELECT COUNT(*)::text AS c FROM edge_p7_workflow_worker_registry ${wh}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_workflow_worker_registry ${wh}
       ORDER BY last_heartbeat_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapWorker(r)), total: num(totalRows[0]?.c) };
  }
}

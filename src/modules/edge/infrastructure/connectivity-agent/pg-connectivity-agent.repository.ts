import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type { ConnectivityAgentRepositoryPort } from '../../domain/connectivity-agent/connectivity-agent-repository.port.js';
import type {
  AgentCommandRecord,
  AgentEvidenceRecord,
  AgentSpoolRecord,
  ConnectivityAgentRecord,
} from '../../domain/connectivity-agent/connectivity-agent.types.js';
import {
  AgentCommandStatus,
  AgentSpoolStatus,
  AgentStatus,
} from '../../domain/connectivity-agent/connectivity-agent.types.js';

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
 * P7.14 PostgreSQL repository — migration 110.
 */
@Injectable()
export class PgConnectivityAgentRepository implements ConnectivityAgentRepositoryPort {
  constructor(private readonly cpDb: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.cpDb.getPool();
  }

  private async q<T extends Row = Row>(sql: string, params: unknown[] = [], client?: unknown) {
    const executor = client ? (client as PoolClient) : this.pool;
    return (await executor.query(sql, params)).rows as T[];
  }

  private conflict(): never {
    throw new DomainError(ErrorCode.CONFLICT, 'Optimistic lock conflict on connectivity agent');
  }

  private rethrow(err: unknown, message: string, collisionCode = 'AGENT_COLLISION'): never {
    const code = (err as { code?: string } | null)?.code;
    if (code === '23505') {
      throw new DomainError(ErrorCode.CONFLICT, message, [{ code: collisionCode }]);
    }
    if (code === '40001') this.conflict();
    throw err;
  }

  private mapAgent(row: Row): ConnectivityAgentRecord {
    return {
      id: str(row.id),
      agentCode: str(row.agent_code),
      displayName: str(row.display_name),
      tenantId: strOrNull(row.tenant_id),
      productId: strOrNull(row.product_id),
      deploymentProfileCode: strOrNull(row.deployment_profile_code),
      agentStatus: str(row.agent_status) as AgentStatus,
      publicKeyRef: str(row.public_key_ref),
      certificateRef: strOrNull(row.certificate_ref),
      outboundOnly: asBool(row.outbound_only, true),
      lastSeenAt: asDateOrNull(row.last_seen_at),
      revokedAt: asDateOrNull(row.revoked_at),
      revocationReason: strOrNull(row.revocation_reason),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapCommand(row: Row): AgentCommandRecord {
    return {
      id: str(row.id),
      agentId: str(row.agent_id),
      commandType: str(row.command_type),
      commandStatus: str(row.command_status) as AgentCommandStatus,
      nonce: str(row.nonce),
      payloadRef: strOrNull(row.payload_ref),
      signatureRef: strOrNull(row.signature_ref),
      provisioningRequestId: strOrNull(row.provisioning_request_id),
      authorizationRowId: strOrNull(row.authorization_row_id),
      authorizationVersion:
        row.authorization_version == null ? null : num(row.authorization_version),
      workflowId: strOrNull(row.workflow_id),
      expiresAt: asDateOrNull(row.expires_at),
      ackedAt: asDateOrNull(row.acked_at),
      finishedAt: asDateOrNull(row.finished_at),
      errorCode: strOrNull(row.error_code),
      errorMessage: strOrNull(row.error_message),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapSpool(row: Row): AgentSpoolRecord {
    return {
      id: str(row.id),
      agentId: str(row.agent_id),
      commandId: strOrNull(row.command_id),
      spoolStatus: str(row.spool_status) as AgentSpoolStatus,
      payloadRef: str(row.payload_ref),
      attempts: num(row.attempts),
      nextAttemptAt: asDateOrNull(row.next_attempt_at),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapEvidence(row: Row): AgentEvidenceRecord {
    return {
      id: str(row.id),
      agentId: strOrNull(row.agent_id),
      commandId: strOrNull(row.command_id),
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

  async createAgent(
    input: Omit<ConnectivityAgentRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<ConnectivityAgentRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_connectivity_agents (
           id, agent_code, display_name, tenant_id, product_id, deployment_profile_code,
           agent_status, public_key_ref, certificate_ref, outbound_only,
           last_seen_at, revoked_at, revocation_reason, metadata, created_by, updated_by, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4::uuid, $5::uuid, $6,
           $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, COALESCE($17, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.agentCode,
          input.displayName,
          input.tenantId,
          input.productId,
          input.deploymentProfileCode,
          input.agentStatus,
          input.publicKeyRef,
          input.certificateRef,
          input.outboundOnly,
          input.lastSeenAt,
          input.revokedAt,
          input.revocationReason,
          JSON.stringify(input.metadata ?? {}),
          input.createdBy,
          input.updatedBy,
          input.version ?? 1,
        ],
        client,
      );
      return this.mapAgent(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Agent code already exists', 'AGENT_CODE_COLLISION');
    }
  }

  async getAgent(id: string): Promise<ConnectivityAgentRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_connectivity_agents WHERE id = $1`, [id]);
    return rows[0] ? this.mapAgent(rows[0]) : null;
  }

  async getAgentByCode(code: string): Promise<ConnectivityAgentRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_connectivity_agents WHERE agent_code = $1`, [
      code,
    ]);
    return rows[0] ? this.mapAgent(rows[0]) : null;
  }

  async listAgents(filter: {
    status?: string;
    tenantId?: string;
    productId?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ConnectivityAgentRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`agent_status = $${params.length}`);
    }
    if (filter.tenantId) {
      params.push(filter.tenantId);
      where.push(`tenant_id = $${params.length}::uuid`);
    }
    if (filter.productId) {
      params.push(filter.productId);
      where.push(`product_id = $${params.length}::uuid`);
    }
    if (filter.q) {
      params.push(`%${filter.q}%`);
      where.push(
        `(agent_code ILIKE $${params.length} OR display_name ILIKE $${params.length})`,
      );
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p7_connectivity_agents ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_connectivity_agents ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapAgent(r)), total: num(countRows[0]?.c) };
  }

  async updateAgent(
    id: string,
    patch: Partial<ConnectivityAgentRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<ConnectivityAgentRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_connectivity_agents SET
         display_name = COALESCE($3, display_name),
         tenant_id = COALESCE($4::uuid, tenant_id),
         product_id = COALESCE($5::uuid, product_id),
         deployment_profile_code = COALESCE($6, deployment_profile_code),
         agent_status = COALESCE($7, agent_status),
         public_key_ref = COALESCE($8, public_key_ref),
         certificate_ref = COALESCE($9, certificate_ref),
         outbound_only = COALESCE($10, outbound_only),
         last_seen_at = COALESCE($11, last_seen_at),
         revoked_at = COALESCE($12, revoked_at),
         revocation_reason = COALESCE($13, revocation_reason),
         metadata = COALESCE($14::jsonb, metadata),
         version = version + 1,
         updated_by = $15,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.displayName ?? null,
        patch.tenantId === undefined ? null : patch.tenantId,
        patch.productId === undefined ? null : patch.productId,
        patch.deploymentProfileCode === undefined ? null : patch.deploymentProfileCode,
        patch.agentStatus ?? null,
        patch.publicKeyRef ?? null,
        patch.certificateRef === undefined ? null : patch.certificateRef,
        patch.outboundOnly === undefined ? null : patch.outboundOnly,
        patch.lastSeenAt === undefined ? null : patch.lastSeenAt,
        patch.revokedAt === undefined ? null : patch.revokedAt,
        patch.revocationReason === undefined ? null : patch.revocationReason,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        actorId,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapAgent(rows[0]);
  }

  async createCommand(
    input: Omit<AgentCommandRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<AgentCommandRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_agent_commands (
           id, agent_id, command_type, command_status, nonce, payload_ref, signature_ref,
           provisioning_request_id, authorization_row_id, authorization_version, workflow_id,
           expires_at, acked_at, finished_at, error_code, error_message, metadata, created_by
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3, $4, $5, $6, $7,
           $8::uuid, $9::uuid, $10, $11::uuid, $12, $13, $14, $15, $16, $17::jsonb, $18
         ) RETURNING *`,
        [
          input.id ?? null,
          input.agentId,
          input.commandType,
          input.commandStatus,
          input.nonce,
          input.payloadRef,
          input.signatureRef,
          input.provisioningRequestId,
          input.authorizationRowId,
          input.authorizationVersion,
          input.workflowId,
          input.expiresAt,
          input.ackedAt,
          input.finishedAt,
          input.errorCode,
          input.errorMessage,
          JSON.stringify(input.metadata ?? {}),
          input.createdBy,
        ],
        client,
      );
      return this.mapCommand(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Command nonce already used (anti-replay)', 'NONCE_REPLAY');
    }
  }

  async getCommand(id: string): Promise<AgentCommandRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_agent_commands WHERE id = $1`, [id]);
    return rows[0] ? this.mapCommand(rows[0]) : null;
  }

  async getCommandByNonce(
    agentId: string,
    nonce: string,
  ): Promise<AgentCommandRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_agent_commands WHERE agent_id = $1 AND nonce = $2`,
      [agentId, nonce],
    );
    return rows[0] ? this.mapCommand(rows[0]) : null;
  }

  async listCommands(filter: {
    agentId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: AgentCommandRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.agentId) {
      params.push(filter.agentId);
      where.push(`agent_id = $${params.length}::uuid`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`command_status = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p7_agent_commands ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_agent_commands ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapCommand(r)), total: num(countRows[0]?.c) };
  }

  async updateCommand(
    id: string,
    patch: Partial<AgentCommandRecord>,
    client?: unknown,
  ): Promise<AgentCommandRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_agent_commands SET
         command_status = COALESCE($2, command_status),
         payload_ref = COALESCE($3, payload_ref),
         signature_ref = COALESCE($4, signature_ref),
         workflow_id = COALESCE($5::uuid, workflow_id),
         expires_at = COALESCE($6, expires_at),
         acked_at = COALESCE($7, acked_at),
         finished_at = COALESCE($8, finished_at),
         error_code = COALESCE($9, error_code),
         error_message = COALESCE($10, error_message),
         metadata = COALESCE($11::jsonb, metadata),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.commandStatus ?? null,
        patch.payloadRef === undefined ? null : patch.payloadRef,
        patch.signatureRef === undefined ? null : patch.signatureRef,
        patch.workflowId === undefined ? null : patch.workflowId,
        patch.expiresAt === undefined ? null : patch.expiresAt,
        patch.ackedAt === undefined ? null : patch.ackedAt,
        patch.finishedAt === undefined ? null : patch.finishedAt,
        patch.errorCode === undefined ? null : patch.errorCode,
        patch.errorMessage === undefined ? null : patch.errorMessage,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Agent command not found');
    }
    return this.mapCommand(rows[0]);
  }

  async revokeActiveCommands(
    agentId: string,
    client?: unknown,
  ): Promise<{ revokedCount: number }> {
    const rows = await this.q(
      `UPDATE edge_p7_agent_commands SET
         command_status = $2,
         finished_at = NOW(),
         error_code = 'AGENT_REVOKED',
         error_message = 'Cleared by agent revocation (fail-closed)',
         updated_at = NOW()
       WHERE agent_id = $1::uuid
         AND command_status IN ('PENDING','QUEUED','DISPATCHED','ACKED')
       RETURNING id`,
      [agentId, AgentCommandStatus.REVOKED],
      client,
    );
    return { revokedCount: rows.length };
  }

  async createSpool(
    input: Omit<AgentSpoolRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<AgentSpoolRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_agent_spool (
         id, agent_id, command_id, spool_status, payload_ref, attempts, next_attempt_at
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid, $4, $5, $6, $7
       ) RETURNING *`,
      [
        input.id ?? null,
        input.agentId,
        input.commandId,
        input.spoolStatus,
        input.payloadRef,
        input.attempts,
        input.nextAttemptAt,
      ],
      client,
    );
    return this.mapSpool(rows[0]!);
  }

  async listSpool(filter: {
    agentId?: string;
    status?: string;
    limit?: number;
  }): Promise<AgentSpoolRecord[]> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.agentId) {
      params.push(filter.agentId);
      where.push(`agent_id = $${params.length}::uuid`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`spool_status = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit);
    const rows = await this.q(
      `SELECT * FROM edge_p7_agent_spool ${clause}
       ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    return rows.map((r) => this.mapSpool(r));
  }

  async updateSpool(
    id: string,
    patch: Partial<AgentSpoolRecord>,
    client?: unknown,
  ): Promise<AgentSpoolRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_agent_spool SET
         spool_status = COALESCE($2, spool_status),
         attempts = COALESCE($3, attempts),
         next_attempt_at = COALESCE($4, next_attempt_at),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.spoolStatus ?? null,
        patch.attempts === undefined ? null : patch.attempts,
        patch.nextAttemptAt === undefined ? null : patch.nextAttemptAt,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Agent spool entry not found');
    }
    return this.mapSpool(rows[0]);
  }

  async createEvidence(
    input: Omit<AgentEvidenceRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<AgentEvidenceRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_agent_evidence (
         id, agent_id, command_id, tenant_id, workflow_id, step_key, operation, outcome,
         evidence, error_code, error_message, duration_ms, performed_by
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, $7, $8,
         $9::jsonb, $10, $11, $12, $13
       ) RETURNING *`,
      [
        input.id ?? null,
        input.agentId,
        input.commandId,
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
    agentId?: string;
    commandId?: string;
    limit?: number;
  }): Promise<AgentEvidenceRecord[]> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.agentId) {
      params.push(filter.agentId);
      where.push(`agent_id = $${params.length}::uuid`);
    }
    if (filter.commandId) {
      params.push(filter.commandId);
      where.push(`command_id = $${params.length}::uuid`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit);
    const rows = await this.q(
      `SELECT * FROM edge_p7_agent_evidence ${clause}
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
      `INSERT INTO edge_p7_agent_history (
         resource_type, resource_id, tenant_id, from_status, to_status, action, reason, actor_id, details
       ) VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9::jsonb)`,
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

  async listHistory(filter: {
    resourceId?: string;
    resourceType?: string;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.resourceId) {
      params.push(filter.resourceId);
      where.push(`resource_id = $${params.length}::uuid`);
    }
    if (filter.resourceType) {
      params.push(filter.resourceType);
      where.push(`resource_type = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit);
    const rows = await this.q(
      `SELECT * FROM edge_p7_agent_history ${clause}
       ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    return rows.map((row) => ({
      id: str(row.id),
      resourceType: str(row.resource_type),
      resourceId: str(row.resource_id),
      tenantId: strOrNull(row.tenant_id),
      fromStatus: strOrNull(row.from_status),
      toStatus: strOrNull(row.to_status),
      action: str(row.action),
      reason: strOrNull(row.reason),
      actorId: str(row.actor_id),
      details: asJson(row.details, {} as Record<string, unknown>),
      createdAt: asDate(row.created_at),
    }));
  }
}

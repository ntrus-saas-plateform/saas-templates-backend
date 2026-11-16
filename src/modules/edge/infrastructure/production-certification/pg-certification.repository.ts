import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type { CertificationRepositoryPort } from '../../domain/production-certification/certification-repository.port.js';
import type {
  CertificationEvidenceItemRecord,
  CertificationEvidenceRecord,
  CertificationPackageRecord,
  CertificationRunRecord,
} from '../../domain/production-certification/certification.types.js';

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
 * P7.15 PostgreSQL repository — migration 111.
 */
@Injectable()
export class PgCertificationRepository implements CertificationRepositoryPort {
  constructor(private readonly cpDb: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.cpDb.getPool();
  }

  private async q<T extends Row = Row>(sql: string, params: unknown[] = [], client?: unknown) {
    const executor = client ? (client as PoolClient) : this.pool;
    return (await executor.query(sql, params)).rows as T[];
  }

  private conflict(): never {
    throw new DomainError(ErrorCode.CONFLICT, 'Optimistic lock conflict on certification resource');
  }

  private rethrow(err: unknown, message: string, collisionCode = 'CERTIFICATION_COLLISION'): never {
    const code = (err as { code?: string } | null)?.code;
    if (code === '23505') {
      throw new DomainError(ErrorCode.CONFLICT, message, [{ code: collisionCode }]);
    }
    if (code === '40001') this.conflict();
    throw err;
  }

  private mapPackage(row: Row): CertificationPackageRecord {
    return {
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      description: strOrNull(row.description),
      productId: strOrNull(row.product_id),
      deploymentProfileCode: strOrNull(row.deployment_profile_code),
      packageStatus: str(row.package_status),
      scope: asJson(row.scope, {}),
      gateResults: asJson(row.gate_results, {}),
      evidenceManifest: asJson(row.evidence_manifest, []),
      certifiedAt: asDateOrNull(row.certified_at),
      revokedAt: asDateOrNull(row.revoked_at),
      revocationReason: strOrNull(row.revocation_reason),
      workflowId: strOrNull(row.workflow_id),
      provisioningRequestId: strOrNull(row.provisioning_request_id),
      authorizationRowId: strOrNull(row.authorization_row_id),
      authorizationVersion:
        row.authorization_version == null ? null : num(row.authorization_version),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapItem(row: Row): CertificationEvidenceItemRecord {
    return {
      id: str(row.id),
      packageId: str(row.package_id),
      evidenceKey: str(row.evidence_key),
      phaseCode: str(row.phase_code),
      required: asBool(row.required, true),
      itemStatus: str(row.item_status),
      sourceRef: strOrNull(row.source_ref),
      checksum: strOrNull(row.checksum),
      details: asJson(row.details, {}),
      attachedAt: asDateOrNull(row.attached_at),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapRun(row: Row): CertificationRunRecord {
    return {
      id: str(row.id),
      packageId: str(row.package_id),
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

  private mapEvidence(row: Row): CertificationEvidenceRecord {
    return {
      id: str(row.id),
      packageId: strOrNull(row.package_id),
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

  async createPackage(
    input: Omit<CertificationPackageRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<CertificationPackageRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_certification_packages (
           id, code, name, description, product_id, deployment_profile_code,
           package_status, scope, gate_results, evidence_manifest,
           certified_at, revoked_at, revocation_reason, workflow_id,
           provisioning_request_id, authorization_row_id, authorization_version,
           metadata, created_by, updated_by, version
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5::uuid, $6,
           $7, $8::jsonb, $9::jsonb, $10::jsonb,
           $11, $12, $13, $14::uuid,
           $15::uuid, $16::uuid, $17,
           $18::jsonb, $19, $20, COALESCE($21, 1)
         ) RETURNING *`,
        [
          input.id ?? null,
          input.code,
          input.name,
          input.description,
          input.productId,
          input.deploymentProfileCode,
          input.packageStatus,
          JSON.stringify(input.scope ?? {}),
          JSON.stringify(input.gateResults ?? {}),
          JSON.stringify(input.evidenceManifest ?? []),
          input.certifiedAt,
          input.revokedAt,
          input.revocationReason,
          input.workflowId,
          input.provisioningRequestId,
          input.authorizationRowId,
          input.authorizationVersion,
          JSON.stringify(input.metadata ?? {}),
          input.createdBy,
          input.updatedBy,
          input.version ?? 1,
        ],
        client,
      );
      return this.mapPackage(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Certification package code collision');
    }
  }

  async getPackage(id: string): Promise<CertificationPackageRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_certification_packages WHERE id = $1`, [id]);
    return rows[0] ? this.mapPackage(rows[0]) : null;
  }

  async getPackageByCode(code: string): Promise<CertificationPackageRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_certification_packages WHERE code = $1`, [
      code,
    ]);
    return rows[0] ? this.mapPackage(rows[0]) : null;
  }

  async listPackages(filter: {
    status?: string;
    productId?: string;
    deploymentProfileCode?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: CertificationPackageRecord[]; total: number }> {
    const where: string[] = ['1=1'];
    const params: unknown[] = [];
    const add = (clause: string, value: unknown) => {
      params.push(value);
      where.push(clause.replace('?', `$${params.length}`));
    };
    if (filter.status) add('package_status = ?', filter.status);
    if (filter.productId) add('product_id = ?::uuid', filter.productId);
    if (filter.deploymentProfileCode) add('deployment_profile_code = ?', filter.deploymentProfileCode);
    if (filter.q) {
      params.push(`%${filter.q}%`);
      where.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
    }
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;
    params.push(limit, offset);
    const whereSql = where.join(' AND ');
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p7_certification_packages WHERE ${whereSql}`,
      params.slice(0, params.length - 2),
    );
    const rows = await this.q(
      `SELECT * FROM edge_p7_certification_packages WHERE ${whereSql}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapPackage(r)), total: num(countRows[0]?.c) };
  }

  async updatePackage(
    id: string,
    patch: Partial<CertificationPackageRecord>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<CertificationPackageRecord> {
    const sets: string[] = ['updated_at = NOW()', 'updated_by = $1', 'version = version + 1'];
    const params: unknown[] = [actorId];
    const set = (col: string, value: unknown, cast = '') => {
      params.push(value);
      sets.push(`${col} = $${params.length}${cast}`);
    };
    if (patch.code !== undefined) set('code', patch.code);
    if (patch.name !== undefined) set('name', patch.name);
    if (patch.description !== undefined) set('description', patch.description);
    if (patch.productId !== undefined) set('product_id', patch.productId, '::uuid');
    if (patch.deploymentProfileCode !== undefined) {
      set('deployment_profile_code', patch.deploymentProfileCode);
    }
    if (patch.packageStatus !== undefined) set('package_status', patch.packageStatus);
    if (patch.scope !== undefined) set('scope', JSON.stringify(patch.scope), '::jsonb');
    if (patch.gateResults !== undefined) {
      set('gate_results', JSON.stringify(patch.gateResults), '::jsonb');
    }
    if (patch.evidenceManifest !== undefined) {
      set('evidence_manifest', JSON.stringify(patch.evidenceManifest), '::jsonb');
    }
    if (patch.certifiedAt !== undefined) set('certified_at', patch.certifiedAt);
    if (patch.revokedAt !== undefined) set('revoked_at', patch.revokedAt);
    if (patch.revocationReason !== undefined) set('revocation_reason', patch.revocationReason);
    if (patch.workflowId !== undefined) set('workflow_id', patch.workflowId, '::uuid');
    if (patch.provisioningRequestId !== undefined) {
      set('provisioning_request_id', patch.provisioningRequestId, '::uuid');
    }
    if (patch.authorizationRowId !== undefined) {
      set('authorization_row_id', patch.authorizationRowId, '::uuid');
    }
    if (patch.authorizationVersion !== undefined) {
      set('authorization_version', patch.authorizationVersion);
    }
    if (patch.metadata !== undefined) set('metadata', JSON.stringify(patch.metadata), '::jsonb');

    params.push(id, expectedVersion);
    const rows = await this.q(
      `UPDATE edge_p7_certification_packages SET ${sets.join(', ')}
       WHERE id = $${params.length - 1}::uuid AND version = $${params.length}
       RETURNING *`,
      params,
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapPackage(rows[0]!);
  }

  async upsertEvidenceItem(
    input: Omit<CertificationEvidenceItemRecord, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    },
    client?: unknown,
  ): Promise<CertificationEvidenceItemRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_certification_evidence_items (
         id, package_id, evidence_key, phase_code, required, item_status,
         source_ref, checksum, details, attached_at
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3, $4, $5, $6,
         $7, $8, $9::jsonb, $10
       )
       ON CONFLICT (package_id, evidence_key) DO UPDATE SET
         phase_code = EXCLUDED.phase_code,
         required = EXCLUDED.required,
         item_status = EXCLUDED.item_status,
         source_ref = EXCLUDED.source_ref,
         checksum = EXCLUDED.checksum,
         details = EXCLUDED.details,
         attached_at = EXCLUDED.attached_at,
         updated_at = NOW()
       RETURNING *`,
      [
        input.id ?? null,
        input.packageId,
        input.evidenceKey,
        input.phaseCode,
        input.required,
        input.itemStatus,
        input.sourceRef,
        input.checksum,
        JSON.stringify(input.details ?? {}),
        input.attachedAt,
      ],
      client,
    );
    return this.mapItem(rows[0]!);
  }

  async getEvidenceItem(id: string): Promise<CertificationEvidenceItemRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_certification_evidence_items WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapItem(rows[0]) : null;
  }

  async listEvidenceItems(filter: {
    packageId: string;
    required?: boolean;
    status?: string;
    limit?: number;
  }): Promise<CertificationEvidenceItemRecord[]> {
    const where = ['package_id = $1::uuid'];
    const params: unknown[] = [filter.packageId];
    if (filter.required !== undefined) {
      params.push(filter.required);
      where.push(`required = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`item_status = $${params.length}`);
    }
    params.push(filter.limit ?? 200);
    const rows = await this.q(
      `SELECT * FROM edge_p7_certification_evidence_items
       WHERE ${where.join(' AND ')}
       ORDER BY evidence_key ASC LIMIT $${params.length}`,
      params,
    );
    return rows.map((r) => this.mapItem(r));
  }

  async updateEvidenceItem(
    id: string,
    patch: Partial<CertificationEvidenceItemRecord>,
    client?: unknown,
  ): Promise<CertificationEvidenceItemRecord> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    const set = (col: string, value: unknown, cast = '') => {
      params.push(value);
      sets.push(`${col} = $${params.length}${cast}`);
    };
    if (patch.phaseCode !== undefined) set('phase_code', patch.phaseCode);
    if (patch.required !== undefined) set('required', patch.required);
    if (patch.itemStatus !== undefined) set('item_status', patch.itemStatus);
    if (patch.sourceRef !== undefined) set('source_ref', patch.sourceRef);
    if (patch.checksum !== undefined) set('checksum', patch.checksum);
    if (patch.details !== undefined) set('details', JSON.stringify(patch.details), '::jsonb');
    if (patch.attachedAt !== undefined) set('attached_at', patch.attachedAt);
    params.push(id);
    const rows = await this.q(
      `UPDATE edge_p7_certification_evidence_items SET ${sets.join(', ')}
       WHERE id = $${params.length}::uuid RETURNING *`,
      params,
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Evidence item not found');
    }
    return this.mapItem(rows[0]!);
  }

  async createRun(
    input: Omit<CertificationRunRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<CertificationRunRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_certification_runs (
         id, package_id, operation, workflow_id, outcome, error_code, error_message,
         observed_state, evidence, started_at, finished_at, performed_by, correlation_id
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3, $4::uuid, $5, $6, $7,
         $8::jsonb, $9::jsonb, $10, $11, $12, $13::uuid
       ) RETURNING *`,
      [
        input.id ?? null,
        input.packageId,
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

  async getRun(id: string): Promise<CertificationRunRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_certification_runs WHERE id = $1`, [id]);
    return rows[0] ? this.mapRun(rows[0]) : null;
  }

  async listRuns(filter: {
    packageId?: string;
    operation?: string;
    outcome?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: CertificationRunRecord[]; total: number }> {
    const where: string[] = ['1=1'];
    const params: unknown[] = [];
    const add = (clause: string, value: unknown) => {
      params.push(value);
      where.push(clause.replace('?', `$${params.length}`));
    };
    if (filter.packageId) add('package_id = ?::uuid', filter.packageId);
    if (filter.operation) add('operation = ?', filter.operation);
    if (filter.outcome) add('outcome = ?', filter.outcome);
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;
    params.push(limit, offset);
    const whereSql = where.join(' AND ');
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p7_certification_runs WHERE ${whereSql}`,
      params.slice(0, params.length - 2),
    );
    const rows = await this.q(
      `SELECT * FROM edge_p7_certification_runs WHERE ${whereSql}
       ORDER BY started_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapRun(r)), total: num(countRows[0]?.c) };
  }

  async updateRun(
    id: string,
    patch: Partial<CertificationRunRecord>,
    client?: unknown,
  ): Promise<CertificationRunRecord> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const set = (col: string, value: unknown, cast = '') => {
      params.push(value);
      sets.push(`${col} = $${params.length}${cast}`);
    };
    if (patch.workflowId !== undefined) set('workflow_id', patch.workflowId, '::uuid');
    if (patch.outcome !== undefined) set('outcome', patch.outcome);
    if (patch.errorCode !== undefined) set('error_code', patch.errorCode);
    if (patch.errorMessage !== undefined) set('error_message', patch.errorMessage);
    if (patch.observedState !== undefined) {
      set('observed_state', JSON.stringify(patch.observedState), '::jsonb');
    }
    if (patch.evidence !== undefined) set('evidence', JSON.stringify(patch.evidence), '::jsonb');
    if (patch.finishedAt !== undefined) set('finished_at', patch.finishedAt);
    if (patch.performedBy !== undefined) set('performed_by', patch.performedBy);
    if (sets.length === 0) {
      const current = await this.getRun(id);
      if (!current) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Certification run not found');
      return current;
    }
    params.push(id);
    const rows = await this.q(
      `UPDATE edge_p7_certification_runs SET ${sets.join(', ')}
       WHERE id = $${params.length}::uuid RETURNING *`,
      params,
      client,
    );
    if (!rows[0]) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Certification run not found');
    return this.mapRun(rows[0]!);
  }

  async createEvidence(
    input: Omit<CertificationEvidenceRecord, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<CertificationEvidenceRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_certification_evidence (
         id, package_id, workflow_id, step_key, operation, outcome,
         evidence, error_code, error_message, duration_ms, performed_by
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid, $4, $5, $6,
         $7::jsonb, $8, $9, $10, $11
       ) RETURNING *`,
      [
        input.id ?? null,
        input.packageId,
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
    packageId?: string;
    workflowId?: string;
    limit?: number;
  }): Promise<CertificationEvidenceRecord[]> {
    const where: string[] = ['1=1'];
    const params: unknown[] = [];
    if (filter.packageId) {
      params.push(filter.packageId);
      where.push(`package_id = $${params.length}::uuid`);
    }
    if (filter.workflowId) {
      params.push(filter.workflowId);
      where.push(`workflow_id = $${params.length}::uuid`);
    }
    params.push(filter.limit ?? 100);
    const rows = await this.q(
      `SELECT * FROM edge_p7_certification_evidence
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
      `INSERT INTO edge_p7_certification_history (
         resource_type, resource_id, from_status, to_status, action, reason, actor_id, details
       ) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        input.resourceType,
        input.resourceId,
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

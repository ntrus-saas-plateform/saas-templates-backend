import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  AuditEventRepositoryPort,
  CreateAuditEventParams,
  EdgeAuditEvent,
} from '../../domain/ports/audit-event-repository.port.js';

interface Row {
  id: string;
  event_type: string;
  actor_id: string | null;
  subject_type: string | null;
  subject_id: string | null;
  vertical_id: string | null;
  details: Record<string, unknown>;
  created_at: Date;
}

@Injectable()
export class PgAuditEventRepository implements AuditEventRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async create(params: CreateAuditEventParams, client?: unknown): Promise<EdgeAuditEvent> {
    const id = randomUUID();
    const executor = client ? (client as PoolClient) : this.pool;
    const result = await executor.query<Row>(
      `INSERT INTO edge_audit_events (
         id, event_type, actor_id, subject_type, subject_id, vertical_id, details
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       RETURNING *`,
      [
        id,
        params.eventType,
        params.actorId ?? null,
        params.subjectType ?? null,
        params.subjectId ?? null,
        params.verticalId ?? null,
        JSON.stringify(params.details ?? {}),
      ],
    );
    return this.map(result.rows[0]);
  }

  async list(params: {
    page: number;
    limit: number;
    eventType?: string;
    actorId?: string;
    verticalId?: string;
  }): Promise<{ items: readonly EdgeAuditEvent[]; total: number }> {
    const offset = (params.page - 1) * params.limit;
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (params.eventType) {
      values.push(params.eventType);
      clauses.push(`event_type = $${values.length}`);
    }
    if (params.actorId) {
      values.push(params.actorId);
      clauses.push(`actor_id = $${values.length}`);
    }
    if (params.verticalId) {
      values.push(params.verticalId);
      clauses.push(`vertical_id = $${values.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const count = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM edge_audit_events ${where}`,
      values,
    );
    values.push(params.limit, offset);
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_audit_events ${where}
       ORDER BY created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return {
      items: result.rows.map((r) => this.map(r)),
      total: Number(count.rows[0]?.count ?? 0),
    };
  }

  private map(row: Row): EdgeAuditEvent {
    return {
      id: row.id,
      eventType: row.event_type,
      actorId: row.actor_id,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      verticalId: row.vertical_id,
      details: row.details ?? {},
      createdAt: row.created_at,
    };
  }
}

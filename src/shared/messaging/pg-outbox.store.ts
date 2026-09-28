import { Injectable, Optional } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { TenantDatabaseManager } from '../database/tenant-database.manager.js';
import { OutboxStatus } from '../../core/domain/ports/outbox.port.js';
import type { OutboxStorePort, OutboxMessage } from '../../core/domain/ports/outbox.port.js';
import type { IntegrationEvent } from '../../core/domain/events/integration-event.js';
import type { MetricsService } from '../observability/metrics.service.js';

interface OutboxRow {
  id: string;
  event_type: string;
  payload: IntegrationEvent;
  status: OutboxStatus;
  attempts: number;
  max_attempts: number;
  organization_id: string | null;
  correlation_id: string;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  last_error: string | null;
}

@Injectable()
export class PgOutboxStore implements OutboxStorePort {
  constructor(
    private readonly dbManager: TenantDatabaseManager,
    @Optional() private readonly metricsService?: MetricsService,
  ) {}

  async enqueue(
    tenantId: string,
    event: IntegrationEvent,
    client?: unknown,
  ): Promise<string> {
    const id = randomUUID();
    const query = `INSERT INTO outbox_events
      (id, event_type, payload, status, attempts, max_attempts, organization_id, correlation_id)
      VALUES ($1, $2, $3, $4, 0, 5, $5, $6)`;

    const params = [
      id,
      event.eventType,
      JSON.stringify(event),
      OutboxStatus.PENDING,
      event.organizationId,
      event.correlationId,
    ];

    if (client) {
      await (client as PoolClient).query(query, params);
    } else {
      const pool = await this.dbManager.getPool(tenantId);
      await pool.query(query, params);
    }

    return id;
  }

  async fetchPending(tenantId: string, limit: number): Promise<readonly OutboxMessage[]> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query<OutboxRow>(
      `UPDATE outbox_events SET status = 'PROCESSING', updated_at = NOW()
       WHERE id IN (
         SELECT id FROM outbox_events
         WHERE status = 'PENDING' AND attempts < max_attempts
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [limit],
    );
    return result.rows.map((row) => this.mapRow(row, tenantId));
  }

  async markPublished(tenantId: string, id: string): Promise<void> {
    const pool = await this.dbManager.getPool(tenantId);
    await pool.query(
      `UPDATE outbox_events SET status = 'PUBLISHED', published_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async markFailed(tenantId: string, id: string, error: string): Promise<void> {
    const pool = await this.dbManager.getPool(tenantId);
    await pool.query(
      `UPDATE outbox_events SET status = 'PENDING', attempts = attempts + 1, last_error = $2, updated_at = NOW() WHERE id = $1`,
      [id, error],
    );
    this.metricsService?.outboxFailed.inc();
    this.metricsService?.eventRetries.inc();
  }

  async markDeadLetter(tenantId: string, id: string, error: string): Promise<void> {
    const pool = await this.dbManager.getPool(tenantId);
    await pool.query(
      `UPDATE outbox_events SET status = 'DEAD_LETTER', last_error = $2, updated_at = NOW() WHERE id = $1`,
      [id, error],
    );
    this.metricsService?.outboxDeadLetter.inc({ store: 'tenant' });
    this.metricsService?.deadLetterEvents.inc();
  }

  async listDeadLetter(
    tenantId: string,
    params?: { limit?: number; offset?: number; organizationId?: string | null },
  ): Promise<readonly OutboxMessage[]> {
    const pool = await this.dbManager.getPool(tenantId);
    const limit = Math.min(Math.max(params?.limit ?? 50, 1), 200);
    const offset = Math.max(params?.offset ?? 0, 0);
    const orgId = params?.organizationId ?? null;
    const result = orgId
      ? await pool.query<OutboxRow>(
          `SELECT * FROM outbox_events
           WHERE status = 'DEAD_LETTER' AND organization_id = $1
           ORDER BY updated_at DESC
           LIMIT $2 OFFSET $3`,
          [orgId, limit, offset],
        )
      : await pool.query<OutboxRow>(
          `SELECT * FROM outbox_events
           WHERE status = 'DEAD_LETTER'
           ORDER BY updated_at DESC
           LIMIT $1 OFFSET $2`,
          [limit, offset],
        );
    return result.rows.map((row) => this.mapRow(row, tenantId));
  }

  async replay(tenantId: string, id: string): Promise<OutboxMessage | null> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query<OutboxRow>(
      `UPDATE outbox_events
       SET status = 'PENDING', attempts = 0, last_error = NULL, updated_at = NOW()
       WHERE id = $1 AND status IN ('DEAD_LETTER', 'FAILED')
       RETURNING *`,
      [id],
    );
    const row = result.rows[0];
    return row ? this.mapRow(row, tenantId) : null;
  }

  private mapRow(row: OutboxRow, tenantId: string): OutboxMessage {
    return {
      id: row.id,
      eventType: row.event_type,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      tenantId,
      organizationId: row.organization_id,
      correlationId: row.correlation_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
      lastError: row.last_error,
    };
  }
}

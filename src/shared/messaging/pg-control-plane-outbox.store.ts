import { Injectable, Optional } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { TenantDatabaseManager } from '../database/tenant-database.manager.js';
import type { MetricsService } from '../observability/metrics.service.js';
import { OutboxStatus } from '../../core/domain/ports/outbox.port.js';
import type { OutboxMessage } from '../../core/domain/ports/outbox.port.js';
import type { ControlPlaneOutboxStorePort } from '../../core/domain/ports/control-plane-outbox.port.js';
import type { IntegrationEvent } from '../../core/domain/events/integration-event.js';

interface OutboxRow {
  id: string;
  event_type: string;
  payload: IntegrationEvent;
  status: OutboxStatus;
  attempts: number;
  max_attempts: number;
  tenant_id: string;
  organization_id: string | null;
  correlation_id: string;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  last_error: string | null;
}

@Injectable()
export class PgControlPlaneOutboxStore implements ControlPlaneOutboxStorePort {
  constructor(
    private readonly dbManager: TenantDatabaseManager,
    @Optional() private readonly metricsService?: MetricsService,
  ) {}

  private get pool(): Pool {
    return this.dbManager.getControlPlanePool();
  }

  async enqueue(
    tenantId: string,
    event: IntegrationEvent,
    client?: unknown,
  ): Promise<string> {
    const id = randomUUID();
    const query = `INSERT INTO control_plane_outbox_events
      (id, event_type, payload, status, attempts, max_attempts, tenant_id, organization_id, correlation_id)
      VALUES ($1, $2, $3, 'PENDING', 0, 5, $4, $5, $6)`;

    const params = [
      id,
      event.eventType,
      JSON.stringify(event),
      tenantId,
      event.organizationId,
      event.correlationId,
    ];

    if (client) {
      await (client as PoolClient).query(query, params);
    } else {
      await this.pool.query(query, params);
    }

    return id;
  }

  async fetchPending(tenantId: string, limit: number): Promise<readonly OutboxMessage[]> {
    const result = await this.pool.query<OutboxRow>(
      `UPDATE control_plane_outbox_events SET status = 'PROCESSING', updated_at = NOW()
       WHERE id IN (
         SELECT id FROM control_plane_outbox_events
         WHERE tenant_id = $1 AND status = 'PENDING' AND attempts < max_attempts
         ORDER BY created_at ASC
         LIMIT $2
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [tenantId, limit],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async markPublished(tenantId: string, id: string): Promise<void> {
    await this.pool.query(
      `UPDATE control_plane_outbox_events SET status = 'PUBLISHED', published_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
  }

  async markFailed(tenantId: string, id: string, error: string): Promise<void> {
    await this.pool.query(
      `UPDATE control_plane_outbox_events SET status = 'PENDING', attempts = attempts + 1, last_error = $3, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId, error],
    );
  }

  async markDeadLetter(tenantId: string, id: string, error: string): Promise<void> {
    await this.pool.query(
      `UPDATE control_plane_outbox_events SET status = 'DEAD_LETTER', last_error = $3, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId, error],
    );
    this.metricsService?.outboxDeadLetter.inc({ store: 'control-plane' });
  }

  private mapRow(row: OutboxRow): OutboxMessage {
    return {
      id: row.id,
      eventType: row.event_type,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      tenantId: row.tenant_id,
      organizationId: row.organization_id,
      correlationId: row.correlation_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
      lastError: row.last_error,
    };
  }
}

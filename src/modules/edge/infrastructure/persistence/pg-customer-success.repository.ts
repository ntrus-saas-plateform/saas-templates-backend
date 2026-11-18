import { Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type { AdoptionEventRecord } from '../../domain/customer-success/adoption-events.js';
import type { AhaProductSegment } from '../../domain/customer-success/aha-moments.js';
import type {
  CustomerSuccessRepositoryPort,
  PersistAdoptionEventInput,
} from '../../domain/ports/customer-success-repository.port.js';

@Injectable()
export class PgCustomerSuccessRepository implements CustomerSuccessRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  private map(r: Record<string, unknown>): AdoptionEventRecord {
    return {
      id: String(r.id),
      subscriptionId: String(r.subscription_id),
      productTenantRef: (r.product_tenant_ref as string | null) ?? null,
      eventCode: String(r.event_code),
      productSegment: String(r.product_segment) as AhaProductSegment,
      occurredAt: new Date(String(r.occurred_at)),
      source: String(r.source) as AdoptionEventRecord['source'],
      correlationId: (r.correlation_id as string | null) ?? null,
      payload: (r.payload as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
    };
  }

  async insertAdoptionEvent(input: PersistAdoptionEventInput): Promise<AdoptionEventRecord> {
    if (input.correlationId) {
      const existing = await this.pool.query(
        `SELECT * FROM edge_cs_adoption_events
         WHERE subscription_id = $1 AND event_code = $2 AND correlation_id = $3
         LIMIT 1`,
        [input.subscriptionId, input.eventCode, input.correlationId],
      );
      if (existing.rows[0]) {
        return this.map(existing.rows[0] as Record<string, unknown>);
      }
    }
    const result = await this.pool.query(
      `INSERT INTO edge_cs_adoption_events (
         subscription_id, product_tenant_ref, event_code, product_segment,
         occurred_at, source, correlation_id, payload
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       RETURNING *`,
      [
        input.subscriptionId,
        input.productTenantRef,
        input.eventCode,
        input.productSegment,
        input.occurredAt.toISOString(),
        input.source,
        input.correlationId,
        JSON.stringify(input.payload ?? {}),
      ],
    );
    return this.map(result.rows[0] as Record<string, unknown>);
  }

  async listAdoptionEvents(input: {
    subscriptionId: string;
    limit?: number;
  }): Promise<AdoptionEventRecord[]> {
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
    const result = await this.pool.query(
      `SELECT * FROM edge_cs_adoption_events
       WHERE subscription_id = $1
       ORDER BY occurred_at DESC
       LIMIT $2`,
      [input.subscriptionId, limit],
    );
    return (result.rows as Record<string, unknown>[]).map((r) => this.map(r));
  }
}

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  RecordVerticalLifecycleEventParams,
  VerticalLifecycleRepositoryPort,
} from '../../domain/ports/vertical-lifecycle-repository.port.js';
import type {
  VerticalLifecycleEvent,
  VerticalStatus,
} from '../../domain/vertical/vertical.entity.js';

interface Row {
  id: string;
  vertical_id: string;
  from_status: VerticalStatus;
  to_status: VerticalStatus;
  reason: string | null;
  actor_id: string | null;
  created_at: Date;
}

@Injectable()
export class PgVerticalLifecycleRepository implements VerticalLifecycleRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async record(params: RecordVerticalLifecycleEventParams): Promise<VerticalLifecycleEvent> {
    const id = randomUUID();
    const result = await this.pool.query<Row>(
      `INSERT INTO edge_vertical_lifecycle_events (
         id, vertical_id, from_status, to_status, reason, actor_id
       ) VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        id,
        params.verticalId,
        params.fromStatus,
        params.toStatus,
        params.reason ?? null,
        params.actorId ?? null,
      ],
    );
    return this.map(result.rows[0]);
  }

  async listByVertical(
    verticalId: string,
    page = 1,
    limit = 50,
  ): Promise<{ items: readonly VerticalLifecycleEvent[]; total: number }> {
    const offset = (page - 1) * limit;
    const count = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM edge_vertical_lifecycle_events WHERE vertical_id = $1`,
      [verticalId],
    );
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_vertical_lifecycle_events
       WHERE vertical_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [verticalId, limit, offset],
    );
    return {
      items: result.rows.map((r) => this.map(r)),
      total: Number(count.rows[0]?.count ?? 0),
    };
  }

  private map(row: Row): VerticalLifecycleEvent {
    return {
      id: row.id,
      verticalId: row.vertical_id,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      reason: row.reason,
      actorId: row.actor_id,
      createdAt: row.created_at,
    };
  }
}

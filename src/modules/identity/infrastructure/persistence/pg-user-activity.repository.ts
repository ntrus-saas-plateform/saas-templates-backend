import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import type {
  CreateUserActivityParams,
  UserActivityEvent,
  UserActivityRepositoryPort,
} from '../../domain/ports/user-activity-repository.port.js';

type Row = {
  id: string;
  user_id: string;
  organization_id: string | null;
  category: string;
  title: string;
  detail: string;
  href: string | null;
  payload: Record<string, unknown> | null;
  created_at: Date;
};

@Injectable()
export class PgUserActivityRepository implements UserActivityRepositoryPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async listByUser(
    tenantId: string,
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ items: readonly UserActivityEvent[]; total: number }> {
    const pool = await this.dbManager.getPool(tenantId);
    const totalRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM user_activity_events WHERE user_id = $1`,
      [userId],
    );
    const offset = (page - 1) * limit;
    const result = await pool.query<Row>(
      `SELECT id, user_id, organization_id, category, title, detail, href, payload, created_at
       FROM user_activity_events WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );
    return {
      items: result.rows.map((r) => this.mapRow(r)),
      total: Number(totalRes.rows[0]?.count ?? 0),
    };
  }

  async create(
    tenantId: string,
    params: CreateUserActivityParams,
  ): Promise<UserActivityEvent> {
    const pool = await this.dbManager.getPool(tenantId);
    const id = randomUUID();
    const result = await pool.query<Row>(
      `INSERT INTO user_activity_events
        (id, user_id, organization_id, category, title, detail, href, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       RETURNING id, user_id, organization_id, category, title, detail, href, payload, created_at`,
      [
        id,
        params.userId,
        params.organizationId ?? null,
        params.category ?? 'general',
        params.title,
        params.detail ?? '',
        params.href ?? null,
        JSON.stringify(params.payload ?? {}),
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async clearByUser(tenantId: string, userId: string): Promise<number> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query(
      `DELETE FROM user_activity_events WHERE user_id = $1`,
      [userId],
    );
    return result.rowCount ?? 0;
  }

  private mapRow(row: Row): UserActivityEvent {
    return {
      id: row.id,
      userId: row.user_id,
      organizationId: row.organization_id,
      category: row.category,
      title: row.title,
      detail: row.detail,
      href: row.href,
      payload: row.payload ?? {},
      createdAt: row.created_at,
    };
  }
}

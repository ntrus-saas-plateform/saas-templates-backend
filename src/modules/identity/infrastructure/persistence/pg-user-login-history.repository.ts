import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import type {
  RecordLoginHistoryParams,
  UserLoginHistoryEntry,
  UserLoginHistoryRepositoryPort,
} from '../../domain/ports/user-login-history-repository.port.js';

type Row = {
  id: string;
  user_id: string;
  event_type: string;
  success: boolean;
  ip: string | null;
  user_agent: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  session_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
};

@Injectable()
export class PgUserLoginHistoryRepository implements UserLoginHistoryRepositoryPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async listByUser(
    tenantId: string,
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ items: readonly UserLoginHistoryEntry[]; total: number }> {
    const pool = await this.dbManager.getPool(tenantId);
    const totalRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM user_login_history WHERE user_id = $1`,
      [userId],
    );
    const offset = (page - 1) * limit;
    const result = await pool.query<Row>(
      `SELECT id, user_id, event_type, success, ip, user_agent, browser, os, device,
              session_id, metadata, created_at
       FROM user_login_history WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );
    return {
      items: result.rows.map((r) => this.mapRow(r)),
      total: Number(totalRes.rows[0]?.count ?? 0),
    };
  }

  async record(
    tenantId: string,
    params: RecordLoginHistoryParams,
  ): Promise<{ entry: UserLoginHistoryEntry; created: boolean }> {
    const pool = await this.dbManager.getPool(tenantId);
    const eventType = params.eventType ?? 'login';
    const success = params.success ?? true;
    const sessionId = params.sessionId ?? null;

    if (sessionId && eventType === 'login' && success) {
      const existing = await pool.query<Row>(
        `SELECT id, user_id, event_type, success, ip, user_agent, browser, os, device,
                session_id, metadata, created_at
         FROM user_login_history
         WHERE user_id = $1 AND session_id = $2 AND event_type = 'login' AND success = TRUE
         LIMIT 1`,
        [params.userId, sessionId],
      );
      if (existing.rows[0]) {
        return { entry: this.mapRow(existing.rows[0]), created: false };
      }
    }

    const id = randomUUID();
    const result = await pool.query<Row>(
      `INSERT INTO user_login_history
        (id, user_id, event_type, success, ip, user_agent, browser, os, device, session_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
       RETURNING id, user_id, event_type, success, ip, user_agent, browser, os, device,
                 session_id, metadata, created_at`,
      [
        id,
        params.userId,
        eventType,
        success,
        params.ip ?? null,
        params.userAgent ?? null,
        params.browser ?? null,
        params.os ?? null,
        params.device ?? null,
        sessionId,
        JSON.stringify(params.metadata ?? {}),
      ],
    );
    return { entry: this.mapRow(result.rows[0]), created: true };
  }

  private mapRow(row: Row): UserLoginHistoryEntry {
    return {
      id: row.id,
      userId: row.user_id,
      eventType: row.event_type,
      success: row.success,
      ip: row.ip,
      userAgent: row.user_agent,
      browser: row.browser,
      os: row.os,
      device: row.device,
      sessionId: row.session_id,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
    };
  }
}

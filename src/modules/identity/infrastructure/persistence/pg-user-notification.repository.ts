import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import type {
  CreateUserNotificationParams,
  UserNotification,
  UserNotificationRepositoryPort,
} from '../../domain/ports/user-notification-repository.port.js';

type NotificationRow = {
  id: string;
  user_id: string;
  organization_id: string | null;
  channel: string;
  category: string;
  priority: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  read_at: Date | null;
  created_at: Date;
};

@Injectable()
export class PgUserNotificationRepository implements UserNotificationRepositoryPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async listByUser(
    tenantId: string,
    userId: string,
    page: number,
    limit: number,
    opts?: { unreadOnly?: boolean },
  ): Promise<{ items: readonly UserNotification[]; total: number; unreadCount: number }> {
    const pool = await this.dbManager.getPool(tenantId);
    const unreadFilter = opts?.unreadOnly ? ' AND read_at IS NULL' : '';
    const totalRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM user_notifications
       WHERE user_id = $1${unreadFilter}`,
      [userId],
    );
    const unreadRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM user_notifications
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    );
    const total = Number(totalRes.rows[0]?.count ?? 0);
    const unreadCount = Number(unreadRes.rows[0]?.count ?? 0);
    const offset = (page - 1) * limit;
    const result = await pool.query<NotificationRow>(
      `SELECT id, user_id, organization_id, channel, category, priority, title, body,
              payload, read_at, created_at
       FROM user_notifications
       WHERE user_id = $1${unreadFilter}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );
    return {
      items: result.rows.map((r) => this.mapRow(r)),
      total,
      unreadCount,
    };
  }

  async markRead(
    tenantId: string,
    userId: string,
    notificationId: string,
  ): Promise<UserNotification | null> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query<NotificationRow>(
      `UPDATE user_notifications
       SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, organization_id, channel, category, priority, title, body,
                 payload, read_at, created_at`,
      [notificationId, userId],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async markAllRead(tenantId: string, userId: string): Promise<number> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query(
      `UPDATE user_notifications SET read_at = NOW()
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    );
    return result.rowCount ?? 0;
  }

  async create(
    tenantId: string,
    params: CreateUserNotificationParams,
  ): Promise<UserNotification> {
    const pool = await this.dbManager.getPool(tenantId);
    const id = randomUUID();
    const result = await pool.query<NotificationRow>(
      `INSERT INTO user_notifications
        (id, user_id, organization_id, channel, category, priority, title, body, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING id, user_id, organization_id, channel, category, priority, title, body,
                 payload, read_at, created_at`,
      [
        id,
        params.userId,
        params.organizationId ?? null,
        params.channel ?? 'in_app',
        params.category ?? 'general',
        params.priority ?? 'normal',
        params.title,
        params.body ?? '',
        JSON.stringify(params.payload ?? {}),
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async delete(
    tenantId: string,
    userId: string,
    notificationId: string,
  ): Promise<boolean> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query(
      `DELETE FROM user_notifications WHERE id = $1 AND user_id = $2`,
      [notificationId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: NotificationRow): UserNotification {
    return {
      id: row.id,
      userId: row.user_id,
      organizationId: row.organization_id,
      channel: row.channel,
      category: row.category,
      priority: row.priority,
      title: row.title,
      body: row.body,
      payload: row.payload ?? {},
      readAt: row.read_at,
      createdAt: row.created_at,
    };
  }
}

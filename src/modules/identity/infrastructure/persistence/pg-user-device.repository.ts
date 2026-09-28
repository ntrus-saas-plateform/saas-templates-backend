import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import type {
  EnrollPushDeviceParams,
  UpsertUserDeviceParams,
  UserDevice,
  UserDeviceRepositoryPort,
} from '../../domain/ports/user-device-repository.port.js';

type DeviceRow = {
  id: string;
  user_id: string;
  external_session_id: string | null;
  device_name: string | null;
  platform: string | null;
  browser: string | null;
  os: string | null;
  last_ip: string | null;
  last_seen_at: Date;
  trusted: boolean;
  push_token: string | null;
  push_platform: string | null;
  push_enrolled_at: Date | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
};

const SELECT_COLS = `id, user_id, external_session_id, device_name, platform, browser, os,
              last_ip, last_seen_at, trusted, push_token, push_platform, push_enrolled_at,
              metadata, created_at, updated_at`;

@Injectable()
export class PgUserDeviceRepository implements UserDeviceRepositoryPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async listByUser(tenantId: string, userId: string): Promise<readonly UserDevice[]> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query<DeviceRow>(
      `SELECT ${SELECT_COLS}
       FROM user_devices WHERE user_id = $1
       ORDER BY last_seen_at DESC`,
      [userId],
    );
    return result.rows.map((r) => this.mapRow(r));
  }

  async upsertFromSession(
    tenantId: string,
    params: UpsertUserDeviceParams,
  ): Promise<UserDevice> {
    const pool = await this.dbManager.getPool(tenantId);
    const sessionId = params.externalSessionId ?? null;
    if (sessionId) {
      const existing = await pool.query<{ id: string }>(
        `SELECT id FROM user_devices WHERE user_id = $1 AND external_session_id = $2`,
        [params.userId, sessionId],
      );
      if (existing.rows[0]) {
        const result = await pool.query<DeviceRow>(
          `UPDATE user_devices SET
             device_name = COALESCE($3, device_name),
             platform = COALESCE($4, platform),
             browser = COALESCE($5, browser),
             os = COALESCE($6, os),
             last_ip = COALESCE($7, last_ip),
             last_seen_at = COALESCE($8, NOW()),
             metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE($9::jsonb, '{}'::jsonb),
             updated_at = NOW()
           WHERE id = $1 AND user_id = $2
           RETURNING ${SELECT_COLS}`,
          [
            existing.rows[0].id,
            params.userId,
            params.deviceName ?? null,
            params.platform ?? null,
            params.browser ?? null,
            params.os ?? null,
            params.lastIp ?? null,
            params.lastSeenAt ?? new Date(),
            JSON.stringify(params.metadata ?? {}),
          ],
        );
        return this.mapRow(result.rows[0]);
      }
    }

    const id = randomUUID();
    const result = await pool.query<DeviceRow>(
      `INSERT INTO user_devices
        (id, user_id, external_session_id, device_name, platform, browser, os,
         last_ip, last_seen_at, trusted, push_token, push_platform, push_enrolled_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
       RETURNING ${SELECT_COLS}`,
      [
        id,
        params.userId,
        sessionId,
        params.deviceName ?? null,
        params.platform ?? null,
        params.browser ?? null,
        params.os ?? null,
        params.lastIp ?? null,
        params.lastSeenAt ?? new Date(),
        params.trusted ?? false,
        params.pushToken ?? null,
        params.pushPlatform ?? null,
        params.pushToken ? new Date() : null,
        JSON.stringify(params.metadata ?? {}),
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async enrollPush(
    tenantId: string,
    params: EnrollPushDeviceParams,
  ): Promise<UserDevice> {
    const pool = await this.dbManager.getPool(tenantId);
    const byToken = await pool.query<{ id: string }>(
      `SELECT id FROM user_devices WHERE user_id = $1 AND push_token = $2 LIMIT 1`,
      [params.userId, params.pushToken],
    );
    if (byToken.rows[0]) {
      const result = await pool.query<DeviceRow>(
        `UPDATE user_devices SET
           device_name = $3,
           platform = COALESCE($4, platform),
           push_platform = $5,
           push_enrolled_at = COALESCE(push_enrolled_at, NOW()),
           last_seen_at = NOW(),
           browser = COALESCE($6, browser),
           os = COALESCE($7, os),
           last_ip = COALESCE($8, last_ip),
           metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE($9::jsonb, '{}'::jsonb),
           updated_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING ${SELECT_COLS}`,
        [
          byToken.rows[0].id,
          params.userId,
          params.deviceName,
          params.platform ?? null,
          params.pushPlatform,
          params.browser ?? null,
          params.os ?? null,
          params.lastIp ?? null,
          JSON.stringify(params.metadata ?? {}),
        ],
      );
      return this.mapRow(result.rows[0]);
    }

    const id = randomUUID();
    const result = await pool.query<DeviceRow>(
      `INSERT INTO user_devices
        (id, user_id, device_name, platform, browser, os, last_ip, last_seen_at,
         trusted, push_token, push_platform, push_enrolled_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), TRUE, $8, $9, NOW(), $10::jsonb)
       RETURNING ${SELECT_COLS}`,
      [
        id,
        params.userId,
        params.deviceName,
        params.platform ?? null,
        params.browser ?? null,
        params.os ?? null,
        params.lastIp ?? null,
        params.pushToken,
        params.pushPlatform,
        JSON.stringify(params.metadata ?? {}),
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async clearPush(
    tenantId: string,
    userId: string,
    deviceId: string,
  ): Promise<UserDevice | null> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query<DeviceRow>(
      `UPDATE user_devices
       SET push_token = NULL, push_platform = NULL, push_enrolled_at = NULL, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING ${SELECT_COLS}`,
      [deviceId, userId],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async setTrusted(
    tenantId: string,
    userId: string,
    deviceId: string,
    trusted: boolean,
  ): Promise<UserDevice | null> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query<DeviceRow>(
      `UPDATE user_devices SET trusted = $3, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING ${SELECT_COLS}`,
      [deviceId, userId, trusted],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async remove(tenantId: string, userId: string, deviceId: string): Promise<boolean> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query(
      `DELETE FROM user_devices WHERE id = $1 AND user_id = $2`,
      [deviceId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: DeviceRow): UserDevice {
    return {
      id: row.id,
      userId: row.user_id,
      externalSessionId: row.external_session_id,
      deviceName: row.device_name,
      platform: row.platform,
      browser: row.browser,
      os: row.os,
      lastIp: row.last_ip,
      lastSeenAt: row.last_seen_at,
      trusted: row.trusted,
      pushToken: row.push_token,
      pushPlatform: row.push_platform,
      pushEnrolledAt: row.push_enrolled_at,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

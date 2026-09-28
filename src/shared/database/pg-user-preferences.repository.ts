import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { UserPreferencesPort } from '../../core/domain/ports/user-preferences.port.js';
import { TenantDatabaseManager } from './tenant-database.manager.js';

@Injectable()
export class PgUserPreferencesRepository implements UserPreferencesPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async getActiveOrganization(tenantId: string, userId: string): Promise<string | null> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query<{ active_organization_id: string }>(
      `SELECT active_organization_id FROM user_preferences WHERE user_id = $1`,
      [userId],
    );
    return result.rows[0]?.active_organization_id ?? null;
  }

  async upsertActiveOrganization(
    tenantId: string,
    userId: string,
    organizationId: string,
    client?: unknown,
  ): Promise<void> {
    const query = `INSERT INTO user_preferences (user_id, active_organization_id, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET active_organization_id = EXCLUDED.active_organization_id, updated_at = NOW()`;

    if (client) {
      await (client as PoolClient).query(query, [userId, organizationId]);
      return;
    }

    const pool = await this.dbManager.getPool(tenantId);
    await pool.query(query, [userId, organizationId]);
  }

  async getSettings(tenantId: string, userId: string): Promise<Record<string, unknown>> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query<{ settings: Record<string, unknown> | null }>(
      `SELECT settings FROM user_preferences WHERE user_id = $1`,
      [userId],
    );
    return result.rows[0]?.settings ?? {};
  }

  async patchSettings(
    tenantId: string,
    userId: string,
    patch: Record<string, unknown>,
    client?: unknown,
    organizationId?: string | null,
  ): Promise<Record<string, unknown>> {
    const query = `
      INSERT INTO user_preferences (user_id, active_organization_id, settings, updated_at)
      VALUES (
        $1,
        COALESCE(NULLIF($3::text, '')::uuid, '00000000-0000-4000-8000-000000000000'::uuid),
        $2::jsonb,
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE
      SET settings = COALESCE(user_preferences.settings, '{}'::jsonb) || EXCLUDED.settings,
          updated_at = NOW()
      RETURNING settings`;

    const payload = JSON.stringify(patch);
    const params = [userId, payload, organizationId ?? null];
    if (client) {
      const result = await (client as PoolClient).query<{ settings: Record<string, unknown> }>(
        query,
        params,
      );
      return result.rows[0]?.settings ?? {};
    }

    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query<{ settings: Record<string, unknown> }>(query, params);
    return result.rows[0]?.settings ?? {};
  }
}

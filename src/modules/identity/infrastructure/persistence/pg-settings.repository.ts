import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { SettingsRepositoryPort } from '../../domain/ports/settings-repository.port.js';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';

@Injectable()
export class PgSettingsRepository implements SettingsRepositoryPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async getTenantSetting(tenantId: string, namespace: string, key: string): Promise<unknown | null> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query<{ value: unknown }>(
      `SELECT value FROM tenant_settings WHERE namespace = $1 AND key = $2`,
      [namespace, key],
    );
    return result.rows[0]?.value ?? null;
  }

  async listTenantNamespace(
    tenantId: string,
    namespace: string,
  ): Promise<Readonly<Record<string, unknown>>> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query<{ key: string; value: unknown }>(
      `SELECT key, value FROM tenant_settings WHERE namespace = $1`,
      [namespace],
    );
    return Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
  }

  async setTenantSetting(
    tenantId: string,
    namespace: string,
    key: string,
    value: unknown,
    sensitivity = 'normal',
    client?: unknown,
  ): Promise<void> {
    if (value === undefined) {
      throw new Error(
        `Cannot persist undefined setting ${namespace}.${key} (would violate NOT NULL)`,
      );
    }
    const db = client
      ? (client as PoolClient)
      : await this.dbManager.getPool(tenantId);
    // JSON.stringify(undefined) is JS undefined (not "null") → pg binds SQL NULL.
    const encoded = JSON.stringify(value);
    await db.query(
      `INSERT INTO tenant_settings (namespace, key, value, sensitivity, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, NOW())
       ON CONFLICT (namespace, key) DO UPDATE
       SET value = EXCLUDED.value, sensitivity = EXCLUDED.sensitivity, updated_at = NOW()`,
      [namespace, key, encoded, sensitivity],
    );
  }

  async getOrganizationSetting(
    tenantId: string,
    organizationId: string,
    namespace: string,
    key: string,
  ): Promise<unknown | null> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query<{ value: unknown }>(
      `SELECT value FROM organization_settings
       WHERE organization_id = $1 AND namespace = $2 AND key = $3`,
      [organizationId, namespace, key],
    );
    return result.rows[0]?.value ?? null;
  }

  async listOrganizationNamespace(
    tenantId: string,
    organizationId: string,
    namespace: string,
  ): Promise<Readonly<Record<string, unknown>>> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query<{ key: string; value: unknown }>(
      `SELECT key, value FROM organization_settings
       WHERE organization_id = $1 AND namespace = $2`,
      [organizationId, namespace],
    );
    return Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
  }

  async setOrganizationSetting(
    tenantId: string,
    organizationId: string,
    namespace: string,
    key: string,
    value: unknown,
    client?: unknown,
  ): Promise<void> {
    if (value === undefined) {
      throw new Error(
        `Cannot persist undefined setting ${namespace}.${key} (would violate NOT NULL)`,
      );
    }
    const db = client
      ? (client as PoolClient)
      : await this.dbManager.getPool(tenantId);
    await db.query(
      `INSERT INTO organization_settings (organization_id, namespace, key, value, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())
       ON CONFLICT (organization_id, namespace, key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = NOW()`,
      [organizationId, namespace, key, JSON.stringify(value)],
    );
  }
}

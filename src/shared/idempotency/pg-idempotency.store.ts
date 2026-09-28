import { Injectable, Inject } from '@nestjs/common';
import { TenantDatabaseManager } from '../database/tenant-database.manager.js';
import type {
  IdempotencyStorePort,
  IdempotencyRecord,
  IdempotencyAcquireResult,
} from '../../core/domain/ports/idempotency.port.js';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';

interface IdempotencyRow {
  key: string;
  tenant_id: string;
  request_hash: string;
  status_code: number;
  response_body: string;
  created_at: Date;
  expires_at: Date;
}

@Injectable()
export class PgIdempotencyStore implements IdempotencyStorePort {
  constructor(
    private readonly dbManager: TenantDatabaseManager,
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
  ) {}

  async acquire(
    key: string,
    tenantId: string,
    requestHash: string,
  ): Promise<IdempotencyAcquireResult> {
    const pool = this.dbManager.getControlPlanePool();
    const client = await pool.connect();
    const expiresAt = new Date(Date.now() + this.config.IDEMPOTENCY_TTL_SECONDS * 1000);

    try {
      await client.query('BEGIN');

      const insert = await client.query<IdempotencyRow>(
        `INSERT INTO idempotency_keys (key, tenant_id, request_hash, status_code, response_body, expires_at)
         VALUES ($1, $2, $3, 0, '', $4)
         ON CONFLICT (key, tenant_id) DO NOTHING
         RETURNING key, tenant_id, request_hash, status_code, response_body, created_at, expires_at`,
        [key, tenantId, requestHash, expiresAt],
      );

      if (insert.rows[0]) {
        await client.query('COMMIT');
        return { type: 'acquired' };
      }

      const existing = await client.query<IdempotencyRow>(
        `SELECT key, tenant_id, request_hash, status_code, response_body, created_at, expires_at
         FROM idempotency_keys
         WHERE key = $1 AND tenant_id = $2 AND expires_at > NOW()
         FOR UPDATE`,
        [key, tenantId],
      );

      const row = existing.rows[0];
      if (!row) {
        await client.query('COMMIT');
        return { type: 'conflict' };
      }

      const record = this.mapRow(row);
      if (record.requestHash !== requestHash || record.statusCode === 0) {
        await client.query('COMMIT');
        return { type: 'conflict' };
      }

      await client.query('COMMIT');
      return { type: 'replay', record };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async complete(
    key: string,
    tenantId: string,
    statusCode: number,
    responseBody: string,
  ): Promise<void> {
    const pool = this.dbManager.getControlPlanePool();
    await pool.query(
      `UPDATE idempotency_keys SET status_code = $3, response_body = $4
       WHERE key = $1 AND tenant_id = $2`,
      [key, tenantId, statusCode, responseBody],
    );
  }

  async find(key: string, tenantId: string): Promise<IdempotencyRecord | null> {
    const pool = this.dbManager.getControlPlanePool();
    const result = await pool.query<IdempotencyRow>(
      `SELECT key, tenant_id, request_hash, status_code, response_body, created_at, expires_at
       FROM idempotency_keys WHERE key = $1 AND tenant_id = $2 AND expires_at > NOW()`,
      [key, tenantId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return this.mapRow(row);
  }

  private mapRow(row: IdempotencyRow): IdempotencyRecord {
    return {
      key: row.key,
      tenantId: row.tenant_id,
      requestHash: row.request_hash,
      statusCode: row.status_code,
      responseBody: row.response_body,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }
}

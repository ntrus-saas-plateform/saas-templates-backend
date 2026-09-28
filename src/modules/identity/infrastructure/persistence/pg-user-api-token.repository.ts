import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import type {
  CreateUserApiTokenParams,
  UserApiToken,
  UserApiTokenRepositoryPort,
} from '../../domain/ports/user-api-token-repository.port.js';

type Row = {
  id: string;
  user_id: string;
  name: string;
  token_prefix: string;
  token_hash: string;
  scopes: unknown;
  last_used_at: Date | null;
  expires_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class PgUserApiTokenRepository implements UserApiTokenRepositoryPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async listByUser(tenantId: string, userId: string): Promise<readonly UserApiToken[]> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query<Row>(
      `SELECT id, user_id, name, token_prefix, token_hash, scopes, last_used_at,
              expires_at, revoked_at, created_at, updated_at
       FROM user_api_tokens WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map((r) => this.mapRow(r));
  }

  async create(tenantId: string, params: CreateUserApiTokenParams): Promise<UserApiToken> {
    const pool = await this.dbManager.getPool(tenantId);
    const id = randomUUID();
    const result = await pool.query<Row>(
      `INSERT INTO user_api_tokens
        (id, user_id, name, token_prefix, token_hash, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       RETURNING id, user_id, name, token_prefix, token_hash, scopes, last_used_at,
                 expires_at, revoked_at, created_at, updated_at`,
      [
        id,
        params.userId,
        params.name,
        params.tokenPrefix,
        params.tokenHash,
        JSON.stringify(params.scopes ?? []),
        params.expiresAt ?? null,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async revoke(
    tenantId: string,
    userId: string,
    tokenId: string,
  ): Promise<UserApiToken | null> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query<Row>(
      `UPDATE user_api_tokens
       SET revoked_at = COALESCE(revoked_at, NOW()), updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, name, token_prefix, token_hash, scopes, last_used_at,
                 expires_at, revoked_at, created_at, updated_at`,
      [tokenId, userId],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findActiveByHash(
    tenantId: string,
    tokenHash: string,
  ): Promise<UserApiToken | null> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query<Row>(
      `SELECT id, user_id, name, token_prefix, token_hash, scopes, last_used_at,
              expires_at, revoked_at, created_at, updated_at
       FROM user_api_tokens
       WHERE token_hash = $1
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [tokenHash],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async touchLastUsed(tenantId: string, tokenId: string): Promise<void> {
    const pool = await this.dbManager.getPool(tenantId);
    await pool.query(
      `UPDATE user_api_tokens SET last_used_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [tokenId],
    );
  }

  private mapRow(row: Row): UserApiToken {
    const scopes = Array.isArray(row.scopes) ? row.scopes.map(String) : [];
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      tokenPrefix: row.token_prefix,
      scopes,
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

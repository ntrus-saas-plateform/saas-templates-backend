import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable, Inject, Optional } from '@nestjs/common';
import type { SecretProviderPort } from '../../core/domain/ports/secret-provider.port.js';
import {
  SECRET_STORE_REF_PREFIX,
} from '../../core/domain/ports/secret-provider.port.js';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';
import { TENANT_DATABASE_CREDENTIALS_REF } from '../database/database.constants.js';
import { ControlPlaneDatabaseService } from '../database/control-plane-database.service.js';

const LEGACY_CONTROL_PLANE_CREDENTIALS_REF = 'CONTROL_PLANE_DB_PASSWORD';

/**
 * Env / local secret provider.
 * - Shared refs (TENANT_DB_PASSWORD, CONTROL_PLANE_DB_PASSWORD) resolve from env.
 * - Per-tenant refs (`secret:tenants/{id}/db`) are stored encrypted in `secret_store`.
 */
@Injectable()
export class EnvSecretProvider implements SecretProviderPort {
  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    @Optional() private readonly controlPlaneDb?: ControlPlaneDatabaseService,
  ) {}

  async resolve(reference: string): Promise<string> {
    if (
      reference === TENANT_DATABASE_CREDENTIALS_REF ||
      reference === LEGACY_CONTROL_PLANE_CREDENTIALS_REF
    ) {
      return this.config.TENANT_DB_PASSWORD;
    }

    if (reference.startsWith(SECRET_STORE_REF_PREFIX)) {
      return this.readFromStore(reference);
    }

    throw new Error(
      `Unsupported credentials reference "${reference}" in env secret provider. ` +
        `Use ${TENANT_DATABASE_CREDENTIALS_REF} or ${SECRET_STORE_REF_PREFIX}tenants/{id}/db.`,
    );
  }

  async putTenantDatabasePassword(tenantId: string, password: string): Promise<string> {
    const reference = `${SECRET_STORE_REF_PREFIX}tenants/${tenantId}/db`;
    await this.writeToStore(reference, password);
    return reference;
  }

  async deleteTenantDatabasePassword(reference: string): Promise<void> {
    if (
      reference === TENANT_DATABASE_CREDENTIALS_REF ||
      reference === LEGACY_CONTROL_PLANE_CREDENTIALS_REF ||
      !reference.startsWith(SECRET_STORE_REF_PREFIX)
    ) {
      return;
    }
    if (!this.controlPlaneDb) return;
    const pool = this.controlPlaneDb.getPool();
    await pool.query(`DELETE FROM secret_store WHERE reference = $1`, [reference]);
  }

  private deriveKey(): Buffer {
    const material = this.config.SECRET_ENCRYPTION_KEY || this.config.CONTROL_PLANE_DB_PASSWORD;
    return createHash('sha256').update(material).digest();
  }

  private encrypt(plaintext: string): string {
    const key = this.deriveKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64url');
  }

  private decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64url');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const key = this.deriveKey();
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  private async writeToStore(reference: string, plaintext: string): Promise<void> {
    if (!this.controlPlaneDb) {
      throw new Error('Control plane database required for per-tenant secret storage');
    }
    const ciphertext = this.encrypt(plaintext);
    const pool = this.controlPlaneDb.getPool();
    await pool.query(
      `INSERT INTO secret_store (reference, ciphertext, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (reference) DO UPDATE SET ciphertext = EXCLUDED.ciphertext, updated_at = NOW()`,
      [reference, ciphertext],
    );
  }

  private async readFromStore(reference: string): Promise<string> {
    if (!this.controlPlaneDb) {
      throw new Error('Control plane database required for per-tenant secret storage');
    }
    const pool = this.controlPlaneDb.getPool();
    const result = await pool.query<{ ciphertext: string }>(
      `SELECT ciphertext FROM secret_store WHERE reference = $1`,
      [reference],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error(`Secret not found for reference "${reference}"`);
    }
    return this.decrypt(row.ciphertext);
  }
}

import { Injectable, Inject, Logger } from '@nestjs/common';
import type { SecretProviderPort } from '../../core/domain/ports/secret-provider.port.js';
import { VAULT_REF_PREFIX } from '../../core/domain/ports/secret-provider.port.js';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';
import { TENANT_DATABASE_CREDENTIALS_REF } from '../database/database.constants.js';

const LEGACY_CONTROL_PLANE_CREDENTIALS_REF = 'CONTROL_PLANE_DB_PASSWORD';

/**
 * HashiCorp Vault KV v2 secret provider.
 * credentials_ref format: `vault:tenants/{tenantId}/db` (path under VAULT_KV_MOUNT).
 */
@Injectable()
export class VaultSecretProvider implements SecretProviderPort {
  private readonly logger = new Logger(VaultSecretProvider.name);

  constructor(@Inject(APP_CONFIG) private readonly config: EnvironmentConfig) {}

  async resolve(reference: string): Promise<string> {
    if (
      reference === TENANT_DATABASE_CREDENTIALS_REF ||
      reference === LEGACY_CONTROL_PLANE_CREDENTIALS_REF
    ) {
      // Cluster admin / legacy shared password still comes from env
      return this.config.TENANT_DB_PASSWORD;
    }

    if (!reference.startsWith(VAULT_REF_PREFIX)) {
      throw new Error(
        `Unsupported credentials reference "${reference}" for Vault provider. ` +
          `Expected ${VAULT_REF_PREFIX}tenants/{id}/db`,
      );
    }

    const path = reference.slice(VAULT_REF_PREFIX.length);
    const data = await this.vaultRead(path);
    const password = data.password;
    if (typeof password !== 'string' || password.length === 0) {
      throw new Error(`Vault secret at "${path}" missing password field`);
    }
    return password;
  }

  async putTenantDatabasePassword(tenantId: string, password: string): Promise<string> {
    const path = `tenants/${tenantId}/db`;
    await this.vaultWrite(path, { password });
    return `${VAULT_REF_PREFIX}${path}`;
  }

  async deleteTenantDatabasePassword(reference: string): Promise<void> {
    if (
      reference === TENANT_DATABASE_CREDENTIALS_REF ||
      reference === LEGACY_CONTROL_PLANE_CREDENTIALS_REF ||
      !reference.startsWith(VAULT_REF_PREFIX)
    ) {
      return;
    }
    const path = reference.slice(VAULT_REF_PREFIX.length);
    const url = `${this.baseUrl()}/v1/${this.mount()}/metadata/${path}`;
    const res = await fetch(url, { method: 'DELETE', headers: this.headers() });
    if (!res.ok && res.status !== 404) {
      const body = await res.text();
      this.logger.error(`Vault delete failed ${res.status}: ${body}`);
      throw new Error(`Vault delete failed for ${path}: HTTP ${res.status}`);
    }
  }

  private baseUrl(): string {
    const addr = this.config.VAULT_ADDR?.replace(/\/$/, '');
    if (!addr) throw new Error('VAULT_ADDR is required when SECRET_PROVIDER=vault');
    return addr;
  }

  private mount(): string {
    return this.config.VAULT_KV_MOUNT || 'secret';
  }

  private headers(): Record<string, string> {
    const token = this.config.VAULT_TOKEN;
    if (!token) throw new Error('VAULT_TOKEN is required when SECRET_PROVIDER=vault');
    const headers: Record<string, string> = {
      'X-Vault-Token': token,
      'Content-Type': 'application/json',
    };
    if (this.config.VAULT_NAMESPACE) {
      headers['X-Vault-Namespace'] = this.config.VAULT_NAMESPACE;
    }
    return headers;
  }

  private async vaultRead(path: string): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl()}/v1/${this.mount()}/data/${path}`;
    const res = await fetch(url, { method: 'GET', headers: this.headers() });
    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Vault read failed ${res.status}: ${body}`);
      throw new Error(`Vault read failed for ${path}: HTTP ${res.status}`);
    }
    const json = (await res.json()) as { data?: { data?: Record<string, unknown> } };
    return json.data?.data ?? {};
  }

  private async vaultWrite(path: string, data: Record<string, string>): Promise<void> {
    const url = `${this.baseUrl()}/v1/${this.mount()}/data/${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ data }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Vault write failed ${res.status}: ${body}`);
      throw new Error(`Vault write failed for ${path}: HTTP ${res.status}`);
    }
  }
}

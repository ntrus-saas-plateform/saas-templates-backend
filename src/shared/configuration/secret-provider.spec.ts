import { describe, expect, it, vi } from 'vitest';
import { EnvSecretProvider } from './env-secret.provider.js';
import { VaultSecretProvider } from './vault-secret.provider.js';
import type { EnvironmentConfig } from './environment.schema.js';
import { TENANT_DATABASE_CREDENTIALS_REF } from '../database/database.constants.js';

function baseConfig(overrides: Partial<EnvironmentConfig> = {}): EnvironmentConfig {
  return {
    TENANT_DB_PASSWORD: 'shared-cluster-secret',
    CONTROL_PLANE_DB_PASSWORD: 'cp-secret',
    SECRET_ENCRYPTION_KEY: 'test-encryption-key-32chars!!',
    SECRET_PROVIDER: 'env',
    ...overrides,
  } as EnvironmentConfig;
}

describe('EnvSecretProvider', () => {
  it('resolves shared TENANT_DB_PASSWORD ref from env', async () => {
    const provider = new EnvSecretProvider(baseConfig());
    await expect(provider.resolve(TENANT_DATABASE_CREDENTIALS_REF)).resolves.toBe(
      'shared-cluster-secret',
    );
  });

  it('stores and reads per-tenant password via secret_store', async () => {
    const store = new Map<string, string>();
    const pool = {
      query: vi.fn(async (sql: string, params: unknown[]) => {
        if (sql.includes('INSERT INTO secret_store')) {
          store.set(params[0] as string, params[1] as string);
          return { rows: [] };
        }
        if (sql.includes('SELECT ciphertext')) {
          const ciphertext = store.get(params[0] as string);
          return { rows: ciphertext ? [{ ciphertext }] : [] };
        }
        if (sql.includes('DELETE FROM secret_store')) {
          store.delete(params[0] as string);
          return { rows: [] };
        }
        throw new Error(`unexpected sql: ${sql}`);
      }),
    };
    const controlPlaneDb = { getPool: () => pool } as never;
    const provider = new EnvSecretProvider(baseConfig(), controlPlaneDb);

    const ref = await provider.putTenantDatabasePassword('tenant-1', 'unique-pw');
    expect(ref).toBe('secret:tenants/tenant-1/db');
    await expect(provider.resolve(ref)).resolves.toBe('unique-pw');
    await provider.deleteTenantDatabasePassword(ref);
    expect(store.has(ref)).toBe(false);
  });
});

describe('VaultSecretProvider', () => {
  it('resolves shared cluster password from env', async () => {
    const provider = new VaultSecretProvider(
      baseConfig({ SECRET_PROVIDER: 'vault', VAULT_ADDR: 'http://127.0.0.1:8200', VAULT_TOKEN: 'root' }),
    );
    await expect(provider.resolve(TENANT_DATABASE_CREDENTIALS_REF)).resolves.toBe(
      'shared-cluster-secret',
    );
  });

  it('writes and reads tenant password via Vault KV v2 API', async () => {
    const secrets = new Map<string, Record<string, string>>();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.split('/data/')[1] ?? url.split('/metadata/')[1]!;
      if (init?.method === 'POST') {
        const body = JSON.parse(init.body as string) as { data: Record<string, string> };
        secrets.set(path, body.data);
        return {
          ok: true,
          status: 200,
          text: async (): Promise<string> => '',
          json: async () => ({}),
        };
      }
      if (init?.method === 'DELETE') {
        secrets.delete(path);
        return {
          ok: true,
          status: 204,
          text: async (): Promise<string> => '',
          json: async () => ({}),
        };
      }
      const data = secrets.get(path);
      if (!data) {
        return {
          ok: false,
          status: 404,
          text: async (): Promise<string> => 'not found',
          json: async () => ({}),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async (): Promise<string> => '',
        json: async () => ({ data: { data } }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new VaultSecretProvider(
      baseConfig({
        SECRET_PROVIDER: 'vault',
        VAULT_ADDR: 'http://127.0.0.1:8200',
        VAULT_TOKEN: 'root',
        VAULT_KV_MOUNT: 'secret',
      }),
    );

    const ref = await provider.putTenantDatabasePassword('tenant-9', 'vault-pw');
    expect(ref).toBe('vault:tenants/tenant-9/db');
    await expect(provider.resolve(ref)).resolves.toBe('vault-pw');
    await provider.deleteTenantDatabasePassword(ref);

    vi.unstubAllGlobals();
  });
});
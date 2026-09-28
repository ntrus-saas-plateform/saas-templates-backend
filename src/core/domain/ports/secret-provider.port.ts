export interface SecretProviderPort {
  /**
   * Resolve a credentials reference to a plaintext secret.
   * Supported refs depend on the provider (shared env key, secret_store, or Vault path).
   */
  resolve(reference: string): Promise<string>;

  /**
   * Persist a dedicated DB password for a tenant and return the credentials_ref
   * to store on `tenants.database_credentials_ref`.
   */
  putTenantDatabasePassword(tenantId: string, password: string): Promise<string>;

  /**
   * Remove a per-tenant DB secret (secret_store or Vault). No-op for shared env refs.
   */
  deleteTenantDatabasePassword(reference: string): Promise<void>;
}

export const SECRET_PROVIDER_PORT = Symbol('SECRET_PROVIDER_PORT');

/** Prefix for control-plane secret_store references. */
export const SECRET_STORE_REF_PREFIX = 'secret:';

/** Prefix for HashiCorp Vault KV v2 logical paths (without mount). */
export const VAULT_REF_PREFIX = 'vault:';

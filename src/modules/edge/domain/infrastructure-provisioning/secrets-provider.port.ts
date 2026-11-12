export const SECRETS_PROVIDER_PORT = Symbol('SECRETS_PROVIDER_PORT');

export type SecretMaterial = {
  username?: string;
  password?: string;
  connectionUri?: string;
  token?: string;
  /** Opaque single-value secret (Keycloak admin/client credentials). */
  value?: string;
  expiresAt?: Date | null;
  extra?: Record<string, string>;
};

export type StoredSecretRef = {
  credentialRef: string;
  kind: string;
  version: number;
  createdAt: Date;
  expiresAt?: Date | null;
};

export interface SecretsProviderPort {
  put(input: {
    kind: string;
    material: SecretMaterial;
    expiresAt?: Date | null;
    metadata?: Record<string, unknown>;
  }): Promise<StoredSecretRef>;

  get(credentialRef: string): Promise<SecretMaterial>;

  rotate(credentialRef: string, material: SecretMaterial): Promise<StoredSecretRef>;

  revoke(credentialRef: string): Promise<void>;

  /** Returns metadata only — never secret values. */
  describe(credentialRef: string): Promise<{
    credentialRef: string;
    kind: string;
    version: number;
    status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
    expiresAt: Date | null;
  }>;
}

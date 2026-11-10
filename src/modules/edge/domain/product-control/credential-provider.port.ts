export const CREDENTIAL_PROVIDER_PORT = Symbol('CREDENTIAL_PROVIDER_PORT');

export type ResolvedCredential = {
  credentialRef: string;
  authProfile: string;
  /** Ephemeral material — never persist. */
  material: {
    accessToken?: string;
    clientCertPem?: string;
    clientKeyPem?: string;
    hmacSecret?: string;
    expiresAt?: Date;
  };
};

/**
 * Resolves opaque credential_ref handles to short-lived material.
 * Implementations must never write secrets into PostgreSQL.
 */
export interface CredentialProviderPort {
  resolve(credentialRef: string, authProfile: string): Promise<ResolvedCredential>;
  revoke(credentialRef: string, actorId: string): Promise<void>;
}

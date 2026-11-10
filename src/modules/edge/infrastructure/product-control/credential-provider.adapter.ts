import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type {
  CredentialProviderPort,
  ResolvedCredential,
} from '../../domain/product-control/credential-provider.port.js';
import { ProductControlErrorCode } from '../../domain/product-control/product-control.types.js';

export type CredentialMaterialStore = Map<
  string,
  {
    authProfile: string;
    material: ResolvedCredential['material'];
    revoked?: boolean;
  }
>;

/**
 * Injectable fake / in-memory credential provider for tests and local wiring.
 * Production deployments replace this with a vault/KMS adapter; PostgreSQL only
 * ever stores opaque credential_ref handles.
 */
export class FakeCredentialProvider implements CredentialProviderPort {
  constructor(private readonly store: CredentialMaterialStore = new Map()) {}

  seed(
    credentialRef: string,
    authProfile: string,
    material: ResolvedCredential['material'],
  ): void {
    this.store.set(credentialRef, { authProfile, material, revoked: false });
  }

  async resolve(credentialRef: string, authProfile: string): Promise<ResolvedCredential> {
    const entry = this.store.get(credentialRef);
    if (!entry || entry.revoked) {
      throw new DomainError(
        ErrorCode.UNAUTHORIZED,
        'Credential ref unknown or revoked',
        [{ code: ProductControlErrorCode.AUTHENTICATION_FAILED, credentialRef }],
      );
    }
    // HMAC_SIGNED is used by SignatureService for any bound ref verification.
    if (authProfile !== 'HMAC_SIGNED' && entry.authProfile !== authProfile) {
      throw new DomainError(
        ErrorCode.UNAUTHORIZED,
        'Credential auth profile mismatch',
        [{ code: ProductControlErrorCode.AUTHENTICATION_FAILED, credentialRef }],
      );
    }
    if (entry.material.expiresAt && entry.material.expiresAt.getTime() <= Date.now()) {
      throw new DomainError(
        ErrorCode.UNAUTHORIZED,
        'Credential expired',
        [{ code: ProductControlErrorCode.REQUEST_EXPIRED, credentialRef }],
      );
    }
    return {
      credentialRef,
      authProfile: entry.authProfile,
      material: { ...entry.material },
    };
  }

  async revoke(credentialRef: string, _actorId: string): Promise<void> {
    const entry = this.store.get(credentialRef);
    if (entry) {
      entry.revoked = true;
      this.store.set(credentialRef, entry);
    }
  }
}

/**
 * Env-backed adapter: EDGE_PCI_CREDENTIALS_JSON maps opaque refs → ephemeral material.
 * Never persists secrets into the control-plane database.
 */
export class EnvCredentialProvider implements CredentialProviderPort {
  private readonly fake: FakeCredentialProvider;

  constructor(json?: string) {
    const store: CredentialMaterialStore = new Map();
    if (json?.trim()) {
      try {
        const parsed = JSON.parse(json) as Record<
          string,
          { authProfile: string; material: ResolvedCredential['material'] }
        >;
        for (const [ref, value] of Object.entries(parsed)) {
          const material = { ...value.material };
          if (typeof material.expiresAt === 'string') {
            material.expiresAt = new Date(material.expiresAt);
          }
          store.set(ref, {
            authProfile: value.authProfile,
            material,
            revoked: false,
          });
        }
      } catch {
        // leave empty — resolve will fail closed
      }
    }
    this.fake = new FakeCredentialProvider(store);
  }

  resolve(credentialRef: string, authProfile: string) {
    return this.fake.resolve(credentialRef, authProfile);
  }

  revoke(credentialRef: string, actorId: string) {
    return this.fake.revoke(credentialRef, actorId);
  }
}

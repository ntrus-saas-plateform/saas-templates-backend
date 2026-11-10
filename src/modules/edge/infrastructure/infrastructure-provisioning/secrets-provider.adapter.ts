import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { InfrastructureErrorCode } from '../../domain/infrastructure-provisioning/infrastructure.types.js';
import type {
  SecretMaterial,
  SecretsProviderPort,
  StoredSecretRef,
} from '../../domain/infrastructure-provisioning/secrets-provider.port.js';

type VaultEntry = {
  kind: string;
  version: number;
  ciphertext: string;
  iv: string;
  tag: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  createdAt: Date;
  expiresAt: Date | null;
};

/**
 * Encrypted in-memory / process vault. Control-plane PostgreSQL only stores opaque refs.
 * Production replaces with HashiCorp Vault / KMS; key from EDGE_P76_SECRETS_KEY.
 */
export class EncryptedSecretsProvider implements SecretsProviderPort {
  private readonly store = new Map<string, VaultEntry>();
  private readonly key: Buffer;

  constructor(keyMaterial?: string) {
    const raw = keyMaterial ?? process.env.EDGE_P76_SECRETS_KEY ?? 'dev-only-p76-secrets-key';
    this.key = createHash('sha256').update(raw).digest();
  }

  private encrypt(material: SecretMaterial): { ciphertext: string; iv: string; tag: string } {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const plain = Buffer.from(JSON.stringify(material), 'utf8');
    const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: enc.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  private decrypt(entry: VaultEntry): SecretMaterial {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(entry.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(entry.tag, 'base64'));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(entry.ciphertext, 'base64')),
      decipher.final(),
    ]);
    return JSON.parse(dec.toString('utf8')) as SecretMaterial;
  }

  async put(input: {
    kind: string;
    material: SecretMaterial;
    expiresAt?: Date | null;
  }): Promise<StoredSecretRef> {
    const credentialRef = `sec_${randomUUID().replace(/-/g, '')}`;
    const enc = this.encrypt(input.material);
    this.store.set(credentialRef, {
      kind: input.kind,
      version: 1,
      ...enc,
      status: 'ACTIVE',
      createdAt: new Date(),
      expiresAt: input.expiresAt ?? null,
    });
    return {
      credentialRef,
      kind: input.kind,
      version: 1,
      createdAt: new Date(),
      expiresAt: input.expiresAt ?? null,
    };
  }

  async get(credentialRef: string): Promise<SecretMaterial> {
    const entry = this.store.get(credentialRef);
    if (!entry || entry.status === 'REVOKED') {
      throw new DomainError(ErrorCode.UNAUTHORIZED, 'Secret ref unknown or revoked', [
        { code: InfrastructureErrorCode.SECRET_UNAVAILABLE, credentialRef },
      ]);
    }
    if (entry.expiresAt && entry.expiresAt.getTime() <= Date.now()) {
      entry.status = 'EXPIRED';
      throw new DomainError(ErrorCode.UNAUTHORIZED, 'Secret expired', [
        { code: InfrastructureErrorCode.SECRET_UNAVAILABLE, credentialRef },
      ]);
    }
    return this.decrypt(entry);
  }

  async rotate(credentialRef: string, material: SecretMaterial): Promise<StoredSecretRef> {
    const entry = this.store.get(credentialRef);
    if (!entry || entry.status === 'REVOKED') {
      throw new DomainError(ErrorCode.UNAUTHORIZED, 'Secret ref unknown or revoked', [
        { code: InfrastructureErrorCode.SECRET_UNAVAILABLE, credentialRef },
      ]);
    }
    const enc = this.encrypt(material);
    entry.version += 1;
    entry.ciphertext = enc.ciphertext;
    entry.iv = enc.iv;
    entry.tag = enc.tag;
    entry.status = 'ACTIVE';
    this.store.set(credentialRef, entry);
    return {
      credentialRef,
      kind: entry.kind,
      version: entry.version,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
    };
  }

  async revoke(credentialRef: string): Promise<void> {
    const entry = this.store.get(credentialRef);
    if (entry) {
      entry.status = 'REVOKED';
      this.store.set(credentialRef, entry);
    }
  }

  async describe(credentialRef: string) {
    const entry = this.store.get(credentialRef);
    if (!entry) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Secret ref not found', [
        { code: InfrastructureErrorCode.SECRET_UNAVAILABLE, credentialRef },
      ]);
    }
    return {
      credentialRef,
      kind: entry.kind,
      version: entry.version,
      status: entry.status,
      expiresAt: entry.expiresAt,
    };
  }
}

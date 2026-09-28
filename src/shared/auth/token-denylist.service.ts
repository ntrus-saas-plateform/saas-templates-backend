import { Injectable, Inject } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CacheService } from '../database/cache.service.js';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';
import type { TokenRevocationPort } from '../../core/domain/ports/token-revocation.port.js';
import { TOKEN_REVOCATION_PORT } from '../../core/domain/ports/token-revocation.port.js';

const REVOKED_SUBJECT_PREFIX = 'platform:auth:revoked-at:';
const DENY_JTI_PREFIX = 'platform:auth:deny:jti:';

@Injectable()
export class TokenDenylistService implements TokenRevocationPort {
  constructor(
    private readonly cache: CacheService,
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
  ) {}

  isEnabled(): boolean {
    return this.config.TOKEN_DENYLIST_ENABLED;
  }

  async revokeAllTokensForSubject(subjectId: string): Promise<void> {
    if (!this.isEnabled()) return;
    const ttl = this.config.TOKEN_DENYLIST_TTL_SECONDS;
    const client = this.cache.getClient();
    // Store epoch seconds to match JWT `iat` (also seconds).
    const revokedAtSeconds = Math.floor(Date.now() / 1000);
    await client.setex(
      `${REVOKED_SUBJECT_PREFIX}${subjectId}`,
      ttl,
      String(revokedAtSeconds),
    );
  }

  async revokeTokenByJti(jti: string, ttlSeconds?: number): Promise<void> {
    if (!this.isEnabled() || !jti) return;
    const ttl = ttlSeconds ?? this.config.TOKEN_DENYLIST_TTL_SECONDS;
    const client = this.cache.getClient();
    await client.setex(`${DENY_JTI_PREFIX}${jti}`, ttl, '1');
  }

  async revokeTokenHash(token: string, ttlSeconds?: number): Promise<void> {
    if (!this.isEnabled()) return;
    const hash = createHash('sha256').update(token).digest('hex');
    const ttl = ttlSeconds ?? this.config.TOKEN_DENYLIST_TTL_SECONDS;
    const client = this.cache.getClient();
    await client.setex(`${DENY_JTI_PREFIX}hash:${hash}`, ttl, '1');
  }

  async isRevoked(subjectId: string, issuedAt: number, jti?: string | null): Promise<boolean> {
    if (!this.isEnabled()) return false;
    const client = this.cache.getClient();

    if (jti) {
      const jtiDenied = await client.get(`${DENY_JTI_PREFIX}${jti}`);
      if (jtiDenied) return true;
    }

    const revokedAtRaw = await client.get(`${REVOKED_SUBJECT_PREFIX}${subjectId}`);
    if (!revokedAtRaw) return false;

    let revokedAt = Number(revokedAtRaw);
    if (!Number.isFinite(revokedAt)) return true;
    // Legacy bug stored Date.now() (ms); JWT iat is seconds. Normalize ms → s.
    if (revokedAt > 10_000_000_000) {
      revokedAt = Math.floor(revokedAt / 1000);
    }
    return issuedAt < revokedAt;
  }
}

export const tokenRevocationProvider = {
  provide: TOKEN_REVOCATION_PORT,
  useExisting: TokenDenylistService,
};

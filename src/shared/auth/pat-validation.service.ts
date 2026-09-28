import { createHash } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { USER_API_TOKEN_REPOSITORY_PORT } from '../../modules/identity/domain/ports/user-api-token-repository.port.js';
import type { UserApiTokenRepositoryPort } from '../../modules/identity/domain/ports/user-api-token-repository.port.js';
import { APPLICATION_USER_REPOSITORY_PORT } from '../../modules/identity/domain/ports/application-user-repository.port.js';
import type { ApplicationUserRepositoryPort } from '../../modules/identity/domain/ports/application-user-repository.port.js';
import { DOMAIN_REGISTRY_PORT } from '../../modules/identity/domain/ports/domain-registry.port.js';
import type { DomainRegistryPort } from '../../modules/identity/domain/ports/domain-registry.port.js';
import { isApplicationUserAccessible } from '../../modules/identity/domain/user/application-user.entity.js';
import { normalizeHostname } from '../tenancy/normalize-hostname.js';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';
import { MEMBERSHIP_REPOSITORY_PORT } from '../../modules/identity/domain/ports/membership-repository.port.js';
import type { MembershipRepositoryPort } from '../../modules/identity/domain/ports/membership-repository.port.js';
import { isMembershipActive } from '../../modules/identity/domain/membership/organization-membership.entity.js';

export type PatAuthenticatedPrincipal = {
  subjectId: string;
  userId: string;
  username: string | null;
  tenantId: string;
  organizationId: string | null;
  /** Requested scopes (permission keys). Empty = full membership permissions. */
  scopes: readonly string[];
  tokenId: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Personal API token format: `uat_<tenantId>.<secret>`
 * Hash = sha256(full plaintext). Tenant id is embedded so multi-tenant lookup works.
 */
export function buildPersonalApiTokenPlaintext(tenantId: string, secret: string): string {
  return `uat_${tenantId}.${secret}`;
}

export function parsePersonalApiToken(
  token: string,
): { tenantId: string; plaintext: string } | null {
  if (!token.startsWith('uat_')) return null;
  const rest = token.slice(4);
  const dot = rest.indexOf('.');
  if (dot <= 0) return null;
  const tenantId = rest.slice(0, dot);
  if (!UUID_RE.test(tenantId)) return null;
  if (rest.slice(dot + 1).length < 16) return null;
  return { tenantId, plaintext: token };
}

@Injectable()
export class PatValidationService {
  constructor(
    @Inject(USER_API_TOKEN_REPOSITORY_PORT)
    private readonly tokens: UserApiTokenRepositoryPort,
    @Inject(APPLICATION_USER_REPOSITORY_PORT)
    private readonly applicationUsers: ApplicationUserRepositoryPort,
    @Inject(DOMAIN_REGISTRY_PORT)
    private readonly domainRegistry: DomainRegistryPort,
    @Inject(MEMBERSHIP_REPOSITORY_PORT)
    private readonly memberships: MembershipRepositoryPort,
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
  ) {}

  isPersonalApiToken(token: string): boolean {
    return token.startsWith('uat_');
  }

  async validate(token: string, request: Request): Promise<PatAuthenticatedPrincipal> {
    const parsed = parsePersonalApiToken(token);
    if (!parsed) {
      throw new UnauthorizedException('Invalid personal API token format');
    }

    const hostTenantId = await this.resolveTenantFromHost(request);
    if (hostTenantId && hostTenantId !== parsed.tenantId) {
      throw new UnauthorizedException('Token tenant does not match host');
    }

    const hash = createHash('sha256').update(parsed.plaintext).digest('hex');
    const record = await this.tokens.findActiveByHash(parsed.tenantId, hash);
    if (!record) {
      throw new UnauthorizedException('Invalid or revoked personal API token');
    }

    const applicationUser = await this.applicationUsers.findByIdentity(
      parsed.tenantId,
      record.userId,
    );
    if (applicationUser && !isApplicationUserAccessible(applicationUser.status)) {
      throw new UnauthorizedException('User account is not active');
    }

    await this.tokens.touchLastUsed(parsed.tenantId, record.id);

    const memberships = await this.memberships.findByUser(
      parsed.tenantId,
      record.userId,
    );
    const active = memberships.filter((m) => isMembershipActive(m));
    const organizationId = active[0]?.organizationId ?? null;

    return {
      subjectId: record.userId,
      userId: record.userId,
      username: applicationUser?.profile?.email ?? null,
      tenantId: parsed.tenantId,
      organizationId,
      scopes: record.scopes,
      tokenId: record.id,
    };
  }

  private async resolveTenantFromHost(request: Request): Promise<string | null> {
    const forwarded = request.headers['x-forwarded-host'] as string | undefined;
    const rawHost =
      this.config.TRUST_X_FORWARDED_HOST && forwarded
        ? forwarded
        : request.headers.host;
    const hostname = normalizeHostname(rawHost);
    if (!hostname) return null;
    const domain = await this.domainRegistry.findByHostname(hostname);
    return domain?.tenantId ?? null;
  }
}

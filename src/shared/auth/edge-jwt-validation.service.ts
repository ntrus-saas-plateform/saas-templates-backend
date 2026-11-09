import { Injectable, Inject } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';

export interface EdgeAuthenticatedUser {
  subjectId: string;
  email: string | null;
  username: string | null;
  roles: readonly string[];
  clientId: string | null;
  locale: string;
  timezone: string;
  authenticationAcr: string | null;
  authenticationMethods: readonly string[];
  tokenIssuedAt: number;
  tokenId: string | null;
}

interface EdgeJwtClaims extends JWTPayload {
  sub: string;
  email?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  azp?: string;
  locale?: string;
  timezone?: string;
  acr?: string | number;
  amr?: string | string[];
  jti?: string;
  iat?: number;
  tenant_id?: string;
}

@Injectable()
export class EdgeJwtValidationService {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(@Inject(APP_CONFIG) private readonly config: EnvironmentConfig) {
    this.jwks = createRemoteJWKSet(new URL(this.config.EDGE_KEYCLOAK_JWKS_URI));
  }

  async validateToken(token: string): Promise<EdgeAuthenticatedUser> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.config.EDGE_KEYCLOAK_ISSUER,
      audience: this.config.EDGE_KEYCLOAK_AUDIENCE,
      algorithms: ['RS256'],
      clockTolerance: 60,
    });

    const claims = payload as EdgeJwtClaims;

    if (!claims.sub) {
      throw new Error('Invalid Edge token: missing subject');
    }

    if (typeof claims.iat !== 'number') {
      throw new Error('Invalid Edge token: missing iat claim');
    }

    // Edge tokens intentionally do NOT require tenant_id (unlike ERP JWT).

    return {
      subjectId: claims.sub,
      email: typeof claims.email === 'string' && claims.email.includes('@') ? claims.email : null,
      username: claims.preferred_username ?? null,
      roles: this.extractRoles(claims),
      clientId: claims.azp ?? null,
      locale: claims.locale ?? 'en',
      timezone: claims.timezone ?? 'UTC',
      authenticationAcr: this.extractAcr(claims),
      authenticationMethods: this.extractAmr(claims),
      tokenIssuedAt: claims.iat,
      tokenId: claims.jti ?? null,
    };
  }

  private extractAcr(claims: EdgeJwtClaims): string | null {
    if (claims.acr === undefined || claims.acr === null) return null;
    return String(claims.acr);
  }

  private extractAmr(claims: EdgeJwtClaims): readonly string[] {
    if (!claims.amr) return [];
    if (Array.isArray(claims.amr)) return claims.amr;
    return [claims.amr];
  }

  private extractRoles(claims: EdgeJwtClaims): readonly string[] {
    const roles = new Set<string>();
    claims.realm_access?.roles?.forEach((r) => roles.add(r));
    const clientRoles =
      claims.resource_access?.[this.config.EDGE_KEYCLOAK_ADMIN_CLIENT_ID]?.roles;
    clientRoles?.forEach((r) => roles.add(r));
    return [...roles];
  }
}

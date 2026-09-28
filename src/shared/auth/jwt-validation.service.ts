import { Injectable, Inject } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';

export interface AuthenticatedUser {
  /** Stable Keycloak subject (`sub`) — primary application identity key. */
  subjectId: string;
  /** Same as subjectId; never email or username. */
  userId: string;
  /** Display username from Keycloak (`preferred_username`), not used as identity key. */
  username: string | null;
  /** JWT `email` claim when present. */
  email: string | null;
  tenantId: string;
  /** Keycloak organization IDs from the organization membership claim. */
  keycloakOrganizationIds: readonly string[];
  /** Organization aliases from the Keycloak `organization` claim object keys. */
  keycloakOrganizationAliases: readonly string[];
  /**
   * Active organization reference from the JWT (Keycloak org id, alias, or legacy app UUID).
   * Resolved to an application organization UUID by ActiveOrganizationResolver.
   */
  jwtActiveOrganizationRef: string | null;
  roles: readonly string[];
  permissions: readonly string[];
  clientId: string | null;
  locale: string;
  timezone: string;
  authenticationAcr: string | null;
  authenticationMethods: readonly string[];
  /** JWT `iat` (seconds since epoch). */
  tokenIssuedAt: number;
  /** JWT `jti` when present. */
  tokenId: string | null;
}

export interface JwtClaims extends JWTPayload {
  sub: string;
  tenant_id?: string;
  organization_id?: string;
  organizationId?: string;
  organization?: string | string[] | Record<string, unknown>;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  permissions?: string[];
  azp?: string;
  locale?: string;
  timezone?: string;
  preferred_username?: string;
  email?: string;
  acr?: string | number;
  amr?: string | string[];
  jti?: string;
  iat?: number;
}

interface ParsedOrganizationClaims {
  memberKeycloakOrganizationIds: readonly string[];
  memberAliases: readonly string[];
  legacyMemberRefs: readonly string[];
  activeOrganizationRef: string | null;
}

@Injectable()
export class JwtValidationService {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(@Inject(APP_CONFIG) private readonly config: EnvironmentConfig) {
    this.jwks = createRemoteJWKSet(new URL(this.config.KEYCLOAK_JWKS_URI));
  }

  async validateToken(token: string): Promise<AuthenticatedUser> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.config.KEYCLOAK_ISSUER,
      audience: this.config.KEYCLOAK_AUDIENCE,
      algorithms: ['RS256'],
      /** Allow small clock skew between Keycloak and API hosts (§57). */
      clockTolerance: 60,
    });

    const claims = payload as JwtClaims;

    if (!claims.sub) {
      throw new Error('Invalid token: missing subject');
    }

    if (typeof claims.iat !== 'number') {
      throw new Error('Invalid token: missing iat claim');
    }

    const tenantId = claims.tenant_id;
    if (!tenantId) {
      throw new Error('Invalid token: missing tenant_id claim');
    }

    const organizationClaims = this.parseOrganizationClaims(claims);
    this.assertActiveOrganizationAuthorized(organizationClaims);

    return {
      subjectId: claims.sub,
      userId: claims.sub,
      username: claims.preferred_username ?? null,
      email: typeof claims.email === 'string' && claims.email.includes('@') ? claims.email : null,
      tenantId,
      keycloakOrganizationIds: organizationClaims.memberKeycloakOrganizationIds,
      keycloakOrganizationAliases: organizationClaims.memberAliases,
      jwtActiveOrganizationRef: organizationClaims.activeOrganizationRef,
      roles: this.extractRoles(claims),
      permissions: claims.permissions ?? [],
      clientId: claims.azp ?? null,
      locale: claims.locale ?? 'en',
      timezone: claims.timezone ?? 'UTC',
      authenticationAcr: this.extractAcr(claims),
      authenticationMethods: this.extractAmr(claims),
      tokenIssuedAt: claims.iat,
      tokenId: claims.jti ?? null,
    };
  }

  private parseOrganizationClaims(claims: JwtClaims): ParsedOrganizationClaims {
    const memberKeycloakOrganizationIds: string[] = [];
    const memberAliases: string[] = [];
    const legacyMemberRefs: string[] = [];

    if (typeof claims.organizationId === 'string' && claims.organizationId.length > 0) {
      memberKeycloakOrganizationIds.push(claims.organizationId);
    }

    const orgClaim = claims.organization;
    if (typeof orgClaim === 'string' && orgClaim.length > 0) {
      legacyMemberRefs.push(orgClaim);
      memberAliases.push(orgClaim);
    } else if (Array.isArray(orgClaim)) {
      for (const entry of orgClaim) {
        if (typeof entry === 'string' && entry.length > 0) {
          legacyMemberRefs.push(entry);
          memberAliases.push(entry);
        }
      }
    } else if (orgClaim && typeof orgClaim === 'object') {
      for (const [alias, value] of Object.entries(orgClaim)) {
        if (alias.length > 0) {
          memberAliases.push(alias);
        }
        if (value && typeof value === 'object' && 'id' in value) {
          const id = (value as { id?: unknown }).id;
          if (typeof id === 'string' && id.length > 0) {
            memberKeycloakOrganizationIds.push(id);
          }
        }
      }
    }

    let activeOrganizationRef =
      claims.organization_id ??
      (memberKeycloakOrganizationIds.length === 1 ? memberKeycloakOrganizationIds[0] : null) ??
      (memberAliases.length === 1 ? memberAliases[0] : null) ??
      (legacyMemberRefs.length === 1 ? legacyMemberRefs[0] : null);

    return {
      memberKeycloakOrganizationIds: [...new Set(memberKeycloakOrganizationIds)],
      memberAliases: [...new Set(memberAliases)],
      legacyMemberRefs: [...new Set(legacyMemberRefs)],
      activeOrganizationRef,
    };
  }

  private assertActiveOrganizationAuthorized(claims: ParsedOrganizationClaims): void {
    const activeRef = claims.activeOrganizationRef;
    if (!activeRef) return;

    const authorized = new Set<string>([
      ...claims.memberKeycloakOrganizationIds,
      ...claims.memberAliases,
      ...claims.legacyMemberRefs,
    ]);

    if (authorized.size > 0 && !authorized.has(activeRef)) {
      throw new Error('Invalid token: active organization not in authorized organizations');
    }
  }

  private extractAcr(claims: JwtClaims): string | null {
    if (claims.acr === undefined || claims.acr === null) return null;
    return String(claims.acr);
  }

  private extractAmr(claims: JwtClaims): readonly string[] {
    if (!claims.amr) return [];
    if (Array.isArray(claims.amr)) return claims.amr;
    return [claims.amr];
  }

  private extractRoles(claims: JwtClaims): readonly string[] {
    const roles = new Set<string>();
    claims.realm_access?.roles?.forEach((r) => roles.add(r));
    const clientRoles = claims.resource_access?.[this.config.KEYCLOAK_CLIENT_ID]?.roles;
    clientRoles?.forEach((r) => roles.add(r));
    return [...roles];
  }
}

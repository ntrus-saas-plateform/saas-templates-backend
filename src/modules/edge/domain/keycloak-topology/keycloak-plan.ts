import { createHash, randomUUID } from 'node:crypto';
import { KeycloakErrorCode, KeycloakTopologyType } from './keycloak.types.js';
import type { KeycloakPlanInput, KeycloakPlanValidationResult } from './keycloak.types.js';

export type PlanValidationContext = {
  providerActive: boolean;
  providerSupportsTopology: boolean;
  serverActive: boolean;
  serverReachable: boolean;
  tlsRequiredByProfile: boolean;
  tlsModeOnServer: string;
  privateNetworkAllowed: boolean;
  authorizationValid: boolean;
  authorizationExpired: boolean;
  authorizationRevoked: boolean;
  placementValid: boolean;
  organizationsSupportedByServer: boolean;
  /** P7.2 profiles/contract options (declaratives — not user free-form). */
  profileOptions: Record<string, unknown>;
};

const REALM_NAME_RE = /^[a-z0-9][a-z0-9-]{1,60}[a-z0-9]$/;
const ORG_ALIAS_RE = /^[a-z0-9][a-z0-9-]{1,60}[a-z0-9]$/;

/** Dangerous patterns that must never reach Keycloak configuration. */
const FORBIDDEN_REDIRECT_PATTERNS = [/\*$/, /\/\/\*/, /^\/\*$/, /:\*$/, /\{\{|\}\}/];
const FORBIDDEN_ORIGIN_PATTERNS = [/^\*$/, /^null$/, /\/\/\*$/, /\*$/];

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** Compact, deterministic realm name decided by Edge (never free-form user input). */
export function deriveRealmName(input: {
  tenantId: string;
  productId: string;
  topologyType: string;
  profileOptions?: Record<string, unknown>;
}): string {
  const prefix = str(input.profileOptions?.realmPrefix) ?? 'okapi';
  const tenant = input.tenantId.replace(/-/g, '').slice(0, 8);
  const product = input.productId.replace(/-/g, '').slice(0, 8);
  if (input.topologyType === KeycloakTopologyType.DEDICATED_REALM) {
    return `${prefix}-t-${tenant}-p-${product}`.toLowerCase();
  }
  return `${prefix}-shared`.toLowerCase();
}

/** Technical organization alias — NOT a business organization. */
export function deriveOrgAlias(tenantId: string): string {
  return `t-${tenantId.replace(/-/g, '').slice(0, 12)}`.toLowerCase();
}

export function validateRedirectUris(uris: readonly string[]): string[] {
  const issues: string[] = [];
  for (const raw of uris) {
    const uri = String(raw ?? '').trim();
    if (!uri) continue;
    for (const pattern of FORBIDDEN_REDIRECT_PATTERNS) {
      if (pattern.test(uri)) {
        issues.push(`forbidden redirect URI pattern: ${uri}`);
        break;
      }
    }
    if (!uri.startsWith('https://') && !uri.startsWith('http://') && uri !== 'urn:ietf:wg:oauth:2.0:oob') {
      issues.push(`redirect URI must be http(s) or approved urn: ${uri}`);
    }
    if (uri === 'http://' || uri === 'https://') {
      issues.push(`incomplete redirect URI: ${uri}`);
    }
  }
  return issues;
}

export function validateWebOrigins(origins: readonly string[]): string[] {
  const issues: string[] = [];
  for (const raw of origins) {
    const origin = String(raw ?? '').trim();
    if (!origin) continue;
    for (const pattern of FORBIDDEN_ORIGIN_PATTERNS) {
      if (pattern.test(origin)) {
        issues.push(`forbidden web origin pattern: ${origin}`);
        break;
      }
    }
  }
  return issues;
}

function checkStringArray(value: unknown, field: string, issues: { code: string; message: string; field?: string }[]): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    issues.push({ code: KeycloakErrorCode.VALIDATION, message: `${field} must be an array`, field });
    return [];
  }
  return value.map((v) => String(v));
}

export function validateResourcePlan(
  input: KeycloakPlanInput,
  ctx: PlanValidationContext,
): KeycloakPlanValidationResult {
  const issues: KeycloakPlanValidationResult['issues'] = [];
  const topologyType = input.topologyType as KeycloakTopologyType;

  // --- Authorization / placement gates (fail-closed) -----------------------
  if (!ctx.authorizationValid) {
    issues.push({
      code: KeycloakErrorCode.AUTHORIZATION_FAILED,
      message: 'Provisioning authorization not valid (fail-closed)',
      field: 'authorizationId',
    });
  }
  if (ctx.authorizationExpired) {
    issues.push({
      code: KeycloakErrorCode.AUTHORIZATION_EXPIRED,
      message: 'Provisioning authorization expired',
      field: 'authorizationId',
    });
  }
  if (ctx.authorizationRevoked) {
    issues.push({
      code: KeycloakErrorCode.AUTHORIZATION_REVOKED,
      message: 'Provisioning authorization revoked',
      field: 'authorizationId',
    });
  }
  if (ctx.placementValid === false) {
    issues.push({
      code: KeycloakErrorCode.PLACEMENT_INVALID,
      message: 'Placement decision not confirmed (fail-closed)',
      field: 'placementDecisionId',
    });
  }

  // --- Provider / server ---------------------------------------------------
  if (!ctx.providerActive) {
    issues.push({
      code: KeycloakErrorCode.PROVIDER_UNAVAILABLE,
      message: 'Keycloak provider is not ACTIVE',
      field: 'providerId',
    });
  }
  if (!ctx.providerSupportsTopology) {
    issues.push({
      code: KeycloakErrorCode.TOPOLOGY_UNSUPPORTED,
      message: `Provider does not support topology ${topologyType}`,
      field: 'topologyType',
    });
  }
  if (!ctx.serverActive) {
    issues.push({
      code: KeycloakErrorCode.SERVER_UNAVAILABLE,
      message: 'Keycloak server not ACTIVE',
      field: 'serverId',
    });
  }
  if (!ctx.serverReachable) {
    issues.push({
      code: KeycloakErrorCode.SERVER_UNAVAILABLE,
      message: 'Keycloak server did not pass last connectivity check',
      field: 'serverId',
    });
  }
  if (ctx.tlsRequiredByProfile && ctx.tlsModeOnServer !== 'REQUIRED') {
    issues.push({
      code: KeycloakErrorCode.VALIDATION,
      message: 'Profile requires TLS but the server is not configured TLS REQUIRED',
      field: 'serverId',
    });
  }

  // --- Topology rules ------------------------------------------------------
  if (!Object.values(KeycloakTopologyType).includes(topologyType)) {
    issues.push({
      code: KeycloakErrorCode.TOPOLOGY_UNSUPPORTED,
      message: `Unknown topology type ${String(input.topologyType)}`,
      field: 'topologyType',
    });
  }
  if (topologyType === KeycloakTopologyType.EXTERNAL_SPECIFIC) {
    // Model C: must be declared and certified by an explicit contract option.
    const certified = ctx.profileOptions.certifiedExternalAdapter === true;
    if (!certified) {
      issues.push({
        code: KeycloakErrorCode.TOPOLOGY_UNSUPPORTED,
        message:
          'EXTERNAL_SPECIFIC topology requires a certified external adapter (no silent compatibility)',
        field: 'topologyType',
      });
    }
  }
  if (topologyType === KeycloakTopologyType.SHARED_REALM_ORGANIZATIONS) {
    if (!ctx.organizationsSupportedByServer) {
      issues.push({
        code: KeycloakErrorCode.CAPABILITY_UNSUPPORTED,
        message: 'Server does not support Keycloak Organizations',
        field: 'topologyType',
      });
    }
  }

  // --- Security/config guards (profile-driven) -----------------------------
  const redirectUris = checkStringArray(ctx.profileOptions.clientRedirectUris, 'clientRedirectUris', issues);
  const webOrigins = checkStringArray(ctx.profileOptions.clientWebOrigins, 'clientWebOrigins', issues);
  for (const msg of validateRedirectUris(redirectUris)) {
    issues.push({ code: KeycloakErrorCode.VALIDATION, message: msg, field: 'clientRedirectUris' });
  }
  for (const msg of validateWebOrigins(webOrigins)) {
    issues.push({ code: KeycloakErrorCode.VALIDATION, message: msg, field: 'clientWebOrigins' });
  }

  const resolvedRealmName = deriveRealmName({
    tenantId: input.tenantId,
    productId: input.productId,
    topologyType,
    profileOptions: input.profileOptions,
  });
  if (!REALM_NAME_RE.test(resolvedRealmName)) {
    issues.push({
      code: KeycloakErrorCode.VALIDATION,
      message: `Derived realm name "${resolvedRealmName}" is invalid`,
      field: 'realmName',
    });
  }

  const resolvedOrgAlias = deriveOrgAlias(input.tenantId);
  if (topologyType === KeycloakTopologyType.SHARED_REALM_ORGANIZATIONS && !ORG_ALIAS_RE.test(resolvedOrgAlias)) {
    issues.push({
      code: KeycloakErrorCode.VALIDATION,
      message: `Derived organization alias "${resolvedOrgAlias}" is invalid`,
      field: 'organizationAlias',
    });
  }

  return {
    valid: issues.length === 0,
    issues,
    resolvedRealmName,
    resolvedOrgAlias,
    topologyType,
  };
}

/** Deterministic fingerprint of the desired configuration (no secrets inside). */
export function computePlanFingerprint(input: KeycloakPlanInput): string {
  const material = {
    tenantId: input.tenantId,
    productId: input.productId,
    providerId: input.providerId,
    serverId: input.serverId,
    topologyType: input.topologyType,
    profileOptions: sorted(input.profileOptions ?? {}),
    metadata: sorted(input.metadata ?? {}),
  };
  return createHash('sha256').update(JSON.stringify(material)).digest('hex');
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sorted((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}
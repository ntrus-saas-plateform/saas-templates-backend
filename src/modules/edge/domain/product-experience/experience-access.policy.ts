import { createHash, randomBytes } from 'node:crypto';
import { ExperienceErrorCode } from './experience.types.js';

export type AccessPolicyIssue = {
  path: string;
  code: ExperienceErrorCode | string;
  message: string;
};

export type AccessPolicyResult = {
  ok: boolean;
  issues: AccessPolicyIssue[];
};

const FORBIDDEN_REDIRECT_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

/** Reject wildcards, null, templates, non-https (except loopback lab), javascript:, data:. */
export function validateRedirectUris(uris: string[], opts?: { allowLoopbackHttp?: boolean }): AccessPolicyResult {
  const issues: AccessPolicyIssue[] = [];
  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i]!;
    const path = `$.redirectUris[${i}]`;
    if (!uri || typeof uri !== 'string') {
      issues.push({ path, code: ExperienceErrorCode.REDIRECT_URI_INVALID, message: 'empty redirect URI' });
      continue;
    }
    if (/[\s<>"']/.test(uri) || uri.includes('*') || /\{|\}|\$\{/.test(uri) || uri.toLowerCase() === 'null') {
      issues.push({
        path,
        code: ExperienceErrorCode.REDIRECT_URI_INVALID,
        message: 'wildcard/template/null redirect URI forbidden',
      });
      continue;
    }
    let parsed: URL;
    try {
      parsed = new URL(uri);
    } catch {
      issues.push({ path, code: ExperienceErrorCode.REDIRECT_URI_INVALID, message: 'malformed URL' });
      continue;
    }
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      issues.push({
        path,
        code: ExperienceErrorCode.REDIRECT_URI_INVALID,
        message: `unsupported scheme ${parsed.protocol}`,
      });
      continue;
    }
    if (parsed.protocol === 'http:') {
      const host = parsed.hostname.toLowerCase();
      if (!(opts?.allowLoopbackHttp && FORBIDDEN_REDIRECT_HOSTS.has(host))) {
        issues.push({
          path,
          code: ExperienceErrorCode.REDIRECT_URI_INVALID,
          message: 'http redirect URI only allowed for attested loopback',
        });
      }
    }
  }
  return { ok: issues.length === 0, issues };
}

export function validateWebOrigins(origins: string[], opts?: { allowLoopbackHttp?: boolean }): AccessPolicyResult {
  const issues: AccessPolicyIssue[] = [];
  for (let i = 0; i < origins.length; i++) {
    const origin = origins[i]!;
    const path = `$.webOrigins[${i}]`;
    if (!origin || origin === '*' || origin.toLowerCase() === 'null' || origin.includes('*')) {
      issues.push({
        path,
        code: ExperienceErrorCode.WEB_ORIGIN_INVALID,
        message: 'wildcard/null web origin forbidden',
      });
      continue;
    }
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      issues.push({ path, code: ExperienceErrorCode.WEB_ORIGIN_INVALID, message: 'malformed origin' });
      continue;
    }
    if (parsed.pathname !== '/' && parsed.pathname !== '') {
      // Origin must not include a path beyond root
      if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
        /* allow bare origin with optional trailing slash only */
      }
    }
    if (parsed.pathname && parsed.pathname !== '/') {
      issues.push({
        path,
        code: ExperienceErrorCode.WEB_ORIGIN_INVALID,
        message: 'web origin must not include a path',
      });
    }
    if (parsed.protocol === 'http:') {
      const host = parsed.hostname.toLowerCase();
      if (!(opts?.allowLoopbackHttp && FORBIDDEN_REDIRECT_HOSTS.has(host))) {
        issues.push({
          path,
          code: ExperienceErrorCode.WEB_ORIGIN_INVALID,
          message: 'http web origin only allowed for attested loopback',
        });
      }
    } else if (parsed.protocol !== 'https:') {
      issues.push({
        path,
        code: ExperienceErrorCode.WEB_ORIGIN_INVALID,
        message: `unsupported scheme ${parsed.protocol}`,
      });
    }
  }
  return { ok: issues.length === 0, issues };
}

/** Hostname rules: lowercase FQDN, no trailing dot, no cross-tenant reuse handled by unique constraint. */
export function validateHostname(hostname: string): AccessPolicyResult {
  const issues: AccessPolicyIssue[] = [];
  const host = hostname.trim().toLowerCase();
  if (!host || host.length > 253) {
    issues.push({
      path: '$.hostname',
      code: ExperienceErrorCode.VALIDATION,
      message: 'hostname missing or too long',
    });
    return { ok: false, issues };
  }
  if (host.endsWith('.') || host.startsWith('.') || host.includes('..') || host.includes('*')) {
    issues.push({
      path: '$.hostname',
      code: ExperienceErrorCode.DOMAIN_TAKEOVER_RISK,
      message: 'hostname format rejected',
    });
  }
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host)) {
    issues.push({
      path: '$.hostname',
      code: ExperienceErrorCode.VALIDATION,
      message: 'hostname must be a valid FQDN',
    });
  }
  return { ok: issues.length === 0, issues };
}

export function issueOwnershipToken(): string {
  return `own_${randomBytes(16).toString('hex')}`;
}

export function ownershipChallengeRecord(hostname: string, token: string): string {
  return createHash('sha256').update(`${hostname}:${token}`).digest('hex');
}

export function checksumManifest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) out[key] = sortKeys(obj[key]);
    return out;
  }
  return value;
}

/** Ensure redirect hosts belong to verified tenant domains when enforced. */
export function assertRedirectsBoundToDomains(
  redirectUris: string[],
  verifiedHostnames: string[],
): AccessPolicyResult {
  const issues: AccessPolicyIssue[] = [];
  const allowed = new Set(verifiedHostnames.map((h) => h.toLowerCase()));
  for (let i = 0; i < redirectUris.length; i++) {
    try {
      const host = new URL(redirectUris[i]!).hostname.toLowerCase();
      if (allowed.size > 0 && !allowed.has(host) && !FORBIDDEN_REDIRECT_HOSTS.has(host)) {
        issues.push({
          path: `$.redirectUris[${i}]`,
          code: ExperienceErrorCode.CROSS_TENANT_ROUTING,
          message: `redirect host ${host} is not a verified domain for this tenant`,
        });
      }
    } catch {
      /* validateRedirectUris already covers malformed */
    }
  }
  return { ok: issues.length === 0, issues };
}

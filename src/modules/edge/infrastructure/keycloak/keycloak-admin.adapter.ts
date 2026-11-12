/**
 * P7.7 Keycloak admin client — REAL Keycloak Admin API over HTTPS:
 * - OAuth2 client_credentials via a service account (credential from vault),
 * - explicit timeouts, controlled retries with backoff,
 * - idempotent operations (reconcile before create),
 * - HTTP/Keycloak error classification, secret redaction in errors/logs.
 *
 * SSRF guards: only the REGISTERED server baseUrl is used as the target —
 * requested URLs must stay under it; endpoints are never taken from frontend
 * input (mandate §10).
 */

import { createHash } from 'node:crypto';
import type {
  KeycloakAdminConnection,
  KeycloakClientObservation,
  KeycloakOrganizationObservation,
  KeycloakProviderPort,
  KeycloakRealmObservation,
  KeycloakTopologyTarget,
} from '../../domain/keycloak-topology/keycloak-provider.port.js';
import type { KeycloakServerCapabilities } from '../../domain/keycloak-topology/keycloak.types.js';
import type { SecretsProviderPort } from '../../domain/infrastructure-provisioning/secrets-provider.port.js';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export type KeycloakAdminAdapterDeps = {
  secrets: SecretsProviderPort;
  /** Override fetch in tests (Testcontainers/MSW). Defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
  now?: () => number;
};

type TokenCacheEntry = { token: string; expiresAt: number };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Redact obvious secrets from any outbound message (logs, errors, evidence). */
export function redactSensitive(text: string): string {
  return text
    .replace(/("client_secret"\s*:\s*")[^"]+(")/gi, '$1**********$2')
    .replace(/(client_secret=)[^&\s]+/gi, '$1**********')
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1**********');
}

export class HttpKeycloakAdminAdapter implements KeycloakProviderPort {
  readonly providerCode: string;
  private readonly fetchImpl: typeof fetch;
  private readonly tokens = new Map<string, TokenCacheEntry>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly deps: KeycloakAdminAdapterDeps,
    providerCode = 'keycloak-managed-v1',
  ) {
    this.providerCode = providerCode;
    this.fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  // -------------------------------------------------------------------------
  // URL safety (SSRF guard)
  // -------------------------------------------------------------------------

  private assertSameOrigin(conn: KeycloakAdminConnection, pathOrUrl: string): string {
    const base = new URL(conn.baseUrl);
    const target = /^https?:\/\//i.test(pathOrUrl)
      ? new URL(pathOrUrl)
      : new URL(pathOrUrl.replace(/^\//, ''), `${conn.baseUrl}/`);
    const isLoopback = /^(localhost|127\.0\.0\.1|::1)$/i.test(base.hostname);
    if (target.protocol !== 'https:' && !(isLoopback && target.protocol === 'http:')) {
      throw new Error(`Keycloak endpoint scheme not allowed: ${target.protocol}`);
    }
    if (target.hostname !== base.hostname || target.port !== base.port) {
      throw new Error(`Keycloak endpoint escapes registered server origin: ${target.origin}`);
    }
    return target.toString();
  }

  // -------------------------------------------------------------------------
  // Token (service account client credentials)
  // -------------------------------------------------------------------------

  private async accessToken(conn: KeycloakAdminConnection): Promise<string> {
    const cacheKey = `${conn.baseUrl}|${conn.adminRealm}|${conn.adminClientId}`;
    const cached = this.tokens.get(cacheKey);
    const now = (this.deps.now ?? Date.now)();
    if (cached && now < cached.expiresAt - 5_000) return cached.token;

    if (!conn.adminCredentialRef) throw new Error('Keycloak admin credential reference missing');
    const material = await this.deps.secrets.get(conn.adminCredentialRef);
    const secret = typeof (material as { value?: unknown }).value === 'string'
      ? String((material as { value: unknown }).value)
      : null;
    if (!secret) throw new Error('Keycloak admin credential unavailable in vault');

    const tokenUrl = this.assertSameOrigin(
      conn,
      `/realms/${encodeURIComponent(conn.adminRealm)}/protocol/openid-connect/token`,
    );
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: conn.adminClientId,
      client_secret: secret,
    });
    const res = await this.request(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      timeoutMs: conn.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxRetries: conn.maxRetries ?? DEFAULT_MAX_RETRIES,
      token: null,
    });
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new Error('Keycloak token response missing access_token');
    const entry: TokenCacheEntry = {
      token: data.access_token,
      expiresAt: now + (data.expires_in ?? 60) * 1000,
    };
    this.tokens.set(cacheKey, entry);
    return entry.token;
  }

  /**
   * Drop the cached token for a connection.
   *
   * Keycloak expands the composite `admin` role AT MINT TIME: a token minted
   * before a realm exists does not carry that realm's admin client roles
   * (`<realm>-realm` in resource_access), so every subsequent call scoped to
   * the new realm fails with 403. After creating a realm we therefore force a
   * fresh mint (P7.7 live test: `createRealm` → `clientExists` 403).
   */
  private invalidateToken(conn: KeycloakAdminConnection): void {
    this.tokens.delete(`${conn.baseUrl}|${conn.adminRealm}|${conn.adminClientId}`);
  }

  // -------------------------------------------------------------------------
  // Transport (timeout + bounded retry + classification)
  // -------------------------------------------------------------------------

  private async request(
    url: string,
    opts: {
      method?: string;
      headers?: Record<string, string>;
      body?: BodyInit;
      timeoutMs?: number;
      maxRetries?: number;
      token: string | null;
    },
  ): Promise<Response> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await this.fetchImpl(url, {
          method: opts.method ?? 'GET',
          headers: {
            ...(opts.headers ?? {}),
            ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
          },
          body: opts.body,
          signal: controller.signal,
        });
        if (RETRYABLE_STATUS.has(res.status) && attempt < maxRetries) {
          lastError = new Error(`Keycloak ${res.status} retryable`);
          await sleep(100 * 2 ** attempt);
          continue;
        }
        return res;
      } catch (err) {
        const wrapped =
          err instanceof Error && err.name === 'AbortError'
            ? new Error(`Keycloak request timeout after ${timeoutMs}ms`)
            : err instanceof Error
              ? new Error(redactSensitive(err.message))
              : new Error(String(err));
        lastError = wrapped;
        if (attempt < maxRetries) {
          await sleep(100 * 2 ** attempt);
          continue;
        }
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError ?? new Error('Keycloak request failed');
  }

  private async adminFetch(
    conn: KeycloakAdminConnection,
    path: string,
    init: {
      method?: string;
      body?: unknown;
      accepted?: number[];
      realm?: string;
      /**
       * 'realm' (default): path is scoped under /admin/realms/{realm}/…
       * (clients, organizations, …). 'root': path is under /admin/… directly
       * (realm CRUD lives at /admin/realms — NOT under a parent realm).
       */
      scope?: 'realm' | 'root';
    },
  ): Promise<{ status: number; body: unknown; headers: Headers }> {
    const realm = init.realm ?? 'master';
    const suffix = path.startsWith('/') ? path : `/${path}`;
    const url = this.assertSameOrigin(
      conn,
      init.scope === 'root' ? `/admin${suffix}` : `/admin/realms/${encodeURIComponent(realm)}${suffix}`,
    );
    const token = await this.accessToken(conn);
    const res = await this.request(url, {
      method: init.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      timeoutMs: conn.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxRetries: conn.maxRetries ?? DEFAULT_MAX_RETRIES,
      token,
    });
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: redactSensitive(text.slice(0, 500)) };
      }
    }
    return { status: res.status, body, headers: res.headers };
  }

  /** Serialize mutating call per (url+method) to double-protect concurrent safety. */
  private async exclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const running = this.inFlight.get(key) as Promise<T> | undefined;
    if (running) return running;
    const p = fn().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, p);
    return p;
  }

  /** Shared foundation: health + version discovery. */
  async discoverCapabilities(conn: KeycloakAdminConnection): Promise<KeycloakServerCapabilities> {
    const token = await this.accessToken(conn); // authenticated → admin API reachable
    const serverInfoUrl = this.assertSameOrigin(conn, '/admin/serverinfo');
    const res = await this.request(serverInfoUrl, {
      method: 'GET',
      timeoutMs: conn.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxRetries: conn.maxRetries ?? DEFAULT_MAX_RETRIES,
      token,
    });
    const verifiedAt = new Date().toISOString();
    if (!res.ok) {
      return {
        serverId: '',
        keycloakVersion: null,
        organizationsSupported: false,
        realmsSupported: false,
        adminApiReachable: false,
        features: {},
        discoverySource: 'SERVERINFO',
        verifiedAt,
        rawEvidence: { serverinfoStatus: res.status },
      };
    }
    const info = (await res.json()) as {
      systemInfo?: Record<string, unknown>;
      profileInfo?: { version?: string; name?: string };
      features?: string[];
      profileInfoMap?: Record<string, { enabled: boolean }>;
    };
    const version =
      (typeof info.profileInfo?.version === 'string' ? info.profileInfo.version : null) ??
      (typeof info.systemInfo?.version === 'string' ? String(info.systemInfo.version) : null);

    // Feature detection: explicit feature list when exposed (KC 26+), else version gate.
    const featureList = Array.isArray(info.features) ? info.features.map(String) : null;
    const organizationsByProbe = await this.probeOrganizations(conn);
    const organizationsSupported = organizationsByProbe
      ? true
      : featureList
        ? featureList.some((f) => /organization/i.test(f))
        : version ? isVersionAtLeast(version, 26, 0) : false;

    return {
      serverId: '',
      keycloakVersion: version,
      organizationsSupported,
      realmsSupported: true,
      adminApiReachable: true,
      features: { organizations: organizationsSupported },
      discoverySource: 'SERVERINFO',
      verifiedAt,
      rawEvidence: {
        serverinfoStatus: res.status,
        profileName: info.profileInfo?.name ?? null,
        featuresCount: featureList?.length ?? null,
        organizationsProbe: organizationsByProbe,
      },
    };
  }

  /** Probe the real Organizations admin API (404/405 ⇒ unsupported). */
  private async probeOrganizations(conn: KeycloakAdminConnection): Promise<boolean> {
    try {
      const res = await this.adminFetch(conn, '/organizations?max=1', { method: 'GET' });
      if (res.status === 404 || res.status === 405 || res.status === 501) return false;
      if (res.status === 401 || res.status === 403) return true; // endpoint exists, perms limited
      return res.status >= 200 && res.status < 300;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Realm lifecycle (Model A) — idempotent + collision detection
  // -------------------------------------------------------------------------

  async realmExists(conn: KeycloakAdminConnection, realmName: string): Promise<KeycloakRealmObservation> {
    const res = await this.adminFetch(
      conn,
      `/realms/${encodeURIComponent(realmName)}`,
      { method: 'GET', realm: 'master', scope: 'root' },
    );
    if (res.status === 404) {
      return { exists: false, realmName, externalId: null, fingerprint: null };
    }
    if (res.status >= 200 && res.status < 300) {
      const row = (res.body ?? {}) as Record<string, unknown>;
      return {
        exists: true,
        realmName: String(row.realm ?? realmName),
        externalId: String(row.id ?? realmName),
        fingerprint: fingerprintRealm(row),
        settings: settingsOf(row),
      };
    }
    throw new Error(`Keycloak realm probe failed: ${res.status}`);
  }

  async createRealm(conn: KeycloakAdminConnection, target: KeycloakTopologyTarget): Promise<KeycloakRealmObservation> {
    return this.exclusive(`realm:${target.realmName}`, async () => {
      // RECONCILE before create: a network error after create must not double-create.
      const observed = await this.realmExists(conn, target.realmName);
      if (observed.exists) return observed;

      const payload = buildRealmPayload(target);
      const res = await this.adminFetch(conn, '/realms', {
        method: 'POST',
        realm: 'master',
        scope: 'root',
        body: payload,
      });
      if (res.status === 409) {
        const again = await this.realmExists(conn, target.realmName);
        if (again.exists) return again; // concurrent creation won — adopt it
        throw new Error(`Keycloak realm conflict: ${target.realmName}`);
      }
      if (res.status !== 201 && res.status !== 204 && res.status !== 200) {
        const detail =
          res.body && typeof res.body === 'object'
            ? ` — ${redactSensitive(JSON.stringify(res.body).slice(0, 300))}`
            : '';
        throw new Error(`Keycloak realm create failed: ${res.status}${detail}`);
      }
      // The cached token predates this realm → its admin roles don't cover it.
      // Invalidate BEFORE the post-create verification probe so the fresh mint
      // carries the new realm's `<realm>-realm` admin roles (Keycloak expands
      // the composite `admin` role at mint time only).
      this.invalidateToken(conn);
      const after = await this.realmExists(conn, target.realmName);
      if (!after.exists) throw new Error(`Keycloak realm ${target.realmName} not visible after create`);
      return after;
    });
  }

  async updateRealmSettings(
    conn: KeycloakAdminConnection,
    realmName: string,
    settings: Record<string, unknown>,
  ): Promise<void> {
    const current = await this.realmExists(conn, realmName);
    if (!current.exists) throw new Error(`Keycloak realm not found: ${realmName}`);
    const payload = { ...(current.settings ?? {}), ...settings };
    const res = await this.adminFetch(
      conn,
      `/realms/${encodeURIComponent(realmName)}`,
      { method: 'PUT', realm: 'master', scope: 'root', body: payload },
    );
    if (res.status !== 204 && res.status !== 200) {
      throw new Error(`Keycloak realm update failed: ${res.status}`);
    }
  }

  // -------------------------------------------------------------------------
  // Organizations (Model B) — capability-gated
  // -------------------------------------------------------------------------

  async organizationExists(
    conn: KeycloakAdminConnection,
    realmName: string,
    alias: string,
  ): Promise<KeycloakOrganizationObservation> {
    const res = await this.adminFetch(conn, `/organizations?bc=${encodeURIComponent(alias)}`, {
      method: 'GET',
      realm: realmName,
    });
    if (res.status === 404 || res.status === 405) {
      return { exists: false, externalId: null, alias };
    }
    if (res.status >= 200 && res.status < 300) {
      const rows = Array.isArray(res.body) ? (res.body as Array<Record<string, unknown>>) : [];
      const match = rows.find(
        (o) => String(o.alias ?? '') === alias || String(o.name ?? '') === alias,
      );
      if (match) {
        return { exists: true, externalId: String(match.id ?? ''), alias };
      }
      return { exists: false, externalId: null, alias };
    }
    throw new Error(
      `Keycloak organization probe failed: ${res.status} — ${redactSensitive(
        JSON.stringify(res.body ?? {}).slice(0, 300),
      )}`,
    );
  }

  async createOrganization(
    conn: KeycloakAdminConnection,
    realmName: string,
    alias: string,
    name: string,
  ): Promise<KeycloakOrganizationObservation> {
    return this.exclusive(`org:${realmName}:${alias}`, async () => {
      const observed = await this.organizationExists(conn, realmName, alias);
      if (observed.exists) return observed;
      const res = await this.adminFetch(conn, '/organizations', {
        method: 'POST',
        realm: realmName,
        body: { name, alias },
      });
      if (res.status === 409) {
        const again = await this.organizationExists(conn, realmName, alias);
        if (again.exists) return again;
      }
      if (res.status !== 201 && res.status !== 204 && res.status !== 200) {
        throw new Error(`Keycloak organization create failed: ${res.status}`);
      }
      const after = await this.organizationExists(conn, realmName, alias);
      if (!after.exists) throw new Error(`Keycloak organization ${alias} not visible after create`);
      return after;
    });
  }

  // -------------------------------------------------------------------------
  // Technical clients (OIDC) — secret returned ONCE, never persisted plaintext
  // -------------------------------------------------------------------------

  async clientExists(
    conn: KeycloakAdminConnection,
    realmName: string,
    clientId: string,
  ): Promise<KeycloakClientObservation> {
    const res = await this.adminFetch(
      conn,
      `/clients?clientId=${encodeURIComponent(clientId)}`,
      { method: 'GET', realm: realmName },
    );
    if (res.status !== 200 && res.status !== 204) {
      if (res.status === 404) {
        return { exists: false, clientId, externalId: null, redirectUris: [], serviceAccountEnabled: false };
      }
      throw new Error(
        `Keycloak client probe failed: ${res.status} — ${redactSensitive(
          JSON.stringify(res.body ?? {}).slice(0, 300),
        )}`,
      );
    }
    const rows = Array.isArray(res.body) ? (res.body as Array<Record<string, unknown>>) : [];
    const match = rows.find((c) => String(c.clientId ?? '') === clientId);
    if (!match) {
      return { exists: false, clientId, externalId: null, redirectUris: [], serviceAccountEnabled: false };
    }
    return {
      exists: true,
      clientId,
      externalId: String(match.id ?? ''),
      redirectUris: Array.isArray(match.redirectUris) ? match.redirectUris.map(String) : [],
      serviceAccountEnabled: match.serviceAccountsEnabled === true,
    };
  }

  async createTechnicalClient(
    conn: KeycloakAdminConnection,
    realmName: string,
    spec: NonNullable<KeycloakTopologyTarget['clientSpecs']>[number],
  ): Promise<{ externalId: string; clientSecret?: string; observation: KeycloakClientObservation }> {
    return this.exclusive(`client:${realmName}:${spec.clientId}`, async () => {
      const observed = await this.clientExists(conn, realmName, spec.clientId);
      if (observed.exists) {
        return { externalId: observed.externalId ?? '', observation: observed }; // idempotent: no secret re-issue
      }
      const confidential = spec.clientKind === 'CONFIDENTIAL';
      const payload = {
        clientId: spec.clientId,
        enabled: true,
        protocol: 'openid-connect',
        publicClient: !confidential,
        secret: undefined as string | undefined,
        standardFlowEnabled: true,
        implicitFlowEnabled: false,
        directAccessGrantsEnabled: false,
        serviceAccountsEnabled: spec.clientKind === 'SERVICE_ACCOUNT' || confidential,
        redirectUris: spec.redirectUris,
        webOrigins: spec.webOrigins,
        attributes: {
          'pkce.code.challenge.method': 'S256',
          'post.logout.redirect.uris': spec.redirectUris.join(' '),
        },
      };
      const res = await this.adminFetch(conn, '/clients', {
        method: 'POST',
        realm: realmName,
        body: payload,
      });
      if (res.status === 409) {
        const again = await this.clientExists(conn, realmName, spec.clientId);
        if (again.exists) {
          return { externalId: again.externalId ?? '', observation: again };
        }
      }
      if (res.status !== 201 && res.status !== 204 && res.status !== 200) {
        const detail =
          res.body && typeof res.body === 'object'
            ? ` — ${redactSensitive(JSON.stringify(res.body).slice(0, 300))}`
            : '';
        throw new Error(`Keycloak client create failed: ${res.status}${detail}`);
      }
      const after = await this.clientExists(conn, realmName, spec.clientId);
      if (!after.exists || !after.externalId) {
        throw new Error(`Keycloak client ${spec.clientId} not visible after create`);
      }
      let secret: string | undefined;
      if (confidential) {
        const secretRes = await this.adminFetch(
          conn,
          `/clients/${encodeURIComponent(after.externalId)}/client-secret`,
          { method: 'GET', realm: realmName },
        );
        if (secretRes.status === 200) {
          const body = (secretRes.body ?? {}) as { value?: string };
          if (typeof body.value === 'string') secret = body.value;
        }
      }
      return { externalId: after.externalId, clientSecret: secret, observation: after };
    });
  }

  // -------------------------------------------------------------------------
  // OIDC discovery (public endpoint, registered-server origin only)
  // -------------------------------------------------------------------------

  async getOpenidConfiguration(
    conn: KeycloakAdminConnection,
    realmName: string,
  ): Promise<Record<string, unknown>> {
    // Built from the REGISTERED origin only — realmName is path-encoded, and
    // no caller-supplied URL is accepted (anti-SSRF).
    const path = `/realms/${encodeURIComponent(realmName)}/.well-known/openid-configuration`;
    const url = this.assertSameOrigin(conn, path);
    const res = await this.request(url, {
      method: 'GET',
      timeoutMs: DEFAULT_TIMEOUT_MS,
      maxRetries: 1,
      token: null,
    });
    if (!res.ok) {
      throw new Error(`OIDC discovery failed: HTTP ${res.status}`);
    }
    return (await res.json()) as Record<string, unknown>;
  }

  async health(conn: KeycloakAdminConnection): Promise<{
    ok: boolean;
    latencyMs: number;
    details: Record<string, unknown>;
  }> {
    const started = (this.deps.now ?? Date.now)();
    try {
      const token = await this.accessToken(conn);
      return {
        ok: Boolean(token),
        latencyMs: (this.deps.now ?? Date.now)() - started,
        details: { authenticated: true },
      };
    } catch (err) {
      return {
        ok: false,
        latencyMs: (this.deps.now ?? Date.now)() - started,
        details: { error: redactSensitive(err instanceof Error ? err.message : String(err)) },
      };
    }
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

export function isVersionAtLeast(version: string, major: number, minor: number): boolean {
  const m = /^(\d+)\.(\d+)/.exec(version.trim());
  if (!m) return false;
  const [maj, min] = [Number(m[1]), Number(m[2])];
  if (maj !== major) return maj > major;
  return min >= minor;
}

function fingerprintRealm(row: Record<string, unknown>): string {
  const material = {
    realm: row.realm,
    sslRequired: row.sslRequired,
    ssoSessionIdleTimeout: row.ssoSessionIdleTimeout,
    ssoSessionMaxLifespan: row.ssoSessionMaxLifespan,
    accessTokenLifespan: row.accessTokenLifespan,
    revokeRefreshToken: row.revokeRefreshToken,
    passwordPolicy: row.passwordPolicy,
  };
  return createHash('sha256').update(JSON.stringify(material)).digest('hex');
}

function settingsOf(row: Record<string, unknown>): Record<string, unknown> {
  return {
    realm: row.realm,
    sslRequired: row.sslRequired,
    // Keycloak 26 RealmRepresentation names (KC <= 24 used ssoSessionIdle/ssoSessionMax).
    ssoSessionIdleTimeout: row.ssoSessionIdleTimeout,
    ssoSessionMaxLifespan: row.ssoSessionMaxLifespan,
    accessTokenLifespan: row.accessTokenLifespan,
    revokeRefreshToken: row.revokeRefreshToken,
    passwordPolicy: row.passwordPolicy,
    offlineSessionIdleTimeout: row.offlineSessionIdleTimeout,
    refreshTokenMaxReuse: row.refreshTokenMaxReuse,
  };
}

function buildRealmPayload(target: KeycloakTopologyTarget): Record<string, unknown> {
  const s = (target.realmSettings ?? {}) as Record<string, unknown>;
  // Accept both legacy (pre-26) and current Keycloak input names.
  const idle = s.ssoSessionIdleTimeout ?? s.ssoSessionIdle;
  const max = s.ssoSessionMaxLifespan ?? s.ssoSessionMax;
  const offlineIdle = s.offlineSessionIdleTimeout ?? s.offlineSessionIdle;
  return {
    realm: target.realmName,
    enabled: true,
    displayName: target.realmName,
    registrationAllowed: false,
    loginWithEmailAllowed: true,
    duplicateEmailsAllowed: false,
    resetPasswordAllowed: false,
    editUsernameAllowed: false,
    sslRequired: String(s.sslRequired ?? 'external'),
    // KC 26 rejects unknown RealmRepresentation fields with HTTP 400
    // ("unable to read contents from stream") — keep names exact.
    ssoSessionIdleTimeout: Number(idle ?? 1800),
    ssoSessionMaxLifespan: Number(max ?? 36000),
    accessTokenLifespan: Number(s.accessTokenLifespan ?? 300),
    offlineSessionIdleTimeout:
      offlineIdle == null ? undefined : Number(offlineIdle),
    revokeRefreshToken: s.revokeRefreshToken === undefined ? true : Boolean(s.revokeRefreshToken),
    refreshTokenMaxReuse: Number(s.refreshTokenMaxReuse ?? 0),
    passwordPolicy: typeof s.passwordPolicy === 'string' ? s.passwordPolicy : undefined,
    // Tech hardening defaults — no user self-registration in Edge-provisioned realms.
    userManagedAccessAllowed: false,
  };
}
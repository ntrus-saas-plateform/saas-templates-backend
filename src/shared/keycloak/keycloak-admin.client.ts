import { Injectable, Inject } from '@nestjs/common';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';
import type {
  KeycloakAdminPort,
  KeycloakSession,
  KeycloakOrganizationSummary,
  KeycloakMfaStatus,
  KeycloakUserSummary,
  KeycloakCredential,
  KeycloakAccountUrls,
  KeycloakFederatedIdentity,
  KeycloakIdentityProvider,
  CreateKeycloakIdentityProviderInput,
  UpdateKeycloakIdentityProviderInput,
} from '../../modules/identity/domain/ports/keycloak-admin.port.js';
import { CircuitBreaker } from '../security/resilience.js';
import { KeycloakRealmResolver } from './keycloak-realm.resolver.js';
import { DomainError, ErrorCode } from '../../core/domain/errors/domain-error.js';

interface TokenResponse {
  access_token: string;
}

/** Keycloak returns session timestamps as epoch milliseconds (number). */
function epochToIso(value: unknown): string {
  if (value == null || value === '') return '';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  const ms = n < 1e12 ? n * 1000 : n;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function guessBrowser(ua: string): string | null {
  if (!ua) return null;
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
  return null;
}

function guessOs(ua: string): string | null {
  if (!ua) return null;
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iOS/i.test(ua)) return 'iOS';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return null;
}

function guessDevice(ua: string): string | null {
  if (!ua) return null;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return 'Android phone';
  if (/Android/i.test(ua)) return 'Android tablet';
  if (/Mobile/i.test(ua)) return 'Mobile';
  return 'Desktop';
}

@Injectable()
export class KeycloakAdminClient implements KeycloakAdminPort {
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private readonly circuitBreaker = new CircuitBreaker();

  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly realmResolver: KeycloakRealmResolver,
  ) {}

  async isAvailable(): Promise<boolean> {
    if (!this.config.KEYCLOAK_ADMIN_ENABLED) return false;
    try {
      await this.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }

  async listUserSessions(identityId: string): Promise<readonly KeycloakSession[]> {
    return this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/users/${identityId}/sessions`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return [];
      const sessions = (await response.json()) as Array<Record<string, unknown>>;
      return sessions.map((s) => {
        const ua = String(s.userAgent ?? s['user-agent'] ?? '');
        const clientsRaw = s.clients;
        const clients = Array.isArray(clientsRaw)
          ? (clientsRaw as string[])
          : clientsRaw && typeof clientsRaw === 'object'
            ? Object.keys(clientsRaw as Record<string, unknown>)
            : [];
        return {
          id: String(s.id),
          username: String(s.username ?? ''),
          ipAddress: String(s.ipAddress ?? ''),
          started: epochToIso(s.start),
          lastAccess: epochToIso(s.lastAccess),
          clients,
          browser: guessBrowser(ua),
          os: guessOs(ua),
          device: guessDevice(ua),
        };
      });
    });
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${this.config.KEYCLOAK_ADMIN_URL}/admin/realms/${await this.resolveRealm()}/sessions/${sessionId}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok && response.status !== 404) {
        throw new Error(`Keycloak session revoke failed: ${response.status}`);
      }
    });
  }

  async revokeAllUserSessions(identityId: string): Promise<void> {
    await this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/users/${identityId}/logout`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Keycloak logout failed: ${response.status}`);
      }
    });
  }

  async createOrganization(name: string, alias: string): Promise<string> {
    return this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/organizations`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, alias }),
      });
      if (!response.ok) {
        throw new Error(`Keycloak organization create failed: ${response.status}`);
      }

      const location = response.headers.get('Location') ?? response.headers.get('location');
      if (location) {
        const id = location.split('/').filter(Boolean).pop();
        if (id && !id.startsWith('kc-')) return id;
      }

      try {
        const body = (await response.json()) as { id?: string };
        if (body.id) return body.id;
      } catch {
        // Keycloak often returns empty body with Location header only
      }

      const listed = await this.listOrganizations();
      const match = listed.find((org) => org.alias === alias || org.name === name);
      if (match) return match.id;

      throw new Error(`Keycloak organization create succeeded but id was not returned for alias=${alias}`);
    });
  }

  async updateOrganization(
    keycloakOrganizationId: string,
    name: string,
    alias: string,
  ): Promise<void> {
    await this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/organizations/${keycloakOrganizationId}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, alias }),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error(`Keycloak organization update failed: ${response.status}`);
      }
    });
  }

  async listOrganizations(): Promise<readonly KeycloakOrganizationSummary[]> {
    return this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/organizations`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return [];
      const orgs = (await response.json()) as Array<Record<string, unknown>>;
      return orgs.map((o) => ({
        id: String(o.id),
        name: String(o.name ?? ''),
        alias: String(o.alias ?? o.name ?? ''),
      }));
    });
  }

  async listOrganizationMemberIds(keycloakOrganizationId: string): Promise<readonly string[]> {
    return this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/organizations/${keycloakOrganizationId}/members`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return [];
      const members = (await response.json()) as Array<Record<string, unknown>>;
      return members.map((m) => String(m.id ?? m.userId ?? '')).filter(Boolean);
    });
  }

  async addUserToOrganization(keycloakOrganizationId: string, identityId: string): Promise<void> {
    await this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/organizations/${keycloakOrganizationId}/members`;
      // KC Organizations API expects the raw user UUID as the body (not a JSON object).
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: identityId,
      });
      if (!response.ok && response.status !== 409) {
        throw new Error(
          `Keycloak add user to org failed: ${response.status} ${await response.text()}`,
        );
      }
    });
  }

  async removeUserFromOrganization(
    keycloakOrganizationId: string,
    identityId: string,
  ): Promise<void> {
    await this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/organizations/${keycloakOrganizationId}/members/${identityId}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok && response.status !== 404) {
        throw new Error(`Keycloak remove user from org failed: ${response.status}`);
      }
    });
  }

  async setUserActiveOrganization(identityId: string, keycloakOrganizationId: string): Promise<void> {
    if (!this.config.KEYCLOAK_ADMIN_ENABLED) return;

    await this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const userUrl = `${await this.adminBase()}/users/${identityId}`;
      const userResponse = await fetch(userUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!userResponse.ok) {
        throw new Error(`Keycloak user fetch failed: ${userResponse.status}`);
      }

      const user = (await userResponse.json()) as {
        attributes?: Record<string, string[]>;
      };
      const attributes = { ...(user.attributes ?? {}) };
      attributes.organization_id = [keycloakOrganizationId];

      const updateResponse = await fetch(userUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ attributes }),
      });
      if (!updateResponse.ok) {
        throw new Error(`Keycloak user organization update failed: ${updateResponse.status}`);
      }
    });
  }

  async createUser(email: string, username?: string): Promise<string> {
    return this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/users`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          username: username ?? email,
          enabled: true,
          emailVerified: false,
        }),
      });
      if (!response.ok) {
        throw new Error(`Keycloak user create failed: ${response.status}`);
      }
      const location = response.headers.get('location');
      if (location) {
        const parts = location.split('/');
        return parts[parts.length - 1] ?? email;
      }
      return email;
    });
  }

  async createB2cUser(params: {
    email: string;
    password: string;
    tenantId: string;
    firstName?: string;
    lastName?: string;
  }): Promise<string> {
    const identityId = await this.createUser(params.email);
    await this.setUserPassword(identityId, params.password, false);
    await this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const userUrl = `${await this.adminBase()}/users/${identityId}`;
      await fetch(userUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: params.email,
          username: params.email,
          firstName: params.firstName,
          lastName: params.lastName,
          enabled: true,
          emailVerified: false,
          attributes: {
            tenant_id: [params.tenantId],
          },
        }),
      });
      const rolesUrl = `${await this.adminBase()}/users/${identityId}/role-mappings/realm`;
      await fetch(rolesUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ name: 'customer' }]),
      });
    });
    return identityId;
  }

  async setUserPassword(
    identityId: string,
    password: string,
    temporary = false,
  ): Promise<void> {
    await this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/users/${identityId}/reset-password`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'password',
          value: password,
          temporary,
        }),
      });
      if (!response.ok) {
        throw new Error(`Keycloak set password failed: ${response.status}`);
      }
    });
  }

  async getUserMfaStatus(identityId: string): Promise<KeycloakMfaStatus> {
    const credentials = await this.listUserCredentials(identityId);
    const mfaTypes = credentials
      .map((c) => c.type)
      .filter((t) => t === 'otp' || t === 'webauthn' || t === 'webauthn-passwordless');
    return { enabled: mfaTypes.length > 0, methods: mfaTypes };
  }

  async listUserCredentials(identityId: string): Promise<readonly KeycloakCredential[]> {
    return this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/users/${identityId}/credentials`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return [];
      const credentials = (await response.json()) as Array<Record<string, unknown>>;
      return credentials.map((c) => ({
        id: String(c.id),
        type: String(c.type ?? ''),
        userLabel: c.userLabel != null ? String(c.userLabel) : null,
        createdDate: epochToIso(c.createdDate),
      }));
    });
  }

  async deleteUserCredential(identityId: string, credentialId: string): Promise<void> {
    await this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/users/${identityId}/credentials/${credentialId}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok && response.status !== 404) {
        throw new Error(`Keycloak delete credential failed: ${response.status}`);
      }
    });
  }

  async getAccountUrls(redirectUri?: string): Promise<KeycloakAccountUrls> {
    const realm = await this.resolveRealm();
    const base = this.config.KEYCLOAK_ADMIN_URL.replace(/\/$/, '');
    const accountConsoleUrl = `${base}/realms/${realm}/account`;
    // Enrollment (password / TOTP / passkey) is started from the edge frontend with
    // browser-side PKCE against platform-web. These URLs are informational / fallbacks;
    // Account Console deep-links are for browsing, not for pkce-gated kc_action.
    const signingInUrl = `${accountConsoleUrl}/#/security/signing-in`;
    const linkedAccountsUrl = `${accountConsoleUrl}/#/security/linked-accounts`;
    void redirectUri;
    return {
      accountConsoleUrl,
      passwordUrl: signingInUrl,
      enrollTotpUrl: signingInUrl,
      enrollWebauthnUrl: signingInUrl,
      linkedAccountsUrl,
      recoveryCodesUrl: signingInUrl,
    };
  }

  async sendExecuteActionsEmail(
    identityId: string,
    actions: readonly string[],
  ): Promise<void> {
    await this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/users/${identityId}/execute-actions-email`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(actions),
      });
      if (!response.ok) {
        throw new Error(`Keycloak execute-actions-email failed: ${response.status}`);
      }
    });
  }

  async setUserEnabled(identityId: string, enabled: boolean): Promise<void> {
    await this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/users/${identityId}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error(`Keycloak setUserEnabled failed: ${response.status}`);
      }
    });
  }

  async getUser(identityId: string): Promise<KeycloakUserSummary | null> {
    return this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/users/${identityId}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`Keycloak getUser failed: ${response.status}`);
      }
      const data = (await response.json()) as {
        id: string;
        enabled?: boolean;
        email?: string;
        username?: string;
        emailVerified?: boolean;
      };
      return {
        id: data.id,
        enabled: data.enabled ?? true,
        email: data.email,
        username: data.username,
        emailVerified: data.emailVerified ?? false,
      };
    });
  }

  async listUsersPage(offset: number, limit: number): Promise<readonly KeycloakUserSummary[]> {
    return this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/users?first=${offset}&max=${limit}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Keycloak listUsers failed: ${response.status}`);
      }
      const data = (await response.json()) as Array<{
        id: string;
        enabled?: boolean;
        email?: string;
        username?: string;
        emailVerified?: boolean;
      }>;
      return data.map((user) => ({
        id: user.id,
        enabled: user.enabled ?? true,
        email: user.email,
        username: user.username,
        emailVerified: user.emailVerified ?? false,
      }));
    });
  }

  async listIdentityProviders(): Promise<readonly KeycloakIdentityProvider[]> {
    if (!(await this.isAvailable())) return [];
    return this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/identity-provider/instances`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return [];
      const data = (await response.json()) as Array<Record<string, unknown>>;
      return data.map((row) => this.mapIdentityProvider(row));
    });
  }

  async getIdentityProvider(alias: string): Promise<KeycloakIdentityProvider | null> {
    if (!(await this.isAvailable())) return null;
    return this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/identity-provider/instances/${encodeURIComponent(alias)}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new DomainError(
          ErrorCode.DEPENDENCY_UNAVAILABLE,
          `Keycloak get identity provider failed: ${response.status}`,
        );
      }
      const row = (await response.json()) as Record<string, unknown>;
      return this.mapIdentityProvider(row);
    });
  }

  async createIdentityProvider(
    input: CreateKeycloakIdentityProviderInput,
  ): Promise<KeycloakIdentityProvider> {
    return this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/identity-provider/instances`;
      const body = {
        alias: input.alias.trim(),
        providerId: input.providerId.trim(),
        enabled: input.enabled !== false,
        displayName: input.displayName ?? undefined,
        linkOnly: input.linkOnly === true,
        config: input.config ?? {},
      };
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (response.status === 409) {
        throw new DomainError(ErrorCode.CONFLICT, 'Identity provider alias already exists');
      }
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new DomainError(
          ErrorCode.DEPENDENCY_UNAVAILABLE,
          `Keycloak create identity provider failed: ${response.status} ${text}`.trim(),
        );
      }
      const created = await this.getIdentityProvider(body.alias);
      if (!created) {
        return {
          alias: body.alias,
          providerId: body.providerId,
          enabled: body.enabled,
          displayName: body.displayName ?? null,
          linkOnly: body.linkOnly,
          config: body.config,
        };
      }
      return created;
    });
  }

  async updateIdentityProvider(
    input: UpdateKeycloakIdentityProviderInput,
  ): Promise<KeycloakIdentityProvider> {
    return this.circuitBreaker.execute(async () => {
      const existing = await this.getIdentityProvider(input.alias);
      if (!existing) {
        throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Identity provider not found');
      }
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/identity-provider/instances/${encodeURIComponent(input.alias)}`;
      const mergedConfig = {
        ...(existing.config ?? {}),
        ...(input.config ?? {}),
      };
      // Drop empty secret fields so Keycloak keeps the previous secret
      for (const [k, v] of Object.entries(mergedConfig)) {
        if (v === '' || v === '**********') delete mergedConfig[k];
      }
      const body = {
        alias: existing.alias,
        providerId: existing.providerId,
        enabled: input.enabled ?? existing.enabled,
        displayName:
          input.displayName !== undefined ? input.displayName : existing.displayName,
        linkOnly: input.linkOnly ?? existing.linkOnly,
        config: mergedConfig,
      };
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new DomainError(
          ErrorCode.DEPENDENCY_UNAVAILABLE,
          `Keycloak update identity provider failed: ${response.status} ${text}`.trim(),
        );
      }
      const updated = await this.getIdentityProvider(input.alias);
      return updated ?? {
        alias: body.alias,
        providerId: body.providerId,
        enabled: body.enabled,
        displayName: body.displayName ?? null,
        linkOnly: body.linkOnly,
        config: this.redactConfig(mergedConfig),
      };
    });
  }

  async deleteIdentityProvider(alias: string): Promise<void> {
    await this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/identity-provider/instances/${encodeURIComponent(alias)}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok && response.status !== 404) {
        throw new DomainError(
          ErrorCode.DEPENDENCY_UNAVAILABLE,
          `Keycloak delete identity provider failed: ${response.status}`,
        );
      }
    });
  }

  private mapIdentityProvider(row: Record<string, unknown>): KeycloakIdentityProvider {
    const rawConfig =
      row.config && typeof row.config === 'object' && !Array.isArray(row.config)
        ? (row.config as Record<string, unknown>)
        : {};
    const config: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawConfig)) {
      if (v == null) continue;
      config[k] = String(v);
    }
    return {
      alias: String(row.alias ?? ''),
      providerId: String(row.providerId ?? ''),
      enabled: row.enabled !== false,
      displayName: row.displayName != null ? String(row.displayName) : null,
      linkOnly: row.linkOnly === true,
      config: this.redactConfig(config),
    };
  }

  private redactConfig(config: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(config)) {
      const lower = k.toLowerCase();
      if (
        lower.includes('secret') ||
        lower.includes('password') ||
        lower.includes('clientsecret') ||
        lower === 'clientsecret'
      ) {
        out[k] = v ? '**********' : '';
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  async listFederatedIdentities(
    identityId: string,
  ): Promise<readonly KeycloakFederatedIdentity[]> {
    if (!(await this.isAvailable())) return [];
    return this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/users/${identityId}/federated-identity`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return [];
      const data = (await response.json()) as Array<Record<string, unknown>>;
      return data.map((row) => ({
        identityProvider: String(row.identityProvider ?? ''),
        userId: String(row.userId ?? ''),
        userName: String(row.userName ?? ''),
      }));
    });
  }

  async removeFederatedIdentity(identityId: string, provider: string): Promise<void> {
    await this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      const url = `${await this.adminBase()}/users/${identityId}/federated-identity/${encodeURIComponent(provider)}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok && response.status !== 404) {
        throw new Error(`Keycloak remove federated identity failed: ${response.status}`);
      }
    });
  }

  private async resolveRealm(): Promise<string> {
    return this.realmResolver.resolveRealm();
  }

  private async adminBase(): Promise<string> {
    const realm = await this.resolveRealm();
    return `${this.config.KEYCLOAK_ADMIN_URL}/admin/realms/${realm}`;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 5000) {
      return this.accessToken;
    }

    const tokenUrl = `${this.config.KEYCLOAK_ADMIN_URL}/realms/${await this.resolveRealm()}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.KEYCLOAK_ADMIN_CLIENT_ID,
      client_secret: this.config.KEYCLOAK_ADMIN_CLIENT_SECRET,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      throw new Error(`Keycloak admin token request failed: ${response.status}`);
    }

    const data = (await response.json()) as TokenResponse & { expires_in?: number };
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in ?? 300) * 1000;
    return this.accessToken;
  }
}

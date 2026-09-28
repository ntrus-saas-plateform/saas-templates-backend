export interface KeycloakSession {
  readonly id: string;
  readonly username: string;
  readonly ipAddress: string;
  readonly started: string;
  readonly lastAccess: string;
  readonly clients: readonly string[];
  readonly browser?: string | null;
  readonly os?: string | null;
  readonly device?: string | null;
}

export interface KeycloakCredential {
  readonly id: string;
  readonly type: string;
  readonly userLabel?: string | null;
  readonly createdDate?: string | null;
}

export interface KeycloakOrganizationSummary {
  readonly id: string;
  readonly name: string;
  readonly alias: string;
}

export interface KeycloakMfaStatus {
  readonly enabled: boolean;
  readonly methods: readonly string[];
}

export interface KeycloakUserSummary {
  readonly id: string;
  readonly enabled: boolean;
  readonly email?: string;
  readonly username?: string;
  readonly emailVerified?: boolean;
  readonly federatedIdentities?: readonly KeycloakFederatedIdentity[];
}

export interface KeycloakFederatedIdentity {
  readonly identityProvider: string;
  readonly userId: string;
  readonly userName: string;
}

export interface KeycloakIdentityProvider {
  readonly alias: string;
  readonly providerId: string;
  readonly enabled: boolean;
  readonly displayName: string | null;
  readonly linkOnly: boolean;
  /** Non-secret config keys returned by Keycloak (secrets redacted). */
  readonly config?: Readonly<Record<string, string>>;
}

export type CreateKeycloakIdentityProviderInput = {
  alias: string;
  providerId: string;
  enabled?: boolean;
  displayName?: string | null;
  linkOnly?: boolean;
  /** Provider-specific config (clientId, clientSecret, authorizationUrl, …). */
  config?: Record<string, string>;
};

export type UpdateKeycloakIdentityProviderInput = {
  alias: string;
  enabled?: boolean;
  displayName?: string | null;
  linkOnly?: boolean;
  config?: Record<string, string>;
};

export interface KeycloakAccountUrls {
  readonly accountConsoleUrl: string;
  readonly passwordUrl: string;
  readonly enrollTotpUrl: string;
  readonly enrollWebauthnUrl: string;
  readonly linkedAccountsUrl: string;
  readonly recoveryCodesUrl: string;
}

export interface KeycloakAdminPort {
  isAvailable(): Promise<boolean>;
  listUserSessions(identityId: string): Promise<readonly KeycloakSession[]>;
  revokeSession(sessionId: string): Promise<void>;
  revokeAllUserSessions(identityId: string): Promise<void>;
  createOrganization(name: string, alias: string): Promise<string>;
  updateOrganization(keycloakOrganizationId: string, name: string, alias: string): Promise<void>;
  listOrganizations(): Promise<readonly KeycloakOrganizationSummary[]>;
  listOrganizationMemberIds(keycloakOrganizationId: string): Promise<readonly string[]>;
  addUserToOrganization(keycloakOrganizationId: string, identityId: string): Promise<void>;
  removeUserFromOrganization(keycloakOrganizationId: string, identityId: string): Promise<void>;
  setUserActiveOrganization(identityId: string, keycloakOrganizationId: string): Promise<void>;
  createUser(email: string, username?: string): Promise<string>;
  createB2cUser(params: {
    email: string;
    password: string;
    tenantId: string;
    firstName?: string;
    lastName?: string;
  }): Promise<string>;
  setUserPassword(identityId: string, password: string, temporary?: boolean): Promise<void>;
  getUserMfaStatus(identityId: string): Promise<KeycloakMfaStatus>;
  listUserCredentials(identityId: string): Promise<readonly KeycloakCredential[]>;
  deleteUserCredential(identityId: string, credentialId: string): Promise<void>;
  getAccountUrls(redirectUri?: string): Promise<KeycloakAccountUrls>;
  sendExecuteActionsEmail(identityId: string, actions: readonly string[]): Promise<void>;
  setUserEnabled(identityId: string, enabled: boolean): Promise<void>;
  getUser(identityId: string): Promise<KeycloakUserSummary | null>;
  listUsersPage(offset: number, limit: number): Promise<readonly KeycloakUserSummary[]>;
  listIdentityProviders(): Promise<readonly KeycloakIdentityProvider[]>;
  getIdentityProvider(alias: string): Promise<KeycloakIdentityProvider | null>;
  createIdentityProvider(input: CreateKeycloakIdentityProviderInput): Promise<KeycloakIdentityProvider>;
  updateIdentityProvider(input: UpdateKeycloakIdentityProviderInput): Promise<KeycloakIdentityProvider>;
  deleteIdentityProvider(alias: string): Promise<void>;
  listFederatedIdentities(identityId: string): Promise<readonly KeycloakFederatedIdentity[]>;
  removeFederatedIdentity(identityId: string, provider: string): Promise<void>;
}

export const KEYCLOAK_ADMIN_PORT = Symbol('KEYCLOAK_ADMIN_PORT');

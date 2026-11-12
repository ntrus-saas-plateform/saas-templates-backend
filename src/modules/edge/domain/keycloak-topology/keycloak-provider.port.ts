/**
 * P7.7 §4 — provider-agnostic Keycloak topology ports.
 * Every adapter uses the REAL Keycloak Admin API (service account, TLS, timeouts,
 * controlled retries, idempotent operations, error classification).
 */

import type { KeycloakServerCapabilities } from './keycloak.types.js';

export const KEYCLOAK_PROVIDER_PORT = Symbol('KEYCLOAK_PROVIDER_PORT');

/** Administrative connection settings for one Keycloak server. */
export type KeycloakAdminConnection = {
  baseUrl: string;
  adminRealm: string;
  adminClientId: string;
  /** Opaque credential reference resolved through the secrets vault. */
  adminCredentialRef: string;
  tlsMode: 'REQUIRED' | 'OPTIONAL_INSECURE_LOCAL';
  allowPrivateNetwork: boolean;
  timeoutMs?: number;
  maxRetries?: number;
};

/** Topology descriptor consumed by adapters (no secrets). */
export type KeycloakTopologyTarget = {
  topologyId: string;
  tenantId: string;
  topologyType: string;
  /** Internal (Edge) names — never free-form user input. */
  realmName: string;
  organizationAlias?: string | null;
  organizationName?: string | null;
  realmSettings?: Record<string, unknown>;
  clientSpecs?: Array<{
    clientId: string;
    clientKind: 'CONFIDENTIAL' | 'PUBLIC' | 'SERVICE_ACCOUNT';
    ownerFunction: string;
    redirectUris: string[];
    webOrigins: string[];
    scopes: string[];
  }>;
  expectedFingerprint: string;
};

export type KeycloakRealmObservation = {
  exists: boolean;
  realmName: string;
  externalId: string | null;
  fingerprint: string | null;
  settings?: Record<string, unknown>;
};

export type KeycloakOrganizationObservation = {
  exists: boolean;
  externalId: string | null;
  alias: string | null;
};

export type KeycloakClientObservation = {
  exists: boolean;
  clientId: string;
  externalId: string | null;
  redirectUris: string[];
  serviceAccountEnabled: boolean;
};

/**
 * KeycloakProviderPort — the single seam to a provider.
 * Implementations must be idempotent: before creating, they RECONCILE the real
 * state (a network error after a create must never trigger a blind second create).
 */
export interface KeycloakProviderPort {
  readonly providerCode: string;

  /** Verify connectivity + discover version/features (serverinfo + probes). */
  discoverCapabilities(connection: KeycloakAdminConnection): Promise<KeycloakServerCapabilities>;

  /** Realm lifecycle (Model A) — idempotent, collision-detecting. */
  realmExists(connection: KeycloakAdminConnection, realmName: string): Promise<KeycloakRealmObservation>;
  createRealm(
    connection: KeycloakAdminConnection,
    target: KeycloakTopologyTarget,
  ): Promise<KeycloakRealmObservation>;
  updateRealmSettings(
    connection: KeycloakAdminConnection,
    realmName: string,
    settings: Record<string, unknown>,
  ): Promise<void>;

  /** Organization lifecycle (Model B) — capability-gated. */
  organizationExists(
    connection: KeycloakAdminConnection,
    realmName: string,
    alias: string,
  ): Promise<KeycloakOrganizationObservation>;
  createOrganization(
    connection: KeycloakAdminConnection,
    realmName: string,
    alias: string,
    name: string,
  ): Promise<KeycloakOrganizationObservation>;

  /** Technical clients (OIDC). Secret returned ONCE, never persisted plaintext. */
  clientExists(
    connection: KeycloakAdminConnection,
    realmName: string,
    clientId: string,
  ): Promise<KeycloakClientObservation>;
  createTechnicalClient(
    connection: KeycloakAdminConnection,
    realmName: string,
    spec: NonNullable<KeycloakTopologyTarget['clientSpecs']>[number],
  ): Promise<{ externalId: string; clientSecret?: string; observation: KeycloakClientObservation }>;

  /**
   * OIDC discovery document of a realm (public, unauthenticated).
   * The URL is ALWAYS built from the registered connection origin — no
   * caller-supplied endpoint is ever accepted (anti-SSRF, mandate §10).
   */
  getOpenidConfiguration(
    connection: KeycloakAdminConnection,
    realmName: string,
  ): Promise<Record<string, unknown>>;

  /** Health probe (admin API reachable + authenticated). */
  health(connection: KeycloakAdminConnection): Promise<{ ok: boolean; latencyMs: number; details: Record<string, unknown> }>;
}

export const KEYCLOAK_CAPABILITY_REGISTRY_PORT = Symbol('KEYCLOAK_CAPABILITY_REGISTRY_PORT');
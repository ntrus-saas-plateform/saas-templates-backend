/** P7.7 repository port (mirror of migration 102 — transactional, versioned). */

import type {
  KeycloakCapabilitiesRecord,
  KeycloakClientRecord,
  KeycloakHealthCheckRecord,
  KeycloakHistoryRecord,
  KeycloakOperationEvidenceRecord,
  KeycloakOidcConfigurationRecord,
  KeycloakOrganizationRecord,
  KeycloakProviderRecord,
  KeycloakRealmRecord,
  KeycloakReconciliationRunRecord,
  KeycloakResourceReferenceRecord,
  KeycloakServerRecord,
  KeycloakTopologyRecord,
} from './keycloak.types.js';

export const KEYCLOAK_REPOSITORY_PORT = Symbol('KEYCLOAK_REPOSITORY_PORT');

export type KeycloakTopologyListFilter = {
  tenantId?: string;
  productId?: string;
  status?: string;
  topologyType?: string;
  serverId?: string;
  limit?: number;
  offset?: number;
};

export interface KeycloakRepositoryPort {
  // --- providers / servers / capabilities -------------------------------
  listProviders(): Promise<KeycloakProviderRecord[]>;
  getProviderById(id: string, client?: unknown): Promise<KeycloakProviderRecord | null>;
  getProviderByCode(code: string, client?: unknown): Promise<KeycloakProviderRecord | null>;

  createServer(
    input: Omit<KeycloakServerRecord, 'createdAt' | 'updatedAt' | 'version'>,
    actorId: string,
    client?: unknown,
  ): Promise<KeycloakServerRecord>;
  listServers(): Promise<KeycloakServerRecord[]>;
  getServerById(id: string, client?: unknown): Promise<KeycloakServerRecord | null>;
  updateServer(
    id: string,
    patch: Partial<Pick<KeycloakServerRecord, 'operationalStatus' | 'discoveredVersion' | 'lastConnectivityStatus' | 'lastConnectivityAt' | 'metadata'>>,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<KeycloakServerRecord>;

  upsertCapabilities(
    record: Omit<KeycloakCapabilitiesRecord, 'id' | 'createdAt'>,
    client?: unknown,
  ): Promise<KeycloakCapabilitiesRecord>;
  getCapabilities(serverId: string, client?: unknown): Promise<KeycloakCapabilitiesRecord | null>;

  // --- topologies -------------------------------------------------------
  createTopology(
    input: Omit<KeycloakTopologyRecord, 'createdAt' | 'updatedAt' | 'version'> & { createdBy: string | null; updatedBy: string | null },
    client?: unknown,
  ): Promise<KeycloakTopologyRecord>;
  getTopology(id: string, client?: unknown): Promise<KeycloakTopologyRecord | null>;
  getActiveTopologyByKey(
    tenantId: string,
    productId: string,
    serverId: string,
    client?: unknown,
  ): Promise<KeycloakTopologyRecord | null>;
  listTopologies(filter: KeycloakTopologyListFilter, client?: unknown): Promise<KeycloakTopologyRecord[]>;
  updateTopology(
    id: string,
    patch: Partial<
      Pick<
        KeycloakTopologyRecord,
        | 'status'
        | 'statusReason'
        | 'realmRef'
        | 'organizationRef'
        | 'oidcConfigurationRef'
        | 'externalRealmId'
        | 'externalOrganizationId'
        | 'keycloakVersion'
        | 'appliedConfigVersion'
        | 'resourceFingerprint'
        | 'lastHealthCheckAt'
        | 'lastReconciliationAt'
        | 'workflowId'
        | 'metadata'
      >
    >,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<KeycloakTopologyRecord>;

  insertTopologyVersion(
    input: {
      topologyId: string;
      versionNumber: number;
      fingerprint: string;
      snapshot: Record<string, unknown>;
      validationStatus: 'PENDING' | 'VALID' | 'INVALID';
      validationErrors: unknown[];
      createdBy: string;
    },
    client?: unknown,
  ): Promise<void>;
  advanceDesiredVersion(topologyId: string, client?: unknown): Promise<number>;

  // --- realms / organizations / clients / oidc --------------------------
  createRealm(
    input: Omit<KeycloakRealmRecord, 'createdAt' | 'updatedAt' | 'version'>,
    client?: unknown,
  ): Promise<KeycloakRealmRecord>;
  getRealmByTopology(topologyId: string, client?: unknown): Promise<KeycloakRealmRecord | null>;
  getRealmByRealmName(realmName: string, client?: unknown): Promise<KeycloakRealmRecord | null>;
  updateRealm(
    id: string,
    patch: Partial<
      Pick<
        KeycloakRealmRecord,
        | 'status'
        | 'externalRealmId'
        | 'appliedFingerprint'
        | 'workflowId'
        | 'evidence'
        | 'sslRequired'
        | 'ssoSessionIdleSeconds'
        | 'ssoSessionMaxSeconds'
        | 'accessTokenLifespanSeconds'
        | 'passwordPolicy'
        | 'revokeRefreshToken'
        | 'refreshTokenMaxReuse'
      >
    >,
    expectedVersion: number,
    client?: unknown,
  ): Promise<KeycloakRealmRecord>;

  createOrganization(
    input: Omit<KeycloakOrganizationRecord, 'createdAt' | 'updatedAt' | 'version'>,
    client?: unknown,
  ): Promise<KeycloakOrganizationRecord>;
  getOrganizationByTopology(topologyId: string, client?: unknown): Promise<KeycloakOrganizationRecord | null>;
  updateOrganization(
    id: string,
    patch: Partial<Pick<KeycloakOrganizationRecord, 'status' | 'externalOrganizationId' | 'workflowId' | 'evidence'>>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<KeycloakOrganizationRecord>;

  createClient(
    input: Omit<KeycloakClientRecord, 'createdAt' | 'updatedAt' | 'version'>,
    client?: unknown,
  ): Promise<KeycloakClientRecord>;
  listClients(topologyId: string, client?: unknown): Promise<KeycloakClientRecord[]>;
  updateClient(
    id: string,
    patch: Partial<
      Pick<
        KeycloakClientRecord,
        | 'status'
        | 'clientUuid'
        | 'secretCredentialRef'
        | 'secretRotatedAt'
        | 'complianceStatus'
        | 'workflowId'
        | 'evidence'
      >
    >,
    expectedVersion: number,
    client?: unknown,
  ): Promise<KeycloakClientRecord>;

  createOidcConfiguration(
    input: Omit<KeycloakOidcConfigurationRecord, 'createdAt' | 'updatedAt'>,
    client?: unknown,
  ): Promise<KeycloakOidcConfigurationRecord>;
  getOidcConfiguration(
    topologyId: string,
    client?: unknown,
  ): Promise<KeycloakOidcConfigurationRecord | null>;
  updateOidcConfiguration(
    id: string,
    patch: Partial<
      Pick<
        KeycloakOidcConfigurationRecord,
        | 'status'
        | 'discoveryDocument'
        | 'discoveryValidated'
        | 'jwksValidated'
        | 'validatedAt'
        | 'authorizationEndpoint'
        | 'tokenEndpoint'
        | 'jwksUri'
        | 'userinfoEndpoint'
        | 'endSessionEndpoint'
        | 'supportedScopes'
        | 'supportedResponseTypes'
        | 'supportedSigningAlgs'
      >
    >,
    client?: unknown,
  ): Promise<KeycloakOidcConfigurationRecord>;

  // --- references / health / reconciliation / history / evidence -------
  createResourceReference(input: Omit<KeycloakResourceReferenceRecord, 'id' | 'createdAt'>, client?: unknown): Promise<KeycloakResourceReferenceRecord>;
  listResourceReferences(topologyId: string, client?: unknown): Promise<KeycloakResourceReferenceRecord[]>;

  createHealthCheck(input: Omit<KeycloakHealthCheckRecord, 'id'>, client?: unknown): Promise<KeycloakHealthCheckRecord>;
  listHealthChecks(topologyId: string | null, serverId: string | null, limit: number, client?: unknown): Promise<KeycloakHealthCheckRecord[]>;

  createReconciliationRun(
    input: Omit<KeycloakReconciliationRunRecord, 'id' | 'startedAt' | 'completedAt'>,
    client?: unknown,
  ): Promise<KeycloakReconciliationRunRecord>;
  completeReconciliationRun(
    id: string,
    patch: Partial<Pick<KeycloakReconciliationRunRecord, 'observedState' | 'driftDetected' | 'driftClassification' | 'driftDetails' | 'actionTaken' | 'outcome' | 'completedAt'>>,
    client?: unknown,
  ): Promise<KeycloakReconciliationRunRecord>;
  listReconciliationRuns(topologyId: string, limit: number, client?: unknown): Promise<KeycloakReconciliationRunRecord[]>;

  appendHistory(
    input: Omit<KeycloakHistoryRecord, 'id' | 'createdAt'> & { topologyId?: string | null; workflowId?: string | null },
    client?: unknown,
  ): Promise<void>;
  listHistory(
    resourceType: string,
    resourceId: string,
    limit?: number,
    client?: unknown,
  ): Promise<KeycloakHistoryRecord[]>;

  createEvidence(
    input: Omit<KeycloakOperationEvidenceRecord, 'id' | 'performedAt'>,
    client?: unknown,
  ): Promise<KeycloakOperationEvidenceRecord>;
  listEvidence(topologyId: string, limit?: number, client?: unknown): Promise<KeycloakOperationEvidenceRecord[]>;
}
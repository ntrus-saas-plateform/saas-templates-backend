import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  KeycloakRepositoryPort,
  KeycloakTopologyListFilter,
} from '../../domain/keycloak-topology/keycloak-repository.port.js';
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
} from '../../domain/keycloak-topology/keycloak.types.js';

type Row = Record<string, unknown>;

function str(v: unknown): string {
  return v == null ? '' : String(v);
}
function strOrNull(v: unknown): string | null {
  return v == null ? null : String(v);
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function bool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1;
}
function asDate(v: unknown): Date {
  return v instanceof Date ? v : new Date(String(v));
}
function asDateOrNull(v: unknown): Date | null {
  return v == null ? null : asDate(v);
}
function asJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}
function asStrArray(v: unknown): string[] {
  return asJson<string[]>(v, []).map(String);
}

/**
 * P7.7 PostgreSQL repository — mirrors migration 102.
 * Optimistic concurrency (version column) + transactional client passthrough.
 * NEVER exposes or stores plaintext secrets (credential refs are opaque).
 */
@Injectable()
export class PgKeycloakRepository implements KeycloakRepositoryPort {
  constructor(private readonly cpDb: ControlPlaneDatabaseService) {}
  private get pool(): Pool {
    return this.cpDb.getPool();
  }
  private async q<T extends Row = Row>(sql: string, params: unknown[] = [], client?: unknown) {
    const executor = client ? (client as PoolClient) : this.pool;
    return (await executor.query(sql, params)).rows as T[];
  }
  private conflict(): never {
    throw new DomainError(ErrorCode.CONFLICT, 'Optimistic lock conflict on Keycloak resource');
  }
  private notFound(): never {
    throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Keycloak resource not found');
  }

  // -------------------------------------------------------------------------
  // Providers
  // -------------------------------------------------------------------------

  private mapProvider(row: Row): KeycloakProviderRecord {
    return {
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      providerVersion: str(row.provider_version),
      providerKind: str(row.provider_kind),
      operationalStatus: str(row.operational_status),
      supportedTopologyTypes: asStrArray(row.supported_topology_types),
      capabilities: asJson(row.capabilities, {}),
      constraints: asJson(row.constraints, {}),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  async listProviders(): Promise<KeycloakProviderRecord[]> {
    const rows = await this.q(`SELECT * FROM edge_p7_keycloak_providers ORDER BY code`);
    return rows.map((r) => this.mapProvider(r));
  }

  async getProviderById(id: string, client?: unknown): Promise<KeycloakProviderRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_keycloak_providers WHERE id = $1`, [id], client);
    return rows[0] ? this.mapProvider(rows[0]) : null;
  }

  async getProviderByCode(code: string, client?: unknown): Promise<KeycloakProviderRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_keycloak_providers WHERE code = $1`, [code], client);
    return rows[0] ? this.mapProvider(rows[0]) : null;
  }

  // -------------------------------------------------------------------------
  // Servers
  // -------------------------------------------------------------------------

  private mapServer(row: Row): KeycloakServerRecord {
    return {
      id: str(row.id),
      providerId: str(row.provider_id),
      code: str(row.code),
      name: str(row.name),
      baseUrl: str(row.base_url),
      adminRealm: str(row.admin_realm),
      adminClientId: str(row.admin_client_id),
      adminCredentialRef: strOrNull(row.admin_credential_ref),
      tlsMode: str(row.tls_mode),
      allowPrivateNetwork: bool(row.allow_private_network),
      environment: str(row.environment),
      operationalStatus: str(row.operational_status),
      discoveredVersion: strOrNull(row.discovered_version),
      lastConnectivityStatus: strOrNull(row.last_connectivity_status),
      lastConnectivityAt: asDateOrNull(row.last_connectivity_at),
      metadata: asJson(row.metadata, {}),
      version: num(row.version),
      createdBy: strOrNull(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  async createServer(
    input: Omit<KeycloakServerRecord, 'createdAt' | 'updatedAt' | 'version'>,
    actorId: string,
    client?: unknown,
  ): Promise<KeycloakServerRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_keycloak_servers (
           id, provider_id, code, name, base_url, admin_realm, admin_client_id,
           admin_credential_ref, tls_mode, allow_private_network, environment,
           operational_status, metadata, created_by, updated_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        [
          input.id,
          input.providerId,
          input.code,
          input.name,
          input.baseUrl,
          input.adminRealm,
          input.adminClientId,
          input.adminCredentialRef,
          input.tlsMode,
          input.allowPrivateNetwork,
          input.environment,
          input.operationalStatus,
          JSON.stringify(input.metadata ?? {}),
          actorId,
          actorId,
        ],
        client,
      );
      return this.mapServer(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Code or server endpoint already registered');
    }
  }

  async listServers(): Promise<KeycloakServerRecord[]> {
    const rows = await this.q(`SELECT * FROM edge_p7_keycloak_servers ORDER BY code`);
    return rows.map((r) => this.mapServer(r));
  }

  async getServerById(id: string, client?: unknown): Promise<KeycloakServerRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_keycloak_servers WHERE id = $1`, [id], client);
    return rows[0] ? this.mapServer(rows[0]) : null;
  }

  async updateServer(
    id: string,
    patch: Partial<
      Pick<KeycloakServerRecord, 'operationalStatus' | 'discoveredVersion' | 'lastConnectivityStatus' | 'lastConnectivityAt' | 'metadata'>
    >,
    expectedVersion: number,
    actorId: string,
    client?: unknown,
  ): Promise<KeycloakServerRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_keycloak_servers SET
         operational_status = COALESCE($3, operational_status),
         discovered_version = COALESCE($4, discovered_version),
         last_connectivity_status = COALESCE($5, last_connectivity_status),
         last_connectivity_at = COALESCE($6, last_connectivity_at),
         metadata = COALESCE($7, metadata),
         version = version + 1,
         updated_by = $8,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.operationalStatus ?? null,
        patch.discoveredVersion ?? null,
        patch.lastConnectivityStatus ?? null,
        patch.lastConnectivityAt ?? null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        actorId,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapServer(rows[0]);
  }

  // -------------------------------------------------------------------------
  // Capabilities
  // -------------------------------------------------------------------------

  private mapCapabilities(row: Row): KeycloakCapabilitiesRecord {
    return {
      id: str(row.id),
      serverId: str(row.server_id),
      keycloakVersion: strOrNull(row.keycloak_version),
      features: asJson(row.features, {}),
      organizationsSupported: bool(row.organizations_supported),
      realmsSupported: bool(row.realms_supported),
      adminApiReachable: bool(row.admin_api_reachable),
      discoverySource: str(row.discovery_source),
      rawEvidence: asJson(row.raw_evidence, {}),
      verifiedAt: asDate(row.verified_at),
      createdAt: asDate(row.created_at),
    };
  }

  async upsertCapabilities(
    record: Omit<KeycloakCapabilitiesRecord, 'id' | 'createdAt'>,
    client?: unknown,
  ): Promise<KeycloakCapabilitiesRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_keycloak_capabilities (
         server_id, keycloak_version, features, organizations_supported,
         realms_supported, admin_api_reachable, discovery_source, raw_evidence, verified_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (server_id) DO UPDATE SET
         keycloak_version = EXCLUDED.keycloak_version,
         features = EXCLUDED.features,
         organizations_supported = EXCLUDED.organizations_supported,
         realms_supported = EXCLUDED.realms_supported,
         admin_api_reachable = EXCLUDED.admin_api_reachable,
         discovery_source = EXCLUDED.discovery_source,
         raw_evidence = EXCLUDED.raw_evidence,
         verified_at = EXCLUDED.verified_at
       RETURNING *`,
      [
        record.serverId,
        record.keycloakVersion,
        JSON.stringify(record.features ?? {}),
        record.organizationsSupported,
        record.realmsSupported,
        record.adminApiReachable,
        record.discoverySource,
        JSON.stringify(record.rawEvidence ?? {}),
        record.verifiedAt,
      ],
      client,
    );
    return this.mapCapabilities(rows[0]!);
  }

  async getCapabilities(serverId: string, client?: unknown): Promise<KeycloakCapabilitiesRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_keycloak_capabilities WHERE server_id = $1`,
      [serverId],
      client,
    );
    return rows[0] ? this.mapCapabilities(rows[0]) : null;
  }

  // -------------------------------------------------------------------------
  // Topologies
  // -------------------------------------------------------------------------

  private mapTopology(row: Row): KeycloakTopologyRecord {
    return {
      id: str(row.id),
      tenantId: str(row.tenant_id),
      productId: str(row.product_id),
      subscriptionId: strOrNull(row.subscription_id),
      authorizationId: strOrNull(row.authorization_id),
      authorizationVersion: row.authorization_version == null ? null : num(row.authorization_version),
      placementDecisionId: strOrNull(row.placement_decision_id),
      deploymentProfileId: strOrNull(row.deployment_profile_id),
      deploymentProfileVersion:
        row.deployment_profile_version == null ? null : num(row.deployment_profile_version),
      runtimeProfileId: strOrNull(row.runtime_profile_id),
      providerId: str(row.provider_id),
      serverId: str(row.server_id),
      topologyType: str(row.topology_type),
      realmRef: strOrNull(row.realm_ref),
      organizationRef: strOrNull(row.organization_ref),
      oidcConfigurationRef: strOrNull(row.oidc_configuration_ref),
      externalRealmId: strOrNull(row.external_realm_id),
      externalOrganizationId: strOrNull(row.external_organization_id),
      keycloakVersion: strOrNull(row.keycloak_version),
      desiredConfigVersion: num(row.desired_config_version),
      appliedConfigVersion: row.applied_config_version == null ? null : num(row.applied_config_version),
      resourceFingerprint: strOrNull(row.resource_fingerprint),
      status: str(row.status),
      statusReason: strOrNull(row.status_reason),
      lastHealthCheckAt: asDateOrNull(row.last_health_check_at),
      lastReconciliationAt: asDateOrNull(row.last_reconciliation_at),
      workflowId: strOrNull(row.workflow_id),
      deletionProtection: bool(row.deletion_protection),
      metadata: asJson(row.metadata, {}),
      version: num(row.version),
      createdBy: strOrNull(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  async createTopology(
    input: Omit<KeycloakTopologyRecord, 'createdAt' | 'updatedAt' | 'version'> & {
      createdBy: string | null;
      updatedBy: string | null;
    },
    client?: unknown,
  ): Promise<KeycloakTopologyRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_keycloak_topologies (
           id, tenant_id, product_id, subscription_id, authorization_id, authorization_version,
           placement_decision_id, deployment_profile_id, deployment_profile_version, runtime_profile_id,
           provider_id, server_id, topology_type, realm_ref, organization_ref, oidc_configuration_ref,
           external_realm_id, external_organization_id, keycloak_version, desired_config_version,
           applied_config_version, resource_fingerprint, status, status_reason,
           last_health_check_at, last_reconciliation_at, workflow_id, deletion_protection,
           metadata, created_by, updated_by
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
           $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31
         ) RETURNING *`,
        [
          input.id,
          input.tenantId,
          input.productId,
          input.subscriptionId,
          input.authorizationId,
          input.authorizationVersion,
          input.placementDecisionId,
          input.deploymentProfileId,
          input.deploymentProfileVersion,
          input.runtimeProfileId,
          input.providerId,
          input.serverId,
          input.topologyType,
          input.realmRef,
          input.organizationRef,
          input.oidcConfigurationRef,
          input.externalRealmId,
          input.externalOrganizationId,
          input.keycloakVersion,
          input.desiredConfigVersion,
          input.appliedConfigVersion,
          input.resourceFingerprint,
          input.status,
          input.statusReason,
          input.lastHealthCheckAt,
          input.lastReconciliationAt,
          input.workflowId,
          input.deletionProtection,
          JSON.stringify(input.metadata ?? {}),
          input.createdBy,
          input.updatedBy,
        ],
        client,
      );
      return this.mapTopology(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Active Keycloak topology already exists (collision)');
    }
  }

  async getTopology(id: string, client?: unknown): Promise<KeycloakTopologyRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_keycloak_topologies WHERE id = $1`, [id], client);
    return rows[0] ? this.mapTopology(rows[0]) : null;
  }

  async getActiveTopologyByKey(
    tenantId: string,
    productId: string,
    serverId: string,
    client?: unknown,
  ): Promise<KeycloakTopologyRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_keycloak_topologies
       WHERE tenant_id = $1 AND product_id = $2 AND server_id = $3 AND status <> 'DEPROVISIONED'
       LIMIT 1`,
      [tenantId, productId, serverId],
      client,
    );
    return rows[0] ? this.mapTopology(rows[0]) : null;
  }

  async listTopologies(
    filter: KeycloakTopologyListFilter,
    client?: unknown,
  ): Promise<KeycloakTopologyRecord[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (clause: string, value: unknown) => {
      params.push(value);
      where.push(clause.replace('$?', `$${params.length}`));
    };
    if (filter.tenantId) add('tenant_id = $?', filter.tenantId);
    if (filter.productId) add('product_id = $?', filter.productId);
    if (filter.status) add('status = $?', filter.status);
    if (filter.topologyType) add('topology_type = $?', filter.topologyType);
    if (filter.serverId) add('server_id = $?', filter.serverId);
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const sql = `SELECT * FROM edge_p7_keycloak_topologies
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const rows = await this.q(sql, [...params, limit, offset], client);
    return rows.map((r) => this.mapTopology(r));
  }

  async updateTopology(
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
  ): Promise<KeycloakTopologyRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_keycloak_topologies SET
         status = COALESCE($3, status),
         status_reason = CASE WHEN $9 THEN $4 ELSE status_reason END,
         realm_ref = COALESCE($5, realm_ref),
         organization_ref = COALESCE($6, organization_ref),
         oidc_configuration_ref = COALESCE($7, oidc_configuration_ref),
         external_realm_id = COALESCE($8, external_realm_id),
         external_organization_id = COALESCE($10, external_organization_id),
         keycloak_version = COALESCE($11, keycloak_version),
         applied_config_version = COALESCE($12, applied_config_version),
         resource_fingerprint = COALESCE($13, resource_fingerprint),
         last_health_check_at = COALESCE($14, last_health_check_at),
         last_reconciliation_at = COALESCE($15, last_reconciliation_at),
         workflow_id = COALESCE($16, workflow_id),
         metadata = COALESCE($17, metadata),
         version = version + 1,
         updated_by = $18,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.status ?? null,
        patch.statusReason ?? null,
        patch.realmRef ?? null,
        patch.organizationRef ?? null,
        patch.oidcConfigurationRef ?? null,
        patch.externalRealmId ?? null,
        patch.statusReason !== undefined,
        patch.externalOrganizationId ?? null,
        patch.keycloakVersion ?? null,
        patch.appliedConfigVersion ?? null,
        patch.resourceFingerprint ?? null,
        patch.lastHealthCheckAt ?? null,
        patch.lastReconciliationAt ?? null,
        patch.workflowId ?? null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        actorId,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapTopology(rows[0]);
  }

  async insertTopologyVersion(
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
  ): Promise<void> {
    await this.q(
      `INSERT INTO edge_p7_keycloak_topology_versions (
         topology_id, version_number, fingerprint, snapshot, validation_status,
         validation_errors, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        input.topologyId,
        input.versionNumber,
        input.fingerprint,
        JSON.stringify(input.snapshot ?? {}),
        input.validationStatus,
        JSON.stringify(input.validationErrors ?? []),
        input.createdBy,
      ],
      client,
    );
  }

  async advanceDesiredVersion(topologyId: string, client?: unknown): Promise<number> {
    const rows = await this.q(
      `UPDATE edge_p7_keycloak_topologies
       SET desired_config_version = desired_config_version + 1, updated_at = NOW()
       WHERE id = $1
       RETURNING desired_config_version`,
      [topologyId],
      client,
    );
    if (!rows[0]) this.notFound();
    return num(rows[0].desired_config_version);
  }

  // -------------------------------------------------------------------------
  // Realms
  // -------------------------------------------------------------------------

  private mapRealm(row: Row): KeycloakRealmRecord {
    return {
      id: str(row.id),
      topologyId: str(row.topology_id),
      tenantId: str(row.tenant_id),
      realmName: str(row.realm_name),
      externalRealmId: strOrNull(row.external_realm_id),
      managedByEdge: bool(row.managed_by_edge),
      sslRequired: str(row.ssl_required),
      ssoSessionIdleSeconds: num(row.sso_session_idle_seconds),
      ssoSessionMaxSeconds: num(row.sso_session_max_seconds),
      accessTokenLifespanSeconds: num(row.access_token_lifespan_seconds),
      passwordPolicy: strOrNull(row.password_policy),
      revokeRefreshToken: bool(row.revoke_refresh_token),
      refreshTokenMaxReuse: num(row.refresh_token_max_reuse),
      desiredFingerprint: strOrNull(row.desired_fingerprint),
      appliedFingerprint: strOrNull(row.applied_fingerprint),
      status: str(row.status),
      workflowId: strOrNull(row.workflow_id),
      evidence: asJson(row.evidence, {}),
      version: num(row.version),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  async createRealm(
    input: Omit<KeycloakRealmRecord, 'createdAt' | 'updatedAt' | 'version'>,
    client?: unknown,
  ): Promise<KeycloakRealmRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_keycloak_realms (
           id, topology_id, tenant_id, realm_name, external_realm_id, managed_by_edge,
           ssl_required, sso_session_idle_seconds, sso_session_max_seconds,
           access_token_lifespan_seconds, password_policy, revoke_refresh_token,
           refresh_token_max_reuse, desired_fingerprint, applied_fingerprint,
           status, workflow_id, evidence
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING *`,
        [
          input.id,
          input.topologyId,
          input.tenantId,
          input.realmName,
          input.externalRealmId,
          input.managedByEdge,
          input.sslRequired,
          input.ssoSessionIdleSeconds,
          input.ssoSessionMaxSeconds,
          input.accessTokenLifespanSeconds,
          input.passwordPolicy,
          input.revokeRefreshToken,
          input.refreshTokenMaxReuse,
          input.desiredFingerprint,
          input.appliedFingerprint,
          input.status,
          input.workflowId,
          JSON.stringify(input.evidence ?? {}),
        ],
        client,
      );
      return this.mapRealm(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Realm already registered (name or topology collision)');
    }
  }

  async getRealmByTopology(topologyId: string, client?: unknown): Promise<KeycloakRealmRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_keycloak_realms WHERE topology_id = $1`,
      [topologyId],
      client,
    );
    return rows[0] ? this.mapRealm(rows[0]) : null;
  }

  async getRealmByRealmName(realmName: string, client?: unknown): Promise<KeycloakRealmRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_keycloak_realms WHERE realm_name = $1`,
      [realmName],
      client,
    );
    return rows[0] ? this.mapRealm(rows[0]) : null;
  }

  async updateRealm(
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
  ): Promise<KeycloakRealmRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_keycloak_realms SET
         status = COALESCE($3, status),
         external_realm_id = COALESCE($4, external_realm_id),
         applied_fingerprint = COALESCE($5, applied_fingerprint),
         workflow_id = COALESCE($6, workflow_id),
         evidence = COALESCE($7, evidence),
         ssl_required = COALESCE($8, ssl_required),
         sso_session_idle_seconds = COALESCE($9, sso_session_idle_seconds),
         sso_session_max_seconds = COALESCE($10, sso_session_max_seconds),
         access_token_lifespan_seconds = COALESCE($11, access_token_lifespan_seconds),
         password_policy = COALESCE($12, password_policy),
         revoke_refresh_token = COALESCE($13, revoke_refresh_token),
         refresh_token_max_reuse = COALESCE($14, refresh_token_max_reuse),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.status ?? null,
        patch.externalRealmId ?? null,
        patch.appliedFingerprint ?? null,
        patch.workflowId ?? null,
        patch.evidence ? JSON.stringify(patch.evidence) : null,
        patch.sslRequired ?? null,
        patch.ssoSessionIdleSeconds ?? null,
        patch.ssoSessionMaxSeconds ?? null,
        patch.accessTokenLifespanSeconds ?? null,
        patch.passwordPolicy ?? null,
        patch.revokeRefreshToken ?? null,
        patch.refreshTokenMaxReuse ?? null,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapRealm(rows[0]);
  }

  // -------------------------------------------------------------------------
  // Organizations
  // -------------------------------------------------------------------------

  private mapOrg(row: Row): KeycloakOrganizationRecord {
    return {
      id: str(row.id),
      topologyId: str(row.topology_id),
      realmId: str(row.realm_id),
      tenantId: str(row.tenant_id),
      orgAlias: str(row.org_alias),
      orgName: str(row.org_name),
      externalOrganizationId: strOrNull(row.external_organization_id),
      technicalPurpose: str(row.technical_purpose),
      status: str(row.status),
      workflowId: strOrNull(row.workflow_id),
      evidence: asJson(row.evidence, {}),
      version: num(row.version),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  async createOrganization(
    input: Omit<KeycloakOrganizationRecord, 'createdAt' | 'updatedAt' | 'version'>,
    client?: unknown,
  ): Promise<KeycloakOrganizationRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_keycloak_organizations (
           id, topology_id, realm_id, tenant_id, org_alias, org_name,
           external_organization_id, technical_purpose, status, workflow_id, evidence
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          input.id,
          input.topologyId,
          input.realmId,
          input.tenantId,
          input.orgAlias,
          input.orgName,
          input.externalOrganizationId,
          input.technicalPurpose,
          input.status,
          input.workflowId,
          JSON.stringify(input.evidence ?? {}),
        ],
        client,
      );
      return this.mapOrg(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Organization already registered for this realm/topology');
    }
  }

  async getOrganizationByTopology(
    topologyId: string,
    client?: unknown,
  ): Promise<KeycloakOrganizationRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_keycloak_organizations WHERE topology_id = $1`,
      [topologyId],
      client,
    );
    return rows[0] ? this.mapOrg(rows[0]) : null;
  }

  async updateOrganization(
    id: string,
    patch: Partial<
      Pick<KeycloakOrganizationRecord, 'status' | 'externalOrganizationId' | 'workflowId' | 'evidence'>
    >,
    expectedVersion: number,
    client?: unknown,
  ): Promise<KeycloakOrganizationRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_keycloak_organizations SET
         status = COALESCE($3, status),
         external_organization_id = COALESCE($4, external_organization_id),
         workflow_id = COALESCE($5, workflow_id),
         evidence = COALESCE($6, evidence),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.status ?? null,
        patch.externalOrganizationId ?? null,
        patch.workflowId ?? null,
        patch.evidence ? JSON.stringify(patch.evidence) : null,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapOrg(rows[0]);
  }

  // -------------------------------------------------------------------------
  // Clients
  // -------------------------------------------------------------------------

  private mapClient(row: Row): KeycloakClientRecord {
    return {
      id: str(row.id),
      topologyId: str(row.topology_id),
      realmId: str(row.realm_id),
      tenantId: str(row.tenant_id),
      clientId: str(row.client_id),
      clientUuid: strOrNull(row.client_uuid),
      clientKind: str(row.client_kind),
      ownerFunction: str(row.owner_function),
      documentedUsage: str(row.documented_usage),
      redirectUris: asStrArray(row.redirect_uris),
      webOrigins: asStrArray(row.web_origins),
      scopes: asStrArray(row.scopes),
      secretCredentialRef: strOrNull(row.secret_credential_ref),
      secretRotatedAt: asDateOrNull(row.secret_rotated_at),
      standardFlowEnabled: bool(row.standard_flow_enabled),
      directAccessGrantsEnabled: bool(row.direct_access_grants_enabled),
      serviceAccountsEnabled: bool(row.service_accounts_enabled),
      pkceRequired: bool(row.pkce_required),
      complianceStatus: str(row.compliance_status),
      status: str(row.status),
      workflowId: strOrNull(row.workflow_id),
      evidence: asJson(row.evidence, {}),
      version: num(row.version),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  async createClient(
    input: Omit<KeycloakClientRecord, 'createdAt' | 'updatedAt' | 'version'>,
    client?: unknown,
  ): Promise<KeycloakClientRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_keycloak_clients (
           id, topology_id, realm_id, tenant_id, client_id, client_uuid, client_kind,
           owner_function, documented_usage, redirect_uris, web_origins, scopes,
           secret_credential_ref, secret_rotated_at, standard_flow_enabled,
           direct_access_grants_enabled, service_accounts_enabled, pkce_required,
           compliance_status, status, workflow_id, evidence
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
         RETURNING *`,
        [
          input.id,
          input.topologyId,
          input.realmId,
          input.tenantId,
          input.clientId,
          input.clientUuid,
          input.clientKind,
          input.ownerFunction,
          input.documentedUsage,
          JSON.stringify(input.redirectUris ?? []),
          JSON.stringify(input.webOrigins ?? []),
          JSON.stringify(input.scopes ?? []),
          input.secretCredentialRef,
          input.secretRotatedAt,
          input.standardFlowEnabled,
          input.directAccessGrantsEnabled,
          input.serviceAccountsEnabled,
          input.pkceRequired,
          input.complianceStatus,
          input.status,
          input.workflowId,
          JSON.stringify(input.evidence ?? {}),
        ],
        client,
      );
      return this.mapClient(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Technical client already registered in this realm');
    }
  }

  async listClients(topologyId: string, client?: unknown): Promise<KeycloakClientRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_keycloak_clients WHERE topology_id = $1 ORDER BY client_id`,
      [topologyId],
      client,
    );
    return rows.map((r) => this.mapClient(r));
  }

  async updateClient(
    id: string,
    patch: Partial<
      Pick<
        KeycloakClientRecord,
        'status' | 'clientUuid' | 'secretCredentialRef' | 'secretRotatedAt' | 'complianceStatus' | 'workflowId' | 'evidence'
      >
    >,
    expectedVersion: number,
    client?: unknown,
  ): Promise<KeycloakClientRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_keycloak_clients SET
         status = COALESCE($4, status),
         client_uuid = COALESCE($5, client_uuid),
         secret_credential_ref = COALESCE($6, secret_credential_ref),
         secret_rotated_at = COALESCE($7, secret_rotated_at),
         compliance_status = COALESCE($8, compliance_status),
         workflow_id = COALESCE($9, workflow_id),
         evidence = COALESCE($10, evidence),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $3
       RETURNING *`,
      [
        id,
        expectedVersion,
        expectedVersion,
        patch.status ?? null,
        patch.clientUuid ?? null,
        patch.secretCredentialRef ?? null,
        patch.secretRotatedAt ?? null,
        patch.complianceStatus ?? null,
        patch.workflowId ?? null,
        patch.evidence ? JSON.stringify(patch.evidence) : null,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapClient(rows[0]);
  }

  // -------------------------------------------------------------------------
  // OIDC configurations
  // -------------------------------------------------------------------------

  private mapOidc(row: Row): KeycloakOidcConfigurationRecord {
    return {
      id: str(row.id),
      topologyId: str(row.topology_id),
      realmId: str(row.realm_id),
      tenantId: str(row.tenant_id),
      issuer: str(row.issuer),
      authorizationEndpoint: strOrNull(row.authorization_endpoint),
      tokenEndpoint: str(row.token_endpoint),
      jwksUri: str(row.jwks_uri),
      userinfoEndpoint: strOrNull(row.userinfo_endpoint),
      endSessionEndpoint: strOrNull(row.end_session_endpoint),
      supportedScopes: asStrArray(row.supported_scopes),
      supportedResponseTypes: asStrArray(row.supported_response_types),
      supportedSigningAlgs: asStrArray(row.supported_signing_algs),
      discoveryDocument: asJson(row.discovery_document, {}),
      discoveryValidated: bool(row.discovery_validated),
      jwksValidated: bool(row.jwks_validated),
      validatedAt: asDateOrNull(row.validated_at),
      status: str(row.status),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  async createOidcConfiguration(
    input: Omit<KeycloakOidcConfigurationRecord, 'createdAt' | 'updatedAt'>,
    client?: unknown,
  ): Promise<KeycloakOidcConfigurationRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_keycloak_oidc_configurations (
           id, topology_id, realm_id, tenant_id, issuer, authorization_endpoint,
           token_endpoint, jwks_uri, userinfo_endpoint, end_session_endpoint,
           supported_scopes, supported_response_types, supported_signing_algs,
           discovery_document, discovery_validated, jwks_validated, validated_at, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING *`,
        [
          input.id,
          input.topologyId,
          input.realmId,
          input.tenantId,
          input.issuer,
          input.authorizationEndpoint,
          input.tokenEndpoint,
          input.jwksUri,
          input.userinfoEndpoint,
          input.endSessionEndpoint,
          JSON.stringify(input.supportedScopes ?? []),
          JSON.stringify(input.supportedResponseTypes ?? []),
          JSON.stringify(input.supportedSigningAlgs ?? []),
          JSON.stringify(input.discoveryDocument ?? {}),
          input.discoveryValidated,
          input.jwksValidated,
          input.validatedAt,
          input.status,
        ],
        client,
      );
      return this.mapOidc(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'OIDC configuration collision (issuer or topology)');
    }
  }

  async getOidcConfiguration(
    topologyId: string,
    client?: unknown,
  ): Promise<KeycloakOidcConfigurationRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_keycloak_oidc_configurations WHERE topology_id = $1`,
      [topologyId],
      client,
    );
    return rows[0] ? this.mapOidc(rows[0]) : null;
  }

  async updateOidcConfiguration(
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
  ): Promise<KeycloakOidcConfigurationRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_keycloak_oidc_configurations SET
         status = COALESCE($3, status),
         discovery_document = COALESCE($4, discovery_document),
         discovery_validated = COALESCE($5, discovery_validated),
         jwks_validated = COALESCE($6, jwks_validated),
         validated_at = COALESCE($7, validated_at),
         authorization_endpoint = COALESCE($8, authorization_endpoint),
         token_endpoint = COALESCE($9, token_endpoint),
         jwks_uri = COALESCE($10, jwks_uri),
         userinfo_endpoint = COALESCE($11, userinfo_endpoint),
         end_session_endpoint = COALESCE($12, end_session_endpoint),
         supported_scopes = COALESCE($13, supported_scopes),
         supported_response_types = COALESCE($14, supported_response_types),
         supported_signing_algs = COALESCE($15, supported_signing_algs),
         updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        '',
        patch.status ?? null,
        patch.discoveryDocument ? JSON.stringify(patch.discoveryDocument) : null,
        patch.discoveryValidated ?? null,
        patch.jwksValidated ?? null,
        patch.validatedAt ?? null,
        patch.authorizationEndpoint ?? null,
        patch.tokenEndpoint ?? null,
        patch.jwksUri ?? null,
        patch.userinfoEndpoint ?? null,
        patch.endSessionEndpoint ?? null,
        patch.supportedScopes ? JSON.stringify(patch.supportedScopes) : null,
        patch.supportedResponseTypes ? JSON.stringify(patch.supportedResponseTypes) : null,
        patch.supportedSigningAlgs ? JSON.stringify(patch.supportedSigningAlgs) : null,
      ],
      client,
    );
    if (!rows[0]) this.conflict();
    return this.mapOidc(rows[0]);
  }

  // -------------------------------------------------------------------------
  // References / health / reconciliation / history / evidence
  // -------------------------------------------------------------------------

  private mapReference(row: Row): KeycloakResourceReferenceRecord {
    return {
      id: str(row.id),
      topologyId: str(row.topology_id),
      tenantId: str(row.tenant_id),
      resourceKind: str(row.resource_kind) as KeycloakResourceReferenceRecord['resourceKind'],
      internalRef: str(row.internal_ref),
      externalId: str(row.external_id),
      externalKind: str(row.external_kind),
      verified: bool(row.verified),
      verifiedAt: asDateOrNull(row.verified_at),
      createdAt: asDate(row.created_at),
    };
  }

  async createResourceReference(
    input: Omit<KeycloakResourceReferenceRecord, 'id' | 'createdAt'>,
    client?: unknown,
  ): Promise<KeycloakResourceReferenceRecord> {
    try {
      const rows = await this.q(
        `INSERT INTO edge_p7_keycloak_resource_references (
           topology_id, tenant_id, resource_kind, internal_ref, external_id,
           external_kind, verified, verified_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [
          input.topologyId,
          input.tenantId,
          input.resourceKind,
          input.internalRef,
          input.externalId,
          input.externalKind,
          input.verified,
          input.verifiedAt,
        ],
        client,
      );
      return this.mapReference(rows[0]!);
    } catch (err) {
      this.rethrow(err, 'Resource reference already bound');
    }
  }

  async listResourceReferences(
    topologyId: string,
    client?: unknown,
  ): Promise<KeycloakResourceReferenceRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_keycloak_resource_references WHERE topology_id = $1 ORDER BY resource_kind`,
      [topologyId],
      client,
    );
    return rows.map((r) => this.mapReference(r));
  }

  private mapHealth(row: Row): KeycloakHealthCheckRecord {
    return {
      id: str(row.id),
      topologyId: strOrNull(row.topology_id),
      serverId: str(row.server_id),
      checkType: str(row.check_type),
      outcome: str(row.outcome) as KeycloakHealthCheckRecord['outcome'],
      latencyMs: row.latency_ms == null ? null : num(row.latency_ms),
      details: asJson(row.details, {}),
      checkedAt: asDate(row.checked_at),
    };
  }

  async createHealthCheck(
    input: Omit<KeycloakHealthCheckRecord, 'id'>,
    client?: unknown,
  ): Promise<KeycloakHealthCheckRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_keycloak_health_checks (
         topology_id, server_id, check_type, outcome, latency_ms, details, checked_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        input.topologyId,
        input.serverId,
        input.checkType,
        input.outcome,
        input.latencyMs,
        JSON.stringify(input.details ?? {}),
        input.checkedAt,
      ],
      client,
    );
    return this.mapHealth(rows[0]!);
  }

  async listHealthChecks(
    topologyId: string | null,
    serverId: string | null,
    limit: number,
    client?: unknown,
  ): Promise<KeycloakHealthCheckRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_keycloak_health_checks
       WHERE ($1::uuid IS NULL OR topology_id = $1)
         AND ($2::uuid IS NULL OR server_id = $2)
       ORDER BY checked_at DESC LIMIT $3`,
      [topologyId, serverId, Math.min(Math.max(limit, 1), 200)],
      client,
    );
    return rows.map((r) => this.mapHealth(r));
  }

  private mapReconciliation(row: Row): KeycloakReconciliationRunRecord {
    return {
      id: str(row.id),
      topologyId: str(row.topology_id),
      tenantId: str(row.tenant_id),
      workflowId: strOrNull(row.workflow_id),
      trigger: str(row.trigger),
      observedState: asJson(row.observed_state, {}),
      driftDetected: bool(row.drift_detected),
      driftClassification: strOrNull(row.drift_classification),
      driftDetails: asJson(row.drift_details, []),
      actionTaken: strOrNull(row.action_taken),
      outcome: str(row.outcome) as KeycloakReconciliationRunRecord['outcome'],
      startedAt: asDate(row.started_at),
      completedAt: asDateOrNull(row.completed_at),
    };
  }

  async createReconciliationRun(
    input: Omit<KeycloakReconciliationRunRecord, 'id' | 'startedAt' | 'completedAt'>,
    client?: unknown,
  ): Promise<KeycloakReconciliationRunRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_keycloak_reconciliation_runs (
         topology_id, tenant_id, workflow_id, trigger, observed_state, drift_detected,
         drift_classification, drift_details, action_taken, outcome
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        input.topologyId,
        input.tenantId,
        input.workflowId,
        input.trigger,
        JSON.stringify(input.observedState ?? {}),
        input.driftDetected,
        input.driftClassification,
        JSON.stringify(input.driftDetails ?? []),
        input.actionTaken,
        input.outcome,
      ],
      client,
    );
    return this.mapReconciliation(rows[0]!);
  }

  async completeReconciliationRun(
    id: string,
    patch: Partial<
      Pick<
        KeycloakReconciliationRunRecord,
        'observedState' | 'driftDetected' | 'driftClassification' | 'driftDetails' | 'actionTaken' | 'outcome' | 'completedAt'
      >
    >,
    client?: unknown,
  ): Promise<KeycloakReconciliationRunRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_keycloak_reconciliation_runs SET
         observed_state = COALESCE($2, observed_state),
         drift_detected = COALESCE($3, drift_detected),
         drift_classification = COALESCE($4, drift_classification),
         drift_details = COALESCE($5, drift_details),
         action_taken = COALESCE($6, action_taken),
         outcome = COALESCE($7, outcome),
         completed_at = COALESCE($8, NOW())
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.observedState ? JSON.stringify(patch.observedState) : null,
        patch.driftDetected ?? null,
        patch.driftClassification ?? null,
        patch.driftDetails ? JSON.stringify(patch.driftDetails) : null,
        patch.actionTaken ?? null,
        patch.outcome ?? null,
        patch.completedAt ?? null,
      ],
      client,
    );
    if (!rows[0]) this.notFound();
    return this.mapReconciliation(rows[0]);
  }

  async listReconciliationRuns(
    topologyId: string,
    limit: number,
    client?: unknown,
  ): Promise<KeycloakReconciliationRunRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_keycloak_reconciliation_runs
       WHERE topology_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [topologyId, Math.min(Math.max(limit, 1), 200)],
      client,
    );
    return rows.map((r) => this.mapReconciliation(r));
  }

  async appendHistory(
    input: Omit<KeycloakHistoryRecord, 'id' | 'createdAt'> & {
      topologyId?: string | null;
      workflowId?: string | null;
    },
    client?: unknown,
  ): Promise<void> {
    await this.q(
      `INSERT INTO edge_p7_keycloak_provisioning_history (
         resource_type, resource_id, topology_id, workflow_id, from_status, to_status,
         action, reason, actor_id, details
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        input.resourceType,
        input.resourceId,
        input.topologyId ?? null,
        input.workflowId ?? null,
        input.fromStatus,
        input.toStatus,
        input.action,
        input.reason,
        input.actorId,
        JSON.stringify(input.details ?? {}),
      ],
      client,
    );
  }

  async listHistory(
    resourceType: string,
    resourceId: string,
    limit = 50,
    client?: unknown,
  ): Promise<KeycloakHistoryRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_keycloak_provisioning_history
       WHERE resource_type = $1 AND resource_id = $2
       ORDER BY created_at DESC LIMIT $3`,
      [resourceType, resourceId, Math.min(Math.max(limit, 1), 200)],
      client,
    );
    return rows.map((r) => ({
      id: str(r.id),
      resourceType: str(r.resource_type),
      resourceId: str(r.resource_id),
      topologyId: strOrNull(r.topology_id),
      workflowId: strOrNull(r.workflow_id),
      fromStatus: strOrNull(r.from_status),
      toStatus: strOrNull(r.to_status),
      action: str(r.action),
      reason: strOrNull(r.reason),
      actorId: str(r.actor_id),
      details: asJson(r.details, {}),
      createdAt: asDate(r.created_at),
    }));
  }

  private mapEvidence(row: Row): KeycloakOperationEvidenceRecord {
    return {
      id: str(row.id),
      topologyId: str(row.topology_id),
      tenantId: str(row.tenant_id),
      workflowId: strOrNull(row.workflow_id),
      stepKey: strOrNull(row.step_key),
      operation: str(row.operation),
      outcome: str(row.outcome) as KeycloakOperationEvidenceRecord['outcome'],
      evidence: asJson(row.evidence, {}),
      errorCode: strOrNull(row.error_code),
      errorMessage: strOrNull(row.error_message),
      durationMs: row.duration_ms == null ? null : num(row.duration_ms),
      performedBy: strOrNull(row.performed_by),
      performedAt: asDate(row.performed_at),
    };
  }

  async createEvidence(
    input: Omit<KeycloakOperationEvidenceRecord, 'id' | 'performedAt'>,
    client?: unknown,
  ): Promise<KeycloakOperationEvidenceRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_keycloak_operation_evidence (
         topology_id, tenant_id, workflow_id, step_key, operation, outcome, evidence,
         error_code, error_message, duration_ms, performed_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        input.topologyId,
        input.tenantId,
        input.workflowId,
        input.stepKey,
        input.operation,
        input.outcome,
        JSON.stringify(input.evidence ?? {}),
        input.errorCode,
        input.errorMessage,
        input.durationMs,
        input.performedBy,
      ],
      client,
    );
    return this.mapEvidence(rows[0]!);
  }

  async listEvidence(
    topologyId: string,
    limit = 100,
    client?: unknown,
  ): Promise<KeycloakOperationEvidenceRecord[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_keycloak_operation_evidence
       WHERE topology_id = $1 ORDER BY performed_at DESC LIMIT $2`,
      [topologyId, Math.min(Math.max(limit, 1), 500)],
      client,
    );
    return rows.map((r) => this.mapEvidence(r));
  }

  private rethrow(err: unknown, message: string): never {
    const code = (err as { code?: string } | null)?.code;
    if (code === '23505') {
      throw new DomainError(ErrorCode.CONFLICT, message, [{ code: 'TOPOLOGY_COLLISION' }]);
    }
    if (code === '40001') {
      this.conflict();
    }
    throw err;
  }
}
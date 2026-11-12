import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { runTestcontainers } from '../helpers/testcontainers-env.js';
import { applyControlPlaneMigrations } from '../helpers/control-plane-migrate.js';
import { PgKeycloakRepository } from '../../src/modules/edge/infrastructure/keycloak/pg-keycloak.repository.js';
import { KEYCLOAK_TABLES, KeycloakTopologyStatus, KeycloakTopologyType } from '../../src/modules/edge/domain/keycloak-topology/keycloak.types.js';

const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe.skipIf(!runTestcontainers)('P7.7 Keycloak topology registry (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: pg.Pool;
  let repo: PgKeycloakRepository;
  let providerId: string;
  let serverId: string;
  let productId: string;
  let seq = 0;

  const cpDb = { getPool: () => pool };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    pool = new pg.Pool({ connectionString: container.getConnectionUri() });
    const result = await applyControlPlaneMigrations(pool);
    // Migration 102 must be part of the applied chain.
    expect(result.applied).toContain('102_edge_p7_keycloak_topology_provisioning');

    // All 14 mandated tables exist.
    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name LIKE 'edge_p7_keycloak_%'`,
    );
    const found = new Set(tables.rows.map((r) => r.table_name));
    for (const expected of KEYCLOAK_TABLES) {
      expect(found.has(expected)).toBe(true);
    }

    repo = new PgKeycloakRepository(cpDb as never);

    // Seeded provider from migration 102.
    const provider = await repo.getProviderByCode('keycloak-managed-v1');
    expect(provider).not.toBeNull();
    providerId = provider!.id;
    expect(provider!.supportedTopologyTypes).toContain('DEDICATED_REALM');
    expect(provider!.constraints).toMatchObject({ noBusinessUsers: true, noBusinessRoles: true });

    // Real product row (FK on edge_p7_keycloak_topologies.product_id).
    seq += 1;
    const vertical = randomUUID();
    productId = randomUUID();
    await pool.query(
      `INSERT INTO edge_verticals (id, code, slug, display_name, status)
       VALUES ($1,$2,$2,$3,'DRAFT')`,
      [vertical, `p77-v-${seq}`, `P77 V ${seq}`],
    );
    await pool.query(
      `INSERT INTO edge_products (id, code, slug, name, vertical_id, lifecycle_status, commercial_availability)
       VALUES ($1,$2,$2,$3,$4,'PUBLISHED','AVAILABLE')`,
      [productId, `p77-p-${seq}`, `Product ${seq}`, vertical],
    );

    const server = await repo.createServer(
      {
        id: randomUUID(),
        providerId,
        code: 'kc-test-1',
        name: 'Keycloak Test',
        baseUrl: 'https://keycloak.test.example',
        adminRealm: 'master',
        adminClientId: 'edge-admin',
        adminCredentialRef: 'sec_testadmin',
        tlsMode: 'REQUIRED',
        allowPrivateNetwork: false,
        environment: 'TEST',
        operationalStatus: 'ACTIVE',
        discoveredVersion: null,
        lastConnectivityStatus: null,
        lastConnectivityAt: null,
        metadata: {},
        createdBy: ACTOR,
        updatedBy: ACTOR,
      },
      ACTOR,
    );
    serverId = server.id;
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it('persists a topology with distinct internal vs external identity and versioning', async () => {
    const tenantId = randomUUID();
    const topology = await repo.createTopology(
      {
        id: randomUUID(),
        tenantId,
        productId,
        subscriptionId: null,
        authorizationId: randomUUID(),
        authorizationVersion: 1,
        placementDecisionId: null,
        deploymentProfileId: null,
        deploymentProfileVersion: null,
        runtimeProfileId: null,
        providerId,
        serverId,
        topologyType: KeycloakTopologyType.DEDICATED_REALM,
        realmRef: null,
        organizationRef: null,
        oidcConfigurationRef: null,
        externalRealmId: null,
        externalOrganizationId: null,
        keycloakVersion: null,
        desiredConfigVersion: 1,
        appliedConfigVersion: null,
        resourceFingerprint: null,
        status: KeycloakTopologyStatus.PLANNED,
        statusReason: null,
        lastHealthCheckAt: null,
        lastReconciliationAt: null,
        workflowId: null,
        deletionProtection: true,
        metadata: { resolvedRealmName: 'okapi-t-test' },
        createdBy: ACTOR,
        updatedBy: ACTOR,
      },
    );
    expect(topology.status).toBe(KeycloakTopologyStatus.PLANNED);
    expect(topology.version).toBe(1);

    // Optimistic locking: stale version must conflict.
    await expect(repo.updateTopology(topology.id, { status: 'PENDING' }, 999, ACTOR)).rejects.toThrow();
  });

  it('enforces active-topology uniqueness (tenant+product+type collision rejected)', async () => {
    const tenantId = randomUUID();
    const base = {
      id: randomUUID(),
      tenantId,
      productId,
      subscriptionId: null,
      authorizationId: null,
      authorizationVersion: null,
      placementDecisionId: null,
      deploymentProfileId: null,
      deploymentProfileVersion: null,
      runtimeProfileId: null,
      providerId,
      serverId,
      topologyType: KeycloakTopologyType.DEDICATED_REALM,
      realmRef: null,
      organizationRef: null,
      oidcConfigurationRef: null,
      externalRealmId: null,
      externalOrganizationId: null,
      keycloakVersion: null,
      desiredConfigVersion: 1,
      appliedConfigVersion: null,
      resourceFingerprint: null,
      status: KeycloakTopologyStatus.PLANNED,
      statusReason: null,
      lastHealthCheckAt: null,
      lastReconciliationAt: null,
      workflowId: null,
      deletionProtection: false,
      metadata: {},
      createdBy: ACTOR,
      updatedBy: ACTOR,
    };
    await repo.createTopology(base);
    await expect(
      repo.createTopology({ ...base, id: randomUUID() }),
    ).rejects.toThrow();
  });

  it('stores only opaque credential refs — never plaintext secrets', async () => {
    const servers = await repo.listServers();
    expect(servers.length).toBeGreaterThan(0);
    for (const s of servers) {
      // Opaque ref shape, not a raw secret.
      expect(s.adminCredentialRef ?? '').toMatch(/^(sec_.+|)$/);
      expect(JSON.stringify(s)).not.toContain('client_secret');
      expect(JSON.stringify(s)).not.toContain('password');
    }
    const dump = await pool.query(
      `SELECT row_to_json(t) FROM edge_p7_keycloak_servers t`,
    );
    const serialized = JSON.stringify(dump.rows);
    expect(serialized).not.toContain('secret-plaintext');
  });

  it('persists capability discovery atomically with server update', async () => {
    await repo.upsertCapabilities(
      {
        serverId,
        keycloakVersion: '26.0.7',
        features: { organizations: true },
        organizationsSupported: true,
        realmsSupported: true,
        adminApiReachable: true,
        discoverySource: 'ENDPOINT_PROBE',
        rawEvidence: { serverInfo: {} },
        verifiedAt: new Date(),
      },
      undefined,
    );
    const caps = await repo.getCapabilities(serverId);
    expect(caps?.organizationsSupported).toBe(true);
    expect(caps?.keycloakVersion).toBe('26.0.7');
  });

  it('persists operation evidence and history durably', async () => {
    const topologyId = randomUUID();
    const tenantId = randomUUID();
    const workflowId = randomUUID();
    const t = await repo.createTopology(
      {
        id: topologyId,
        tenantId,
        productId,
        subscriptionId: null,
        authorizationId: null,
        authorizationVersion: null,
        placementDecisionId: null,
        deploymentProfileId: null,
        deploymentProfileVersion: null,
        runtimeProfileId: null,
        providerId,
        serverId,
        topologyType: KeycloakTopologyType.DEDICATED_REALM,
        realmRef: null,
        organizationRef: null,
        oidcConfigurationRef: null,
        externalRealmId: null,
        externalOrganizationId: null,
        keycloakVersion: null,
        desiredConfigVersion: 1,
        appliedConfigVersion: null,
        resourceFingerprint: null,
        status: KeycloakTopologyStatus.PROVISIONING,
        statusReason: null,
        lastHealthCheckAt: null,
        lastReconciliationAt: null,
        workflowId,
        deletionProtection: false,
        metadata: {},
        createdBy: ACTOR,
        updatedBy: ACTOR,
      },
    );
    expect(t.id).toBe(topologyId);

    const evidence = await repo.createEvidence({
      topologyId,
      tenantId,
      workflowId,
      stepKey: 'topology_provision',
      operation: 'provision_realm',
      outcome: 'SUCCEEDED',
      evidence: { realmName: 'okapi-t-x' },
      errorCode: null,
      errorMessage: null,
      durationMs: 42,
      performedBy: ACTOR,
    });
    expect(evidence.outcome).toBe('SUCCEEDED');

    await repo.appendHistory(
      {
        resourceType: 'KEYCLOAK_TOPOLOGY',
        resourceId: topologyId,
        topologyId,
        workflowId,
        fromStatus: 'PLANNED',
        toStatus: 'PROVISIONING',
        action: 'PROVISION',
        reason: null,
        actorId: ACTOR,
        details: { step: 'topology_provision' },
      },
      undefined,
    );
    const history = await repo.listHistory('KEYCLOAK_TOPOLOGY', topologyId, 10);
    expect(history.length).toBeGreaterThanOrEqual(1);
    const evs = await repo.listEvidence(topologyId, 10);
    expect(evs.length).toBe(1);
  });

  it('records reconciliation runs with drift classification', async () => {
    const tenantId = randomUUID();
    const topologyId = randomUUID();
    await repo.createTopology(
      {
        id: topologyId,
        tenantId,
        productId,
        subscriptionId: null,
        authorizationId: null,
        authorizationVersion: null,
        placementDecisionId: null,
        deploymentProfileId: null,
        deploymentProfileVersion: null,
        runtimeProfileId: null,
        providerId,
        serverId,
        topologyType: KeycloakTopologyType.DEDICATED_REALM,
        realmRef: null,
        organizationRef: null,
        oidcConfigurationRef: null,
        externalRealmId: null,
        externalOrganizationId: null,
        keycloakVersion: null,
        desiredConfigVersion: 2,
        appliedConfigVersion: 1,
        resourceFingerprint: 'abc',
        status: KeycloakTopologyStatus.RECONCILIATION_REQUIRED,
        statusReason: null,
        lastHealthCheckAt: null,
        lastReconciliationAt: null,
        workflowId: null,
        deletionProtection: false,
        metadata: {},
        createdBy: ACTOR,
        updatedBy: ACTOR,
      },
    );
    const run = await repo.createReconciliationRun({
      topologyId,
      tenantId,
      workflowId: null,
      trigger: 'SCHEDULED',
      observedState: { realmExists: false },
      driftDetected: true,
      driftClassification: 'CRITICAL',
      driftDetails: [{ kind: 'REALM_MISSING' }],
      actionTaken: 'QUARANTINE_OR_SCHEDULE',
      outcome: 'PENDING',
    });
    await repo.completeReconciliationRun(run.id, { outcome: 'QUARANTINED', completedAt: new Date() });
    const runs = await repo.listReconciliationRuns(topologyId, 10);
    expect(runs[0]?.outcome).toBe('QUARANTINED');
  });

  it('rejects plaintext secret columns (schema guard)', async () => {
    const cols = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name IN ('edge_p7_keycloak_servers','edge_p7_keycloak_clients')
         AND (column_name LIKE '%secret%' OR column_name LIKE '%password%' OR column_name LIKE '%credential%')`,
    );
    expect(cols.rows.length).toBeGreaterThan(0);
    for (const c of cols.rows) {
      // Only opaque *ref* columns (and their rotation timestamp) are allowed.
      expect(
        c.column_name.endsWith('_ref') || c.column_name.endsWith('_rotated_at'),
      ).toBe(true);
    }
  });
});

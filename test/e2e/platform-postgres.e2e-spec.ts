import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import pg from 'pg';
import { setupTestDatabase } from '../helpers/test-database.js';
import { createTestJwtEnvironment } from '../helpers/test-jwt.js';
import { createIntegrationTestApp } from '../helpers/integration-test-app.js';
import {
  TENANT_A_ID,
  ORG_A1_ID,
  ORG_A2_ID,
  ORG_B1_ID,
  USER_A_ID,
} from '../helpers/test-constants.js';

import { runTestcontainers } from '../helpers/testcontainers-env.js';

describe.skipIf(!runTestcontainers)('Platform Core E2E (Postgres + JWT)', () => {
  let app: INestApplication;
  let dbEnv: Awaited<ReturnType<typeof setupTestDatabase>>;
  let jwtEnv: Awaited<ReturnType<typeof createTestJwtEnvironment>>;
  let token: string;

  beforeAll(async () => {
    dbEnv = await setupTestDatabase();
    jwtEnv = await createTestJwtEnvironment();

    token = await jwtEnv.signToken({
      sub: USER_A_ID,
      preferred_username: USER_A_ID,
      tenant_id: TENANT_A_ID,
      organization_id: ORG_A1_ID,
      organization: [ORG_A1_ID, ORG_A2_ID],
      permissions: ['platform:read'],
      roles: ['tenant-owner'],
    });

    app = await createIntegrationTestApp({
      jwtIssuer: jwtEnv.issuer,
      jwtJwksUri: jwtEnv.jwksUri,
      jwtAudience: jwtEnv.audience,
      dbHost: dbEnv.host,
      dbPort: dbEnv.port,
      dbPassword: dbEnv.password,
    });
  }, 300_000);

  afterAll(async () => {
    await app?.close();
    await jwtEnv?.stop();
    await dbEnv?.stop();
  });

  it('rejects requests without membership in tenant', async () => {
    const outsiderToken = await jwtEnv.signToken({
      sub: 'sub-b',
      preferred_username: 'user-b',
      tenant_id: TENANT_A_ID,
      organization_id: ORG_A1_ID,
      organization: [ORG_A1_ID],
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/platform/context')
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(res.status).toBe(403);
  });

  it('returns context for valid JWT with real DB membership', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/platform/context')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tenantId).toBe(TENANT_A_ID);
    expect(res.body.data.organizationId).toBe(ORG_A1_ID);
  });

  it('lists organizations from control plane DB', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/platform/organizations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('denies switch to organization from another tenant', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/platform/organizations/switch')
      .set('Authorization', `Bearer ${token}`)
      .send({ organizationId: ORG_B1_ID });

    expect(res.status).toBe(403);
  });

  it('emits outbox event and requires token refresh on organization switch', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/platform/organizations/switch')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'switch-org-a2-real-e2e')
      .send({ organizationId: ORG_A2_ID });

    expect(res.status).toBe(201);
    expect(res.body.data.organizationId).toBe(ORG_A2_ID);
    expect(res.body.data.requiresTokenRefresh).toBe(true);
    expect(res.body.data.tokenRefreshScope).toMatch(/^organization:/);

    const tenantPool = new pg.Pool({
      host: dbEnv.host,
      port: dbEnv.port,
      database: dbEnv.tenantADatabase,
      user: dbEnv.user,
      password: dbEnv.password,
    });

    const outbox = await tenantPool.query(
      `SELECT event_type FROM outbox_events WHERE status = 'PENDING' ORDER BY created_at DESC LIMIT 1`,
    );
    expect(outbox.rows[0]?.event_type).toBe('platform.organization.switched.v1');

    await tenantPool.end();
  });

  it('replays idempotent organization switch', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/platform/organizations/switch')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'switch-org-a2-real-e2e')
      .send({ organizationId: ORG_A2_ID });

    expect(res.status).toBe(201);
    expect(res.body.data.organizationId).toBe(ORG_A2_ID);
  });
});

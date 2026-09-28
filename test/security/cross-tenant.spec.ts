import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from '../test-app.js';
import { JwtValidationService } from '../../src/shared/auth/jwt-validation.service.js';
import { TENANT_REGISTRY_PORT } from '../../src/modules/identity/domain/ports/tenant-registry.port.js';
import { USER_TENANT_MEMBERSHIP_PORT } from '../../src/modules/identity/domain/ports/user-tenant-membership.port.js';
import { TenantDatabaseManager } from '../../src/shared/database/tenant-database.manager.js';
import { TenantStatus } from '../../src/modules/identity/domain/tenant/tenant.entity.js';
import { ACCESS_DENIED_MESSAGE } from '../../src/core/domain/errors/access-denied.js';
import { authorizationTestProviders } from '../helpers/authorization-mocks.js';

const TENANT_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORG_A1_ID = '11111111-1111-4111-8111-111111111111';
const USER_A_SUB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001';

describe('Security: Cross-tenant access on Identity routes', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.CONTROL_PLANE_DB_PASSWORD = 'test';
    process.env.NODE_ENV = 'test';

    app = await createTestApp([
      ...authorizationTestProviders(TENANT_A_ID, USER_A_SUB, ORG_A1_ID, ['viewer']),
      {
        provide: JwtValidationService,
        useValue: {
          validateToken: async () => ({
            subjectId: USER_A_SUB,
            userId: USER_A_SUB,
            username: 'user-a',
            tenantId: TENANT_A_ID,
            keycloakOrganizationIds: [],
            keycloakOrganizationAliases: [],
            jwtActiveOrganizationRef: null,
            roles: ['user'],
            permissions: ['tenant:read', 'organizations:read', 'memberships:read'],
            clientId: 'platform-api',
            locale: 'en',
            timezone: 'UTC',
            authenticationAcr: null,
            authenticationMethods: [],
          }),
        },
      },
      {
        provide: TENANT_REGISTRY_PORT,
        useValue: {
          findById: async (id: string) => {
            if (id === TENANT_A_ID) {
              return {
                id: TENANT_A_ID,
                slug: 'tenant-a',
                status: TenantStatus.ACTIVE,
                database: {
                  host: 'localhost',
                  port: 5433,
                  name: 'tenant_a',
                  username: null,
                  credentialsReference: 'TENANT_DB_PASSWORD',
                },
                region: 'eu-west-1',
                environment: 'test',
                createdAt: new Date(),
                updatedAt: new Date(),
              };
            }
            return null;
          },
          findBySlug: async () => null,
        },
      },
      {
        provide: USER_TENANT_MEMBERSHIP_PORT,
        useValue: {
          isMember: async (userId: string, tenantId: string) =>
            userId === USER_A_SUB && tenantId === TENANT_A_ID,
        },
      },
      {
        provide: TenantDatabaseManager,
        useValue: {
          healthCheck: async () => ({ controlPlane: true, tenantPools: 0 }),
          getControlPlanePool: () => ({ query: async () => ({ rows: [] }) }),
          getPool: async () => ({ query: async () => ({ rows: [] }) }),
          onModuleDestroy: async () => {},
        },
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('denies tenant profile read for tenant B with JWT tenant A', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${TENANT_B_ID}`)
      .set('Authorization', 'Bearer token-tenant-a');

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe(ACCESS_DENIED_MESSAGE);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from '../test-app.js';
import { JwtValidationService } from '../../src/shared/auth/jwt-validation.service.js';
import { TENANT_REGISTRY_PORT } from '../../src/modules/identity/domain/ports/tenant-registry.port.js';
import { ORGANIZATION_REPOSITORY_PORT } from '../../src/modules/identity/domain/ports/organization-repository.port.js';
import { OutboxTransactionService } from '../../src/shared/messaging/outbox-transaction.service.js';
import { USER_TENANT_MEMBERSHIP_PORT } from '../../src/modules/identity/domain/ports/user-tenant-membership.port.js';
import { TenantDatabaseManager } from '../../src/shared/database/tenant-database.manager.js';
import { TenantStatus } from '../../src/modules/identity/domain/tenant/tenant.entity.js';
import { OrganizationStatus } from '../../src/modules/identity/domain/organization/organization.entity.js';
import { ACCESS_DENIED_MESSAGE } from '../../src/core/domain/errors/access-denied.js';
import { authorizationTestProviders } from '../helpers/authorization-mocks.js';

const TENANT_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORG_A1_ID = '11111111-1111-4111-8111-111111111111';
const ORG_A2_ID = '22222222-2222-4222-8222-222222222222';
const ORG_B1_ID = '33333333-3333-4333-8333-333333333333';
const USER_A_SUB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001';

describe('Security: Cross-tenant isolation', () => {
  let app: INestApplication;

  const mockTenantRegistry = {
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
  };

  const mockOrganizationRepository = {
    findById: async (tenantId: string, orgId: string) => {
      const orgs: Record<string, { tenantId: string; id: string; name: string }> = {
        [ORG_A1_ID]: { tenantId: TENANT_A_ID, id: ORG_A1_ID, name: 'Org A1' },
        [ORG_A2_ID]: { tenantId: TENANT_A_ID, id: ORG_A2_ID, name: 'Org A2' },
        [ORG_B1_ID]: { tenantId: TENANT_B_ID, id: ORG_B1_ID, name: 'Org B1' },
      };
      const org = orgs[orgId];
      if (!org || org.tenantId !== tenantId) return null;
      return {
        id: org.id,
        tenantId: org.tenantId,
        keycloakOrganizationId: `kc-${org.id}`,
        name: org.name,
        slug: org.name.toLowerCase().replace(' ', '-'),
        status: OrganizationStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    findByKeycloakId: async () => null,
    findByUserMembership: async (tenantId: string, userId: string) => {
      if (userId !== USER_A_SUB) return [];
      if (tenantId === TENANT_A_ID) {
        return [
          {
            id: ORG_A1_ID,
            tenantId: TENANT_A_ID,
            keycloakOrganizationId: 'kc-a1',
            name: 'Org A1',
            slug: 'org-a1',
            status: OrganizationStatus.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: ORG_A2_ID,
            tenantId: TENANT_A_ID,
            keycloakOrganizationId: 'kc-a2',
            name: 'Org A2',
            slug: 'org-a2',
            status: OrganizationStatus.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      }
      return [];
    },
  };

  beforeAll(async () => {
    process.env.CONTROL_PLANE_DB_PASSWORD = 'test';
    process.env.NODE_ENV = 'test';

    app = await createTestApp([
      ...authorizationTestProviders(TENANT_A_ID, USER_A_SUB, ORG_A1_ID, ['tenant-owner']),
      {
        provide: JwtValidationService,
        useValue: {
          validateToken: async (token: string) => {
            if (token === 'token-tenant-a') {
              return {
                subjectId: USER_A_SUB,
                userId: USER_A_SUB,
                username: 'user-a',
                tenantId: TENANT_A_ID,
                keycloakOrganizationIds: ['kc-a1', 'kc-a2'],
                keycloakOrganizationAliases: ['org-a1', 'org-a2'],
                jwtActiveOrganizationRef: ORG_A1_ID,
                roles: ['user'],
                permissions: ['platform:read', 'platform:organizations:read'],
                clientId: 'platform-api',
                locale: 'en',
                timezone: 'UTC',
              };
            }
            throw new Error('Invalid token');
          },
        },
      },
      { provide: TENANT_REGISTRY_PORT, useValue: mockTenantRegistry },
      { provide: ORGANIZATION_REPOSITORY_PORT, useValue: mockOrganizationRepository },
      {
        provide: OutboxTransactionService,
        useValue: {
          runWithOutbox: async (
            _tenantId: string,
            fn: (client: unknown, enqueue: (event: unknown) => Promise<string>) => Promise<unknown>,
          ) => fn({ query: async () => ({ rows: [] }) }, async () => 'outbox-id'),
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

  it('User A → Organization B1 via switch = DENIED (generic message)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/platform/organizations/switch')
      .set('Authorization', 'Bearer token-tenant-a')
      .send({ organizationId: ORG_B1_ID });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe(ACCESS_DENIED_MESSAGE);
  });

  it('User A can switch to Organization A2 within tenant A', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/platform/organizations/switch')
      .set('Authorization', 'Bearer token-tenant-a')
      .send({ organizationId: ORG_A2_ID });
    expect(res.status).toBe(201);
    expect(res.body.data.organizationId).toBe(ORG_A2_ID);
  });
});

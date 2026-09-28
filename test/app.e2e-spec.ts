import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.js';
import { JwtValidationService } from '../src/shared/auth/jwt-validation.service.js';
import { TENANT_REGISTRY_PORT } from '../src/modules/identity/domain/ports/tenant-registry.port.js';
import { ORGANIZATION_REPOSITORY_PORT } from '../src/modules/identity/domain/ports/organization-repository.port.js';
import { OutboxTransactionService } from '../src/shared/messaging/outbox-transaction.service.js';
import { USER_TENANT_MEMBERSHIP_PORT } from '../src/modules/identity/domain/ports/user-tenant-membership.port.js';
import { TenantDatabaseManager } from '../src/shared/database/tenant-database.manager.js';
import { TenantStatus } from '../src/modules/identity/domain/tenant/tenant.entity.js';
import { OrganizationStatus } from '../src/modules/identity/domain/organization/organization.entity.js';
import { ACCESS_DENIED_MESSAGE } from '../src/core/domain/errors/access-denied.js';
import { APPLICATION_USER_REPOSITORY_PORT } from '../src/modules/identity/domain/ports/application-user-repository.port.js';
import { TOKEN_REVOCATION_PORT } from '../src/core/domain/ports/token-revocation.port.js';
import { authorizationTestProviders } from './helpers/authorization-mocks.js';

const TENANT_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORG_A1_ID = '11111111-1111-4111-8111-111111111111';
const ORG_A2_ID = '22222222-2222-4222-8222-222222222222';
const ORG_B1_ID = '33333333-3333-4333-8333-333333333333';
const USER_A_SUB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001';

describe('Platform Core E2E', () => {
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
      if (id === TENANT_B_ID) {
        return {
          id: TENANT_B_ID,
          slug: 'tenant-b',
          status: TenantStatus.ACTIVE,
          database: {
            host: 'localhost',
            port: 5434,
            name: 'tenant_b',
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
      const page = await mockOrganizationRepository.findByUserMembershipPage!(
        tenantId,
        userId,
        1,
        100,
      );
      return page.items;
    },
    findByUserMembershipPage: async (tenantId: string, userId: string, page: number, limit: number) => {
      if (userId !== USER_A_SUB) return { items: [], total: 0 };
      if (tenantId !== TENANT_A_ID) return { items: [], total: 0 };
      const items = [
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
      const offset = (page - 1) * limit;
      return { items: items.slice(offset, offset + limit), total: items.length };
    },
  };

  beforeAll(async () => {
    process.env.CONTROL_PLANE_DB_PASSWORD = 'test';
    process.env.NODE_ENV = 'test';

    app = await createTestApp([
      ...authorizationTestProviders(TENANT_A_ID, USER_A_SUB, ORG_A1_ID, ['viewer']),
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
                authenticationAcr: null,
                authenticationMethods: [],
                tokenIssuedAt: 1_700_000_000,
                tokenId: 'e2e-jti-1',
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
      {
        provide: APPLICATION_USER_REPOSITORY_PORT,
        useValue: { findByIdentity: async () => null },
      },
      {
        provide: TOKEN_REVOCATION_PORT,
        useValue: {
          isRevoked: async () => false,
          revokeAllTokensForSubject: async () => {},
          revokeTokenByJti: async () => {},
        },
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health endpoints', () => {
    it('GET /liveness should return ok', async () => {
      const res = await request(app.getHttpServer()).get('/liveness');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Authentication', () => {
    it('should reject unauthenticated requests', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/platform/context');
      expect(res.status).toBe(401);
    });

    it('should accept valid JWT for tenant A', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/platform/context')
        .set('Authorization', 'Bearer token-tenant-a');
      expect(res.status).toBe(200);
      expect(res.body.data.tenantId).toBe(TENANT_A_ID);
      expect(res.body.data.userId).toBe(USER_A_SUB);
    });
  });

  describe('Multi-tenant isolation', () => {
    it('User A → Tenant A → Organization A1 = OK', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/platform/context')
        .set('Authorization', 'Bearer token-tenant-a');
      expect(res.status).toBe(200);
      expect(res.body.data.tenantId).toBe(TENANT_A_ID);
      expect(res.body.data.organizationId).toBe(ORG_A1_ID);
    });

    it('User A → Tenant A → list organizations = OK', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/platform/organizations')
        .set('Authorization', 'Bearer token-tenant-a');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('User A → Organization B1 via switch = DENIED', async () => {
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

  describe('Error format', () => {
    it('should return standardized error response', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/platform/context');
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBeDefined();
      expect(res.body.error.requestId).toBeDefined();
    });
  });
});

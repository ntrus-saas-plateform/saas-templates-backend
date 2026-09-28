import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from '../test-app.js';
import { JwtValidationService } from '../../src/shared/auth/jwt-validation.service.js';
import { TENANT_REGISTRY_PORT } from '../../src/modules/identity/domain/ports/tenant-registry.port.js';
import { USER_TENANT_MEMBERSHIP_PORT } from '../../src/modules/identity/domain/ports/user-tenant-membership.port.js';
import { CONTROL_PLANE_TRANSACTION_PORT } from '../../src/modules/identity/domain/ports/control-plane-transaction.port.js';
import { TENANT_ADMIN_PORT } from '../../src/modules/identity/domain/ports/tenant-admin.port.js';
import { TenantDatabaseManager } from '../../src/shared/database/tenant-database.manager.js';
import { TenantStatus } from '../../src/modules/identity/domain/tenant/tenant.entity.js';
import { authorizationTestProviders } from '../helpers/authorization-mocks.js';

const TENANT_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORG_A1_ID = '11111111-1111-4111-8111-111111111111';
const USER_A_SUB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001';
const NEW_OWNER_SUB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('Security: Step-up authentication', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.CONTROL_PLANE_DB_PASSWORD = 'test';
    process.env.NODE_ENV = 'test';

    app = await createTestApp([
      ...authorizationTestProviders(TENANT_A_ID, USER_A_SUB, ORG_A1_ID, ['tenant-owner']),
      {
        provide: JwtValidationService,
        useValue: {
          validateToken: async (token: string) => ({
            subjectId: USER_A_SUB,
            userId: USER_A_SUB,
            username: 'user-a',
            tenantId: TENANT_A_ID,
            keycloakOrganizationIds: [],
            keycloakOrganizationAliases: [],
            jwtActiveOrganizationRef: null,
            roles: ['user'],
            permissions: ['tenant:ownership_transfer'],
            clientId: 'platform-api',
            locale: 'en',
            timezone: 'UTC',
            authenticationAcr: token === 'token-step-up' ? '1' : null,
            authenticationMethods: token === 'token-step-up' ? ['mfa'] : [],
          }),
        },
      },
      {
        provide: TENANT_REGISTRY_PORT,
        useValue: {
          findById: async (id: string) =>
            id === TENANT_A_ID
              ? {
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
                }
              : null,
          findBySlug: async () => null,
        },
      },
      {
        provide: USER_TENANT_MEMBERSHIP_PORT,
        useValue: {
          isMember: async (userId: string, tenantId: string) =>
            userId === USER_A_SUB && tenantId === TENANT_A_ID,
          ensureMember: async () => {},
        },
      },
      {
        provide: CONTROL_PLANE_TRANSACTION_PORT,
        useValue: {
          runInTransaction: async (fn: (client: unknown) => Promise<unknown>) => fn({}),
        },
      },
      {
        provide: TENANT_ADMIN_PORT,
        useValue: {
          getOwnerIdentityId: async () => USER_A_SUB,
          transferOwnership: async () => true,
          updateProfile: async () => {
            throw new Error('not used');
          },
          transitionStatus: async () => {
            throw new Error('not used');
          },
          setOwner: async () => {},
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

  it('denies ownership transfer without step-up acr', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${TENANT_A_ID}/ownership/transfer`)
      .set('Authorization', 'Bearer token-no-step-up')
      .send({ newOwnerIdentityId: NEW_OWNER_SUB });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Step-up');
  });

  it('allows ownership transfer with elevated acr', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${TENANT_A_ID}/ownership/transfer`)
      .set('Authorization', 'Bearer token-step-up')
      .send({ newOwnerIdentityId: NEW_OWNER_SUB });

    expect(res.status).toBe(201);
    expect(res.body.data.ownerIdentityId).toBe(NEW_OWNER_SUB);
  });
});

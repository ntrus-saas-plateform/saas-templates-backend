import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.js';
import { JwtValidationService } from '../src/shared/auth/jwt-validation.service.js';
import { TENANT_DATABASE_PROVISIONER_PORT } from '../src/core/domain/ports/tenant-provisioning.port.js';
import { TENANT_REGISTRY_PORT } from '../src/modules/identity/domain/ports/tenant-registry.port.js';
import { TENANT_ADMIN_PORT } from '../src/modules/identity/domain/ports/tenant-admin.port.js';
import { USER_TENANT_MEMBERSHIP_PORT } from '../src/modules/identity/domain/ports/user-tenant-membership.port.js';
import { ORGANIZATION_ADMIN_PORT } from '../src/modules/identity/domain/ports/organization-admin.port.js';
import { MEMBERSHIP_REPOSITORY_PORT } from '../src/modules/identity/domain/ports/membership-repository.port.js';
import { KEYCLOAK_ADMIN_PORT } from '../src/modules/identity/domain/ports/keycloak-admin.port.js';
import { APPLICATION_USER_REPOSITORY_PORT } from '../src/modules/identity/domain/ports/application-user-repository.port.js';
import { TOKEN_REVOCATION_PORT } from '../src/core/domain/ports/token-revocation.port.js';
import { AUDIT_WRITER_PORT } from '../src/core/domain/ports/audit.port.js';
import { TenantStatus, TenantProvisioningStep } from '../src/modules/identity/domain/tenant/tenant.entity.js';
import { ControlPlaneOutboxTransactionService } from '../src/shared/messaging/control-plane-outbox-transaction.service.js';
import { authorizationTestProviders } from './helpers/authorization-mocks.js';

const TENANT_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PLATFORM_ADMIN_SUB = 'platform-admin-sub';
const NEW_TENANT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const IDEMPOTENCY_KEY = 'test-idempotency-key-1234';

const makeTenantA = () => ({
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
  legalName: null,
  displayName: null,
  description: null,
  logoUrl: null,
  country: null,
  timezone: 'UTC',
  locale: 'en',
  defaultCurrency: 'EUR',
  defaultLanguage: 'en',
  dateFormat: 'YYYY-MM-DD',
  numberFormat: '1,234.56',
  planReference: null,
  keycloakRealm: null,
  provisioningStep: TenantProvisioningStep.READY,
  failureReason: null,
  failureStep: null,
  lastAttemptAt: null,
  retryCount: 0,
  defaultOrganizationId: null,
  provisionIdempotencyKey: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeNewTenant = (step: TenantProvisioningStep | null = null, status = TenantStatus.PROVISIONING) => ({
  id: NEW_TENANT_ID,
  slug: 'new-tenant-e2e',
  status,
  database: {
    host: 'localhost',
    port: 5433,
    name: 'tenant_new_tenant_e2e',
    username: 't_new_tenant_e2e_app',
    credentialsReference: 'TENANT_DB_PASSWORD',
  },
  region: 'eu-west-1',
  environment: 'test',
  legalName: null,
  displayName: null,
  description: null,
  logoUrl: null,
  country: null,
  timezone: 'UTC',
  locale: 'en',
  defaultCurrency: 'EUR',
  defaultLanguage: 'en',
  dateFormat: 'YYYY-MM-DD',
  numberFormat: '1,234.56',
  planReference: null,
  keycloakRealm: null,
  provisioningStep: step,
  failureReason: null,
  failureStep: null,
  lastAttemptAt: null,
  retryCount: 0,
  defaultOrganizationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  provisionIdempotencyKey: IDEMPOTENCY_KEY,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('Platform Admin E2E', () => {
  let app: INestApplication;

  const mockProvisioner = {
    registerTenant: async (_input: { slug: string; databaseName?: string; provisionIdempotencyKey?: string }) => ({
      tenantId: NEW_TENANT_ID,
      created: true,
    }),
    createDatabaseInfrastructure: async (_tenantId: string) => ({
      databaseName: 'tenant_new_tenant_e2e',
      databaseUsername: 't_new_tenant_e2e_app',
    }),
    migrateAndGrant: async (_tenantId: string) => {},
    provision: async (input: { slug: string; databaseName?: string }) => ({
      tenantId: NEW_TENANT_ID,
      databaseName: input.databaseName ?? `tenant_${input.slug.replace(/-/g, '_')}`,
      databaseUsername: `t_${input.slug.replace(/-/g, '_')}_app`,
      status: 'ACTIVE' as const,
    }),
    deprovision: async () => {},
  };

  const mockOrganizationAdmin = {
    create: async () => ({
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      tenantId: NEW_TENANT_ID,
      keycloakOrganizationId: 'kc-placeholder',
      name: 'new-tenant-e2e',
      slug: 'new-tenant-e2e',
      status: 'ACTIVE',
      description: null,
      timezone: null,
      locale: null,
      address: {},
      contact: {},
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  };

  // Track progress state for updateProvisioningProgress
  let currentTenantState = makeNewTenant();

  const mockTenantAdmin = {
    findById: async (id: string) => {
      if (id === TENANT_A_ID) return makeTenantA();
      if (id === NEW_TENANT_ID) return currentTenantState;
      return null;
    },
    findByProvisionIdempotencyKey: async (key: string) => {
      if (key === IDEMPOTENCY_KEY && currentTenantState.id) return currentTenantState;
      return null;
    },
    updateProvisioningProgress: async (_tenantId: string, update: Record<string, unknown>) => {
      currentTenantState = { ...currentTenantState, ...update } as typeof currentTenantState;
      return currentTenantState;
    },
    updateProfile: async () => makeTenantA(),
    transitionStatus: async () => makeTenantA(),
    getOwnerIdentityId: async () => null,
    setOwner: async () => {},
    transferOwnership: async () => true,
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.CONTROL_PLANE_DB_PASSWORD = 'test';

    // Reset state before tests
    currentTenantState = makeNewTenant();

    app = await createTestApp([
      {
        provide: JwtValidationService,
        useValue: {
          validateToken: async (token: string) => {
            if (token === 'token-platform-admin') {
              return {
                subjectId: PLATFORM_ADMIN_SUB,
                userId: PLATFORM_ADMIN_SUB,
                username: 'platform-admin',
                tenantId: TENANT_A_ID,
                keycloakOrganizationIds: [],
                keycloakOrganizationAliases: [],
                jwtActiveOrganizationRef: null,
                roles: ['platform-admin'],
                permissions: [],
                clientId: 'platform-admin',
                locale: 'en',
                timezone: 'UTC',
                authenticationAcr: null,
                authenticationMethods: [],
                tokenIssuedAt: 1_700_000_000,
                tokenId: 'admin-jti-1',
              };
            }
            throw new Error('Invalid token');
          },
        },
      },
      {
        provide: TENANT_REGISTRY_PORT,
        useValue: {
          findById: async (id: string) => (id === TENANT_A_ID ? makeTenantA() : null),
          findBySlug: async () => null,
          listActiveTenantIds: async () => [TENANT_A_ID],
        },
      },
      { provide: TENANT_DATABASE_PROVISIONER_PORT, useValue: mockProvisioner },
      { provide: ORGANIZATION_ADMIN_PORT, useValue: mockOrganizationAdmin },
      { provide: MEMBERSHIP_REPOSITORY_PORT, useValue: { create: async () => ({}) } },
      { provide: KEYCLOAK_ADMIN_PORT, useValue: { isAvailable: async () => false } },
      { provide: TENANT_ADMIN_PORT, useValue: mockTenantAdmin },
      {
        provide: USER_TENANT_MEMBERSHIP_PORT,
        useValue: {
          ensureMember: async () => {},
          isMember: async (userId: string, tenantId: string) =>
            userId === PLATFORM_ADMIN_SUB && tenantId === TENANT_A_ID,
        },
      },
      { provide: APPLICATION_USER_REPOSITORY_PORT, useValue: { findByIdentity: async () => null } },
      {
        provide: TOKEN_REVOCATION_PORT,
        useValue: {
          isRevoked: async () => false,
          revokeAllTokensForSubject: async () => {},
          revokeTokenByJti: async () => {},
        },
      },
      { provide: AUDIT_WRITER_PORT, useValue: { write: async () => {} } },
      {
        provide: ControlPlaneOutboxTransactionService,
        useValue: {
          runWithOutbox: async (_tenantId: string, fn: (client: unknown, enqueue: unknown) => Promise<unknown>) => {
            return fn(null, async () => 'mock-event-id');
          },
        },
      },
      ...authorizationTestProviders(
        TENANT_A_ID,
        PLATFORM_ADMIN_SUB,
        '11111111-1111-4111-8111-111111111111',
        ['platform-admin'],
      ),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/admin/tenants provisions tenant for platform-admin', async () => {
    // Reset state
    currentTenantState = makeNewTenant();

    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/tenants')
      .set('Authorization', 'Bearer token-platform-admin')
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({ slug: 'new-tenant-e2e' });

    expect(res.status).toBe(201);
    expect(res.body.data.tenantId).toBe(NEW_TENANT_ID);
    expect(res.body.data.defaultOrganizationId).toBe('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  });

  it('POST /api/v1/admin/tenants returns 400 without Idempotency-Key', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/tenants')
      .set('Authorization', 'Bearer token-platform-admin')
      .send({ slug: 'new-tenant-e2e' });

    expect(res.status).toBe(400);
  });

  it('DELETE /api/v1/admin/tenants/:id soft-deprovisions', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/admin/tenants/${NEW_TENANT_ID}`)
      .set('Authorization', 'Bearer token-platform-admin');

    expect(res.status).toBe(200);
    expect(res.body.data.tenantId).toBe(NEW_TENANT_ID);
    expect(res.body.data.hard).toBe(false);
  });

  it('rejects tenant provision without platform-admin role', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/tenants')
      .set('Authorization', 'Bearer invalid')
      .send({ slug: 'denied' });

    expect(res.status).toBe(401);
  });
});

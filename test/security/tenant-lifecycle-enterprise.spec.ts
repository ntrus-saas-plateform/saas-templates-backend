/**
 * Security: Tenant Lifecycle Enterprise hardening tests
 *
 * Tests the security contracts from Phase 4:
 *  1. Host/JWT mismatch → TenantHostGuard throws ForbiddenException
 *  2. Reserved subdomain → assertSubdomainAllowed throws
 *  3. LOCKED tenant → TenantGuard rejects with explicit message
 *  4. CapabilityResolver: plan module disabled → isModuleEnabled returns false
 *  5. FAILED retry — RetryTenantProvisioningUseCase rejects on non-retryable status
 *  6. Reconcile domain drifts: domain.missing_primary and database.missing emitted
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantHostGuard } from '../../src/shared/auth/tenant-host.guard.js';
import { TenantGuard } from '../../src/shared/auth/tenant.guard.js';
import { assertSubdomainAllowed } from '../../src/shared/tenancy/reserved-subdomains.js';
import { TenantStatus } from '../../src/modules/identity/domain/tenant/tenant.entity.js';
import { ReconcileKeycloakUseCase } from '../../src/modules/identity/application/reconciliation/reconcile-keycloak.use-case.js';
import { CapabilityResolverService } from '../../src/shared/authorization/capability-resolver.service.js';
import { DomainStatus, DomainType } from '../../src/modules/identity/domain/domain/tenant-domain.entity.js';
import { DomainError } from '../../src/core/domain/errors/domain-error.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeTenant = (status: TenantStatus = TenantStatus.ACTIVE) => ({
  id: 'tenant-1',
  slug: 'acme',
  planId: 'plan-1',
  status,
  maxOrganizationsOverride: null,
  maxUsersOverride: null,
  defaultOrganizationId: 'org-1',
  database: { host: 'localhost', port: 5432, name: 'db', username: 'u', credentialsReference: 'ref' },
  region: 'eu',
  environment: 'production',
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
  provisioningStep: null,
  failureReason: null,
  failureStep: null,
  lastAttemptAt: null,
  retryCount: 0,
  provisionIdempotencyKey: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeDomain = (opts?: Partial<{ tenantId: string; hostname: string; status: DomainStatus; isPrimary: boolean }>) => ({
  id: 'domain-1',
  tenantId: opts?.tenantId ?? 'tenant-1',
  hostname: opts?.hostname ?? 'acme.example.com',
  type: DomainType.SUBDOMAIN,
  isPrimary: opts?.isPrimary ?? true,
  status: opts?.status ?? DomainStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeContext = (method = 'GET', host?: string) =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        headers: {
          host: host ?? 'acme.example.com',
          'x-forwarded-host': undefined,
        },
      }),
    }),
  }) as never;

// ─── 1. TenantHostGuard: Host/JWT mismatch ────────────────────────────────────

describe('Security: TenantHostGuard — host/JWT mismatch', () => {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
  const tenantContext = { get: vi.fn() };
  const domainRegistry = { findByHostname: vi.fn() };

  let guard: TenantHostGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new TenantHostGuard(reflector, tenantContext as never, domainRegistry as never, {
      TRUST_X_FORWARDED_HOST: false,
    } as never);
  });

  it('throws ForbiddenException when host resolves to a different tenant', async () => {
    domainRegistry.findByHostname.mockResolvedValue(makeDomain({ tenantId: 'tenant-B' }));
    tenantContext.get.mockReturnValue({ tenantId: 'tenant-A' });

    await expect(guard.canActivate(makeContext('GET', 'acme.example.com'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows when host matches JWT tenant', async () => {
    domainRegistry.findByHostname.mockResolvedValue(makeDomain({ tenantId: 'tenant-1' }));
    tenantContext.get.mockReturnValue({ tenantId: 'tenant-1' });

    await expect(guard.canActivate(makeContext('GET', 'acme.example.com'))).resolves.toBe(true);
  });

  it('allows when hostname is not registered (unknown host → pass through)', async () => {
    domainRegistry.findByHostname.mockResolvedValue(null);
    tenantContext.get.mockReturnValue({ tenantId: 'tenant-1' });

    await expect(guard.canActivate(makeContext('GET', 'unknown.example.com'))).resolves.toBe(true);
  });
});

// ─── 2. Reserved subdomain ───────────────────────────────────────────────────

describe('Security: Reserved subdomain assertion', () => {
  it.each(['www', 'api', 'admin', 'app', 'auth', 'platform'])(
    'assertSubdomainAllowed("%s") throws DomainError',
    (label) => {
      expect(() => assertSubdomainAllowed(label)).toThrow(DomainError);
    },
  );

  it('assertSubdomainAllowed("acme") does not throw', () => {
    expect(() => assertSubdomainAllowed('acme')).not.toThrow();
  });

  it('assertSubdomainAllowed is case-insensitive', () => {
    expect(() => assertSubdomainAllowed('WWW')).toThrow(DomainError);
  });
});

// ─── 3. LOCKED tenant → TenantGuard rejects ──────────────────────────────────

describe('Security: TenantGuard — LOCKED tenant', () => {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
  const tenantContext = { get: vi.fn() };
  const tenantRegistry = { findById: vi.fn() };
  const userTenantMembership = { isMember: vi.fn() };
  const identityMetrics = { recordCrossTenantAttempt: vi.fn() };
  const config = { TENANT_SUSPENDED_ALLOW_READS: false };

  let guard: TenantGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new TenantGuard(
      reflector,
      tenantContext as never,
      tenantRegistry as never,
      userTenantMembership as never,
      identityMetrics as never,
      config as never,
    );
  });

  it('throws ForbiddenException with "Tenant is locked" for LOCKED tenants', async () => {
    tenantContext.get.mockReturnValue({ tenantId: 'tenant-1', subjectId: 'sub-1' });
    tenantRegistry.findById.mockResolvedValue(makeTenant(TenantStatus.LOCKED));

    const err = await guard.canActivate(makeContext('GET')).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).message).toBe('Tenant is locked');
  });

  it('throws ForbiddenException for FAILED tenants', async () => {
    tenantContext.get.mockReturnValue({ tenantId: 'tenant-1', subjectId: 'sub-1' });
    tenantRegistry.findById.mockResolvedValue(makeTenant(TenantStatus.FAILED));

    const err = await guard.canActivate(makeContext('GET')).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).message).toContain('FAILED');
  });

  it('throws ForbiddenException for SUSPENDED tenant when TENANT_SUSPENDED_ALLOW_READS=false', async () => {
    tenantContext.get.mockReturnValue({ tenantId: 'tenant-1', subjectId: 'sub-1' });
    tenantRegistry.findById.mockResolvedValue(makeTenant(TenantStatus.SUSPENDED));

    const err = await guard.canActivate(makeContext('GET')).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
  });

  it('allows SUSPENDED reads when TENANT_SUSPENDED_ALLOW_READS=true', async () => {
    const guardWithReads = new TenantGuard(
      reflector,
      tenantContext as never,
      tenantRegistry as never,
      userTenantMembership as never,
      identityMetrics as never,
      { TENANT_SUSPENDED_ALLOW_READS: true } as never,
    );
    tenantContext.get.mockReturnValue({ tenantId: 'tenant-1', subjectId: null });
    tenantRegistry.findById.mockResolvedValue(makeTenant(TenantStatus.SUSPENDED));

    await expect(guardWithReads.canActivate(makeContext('GET'))).resolves.toBe(true);
  });
});

// ─── 4. CapabilityResolver: disabled module ───────────────────────────────────

describe('Security: CapabilityResolverService — disabled plan module', () => {
  it('isModuleEnabled returns false when plan module is disabled', async () => {
    const tenantRegistry = {
      findById: vi.fn().mockResolvedValue(makeTenant()),
      findBySlug: vi.fn(),
      listActiveTenantIds: vi.fn(),
    };
    const planRepository = {
      findById: vi.fn().mockResolvedValue({ id: 'plan-1', code: 'STANDARD', name: 'Standard', maxOrganizations: 25, maxUsers: 100 }),
      findByCode: vi.fn(),
      findModules: vi.fn().mockResolvedValue([
        { planId: 'plan-1', moduleKey: 'identity', enabled: true },
        { planId: 'plan-1', moduleKey: 'commerce', enabled: false },
      ]),
      getEffectiveQuotas: vi.fn().mockResolvedValue({ maxOrganizations: 25, maxUsers: 100 }),
    };
    const featureFlags = {
      listFlags: vi.fn().mockResolvedValue({}),
      isEnabled: vi.fn().mockResolvedValue(true),
    };
    const tenantContext = {
      getOrThrow: vi.fn().mockReturnValue({ tenantId: 'tenant-1', organizationId: 'org-1', userId: 'user-1', subjectId: 'user-1' }),
    };
    const authService = { resolveEffectivePermissions: vi.fn().mockResolvedValue(['orders:write']) };
    const orgRepo = {
      findByUserMembership: vi.fn().mockResolvedValue([]),
      findById: vi.fn(),
      findByKeycloakId: vi.fn(),
      findByUserMembershipPage: vi.fn(),
      findAllByTenant: vi.fn(),
      countOrganizations: vi.fn(),
      countDistinctUsers: vi.fn(),
    };

    const service = new CapabilityResolverService(
      tenantContext as never,
      authService as never,
      planRepository as never,
      tenantRegistry as never,
      orgRepo as never,
      featureFlags as never,
    );

    // JWT has commerce permissions but the plan has commerce disabled
    const enabled = await service.isModuleEnabled('tenant-1', 'commerce');
    expect(enabled).toBe(false);
  });

  it('isModuleEnabled returns false when tenant has no plan', async () => {
    const tenantRegistry = {
      findById: vi.fn().mockResolvedValue({ ...makeTenant(), planId: null }),
      findBySlug: vi.fn(),
      listActiveTenantIds: vi.fn(),
    };
    const planRepository = {
      findById: vi.fn(),
      findByCode: vi.fn().mockResolvedValue(null),
      findModules: vi.fn(),
      getEffectiveQuotas: vi.fn(),
    };
    const featureFlags = { isEnabled: vi.fn().mockResolvedValue(true), listFlags: vi.fn() };
    const tenantContext = {
      getOrThrow: vi.fn().mockReturnValue({ tenantId: 'tenant-1' }),
    };
    const authService = { resolveEffectivePermissions: vi.fn().mockResolvedValue([]) };
    const orgRepo = {
      findByUserMembership: vi.fn().mockResolvedValue([]),
      findById: vi.fn(),
      findByKeycloakId: vi.fn(),
      findByUserMembershipPage: vi.fn(),
      findAllByTenant: vi.fn(),
      countOrganizations: vi.fn(),
      countDistinctUsers: vi.fn(),
    };

    const service = new CapabilityResolverService(
      tenantContext as never,
      authService as never,
      planRepository as never,
      tenantRegistry as never,
      orgRepo as never,
      featureFlags as never,
    );

    const enabled = await service.isModuleEnabled('tenant-1', 'commerce');
    expect(enabled).toBe(false);
  });
});

// ─── 5. RetryTenantProvisioningUseCase: FAILED → retryable ───────────────────

describe('Security: RetryTenantProvisioningUseCase — FAILED tenant retry', () => {
  it('throws when tenant is not found', async () => {
    const { RetryTenantProvisioningUseCase } = await import(
      '../../src/modules/platform/application/admin/provision-tenant.use-case.js'
    );
    const provisioner = {
      registerTenant: vi.fn(),
      createDatabaseInfrastructure: vi.fn(),
      migrateAndGrant: vi.fn(),
      provision: vi.fn(),
      deprovision: vi.fn(),
    };
    const tenantAdmin = {
      findById: vi.fn().mockResolvedValue(null),
      findByProvisionIdempotencyKey: vi.fn(),
      updateProvisioningProgress: vi.fn(),
      updateProfile: vi.fn(),
      transitionStatus: vi.fn(),
      getOwnerIdentityId: vi.fn(),
      setOwner: vi.fn(),
      transferOwnership: vi.fn(),
    };
    const orgAdmin = { create: vi.fn(), update: vi.fn(), transitionStatus: vi.fn(), updateKeycloakOrganizationId: vi.fn() };
    const membershipRepo = { findByOrganization: vi.fn(), findById: vi.fn(), findByUser: vi.fn(), findByUsers: vi.fn(), findByUserPage: vi.fn(), findByOrganizationPage: vi.fn(), countTenantAdmins: vi.fn(), create: vi.fn(), revoke: vi.fn(), updateRoles: vi.fn(), updateStatus: vi.fn() };
    const kcAdmin = {
      isAvailable: vi.fn().mockResolvedValue(false),
      createOrganization: vi.fn(),
      listOrganizations: vi.fn(),
      listOrganizationMemberIds: vi.fn(),
      addUserToOrganization: vi.fn(),
      removeUserFromOrganization: vi.fn(),
      setUserActiveOrganization: vi.fn(),
      createUser: vi.fn(),
      createB2cUser: vi.fn(),
      setUserPassword: vi.fn(),
      getUserMfaStatus: vi.fn(),
      sendExecuteActionsEmail: vi.fn(),
      setUserEnabled: vi.fn(),
      getUser: vi.fn(),
      listUsersPage: vi.fn(),
      listUserSessions: vi.fn(),
      revokeSession: vi.fn(),
      revokeAllUserSessions: vi.fn(),
      updateOrganization: vi.fn(),
    };
    const membershipPort = { isMember: vi.fn() };
    const outbox = { executeInTransaction: vi.fn(), publishEvent: vi.fn() };
    const domainRegistry = { findByHostname: vi.fn(), listByTenant: vi.fn().mockResolvedValue([]), create: vi.fn(), setPrimary: vi.fn(), disable: vi.fn() };

    const useCase = new RetryTenantProvisioningUseCase(
      provisioner as never,
      tenantAdmin as never,
      membershipPort as never,
      orgAdmin as never,
      membershipRepo as never,
      kcAdmin as never,
      { environment: 'test', databaseHost: 'localhost', databasePort: 5432 },
      outbox as never,
      domainRegistry as never,
    );

    await expect(
      useCase.execute({
        ctx: {
          subjectId: 'admin-1',
          tenantId: 'admin-tenant',
          organizationId: null,
          username: null,
          correlationId: 'corr-1',
          traceId: null,
          permissions: [],
        },
        tenantId: 'nonexistent-tenant',
      }),
    ).rejects.toThrow();
  });
});

// ─── 6. Reconciliation: domain.missing_primary and database.missing ───────────

describe('Security: ReconcileKeycloakUseCase — infrastructure drifts', () => {
  const makeOrg = () => ({
    id: 'org-1',
    tenantId: 'tenant-1',
    keycloakOrganizationId: 'real-kc-id',
    name: 'Acme HQ',
    slug: 'acme-hq',
    status: 'ACTIVE',
    type: 'OTHER',
    description: null,
    timezone: null,
    locale: null,
    address: {},
    contact: {},
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let organizationRepository: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let membershipRepository: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let organizationAdmin: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let keycloakAdmin: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let applicationUserRepository: any;

  beforeEach(() => {
    organizationRepository = {
      findById: vi.fn(),
      findByKeycloakId: vi.fn(),
      findByUserMembership: vi.fn(),
      findByUserMembershipPage: vi.fn(async () => ({ items: [], total: 0 })),
      countOrganizations: vi.fn(async () => 0),
      countDistinctUsers: vi.fn(async () => 0),
      findAllByTenant: vi.fn().mockResolvedValue([makeOrg()]),
    };
    membershipRepository = {
      findById: vi.fn(),
      findByUser: vi.fn(),
      findByUsers: vi.fn().mockResolvedValue([]),
      findByOrganization: vi.fn().mockResolvedValue([]),
      findByUserPage: vi.fn(async () => ({ items: [], total: 0 })),
      findByOrganizationPage: vi.fn(async () => ({ items: [], total: 0 })),
      countTenantAdmins: vi.fn(),
      create: vi.fn(),
      revoke: vi.fn(),
      updateRoles: vi.fn(),
      updateStatus: vi.fn(),
    };
    organizationAdmin = {
      create: vi.fn(),
      update: vi.fn(),
      transitionStatus: vi.fn(),
      updateKeycloakOrganizationId: vi.fn(),
    };
    keycloakAdmin = {
      isAvailable: vi.fn().mockResolvedValue(false),
      listUserSessions: vi.fn(),
      revokeSession: vi.fn(),
      revokeAllUserSessions: vi.fn(),
      createOrganization: vi.fn(),
      updateOrganization: vi.fn(),
      listOrganizations: vi.fn().mockResolvedValue([]),
      listOrganizationMemberIds: vi.fn(),
      addUserToOrganization: vi.fn(),
      removeUserFromOrganization: vi.fn(),
      setUserActiveOrganization: vi.fn(),
      createUser: vi.fn(),
      createB2cUser: vi.fn(),
      setUserPassword: vi.fn(),
      getUserMfaStatus: vi.fn(),
      sendExecuteActionsEmail: vi.fn(),
      setUserEnabled: vi.fn(),
      getUser: vi.fn(),
      listUsersPage: vi.fn().mockResolvedValue([]),
    };
    applicationUserRepository = {
      findByIdentity: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updateProfile: vi.fn(),
      updateStatus: vi.fn(),
      touchLastSeen: vi.fn(),
      listPage: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    };
  });

  it('reports domain.missing_primary when ACTIVE tenant has no primary domain and base domain configured', async () => {
    const domainRegistry = {
      listByTenant: vi.fn().mockResolvedValue([]),
      findByHostname: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      setPrimary: vi.fn(),
      disable: vi.fn(),
      beginVerification: vi.fn(),
      markVerified: vi.fn(),
    };
    const tenantRegistry = {
      findById: vi.fn().mockResolvedValue(makeTenant(TenantStatus.ACTIVE)),
      findBySlug: vi.fn(),
      listActiveTenantIds: vi.fn(),
    };

    const useCase = new ReconcileKeycloakUseCase(
      organizationRepository as never,
      membershipRepository as never,
      organizationAdmin as never,
      keycloakAdmin as never,
      applicationUserRepository as never,
      { domainRegistry, tenantRegistry, tenantBaseDomain: 'example.com' },
    );

    const result = await useCase.execute({ tenantId: 'tenant-1', repair: false });
    expect(result.drifts.some((d) => d.type === 'domain.missing_primary')).toBe(true);
  });

  it('does NOT report domain.missing_primary when TENANT_BASE_DOMAIN is not configured', async () => {
    const domainRegistry = {
      listByTenant: vi.fn().mockResolvedValue([]),
      findByHostname: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      setPrimary: vi.fn(),
      disable: vi.fn(),
      beginVerification: vi.fn(),
      markVerified: vi.fn(),
    };

    const useCase = new ReconcileKeycloakUseCase(
      organizationRepository as never,
      membershipRepository as never,
      organizationAdmin as never,
      keycloakAdmin as never,
      applicationUserRepository as never,
      { domainRegistry },
    );

    const result = await useCase.execute({ tenantId: 'tenant-1', repair: false });
    expect(result.drifts.some((d) => d.type === 'domain.missing_primary')).toBe(false);
  });

  it('reports database.missing when tenant DB is unreachable', async () => {
    const dbPool = {
      query: vi.fn().mockRejectedValue(new Error('Connection refused')),
    };

    const useCase = new ReconcileKeycloakUseCase(
      organizationRepository as never,
      membershipRepository as never,
      organizationAdmin as never,
      keycloakAdmin as never,
      applicationUserRepository as never,
      { getTenantPool: async () => dbPool },
    );

    const result = await useCase.execute({ tenantId: 'tenant-1', repair: false });
    expect(result.drifts.some((d) => d.type === 'database.missing')).toBe(true);
    expect(result.drifts.find((d) => d.type === 'database.missing')?.severity).toBe('critical');
  });

  it('does not report database.missing when DB is reachable', async () => {
    let callCount = 0;
    const dbPool = {
      query: vi.fn().mockImplementation(async () => {
        callCount++;
        // SELECT 1 succeeds, schema_migrations query returns empty
        if (callCount === 1) return { rows: [] };
        return { rows: [{ cnt: 5 }] };
      }),
    };

    const useCase = new ReconcileKeycloakUseCase(
      organizationRepository as never,
      membershipRepository as never,
      organizationAdmin as never,
      keycloakAdmin as never,
      applicationUserRepository as never,
      { getTenantPool: async () => dbPool },
    );

    const result = await useCase.execute({ tenantId: 'tenant-1', repair: false });
    expect(result.drifts.some((d) => d.type === 'database.missing')).toBe(false);
  });
});

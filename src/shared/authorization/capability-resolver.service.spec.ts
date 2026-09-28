import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CapabilityResolverService } from './capability-resolver.service.js';
import { OrganizationStatus, OrganizationType } from '../../modules/identity/domain/organization/organization.entity.js';

const makeTenant = (planId: string | null = 'plan-1') => ({
  id: 'tenant-1',
  slug: 'acme',
  planId,
  maxOrganizationsOverride: null,
  maxUsersOverride: null,
  defaultOrganizationId: 'org-1',
  status: 'ACTIVE' as const,
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

const makePlan = () => ({
  id: 'plan-1',
  code: 'STANDARD',
  name: 'Standard',
  maxOrganizations: 25,
  maxUsers: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeOrg = () => ({
  id: 'org-1',
  tenantId: 'tenant-1',
  keycloakOrganizationId: 'kc-org-1',
  name: 'Acme HQ',
  slug: 'acme-hq',
  status: OrganizationStatus.ACTIVE,
  type: OrganizationType.STORE,
  description: null,
  timezone: null,
  locale: null,
  address: {},
  contact: {},
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('CapabilityResolverService', () => {
  let service: CapabilityResolverService;
  let tenantContext: ReturnType<typeof makeTenantContextMock>;
  let authService: ReturnType<typeof makeAuthServiceMock>;
  let planRepo: ReturnType<typeof makePlanRepoMock>;
  let tenantRegistry: ReturnType<typeof makeTenantRegistryMock>;
  let orgRepo: ReturnType<typeof makeOrgRepoMock>;
  let featureFlags: ReturnType<typeof makeFeatureFlagsMock>;

  function makeTenantContextMock() {
    return {
      getOrThrow: vi.fn().mockReturnValue({
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        userId: 'user-1',
        subjectId: 'user-1',
      }),
      get: vi.fn(),
      set: vi.fn(),
    };
  }

  function makeAuthServiceMock() {
    return {
      resolveEffectivePermissions: vi.fn().mockResolvedValue(['users:read', 'orders:write']),
      hasAnyPermission: vi.fn(),
    };
  }

  function makePlanRepoMock() {
    return {
      findById: vi.fn().mockResolvedValue(makePlan()),
      findByCode: vi.fn(),
      findModules: vi.fn().mockResolvedValue([
        { planId: 'plan-1', moduleKey: 'identity', enabled: true },
        { planId: 'plan-1', moduleKey: 'commerce', enabled: false },
        { planId: 'plan-1', moduleKey: 'pharmacy', enabled: false },
        { planId: 'plan-1', moduleKey: 'platform', enabled: true },
      ]),
      getEffectiveQuotas: vi.fn().mockResolvedValue({ maxOrganizations: 25, maxUsers: 100 }),
      countOrganizations: vi.fn().mockResolvedValue(3),
      countDistinctUsers: vi.fn().mockResolvedValue(10),
    };
  }

  function makeTenantRegistryMock() {
    return {
      findById: vi.fn().mockResolvedValue(makeTenant()),
      findBySlug: vi.fn(),
      listActiveTenantIds: vi.fn(),
    };
  }

  function makeOrgRepoMock() {
    return {
      findByUserMembership: vi.fn().mockResolvedValue([makeOrg()]),
      findById: vi.fn(),
      findByKeycloakId: vi.fn(),
      findByUserMembershipPage: vi.fn(),
      findAllByTenant: vi.fn(),
      countOrganizations: vi.fn(),
      countDistinctUsers: vi.fn(),
    };
  }

  function makeFeatureFlagsMock() {
    return {
      isEnabled: vi.fn().mockResolvedValue(true),
      listFlags: vi.fn().mockResolvedValue({}),
      listFlagsPage: vi.fn(),
    };
  }

  beforeEach(() => {
    tenantContext = makeTenantContextMock();
    authService = makeAuthServiceMock();
    planRepo = makePlanRepoMock();
    tenantRegistry = makeTenantRegistryMock();
    orgRepo = makeOrgRepoMock();
    featureFlags = makeFeatureFlagsMock();

    service = new CapabilityResolverService(
      tenantContext as any,
      authService as any,
      planRepo as any,
      tenantRegistry as any,
      orgRepo as any,
      featureFlags as any,
    );
  });

  describe('resolveForCurrentUser', () => {
    it('returns plan info, modules, permissions, and organizations', async () => {
      const snapshot = await service.resolveForCurrentUser();

      expect(snapshot.plan).toMatchObject({ code: 'STANDARD', name: 'Standard' });
      expect(snapshot.permissions).toContain('users:read');
      expect(snapshot.capabilityMap['users:read']).toBe(true);
      expect(snapshot.organizations).toHaveLength(1);
      expect(snapshot.organizations[0]).toMatchObject({
        id: 'org-1',
        type: OrganizationType.STORE,
      });
      expect(snapshot.defaultOrganizationId).toBe('org-1');
    });

    it('disables module when plan has it disabled even if user has related permission', async () => {
      // commerce module is disabled in plan; user has orders:write
      const snapshot = await service.resolveForCurrentUser();

      expect(snapshot.modules['commerce']).toBe(false);
    });

    it('excludes disabled modules from navigationHints', async () => {
      // commerce disabled, pharmacy disabled — only identity and platform are enabled
      // user has users:read → identity matches; user has no platform: perm → platform excluded
      const snapshot = await service.resolveForCurrentUser();

      expect(snapshot.navigationHints).toContain('identity');
      expect(snapshot.navigationHints).not.toContain('commerce');
      expect(snapshot.navigationHints).not.toContain('pharmacy');
    });

    it('returns empty plan when tenant has no planId', async () => {
      tenantRegistry.findById.mockResolvedValue(makeTenant(null));

      const snapshot = await service.resolveForCurrentUser();

      expect(snapshot.plan).toBeNull();
      expect(snapshot.modules).toEqual({});
    });

    it('applies feature flag to module enablement', async () => {
      // identity module enabled in plan, but feature flag disables it
      featureFlags.isEnabled.mockImplementation(async (key: string) => {
        if (key === 'module.identity') return false;
        return true;
      });
      featureFlags.listFlags.mockResolvedValue({ 'module.identity': false });

      const snapshot = await service.resolveForCurrentUser();

      expect(snapshot.modules['identity']).toBe(false);
      expect(snapshot.navigationHints).not.toContain('identity');
    });
  });

  describe('isModuleEnabled', () => {
    it('returns true for an enabled module with no blocking flag', async () => {
      const result = await service.isModuleEnabled('tenant-1', 'identity');
      expect(result).toBe(true);
    });

    it('returns false for a disabled module even if feature flag is enabled', async () => {
      const result = await service.isModuleEnabled('tenant-1', 'commerce');
      expect(result).toBe(false);
    });

    it('falls back to STANDARD plan when tenant has no planId', async () => {
      tenantRegistry.findById.mockResolvedValue(makeTenant(null));
      planRepo.findByCode.mockResolvedValue({
        id: 'plan-1',
        code: 'STANDARD',
        name: 'Standard',
        maxOrganizations: 25,
        maxUsers: 100,
      });
      const result = await service.isModuleEnabled('tenant-1', 'identity');
      expect(planRepo.findByCode).toHaveBeenCalledWith('STANDARD');
      expect(result).toBe(true);
    });

    it('returns false when no planId and STANDARD plan missing', async () => {
      tenantRegistry.findById.mockResolvedValue(makeTenant(null));
      planRepo.findByCode.mockResolvedValue(null);
      const result = await service.isModuleEnabled('tenant-1', 'identity');
      expect(result).toBe(false);
    });

    it('returns false when feature flag disables an otherwise-enabled module', async () => {
      featureFlags.isEnabled.mockResolvedValue(false);
      const result = await service.isModuleEnabled('tenant-1', 'identity');
      expect(result).toBe(false);
    });
  });

  describe('assertModuleEnabled', () => {
    it('resolves without error for enabled module', async () => {
      await expect(service.assertModuleEnabled('tenant-1', 'identity')).resolves.toBeUndefined();
    });

    it('throws DomainError for disabled module', async () => {
      const { DomainError } = await import('../../core/domain/errors/domain-error.js');
      await expect(service.assertModuleEnabled('tenant-1', 'commerce')).rejects.toBeInstanceOf(DomainError);
    });
  });
});

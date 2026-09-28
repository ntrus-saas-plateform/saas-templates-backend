import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantHostGuard } from './tenant-host.guard.js';
import type { DomainRegistryPort } from '../../modules/identity/domain/ports/domain-registry.port.js';
import type { TenantDomain } from '../../modules/identity/domain/domain/tenant-domain.entity.js';
import { DomainType, DomainStatus } from '../../modules/identity/domain/domain/tenant-domain.entity.js';

const makeDomain = (overrides: Partial<TenantDomain> = {}): TenantDomain => ({
  id: 'domain-1',
  tenantId: 'tenant-a',
  hostname: 'acme.example.com',
  type: DomainType.SUBDOMAIN,
  isPrimary: true,
  status: DomainStatus.ACTIVE,
  verificationToken: null,
  verificationMethod: 'DNS_TXT',
  verifiedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

function makeContext(host: string | undefined, tenantId: string | null = 'tenant-a') {
  const request = { headers: { host } };
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
    _tenantId: tenantId,
  };
}

describe('TenantHostGuard', () => {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;

  let domainRegistry: DomainRegistryPort;
  let tenantContext: { get: ReturnType<typeof vi.fn> };
  let guard: TenantHostGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    domainRegistry = {
      findByHostname: vi.fn(),
      findById: vi.fn(),
      listByTenant: vi.fn(),
      create: vi.fn(),
      setPrimary: vi.fn(),
      disable: vi.fn(),
      beginVerification: vi.fn(),
      markVerified: vi.fn(),
    };
    tenantContext = { get: vi.fn() };
  });

  const buildGuard = (trustForwardedHost = false) =>
    new TenantHostGuard(reflector, tenantContext as never, domainRegistry, {
      TRUST_X_FORWARDED_HOST: trustForwardedHost,
    } as never);

  it('allows public routes without any lookup', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValueOnce(true); // IS_PUBLIC
    guard = buildGuard();
    const result = await guard.canActivate(makeContext('acme.example.com') as never);
    expect(result).toBe(true);
    expect(domainRegistry.findByHostname).not.toHaveBeenCalled();
  });

  it('enforces host binding on customer routes when tenant is set', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false); // not public
    tenantContext.get.mockReturnValue({ tenantId: 'tenant-b' });
    vi.mocked(domainRegistry.findByHostname).mockResolvedValue(makeDomain({ tenantId: 'tenant-a' }));
    guard = buildGuard();
    await expect(guard.canActivate(makeContext('acme.example.com') as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows customer routes when host tenant matches JWT tenant', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    tenantContext.get.mockReturnValue({ tenantId: 'tenant-a' });
    vi.mocked(domainRegistry.findByHostname).mockResolvedValue(makeDomain({ tenantId: 'tenant-a' }));
    guard = buildGuard();
    await expect(guard.canActivate(makeContext('acme.example.com') as never)).resolves.toBe(true);
  });

  it('allows requests with no Host header (internal/tooling calls)', async () => {
    tenantContext.get.mockReturnValue({ tenantId: 'tenant-a' });
    guard = buildGuard();
    const result = await guard.canActivate(makeContext(undefined) as never);
    expect(result).toBe(true);
    expect(domainRegistry.findByHostname).not.toHaveBeenCalled();
  });

  it('allows requests from localhost (no domain mapping required)', async () => {
    tenantContext.get.mockReturnValue({ tenantId: 'tenant-a' });
    guard = buildGuard();
    const result = await guard.canActivate(makeContext('localhost:3000') as never);
    expect(result).toBe(true);
    expect(domainRegistry.findByHostname).not.toHaveBeenCalled();
  });

  it('allows requests from an IP address', async () => {
    tenantContext.get.mockReturnValue({ tenantId: 'tenant-a' });
    guard = buildGuard();
    const result = await guard.canActivate(makeContext('127.0.0.1:3000') as never);
    expect(result).toBe(true);
    expect(domainRegistry.findByHostname).not.toHaveBeenCalled();
  });

  it('allows requests when hostname is not registered (unknown host)', async () => {
    tenantContext.get.mockReturnValue({ tenantId: 'tenant-a' });
    vi.mocked(domainRegistry.findByHostname).mockResolvedValue(null);
    guard = buildGuard();
    const result = await guard.canActivate(makeContext('unknown.example.com') as never);
    expect(result).toBe(true);
  });

  it('allows requests when hostname matches the JWT tenant', async () => {
    tenantContext.get.mockReturnValue({ tenantId: 'tenant-a' });
    vi.mocked(domainRegistry.findByHostname).mockResolvedValue(makeDomain({ tenantId: 'tenant-a' }));
    guard = buildGuard();
    const result = await guard.canActivate(makeContext('acme.example.com') as never);
    expect(result).toBe(true);
  });

  it('denies requests when hostname resolves to a different tenant (cross-tenant attack)', async () => {
    tenantContext.get.mockReturnValue({ tenantId: 'tenant-b' });
    vi.mocked(domainRegistry.findByHostname).mockResolvedValue(makeDomain({ tenantId: 'tenant-a' }));
    guard = buildGuard();
    await expect(guard.canActivate(makeContext('acme.example.com') as never)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('normalises the hostname (strips port, lowercases)', async () => {
    tenantContext.get.mockReturnValue({ tenantId: 'tenant-a' });
    vi.mocked(domainRegistry.findByHostname).mockResolvedValue(makeDomain({ tenantId: 'tenant-a' }));
    guard = buildGuard();
    await guard.canActivate(makeContext('ACME.EXAMPLE.COM:443') as never);
    expect(domainRegistry.findByHostname).toHaveBeenCalledWith('acme.example.com');
  });

  it('ignores client X-Forwarded-Host when TRUST_X_FORWARDED_HOST is false', async () => {
    tenantContext.get.mockReturnValue({ tenantId: 'tenant-a' });
    vi.mocked(domainRegistry.findByHostname).mockResolvedValue(makeDomain({ tenantId: 'tenant-a' }));
    guard = buildGuard(false);
    const ctx = makeContext('localhost:3000') as {
      switchToHttp: () => { getRequest: () => { headers: Record<string, string> } };
      getHandler: () => object;
      getClass: () => object;
    };
    ctx.switchToHttp = () => ({
      getRequest: () => ({
        headers: {
          host: 'localhost:3000',
          'x-forwarded-host': 'acme.example.com',
        },
      }),
    });
    const result = await guard.canActivate(ctx as never);
    expect(result).toBe(true);
    expect(domainRegistry.findByHostname).not.toHaveBeenCalled();
  });

  it('uses X-Forwarded-Host when TRUST_X_FORWARDED_HOST is true', async () => {
    tenantContext.get.mockReturnValue({ tenantId: 'tenant-b' });
    vi.mocked(domainRegistry.findByHostname).mockResolvedValue(makeDomain({ tenantId: 'tenant-a' }));
    guard = buildGuard(true);
    const ctx = makeContext('localhost:3000') as {
      switchToHttp: () => { getRequest: () => { headers: Record<string, string> } };
      getHandler: () => object;
      getClass: () => object;
    };
    ctx.switchToHttp = () => ({
      getRequest: () => ({
        headers: {
          host: 'localhost:3000',
          'x-forwarded-host': 'acme.example.com',
        },
      }),
    });
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(ForbiddenException);
    expect(domainRegistry.findByHostname).toHaveBeenCalledWith('acme.example.com');
  });
});

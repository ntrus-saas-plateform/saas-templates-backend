import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { TenantGuard } from './tenant.guard.js';
import { TenantStatus } from '../../modules/identity/domain/tenant/tenant.entity.js';
import { DomainError, ErrorCode } from '../../core/domain/errors/domain-error.js';
import { ACCESS_DENIED_MESSAGE } from '../../core/domain/errors/access-denied.js';

describe('TenantGuard', () => {
  const reflector = { getAllAndOverride: vi.fn() } as unknown as Reflector;
  const tenantContext = { get: vi.fn() };
  const tenantRegistry = { findById: vi.fn() };
  const userTenantMembership = { isMember: vi.fn() };
  const identityMetrics = { recordCrossTenantAttempt: vi.fn() };

  const makeConfig = (overrides?: { TENANT_SUSPENDED_ALLOW_READS?: boolean }) => ({
    TENANT_SUSPENDED_ALLOW_READS: false,
    ...overrides,
  });

  let guard: TenantGuard;

  const createContext = (method = 'GET') =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ method }),
      }),
    }) as never;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new TenantGuard(
      reflector,
      tenantContext as never,
      tenantRegistry as never,
      userTenantMembership as never,
      identityMetrics as never,
      makeConfig() as never,
    );
  });

  it('allows public routes', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(true);
    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it('denies when user is not tenant member', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    tenantContext.get.mockReturnValue({ tenantId: 't1', subjectId: 'sub-1' });
    tenantRegistry.findById.mockResolvedValue({ id: 't1', status: TenantStatus.ACTIVE });
    userTenantMembership.isMember.mockResolvedValue(false);

    await expect(guard.canActivate(createContext())).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
      message: ACCESS_DENIED_MESSAGE,
    });
  });

  it('denies when tenant not found', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    tenantContext.get.mockReturnValue({ tenantId: 't1', subjectId: 'sub-1' });
    tenantRegistry.findById.mockResolvedValue(null);

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(DomainError);
  });

  it('allows active tenant member', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    tenantContext.get.mockReturnValue({ tenantId: 't1', subjectId: 'sub-1' });
    tenantRegistry.findById.mockResolvedValue({ id: 't1', status: TenantStatus.ACTIVE });
    userTenantMembership.isMember.mockResolvedValue(true);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it('denies LOCKED tenant with explicit message', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    tenantContext.get.mockReturnValue({ tenantId: 't1', subjectId: 'sub-1' });
    tenantRegistry.findById.mockResolvedValue({ id: 't1', status: TenantStatus.LOCKED });

    const err = await guard.canActivate(createContext()).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).message).toBe('Tenant is locked');
  });

  it('denies LOCKED tenant even for GET when TENANT_SUSPENDED_ALLOW_READS is true', async () => {
    guard = new TenantGuard(
      reflector,
      tenantContext as never,
      tenantRegistry as never,
      userTenantMembership as never,
      identityMetrics as never,
      makeConfig({ TENANT_SUSPENDED_ALLOW_READS: true }) as never,
    );
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    tenantContext.get.mockReturnValue({ tenantId: 't1', subjectId: 'sub-1' });
    tenantRegistry.findById.mockResolvedValue({ id: 't1', status: TenantStatus.LOCKED });

    const err = await guard.canActivate(createContext('GET')).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).message).toBe('Tenant is locked');
  });

  it('denies SUSPENDED tenant GET when TENANT_SUSPENDED_ALLOW_READS is false', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    tenantContext.get.mockReturnValue({ tenantId: 't1', subjectId: 'sub-1' });
    tenantRegistry.findById.mockResolvedValue({ id: 't1', status: TenantStatus.SUSPENDED });

    const err = await guard.canActivate(createContext('GET')).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).message).toContain('SUSPENDED');
  });

  it('allows SUSPENDED tenant GET when TENANT_SUSPENDED_ALLOW_READS is true', async () => {
    guard = new TenantGuard(
      reflector,
      tenantContext as never,
      tenantRegistry as never,
      userTenantMembership as never,
      identityMetrics as never,
      makeConfig({ TENANT_SUSPENDED_ALLOW_READS: true }) as never,
    );
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    // No subjectId to skip membership check (simulates customer or context-less call)
    tenantContext.get.mockReturnValue({ tenantId: 't1', subjectId: null });
    tenantRegistry.findById.mockResolvedValue({ id: 't1', status: TenantStatus.SUSPENDED });

    await expect(guard.canActivate(createContext('GET'))).resolves.toBe(true);
  });
});

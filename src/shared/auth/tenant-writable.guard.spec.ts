import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantWritableGuard } from './tenant-writable.guard.js';
import { TenantStatus } from '../../modules/identity/domain/tenant/tenant.entity.js';

describe('TenantWritableGuard', () => {
  const reflector = { getAllAndOverride: vi.fn() } as unknown as Reflector;
  const tenantContext = { get: vi.fn() };
  const tenantRegistry = { findById: vi.fn() };

  let guard: TenantWritableGuard;

  const createContext = (method: string) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ method }),
      }),
    }) as never;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new TenantWritableGuard(reflector, tenantContext as never, tenantRegistry as never);
  });

  it('allows GET on READ_ONLY tenant', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    tenantContext.get.mockReturnValue({ tenantId: 't1' });
    tenantRegistry.findById.mockResolvedValue({ id: 't1', status: TenantStatus.READ_ONLY });

    await expect(guard.canActivate(createContext('GET'))).resolves.toBe(true);
  });

  it('blocks POST on READ_ONLY tenant', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    tenantContext.get.mockReturnValue({ tenantId: 't1' });
    tenantRegistry.findById.mockResolvedValue({ id: 't1', status: TenantStatus.READ_ONLY });

    await expect(guard.canActivate(createContext('POST'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows POST on ACTIVE tenant', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    tenantContext.get.mockReturnValue({ tenantId: 't1' });
    tenantRegistry.findById.mockResolvedValue({ id: 't1', status: TenantStatus.ACTIVE });

    await expect(guard.canActivate(createContext('POST'))).resolves.toBe(true);
  });
});

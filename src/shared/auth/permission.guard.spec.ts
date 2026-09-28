import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard.js';

describe('PermissionGuard', () => {
  const reflector = { getAllAndOverride: vi.fn() } as unknown as Reflector;
  const tenantContext = { get: vi.fn() };
  const authorizationService = { hasAnyPermission: vi.fn() };
  const identityMetrics = { recordPermissionDenied: vi.fn() };
  const config = { KEYCLOAK_ADMIN_CLIENT_ID: 'platform-admin' };

  let guard: PermissionGuard;

  const createContext = () =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as never;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new PermissionGuard(
      reflector,
      tenantContext as never,
      authorizationService as never,
      identityMetrics as never,
      config as never,
    );
  });

  it('allows public routes', async () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === 'isPublic') return true;
      return undefined;
    });
    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it('allows when no permissions or roles required (deny-by-default off)', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(undefined);
    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it('denies undecorated routes when AUTH_PERMISSION_DENY_BY_DEFAULT (H-02)', async () => {
    guard = new PermissionGuard(
      reflector,
      tenantContext as never,
      authorizationService as never,
      identityMetrics as never,
      { KEYCLOAK_ADMIN_CLIENT_ID: 'platform-admin', AUTH_PERMISSION_DENY_BY_DEFAULT: true } as never,
    );
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'isCustomerRoute') return false;
      return undefined;
    });
    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(ForbiddenException);
    expect(identityMetrics.recordPermissionDenied).toHaveBeenCalled();
  });

  it('denies when required permission is missing', async () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'permissions') return ['platform:read'];
      return undefined;
    });
    authorizationService.hasAnyPermission.mockResolvedValue(false);

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows when authorization service grants permission', async () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'permissions') return ['platform:read'];
      return undefined;
    });
    authorizationService.hasAnyPermission.mockResolvedValue(true);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });
});

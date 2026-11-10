import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EDGE_PERMISSIONS_KEY, IS_PUBLIC_KEY } from '../../../../shared/auth/decorators.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import { EdgeRegistryController } from './registry.controller.js';

/**
 * Authenticated Edge registry API permission checks.
 * Guards + method metadata are the enforcement points (ValidationPipe is orthogonal).
 */
describe('EdgeRegistryController authz', () => {
  const cases: Array<{
    method: keyof EdgeRegistryController;
    permission: string;
  }> = [
    { method: 'listProducts', permission: 'platform:product_registry:read' },
    { method: 'createProduct', permission: 'platform:product_registry:manage' },
    { method: 'patchProduct', permission: 'platform:product_registry:manage' },
    {
      method: 'transitionProductStatus',
      permission: 'platform:product_registry:certify',
    },
    { method: 'listPlatforms', permission: 'platform:product_platforms:read' },
    { method: 'createPlatform', permission: 'platform:product_platforms:manage' },
    {
      method: 'listEnvironments',
      permission: 'platform:runtime_environments:read',
    },
    {
      method: 'listProfiles',
      permission: 'platform:deployment_profiles:read',
    },
    {
      method: 'patchProfile',
      permission: 'platform:deployment_profiles:manage',
    },
    {
      method: 'listContracts',
      permission: 'platform:product_control_contracts:read',
    },
    {
      method: 'transitionContractStatus',
      permission: 'platform:product_control_contracts:certify',
    },
    {
      method: 'evaluate',
      permission: 'platform:registry_compatibility:evaluate',
    },
    { method: 'listHistory', permission: 'platform:registry_history:read' },
  ];

  it.each(cases)(
    '$method requires $permission',
    ({ method, permission }) => {
      const meta = Reflect.getMetadata(
        EDGE_PERMISSIONS_KEY,
        EdgeRegistryController.prototype[method],
      ) as string[] | undefined;
      expect(meta).toEqual([permission]);
    },
  );

  describe('EdgePermissionGuard against registry permissions', () => {
    const reflector = { getAllAndOverride: vi.fn() } as unknown as Reflector;
    const edgeContext = { get: vi.fn() };
    const edgeMetrics = { recordAuthorizationDenial: vi.fn() };
    let guard: EdgePermissionGuard;

    const createContext = () =>
      ({
        getHandler: () => ({}),
        getClass: () => ({}),
      }) as never;

    beforeEach(() => {
      vi.clearAllMocks();
      guard = new EdgePermissionGuard(
        reflector,
        edgeContext as never,
        edgeMetrics as never,
      );
    });

    it('forbids registry manage without permission', () => {
      vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === EDGE_PERMISSIONS_KEY) {
          return ['platform:product_registry:manage'];
        }
        return undefined;
      });
      edgeContext.get.mockReturnValue({
        permissions: ['platform:product_registry:read'],
      });

      expect(() => guard.canActivate(createContext())).toThrow(ForbiddenException);
      expect(edgeMetrics.recordAuthorizationDenial).toHaveBeenCalled();
    });

    it('allows registry manage with matching permission', () => {
      vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === EDGE_PERMISSIONS_KEY) {
          return ['platform:product_registry:manage'];
        }
        return undefined;
      });
      edgeContext.get.mockReturnValue({
        permissions: ['platform:product_registry:manage'],
      });

      expect(guard.canActivate(createContext())).toBe(true);
    });

    it('forbids certify transition without certify permission', () => {
      vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === EDGE_PERMISSIONS_KEY) {
          return ['platform:product_registry:certify'];
        }
        return undefined;
      });
      edgeContext.get.mockReturnValue({
        permissions: ['platform:product_registry:manage'],
      });

      expect(() => guard.canActivate(createContext())).toThrow(ForbiddenException);
    });

    it('allows compatibility evaluate with evaluate permission', () => {
      vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === EDGE_PERMISSIONS_KEY) {
          return ['platform:registry_compatibility:evaluate'];
        }
        return undefined;
      });
      edgeContext.get.mockReturnValue({
        permissions: ['platform:registry_compatibility:evaluate'],
      });

      expect(guard.canActivate(createContext())).toBe(true);
    });
  });
});

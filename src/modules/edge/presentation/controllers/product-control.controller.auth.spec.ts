import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EDGE_PERMISSIONS_KEY, IS_PUBLIC_KEY } from '../../../../shared/auth/decorators.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import { EdgeProductControlController } from './product-control.controller.js';

describe('EdgeProductControlController authz', () => {
  const cases: Array<{
    method: keyof EdgeProductControlController;
    permission: string;
  }> = [
    { method: 'listEndpoints', permission: 'platform:product_control:read' },
    { method: 'getEndpoint', permission: 'platform:product_control:read' },
    { method: 'createEndpoint', permission: 'platform:product_control:manage' },
    { method: 'validate', permission: 'platform:product_control:validate' },
    { method: 'runHandshake', permission: 'platform:product_control:handshake' },
    { method: 'runDiscoverContract', permission: 'platform:product_control:discover' },
    { method: 'runDiscoverCapabilities', permission: 'platform:product_control:discover' },
    { method: 'runHealthCheck', permission: 'platform:product_control:health' },
    { method: 'quarantineEndpoint', permission: 'platform:product_control:quarantine' },
    { method: 'listEndpointExchanges', permission: 'platform:product_control:read' },
    { method: 'getExchange', permission: 'platform:product_control:read' },
    { method: 'reconcileExchange', permission: 'platform:product_control:reconcile' },
    { method: 'ingestCallback', permission: 'platform:product_control:manage' },
  ];

  it.each(cases)('$method requires $permission', ({ method, permission }) => {
    const meta = Reflect.getMetadata(
      EDGE_PERMISSIONS_KEY,
      EdgeProductControlController.prototype[method],
    ) as string[] | undefined;
    expect(meta).toEqual([permission]);
  });

  describe('EdgePermissionGuard against product-control permissions', () => {
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

    it('forbids manage without permission', () => {
      vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === EDGE_PERMISSIONS_KEY) return ['platform:product_control:manage'];
        return undefined;
      });
      edgeContext.get.mockReturnValue({
        permissions: ['platform:product_control:read'],
      });
      expect(() => guard.canActivate(createContext())).toThrow(ForbiddenException);
    });

    it('allows handshake with matching permission', () => {
      vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === EDGE_PERMISSIONS_KEY) return ['platform:product_control:handshake'];
        return undefined;
      });
      edgeContext.get.mockReturnValue({
        permissions: ['platform:product_control:handshake'],
      });
      expect(guard.canActivate(createContext())).toBe(true);
    });

    it('forbids quarantine without quarantine permission', () => {
      vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === EDGE_PERMISSIONS_KEY) return ['platform:product_control:quarantine'];
        return undefined;
      });
      edgeContext.get.mockReturnValue({
        permissions: ['platform:product_control:read', 'platform:product_control:handshake'],
      });
      expect(() => guard.canActivate(createContext())).toThrow(ForbiddenException);
    });
  });
});

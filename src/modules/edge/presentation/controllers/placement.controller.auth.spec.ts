import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EDGE_PERMISSIONS_KEY, IS_PUBLIC_KEY } from '../../../../shared/auth/decorators.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import {
  EdgeCapacityController,
  EdgePlacementController,
} from './placement.controller.js';

describe('EdgePlacementController authz', () => {
  const cases: Array<{
    method: keyof EdgePlacementController;
    permission: string;
  }> = [
    { method: 'listRequests', permission: 'platform:placement:read' },
    { method: 'createPlacementRequest', permission: 'platform:placement:request' },
    { method: 'getRequest', permission: 'platform:placement:read' },
    { method: 'evaluateRequest', permission: 'platform:placement:evaluate' },
    { method: 'confirmRequest', permission: 'platform:placement:confirm' },
    { method: 'cancelRequest', permission: 'platform:placement:cancel' },
    { method: 'getDecision', permission: 'platform:placement:read' },
    { method: 'listCandidates', permission: 'platform:placement:read' },
    { method: 'listHistory', permission: 'platform:placement:read' },
    { method: 'listPolicies', permission: 'platform:placement_policy:read' },
    { method: 'createPlacementPolicy', permission: 'platform:placement_policy:manage' },
    { method: 'patchPlacementPolicy', permission: 'platform:placement_policy:manage' },
  ];

  it.each(cases)('$method requires $permission', ({ method, permission }) => {
    const meta = Reflect.getMetadata(
      EDGE_PERMISSIONS_KEY,
      EdgePlacementController.prototype[method],
    ) as string[] | undefined;
    expect(meta).toEqual([permission]);
  });
});

describe('EdgeCapacityController authz', () => {
  const cases: Array<{
    method: keyof EdgeCapacityController;
    permission: string;
  }> = [
    { method: 'listInventory', permission: 'platform:capacity:read' },
    { method: 'upsert', permission: 'platform:capacity:manage' },
    { method: 'patch', permission: 'platform:capacity:manage' },
    { method: 'listReservations', permission: 'platform:capacity:read' },
    { method: 'getReservation', permission: 'platform:capacity:read' },
    { method: 'releaseReservation', permission: 'platform:capacity:release' },
    { method: 'expireReservation', permission: 'platform:capacity:release' },
  ];

  it.each(cases)('$method requires $permission', ({ method, permission }) => {
    const meta = Reflect.getMetadata(
      EDGE_PERMISSIONS_KEY,
      EdgeCapacityController.prototype[method],
    ) as string[] | undefined;
    expect(meta).toEqual([permission]);
  });

  describe('EdgePermissionGuard against capacity permissions', () => {
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

    it('forbids capacity manage without permission', () => {
      vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === EDGE_PERMISSIONS_KEY) return ['platform:capacity:manage'];
        return undefined;
      });
      edgeContext.get.mockReturnValue({
        permissions: ['platform:capacity:read'],
      });
      expect(() => guard.canActivate(createContext())).toThrow(ForbiddenException);
    });

    it('allows capacity release with matching permission', () => {
      vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === EDGE_PERMISSIONS_KEY) return ['platform:capacity:release'];
        return undefined;
      });
      edgeContext.get.mockReturnValue({
        permissions: ['platform:capacity:release'],
      });
      expect(guard.canActivate(createContext())).toBe(true);
    });
  });
});

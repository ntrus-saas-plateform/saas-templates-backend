import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { EDGE_PERMISSIONS_KEY, IS_PUBLIC_KEY } from '../../../../shared/auth/decorators.js';
import { EdgeLifecycleController } from './lifecycle.controller.js';

describe('EdgeLifecycleController authz', () => {
  const cases: Array<{ method: keyof EdgeLifecycleController; permission: string }> = [
    { method: 'listRecords', permission: 'platform:lifecycle:read' },
    { method: 'getRecord', permission: 'platform:lifecycle:read' },
    { method: 'createRecordEndpoint', permission: 'platform:lifecycle:suspend' },
    { method: 'suspendEndpoint', permission: 'platform:lifecycle:suspend' },
    { method: 'resumeEndpoint', permission: 'platform:lifecycle:resume' },
    { method: 'deprovisionEndpoint', permission: 'platform:lifecycle:deprovision' },
    { method: 'listRuns', permission: 'platform:lifecycle:history:read' },
    { method: 'listEvidence', permission: 'platform:lifecycle:history:read' },
  ];

  for (const { method, permission } of cases) {
    it(`${String(method)} requires ${permission}`, () => {
      const perms = Reflect.getMetadata(
        EDGE_PERMISSIONS_KEY,
        EdgeLifecycleController.prototype[method],
      );
      expect(perms).toContain(permission);
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        EdgeLifecycleController.prototype[method],
      );
      expect(isPublic).toBeFalsy();
    });
  }
});

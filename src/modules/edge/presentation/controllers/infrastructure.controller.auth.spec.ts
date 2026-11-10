import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { EDGE_PERMISSIONS_KEY, IS_PUBLIC_KEY } from '../../../../shared/auth/decorators.js';
import { EdgeInfrastructureController } from './infrastructure.controller.js';

describe('EdgeInfrastructureController authz', () => {
  const cases: Array<{ method: keyof EdgeInfrastructureController; permission: string }> = [
    { method: 'listProviders', permission: 'platform:infrastructure:read' },
    { method: 'listResources', permission: 'platform:infrastructure:read' },
    { method: 'createResourcePlan', permission: 'platform:infrastructure:manage' },
    { method: 'validateResourcePlan', permission: 'platform:infrastructure:manage' },
    { method: 'reconcileResource', permission: 'platform:infrastructure:reconcile' },
    { method: 'listDatabases', permission: 'platform:database:read' },
    { method: 'verifyDatabase', permission: 'platform:database:verify' },
    { method: 'rotateDatabaseCredentials', permission: 'platform:database:credentials:rotate' },
    { method: 'createBackup', permission: 'platform:database:backup' },
    { method: 'deprovisionResource', permission: 'platform:infrastructure:deprovision' },
  ];

  for (const { method, permission } of cases) {
    it(`${String(method)} requires ${permission}`, () => {
      const perms = Reflect.getMetadata(
        EDGE_PERMISSIONS_KEY,
        EdgeInfrastructureController.prototype[method],
      );
      expect(perms).toContain(permission);
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        EdgeInfrastructureController.prototype[method],
      );
      expect(isPublic).toBeFalsy();
    });
  }
});

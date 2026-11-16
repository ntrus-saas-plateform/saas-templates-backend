import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import {
  EDGE_PERMISSIONS_KEY,
  IS_PUBLIC_KEY,
} from '../../../../shared/auth/decorators.js';
import { EdgePlatformOperationsController } from './platform-operations.controller.js';

describe('EdgePlatformOperationsController auth matrix', () => {
  const cases: Array<{ method: keyof EdgePlatformOperationsController; permission: string }> = [
    { method: 'searchServices', permission: 'platform:service_catalog:read' },
    { method: 'createService', permission: 'platform:service_catalog:manage' },
    { method: 'getServiceById', permission: 'platform:service_catalog:read' },
    { method: 'patchService', permission: 'platform:service_catalog:manage' },
    { method: 'postDependency', permission: 'platform:service_catalog:manage' },
    { method: 'deleteDependency', permission: 'platform:service_catalog:manage' },
    { method: 'operationsOverview', permission: 'platform:operations:overview:read' },
  ];

  for (const { method, permission } of cases) {
    it(`${String(method)} requires ${permission}`, () => {
      const perms = Reflect.getMetadata(
        EDGE_PERMISSIONS_KEY,
        EdgePlatformOperationsController.prototype[method],
      );
      expect(perms).toContain(permission);
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        EdgePlatformOperationsController.prototype[method],
      );
      expect(isPublic).toBeFalsy();
    });
  }
});

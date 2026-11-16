import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { EDGE_PERMISSIONS_KEY, IS_PUBLIC_KEY } from '../../../../shared/auth/decorators.js';
import { EdgeConfigurationController } from './configuration.controller.js';

describe('EdgeConfigurationController authz', () => {
  const cases: Array<{ method: keyof EdgeConfigurationController; permission: string }> = [
    { method: 'listSchemas', permission: 'platform:configuration:read' },
    { method: 'getSchema', permission: 'platform:configuration:read' },
    { method: 'createSchemaEndpoint', permission: 'platform:configuration:manage' },
    { method: 'listTemplates', permission: 'platform:configuration:read' },
    { method: 'createTemplateEndpoint', permission: 'platform:configuration:manage' },
    { method: 'publishTemplateEndpoint', permission: 'platform:configuration:manage' },
    { method: 'listBundles', permission: 'platform:configuration:read' },
    { method: 'createBundleEndpoint', permission: 'platform:configuration:manage' },
    { method: 'publishBundleEndpoint', permission: 'platform:configuration:manage' },
    { method: 'listAssignments', permission: 'platform:configuration:read' },
    { method: 'assignEndpoint', permission: 'platform:configuration:deploy' },
    { method: 'deployEndpoint', permission: 'platform:configuration:deploy' },
    { method: 'rollbackEndpoint', permission: 'platform:configuration:rollback' },
    { method: 'listRuns', permission: 'platform:configuration:history:read' },
    { method: 'listEvidence', permission: 'platform:configuration:history:read' },
    { method: 'listEntitlements', permission: 'platform:entitlement:read' },
    { method: 'reconcileEntitlements', permission: 'platform:entitlement:reconcile' },
  ];

  for (const { method, permission } of cases) {
    it(`${String(method)} requires ${permission}`, () => {
      const perms = Reflect.getMetadata(
        EDGE_PERMISSIONS_KEY,
        EdgeConfigurationController.prototype[method],
      );
      expect(perms).toContain(permission);
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        EdgeConfigurationController.prototype[method],
      );
      expect(isPublic).toBeFalsy();
    });
  }
});

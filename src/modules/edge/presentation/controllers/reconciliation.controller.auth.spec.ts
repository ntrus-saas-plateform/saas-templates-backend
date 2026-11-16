import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { EDGE_PERMISSIONS_KEY, IS_PUBLIC_KEY } from '../../../../shared/auth/decorators.js';
import { EdgeReconciliationController } from './reconciliation.controller.js';

describe('EdgeReconciliationController authz', () => {
  const cases: Array<{ method: keyof EdgeReconciliationController; permission: string }> = [
    { method: 'listPolicies', permission: 'platform:reconciliation:read' },
    { method: 'getPolicy', permission: 'platform:reconciliation:read' },
    { method: 'createPolicyEndpoint', permission: 'platform:reconciliation:approve' },
    { method: 'listRuns', permission: 'platform:reconciliation:read' },
    { method: 'getRun', permission: 'platform:reconciliation:read' },
    { method: 'createRunEndpoint', permission: 'platform:reconciliation:run' },
    { method: 'observeEndpoint', permission: 'platform:reconciliation:run' },
    { method: 'remediateEndpoint', permission: 'platform:reconciliation:remediate' },
    { method: 'decideRemediationEndpoint', permission: 'platform:reconciliation:approve' },
    { method: 'listFindings', permission: 'platform:reconciliation:read' },
    { method: 'quarantineEndpoint', permission: 'platform:reconciliation:quarantine' },
    { method: 'createWaiverEndpoint', permission: 'platform:reconciliation:approve' },
    { method: 'listWaivers', permission: 'platform:reconciliation:read' },
    { method: 'listEvidence', permission: 'platform:reconciliation:history:read' },
    { method: 'listHistory', permission: 'platform:reconciliation:history:read' },
  ];

  for (const { method, permission } of cases) {
    it(`${String(method)} requires ${permission}`, () => {
      const perms = Reflect.getMetadata(
        EDGE_PERMISSIONS_KEY,
        EdgeReconciliationController.prototype[method],
      );
      expect(perms).toContain(permission);
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        EdgeReconciliationController.prototype[method],
      );
      expect(isPublic).toBeFalsy();
    });
  }
});

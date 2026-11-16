import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { EDGE_PERMISSIONS_KEY, IS_PUBLIC_KEY } from '../../../../shared/auth/decorators.js';
import { EdgeActivationController } from './activation.controller.js';

describe('EdgeActivationController authz', () => {
  const cases: Array<{ method: keyof EdgeActivationController; permission: string }> = [
    { method: 'listEvaluations', permission: 'platform:activation:read' },
    { method: 'getEvaluation', permission: 'platform:activation:read' },
    { method: 'createEvaluationEndpoint', permission: 'platform:activation:evaluate' },
    { method: 'evaluateEndpoint', permission: 'platform:activation:evaluate' },
    { method: 'listRecords', permission: 'platform:activation:read' },
    { method: 'getRecord', permission: 'platform:activation:read' },
    { method: 'createRecordEndpoint', permission: 'platform:activation:activate' },
    { method: 'evaluateRecordEndpoint', permission: 'platform:activation:evaluate' },
    { method: 'activateEndpoint', permission: 'platform:activation:activate' },
    { method: 'listRuns', permission: 'platform:activation:history:read' },
    { method: 'listEvidence', permission: 'platform:activation:history:read' },
  ];

  for (const { method, permission } of cases) {
    it(`${String(method)} requires ${permission}`, () => {
      const perms = Reflect.getMetadata(
        EDGE_PERMISSIONS_KEY,
        EdgeActivationController.prototype[method],
      );
      expect(perms).toContain(permission);
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        EdgeActivationController.prototype[method],
      );
      expect(isPublic).toBeFalsy();
    });
  }
});

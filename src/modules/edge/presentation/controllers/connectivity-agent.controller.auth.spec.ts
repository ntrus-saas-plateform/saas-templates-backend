import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { EDGE_PERMISSIONS_KEY, IS_PUBLIC_KEY } from '../../../../shared/auth/decorators.js';
import { EdgeConnectivityAgentController } from './connectivity-agent.controller.js';

describe('EdgeConnectivityAgentController authz', () => {
  const cases: Array<{ method: keyof EdgeConnectivityAgentController; permission: string }> = [
    { method: 'listAgents', permission: 'platform:agents:read' },
    { method: 'getAgent', permission: 'platform:agents:read' },
    { method: 'createAgentEndpoint', permission: 'platform:agents:manage' },
    { method: 'registerEndpoint', permission: 'platform:agents:manage' },
    { method: 'commandEndpoint', permission: 'platform:agents:command' },
    { method: 'revokeEndpoint', permission: 'platform:agents:revoke' },
    { method: 'listCommands', permission: 'platform:agents:read' },
    { method: 'listEvidence', permission: 'platform:agents:history:read' },
    { method: 'listHistory', permission: 'platform:agents:history:read' },
  ];

  for (const { method, permission } of cases) {
    it(`${String(method)} requires ${permission}`, () => {
      const perms = Reflect.getMetadata(
        EDGE_PERMISSIONS_KEY,
        EdgeConnectivityAgentController.prototype[method],
      );
      expect(perms).toContain(permission);
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        EdgeConnectivityAgentController.prototype[method],
      );
      expect(isPublic).toBeFalsy();
    });
  }
});

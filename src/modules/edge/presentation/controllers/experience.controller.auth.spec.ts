import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { EDGE_PERMISSIONS_KEY, IS_PUBLIC_KEY } from '../../../../shared/auth/decorators.js';
import { EdgeExperienceController } from './experience.controller.js';

describe('EdgeExperienceController authz', () => {
  const cases: Array<{ method: keyof EdgeExperienceController; permission: string }> = [
    { method: 'listProfiles', permission: 'platform:experience:read' },
    { method: 'getProfile', permission: 'platform:experience:read' },
    { method: 'createProfileEndpoint', permission: 'platform:experience:manage' },
    { method: 'publishProfileEndpoint', permission: 'platform:experience:manage' },
    { method: 'listApplications', permission: 'platform:experience:read' },
    { method: 'getApplication', permission: 'platform:experience:read' },
    { method: 'createApplicationEndpoint', permission: 'platform:experience:manage' },
    { method: 'publishApplicationEndpoint', permission: 'platform:experience:manage' },
    { method: 'listAssignments', permission: 'platform:experience:read' },
    { method: 'getAssignment', permission: 'platform:experience:read' },
    { method: 'assignEndpoint', permission: 'platform:experience:deploy' },
    { method: 'provisionEndpoint', permission: 'platform:experience:deploy' },
    { method: 'deactivateEndpoint', permission: 'platform:experience:deploy' },
    { method: 'listRuns', permission: 'platform:experience:history:read' },
    { method: 'listEvidence', permission: 'platform:experience:history:read' },
    { method: 'listDomains', permission: 'platform:experience:read' },
    { method: 'bindDomainEndpoint', permission: 'platform:experience:domains' },
  ];

  for (const { method, permission } of cases) {
    it(`${String(method)} requires ${permission}`, () => {
      const perms = Reflect.getMetadata(
        EDGE_PERMISSIONS_KEY,
        EdgeExperienceController.prototype[method],
      );
      expect(perms).toContain(permission);
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        EdgeExperienceController.prototype[method],
      );
      expect(isPublic).toBeFalsy();
    });
  }
});

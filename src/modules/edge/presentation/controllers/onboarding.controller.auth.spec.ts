import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { EDGE_PERMISSIONS_KEY, IS_PUBLIC_KEY } from '../../../../shared/auth/decorators.js';
import { EdgeOnboardingController } from './onboarding.controller.js';

describe('EdgeOnboardingController authz', () => {
  const cases: Array<{ method: keyof EdgeOnboardingController; permission: string }> = [
    { method: 'listTemplates', permission: 'platform:onboarding:read' },
    { method: 'getTemplate', permission: 'platform:onboarding:read' },
    { method: 'createTemplateEndpoint', permission: 'platform:onboarding:start' },
    { method: 'publishTemplateEndpoint', permission: 'platform:onboarding:start' },
    { method: 'listJourneys', permission: 'platform:onboarding:read' },
    { method: 'getJourney', permission: 'platform:onboarding:read' },
    { method: 'createJourneyEndpoint', permission: 'platform:onboarding:start' },
    { method: 'startEndpoint', permission: 'platform:onboarding:start' },
    { method: 'advanceEndpoint', permission: 'platform:onboarding:advance' },
    { method: 'closeEndpoint', permission: 'platform:onboarding:close' },
    { method: 'decideTaskEndpoint', permission: 'platform:onboarding:approve' },
    { method: 'listRuns', permission: 'platform:onboarding:history:read' },
    { method: 'listEvidence', permission: 'platform:onboarding:history:read' },
  ];

  for (const { method, permission } of cases) {
    it(`${String(method)} requires ${permission}`, () => {
      const perms = Reflect.getMetadata(
        EDGE_PERMISSIONS_KEY,
        EdgeOnboardingController.prototype[method],
      );
      expect(perms).toContain(permission);
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        EdgeOnboardingController.prototype[method],
      );
      expect(isPublic).toBeFalsy();
    });
  }
});

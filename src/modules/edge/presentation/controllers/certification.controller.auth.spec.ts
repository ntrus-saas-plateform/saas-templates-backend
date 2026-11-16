import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { EDGE_PERMISSIONS_KEY, IS_PUBLIC_KEY } from '../../../../shared/auth/decorators.js';
import { EdgeCertificationController } from './certification.controller.js';

describe('EdgeCertificationController authz', () => {
  const cases: Array<{ method: keyof EdgeCertificationController; permission: string }> = [
    { method: 'listPackages', permission: 'platform:certification:read' },
    { method: 'getPackage', permission: 'platform:certification:read' },
    { method: 'createPackageEndpoint', permission: 'platform:certification:manage' },
    { method: 'assembleEndpoint', permission: 'platform:certification:manage' },
    { method: 'certifyEndpoint', permission: 'platform:certification:certify' },
    { method: 'revokeEndpoint', permission: 'platform:certification:revoke' },
    { method: 'attachEvidenceEndpoint', permission: 'platform:certification:manage' },
    { method: 'listPackageEvidence', permission: 'platform:certification:history:read' },
    { method: 'listEvidenceItems', permission: 'platform:certification:read' },
    { method: 'listRuns', permission: 'platform:certification:history:read' },
    { method: 'listHistory', permission: 'platform:certification:history:read' },
  ];

  for (const { method, permission } of cases) {
    it(`${String(method)} requires ${permission}`, () => {
      const perms = Reflect.getMetadata(
        EDGE_PERMISSIONS_KEY,
        EdgeCertificationController.prototype[method],
      );
      expect(perms).toContain(permission);
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        EdgeCertificationController.prototype[method],
      );
      expect(isPublic).toBeFalsy();
    });
  }
});

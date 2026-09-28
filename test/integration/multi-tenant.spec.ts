import { describe, it, expect } from 'vitest';
import {
  TenantStatus,
  isTenantAccessible,
} from '../../src/modules/identity/domain/tenant/tenant.entity.js';

describe('Multi-Tenant Isolation Rules', () => {
  const TENANT_A = 'tenant-a';
  const TENANT_B = 'tenant-b';
  const ORG_A1 = 'org-a1';
  const ORG_B1 = 'org-b1';

  interface AccessContext {
    userId: string;
    tenantId: string;
    organizationId: string;
    userOrganizations: Record<string, string[]>;
  }

  function canAccess(ctx: AccessContext): boolean {
    const userOrgs = ctx.userOrganizations[ctx.userId] ?? [];
    if (!userOrgs.includes(ctx.organizationId)) return false;

    const orgTenantMap: Record<string, string> = {
      [ORG_A1]: TENANT_A,
      [ORG_B1]: TENANT_B,
    };

    return orgTenantMap[ctx.organizationId] === ctx.tenantId;
  }

  it('User A → Tenant A → Organization A1 = OK', () => {
    expect(
      canAccess({
        userId: 'user-a',
        tenantId: TENANT_A,
        organizationId: ORG_A1,
        userOrganizations: { 'user-a': [ORG_A1, 'org-a2'] },
      }),
    ).toBe(true);
  });

  it('User A → Tenant B = DENIED', () => {
    expect(
      canAccess({
        userId: 'user-a',
        tenantId: TENANT_B,
        organizationId: ORG_B1,
        userOrganizations: { 'user-a': [ORG_A1] },
      }),
    ).toBe(false);
  });

  it('User A → Organization B1 = DENIED', () => {
    expect(
      canAccess({
        userId: 'user-a',
        tenantId: TENANT_A,
        organizationId: ORG_B1,
        userOrganizations: { 'user-a': [ORG_A1] },
      }),
    ).toBe(false);
  });

  it('Suspended tenant should not be accessible', () => {
    expect(isTenantAccessible(TenantStatus.SUSPENDED)).toBe(false);
  });
});

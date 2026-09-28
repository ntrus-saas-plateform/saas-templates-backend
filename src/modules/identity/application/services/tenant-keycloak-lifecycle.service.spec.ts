import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantKeycloakLifecycleService } from './tenant-keycloak-lifecycle.service.js';
import { TenantStatus } from '../../domain/tenant/tenant.entity.js';

describe('TenantKeycloakLifecycleService', () => {
  const keycloakAdmin = {
    isAvailable: vi.fn(async () => true),
    revokeAllUserSessions: vi.fn(async () => {}),
    setUserEnabled: vi.fn(async () => {}),
  };
  const userTenantMembership = {
    listActiveMemberIdentityIds: vi.fn(async () => ['user-1', 'user-2']),
  };

  let service: TenantKeycloakLifecycleService;

  const tokenRevocation = {
    revokeAllTokensForSubject: vi.fn(async () => {}),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TenantKeycloakLifecycleService(
      keycloakAdmin as never,
      userTenantMembership as never,
      tokenRevocation as never,
    );
  });

  it('revokes sessions and disables users when tenant is suspended', async () => {
    await service.syncTenantStatus('tenant-a', TenantStatus.SUSPENDED);
    expect(keycloakAdmin.revokeAllUserSessions).toHaveBeenCalledTimes(2);
    expect(keycloakAdmin.setUserEnabled).toHaveBeenCalledWith('user-1', false);
    expect(keycloakAdmin.setUserEnabled).toHaveBeenCalledWith('user-2', false);
    expect(tokenRevocation.revokeAllTokensForSubject).toHaveBeenCalledWith('user-1');
    expect(tokenRevocation.revokeAllTokensForSubject).toHaveBeenCalledWith('user-2');
  });

  it('re-enables users when tenant becomes active', async () => {
    await service.syncTenantStatus('tenant-a', TenantStatus.ACTIVE);
    expect(keycloakAdmin.setUserEnabled).toHaveBeenCalledWith('user-1', true);
    expect(keycloakAdmin.setUserEnabled).toHaveBeenCalledWith('user-2', true);
  });
});

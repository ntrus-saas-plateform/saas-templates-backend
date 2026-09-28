import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdentityMetricsService } from './identity-metrics.service.js';

describe('IdentityMetricsService', () => {
  const metrics = {
    identityLoginFailures: { inc: vi.fn() },
    identityPermissionDenied: { inc: vi.fn() },
    identityCrossTenantAttempts: { inc: vi.fn() },
    identityInvitationFailures: { inc: vi.fn() },
    identityMembershipChanges: { inc: vi.fn() },
    identityReconciliationDrifts: { inc: vi.fn() },
  };

  let service: IdentityMetricsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IdentityMetricsService(metrics as never);
  });

  it('records identity counters without tenant_id labels', () => {
    service.recordLoginFailure('expired');
    service.recordPermissionDenied();
    service.recordCrossTenantAttempt();
    service.recordInvitationFailure('expired_token');
    service.recordMembershipChange('grant');
    service.recordReconciliationDrift('organization.keycloak_missing');

    expect(metrics.identityLoginFailures.inc).toHaveBeenCalledWith({ reason: 'expired' });
    expect(metrics.identityPermissionDenied.inc).toHaveBeenCalledOnce();
    expect(metrics.identityCrossTenantAttempts.inc).toHaveBeenCalledOnce();
    expect(metrics.identityInvitationFailures.inc).toHaveBeenCalledWith({ reason: 'expired_token' });
    expect(metrics.identityMembershipChanges.inc).toHaveBeenCalledWith({ operation: 'grant' });
    expect(metrics.identityReconciliationDrifts.inc).toHaveBeenCalledWith({
      drift_type: 'organization.keycloak_missing',
    });
  });
});

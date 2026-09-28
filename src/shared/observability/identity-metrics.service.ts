import { Injectable } from '@nestjs/common';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class IdentityMetricsService {
  constructor(private readonly metrics: MetricsService) {}

  recordLoginFailure(reason = 'invalid_token'): void {
    this.metrics.identityLoginFailures.inc({ reason });
  }

  recordPermissionDenied(): void {
    this.metrics.identityPermissionDenied.inc();
  }

  recordCrossTenantAttempt(): void {
    this.metrics.identityCrossTenantAttempts.inc();
  }

  recordInvitationFailure(reason: string): void {
    this.metrics.identityInvitationFailures.inc({ reason });
  }

  recordMembershipChange(operation: 'grant' | 'revoke'): void {
    this.metrics.identityMembershipChanges.inc({ operation });
  }

  recordReconciliationDrift(driftType: string): void {
    this.metrics.identityReconciliationDrifts.inc({ drift_type: driftType });
  }
}

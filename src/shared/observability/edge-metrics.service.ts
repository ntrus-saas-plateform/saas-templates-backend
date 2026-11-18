import { Injectable } from '@nestjs/common';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class EdgeMetricsService {
  constructor(private readonly metrics: MetricsService) {}

  recordInvitation(result: 'created' | 'accepted' | 'revoked' | 'failed'): void {
    this.metrics.edgeInvitationsTotal.inc({ result });
  }

  recordInvitationDeliveryFailure(): void {
    this.metrics.edgeInvitationDeliveryFailures.inc();
  }

  recordAdministratorSuspension(): void {
    this.metrics.edgeAdministratorSuspensions.inc();
  }

  recordMembershipMutation(
    operation: 'invite' | 'activate' | 'suspend' | 'reinstate' | 'revoke',
  ): void {
    this.metrics.edgeMembershipMutations.inc({ operation });
  }

  recordWorkspaceSwitch(result: 'success' | 'failure'): void {
    this.metrics.edgeWorkspaceSwitches.inc({ result });
  }

  recordAuthorizationDenial(): void {
    this.metrics.edgeAuthorizationDenials.inc();
  }

  recordInvalidWorkspaceContext(): void {
    this.metrics.edgeInvalidWorkspaceContexts.inc();
  }

  recordSessionMutation(operation: 'create' | 'renew' | 'revoke' | 'revoke_all'): void {
    this.metrics.edgeSessionMutations.inc({ operation });
  }

  recordKeycloakSyncFailure(): void {
    this.metrics.edgeKeycloakSyncFailures.inc();
  }

  recordReconciliationDrift(driftType: string): void {
    this.metrics.edgeReconciliationDrifts.inc({ drift_type: driftType });
  }

  recordAuditPersistenceFailure(): void {
    this.metrics.edgeAuditPersistenceFailures.inc();
  }

  recordProvisioningJob(result: 'SUCCEEDED' | 'RETRY' | 'FAILED' | 'DEAD_LETTER'): void {
    this.metrics.edgeProvisioningJobsProcessed.inc({ result });
  }

  observeProvisioningJobDuration(jobType: string, seconds: number): void {
    this.metrics.edgeProvisioningJobsDuration.observe({ job_type: jobType }, seconds);
  }

  setProvisioningJobsPending(count: number): void {
    this.metrics.edgeProvisioningJobsPending.set(count);
  }

  setProvisioningJobsLagSeconds(seconds: number): void {
    this.metrics.edgeProvisioningJobsLagSeconds.set(Math.max(0, seconds));
  }
}

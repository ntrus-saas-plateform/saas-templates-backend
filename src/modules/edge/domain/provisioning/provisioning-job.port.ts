export const PROVISIONING_JOB_PORT = Symbol('PROVISIONING_JOB_PORT');

export type ProvisioningJobType =
  | 'REQUEST_PROVISION'
  | 'ADVANCE_AFTER_PAID'
  | 'POLL_READY'
  | 'PUBLISH_ENTITLEMENTS'
  | 'ACTIVATE_SUBSCRIPTION';

export type ProvisioningJobStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'DEAD_LETTER'
  | 'CANCELLED';

export type ProvisioningJob = {
  readonly id: string;
  readonly subscriptionId: string;
  readonly jobType: ProvisioningJobType;
  readonly status: ProvisioningJobStatus;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly nextAttemptAt: Date;
  readonly lastError: string | null;
  readonly checkpoint: Record<string, unknown>;
  readonly payload: Record<string, unknown>;
  readonly correlationId: string | null;
  readonly idempotencyKey: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
};

export interface ProvisioningJobPort {
  enqueue(input: {
    subscriptionId: string;
    jobType: ProvisioningJobType;
    payload?: Record<string, unknown>;
    correlationId?: string | null;
    idempotencyKey?: string | null;
    nextAttemptAt?: Date;
  }): Promise<ProvisioningJob>;

  claimNext(limit?: number): Promise<ProvisioningJob[]>;

  markRunning(id: string): Promise<ProvisioningJob>;

  markSucceeded(
    id: string,
    checkpoint?: Record<string, unknown>,
  ): Promise<ProvisioningJob>;

  markFailed(
    id: string,
    error: string,
    opts?: { deadLetter?: boolean; retryDelayMs?: number },
  ): Promise<ProvisioningJob>;

  listBySubscription(subscriptionId: string): Promise<ProvisioningJob[]>;

  /** Backlog depth + age of oldest claimable job (PENDING/FAILED due). */
  getBacklogStats(): Promise<{ pending: number; oldestAgeSeconds: number }>;
}

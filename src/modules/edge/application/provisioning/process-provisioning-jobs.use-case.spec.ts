import { describe, expect, it, vi } from 'vitest';
import { ProcessProvisioningJobsUseCase } from './process-provisioning-jobs.use-case.js';
import type { ProvisioningJob, ProvisioningJobPort } from '../../domain/provisioning/provisioning-job.port.js';

function job(partial: Partial<ProvisioningJob> & Pick<ProvisioningJob, 'id' | 'jobType'>): ProvisioningJob {
  return {
    subscriptionId: 'sub-1',
    status: 'RUNNING',
    attemptCount: 1,
    maxAttempts: 8,
    nextAttemptAt: new Date(),
    lastError: null,
    checkpoint: {},
    payload: {},
    correlationId: null,
    idempotencyKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    ...partial,
  };
}

describe('ProcessProvisioningJobsUseCase', () => {
  it('advances AFTER_PAID and marks succeeded', async () => {
    const jobs: ProvisioningJobPort = {
      enqueue: vi.fn(),
      claimNext: vi.fn(async () => [job({ id: 'j1', jobType: 'ADVANCE_AFTER_PAID' })]),
      markRunning: vi.fn(),
      markSucceeded: vi.fn(async (id) => job({ id, jobType: 'ADVANCE_AFTER_PAID', status: 'SUCCEEDED' })),
      markFailed: vi.fn(),
      listBySubscription: vi.fn(async () => []),
      getBacklogStats: vi.fn(async () => ({ pending: 1, oldestAgeSeconds: 12 })),
    };
    const request = { execute: vi.fn() };
    const advance = { execute: vi.fn(async () => ({ advanced: true, ready: true })) };
    const uc = new ProcessProvisioningJobsUseCase(jobs, request as never, advance as never);
    const out = await uc.execute({ limit: 1 });
    expect(out.processed).toBe(1);
    expect(advance.execute).toHaveBeenCalled();
    expect(jobs.markSucceeded).toHaveBeenCalled();
  });

  it('retries TENANT_NOT_READY without dead-letter', async () => {
    const jobs: ProvisioningJobPort = {
      enqueue: vi.fn(),
      claimNext: vi.fn(async () => [job({ id: 'j2', jobType: 'ADVANCE_AFTER_PAID' })]),
      markRunning: vi.fn(),
      markSucceeded: vi.fn(),
      markFailed: vi.fn(async (id) => job({ id, jobType: 'ADVANCE_AFTER_PAID', status: 'FAILED' })),
      listBySubscription: vi.fn(async () => []),
      getBacklogStats: vi.fn(async () => ({ pending: 2, oldestAgeSeconds: 90 })),
    };
    const request = { execute: vi.fn() };
    const advance = {
      execute: vi.fn(async () => ({ advanced: false, ready: false, reason: 'TENANT_NOT_READY' })),
    };
    const uc = new ProcessProvisioningJobsUseCase(jobs, request as never, advance as never);
    const out = await uc.execute();
    expect(out.results[0]?.status).toBe('RETRY');
    expect(jobs.markFailed).toHaveBeenCalledWith('j2', 'TENANT_NOT_READY', { retryDelayMs: 15_000 });
  });
});

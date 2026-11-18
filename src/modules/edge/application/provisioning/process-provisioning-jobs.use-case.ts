import type { ProvisioningJobPort } from '../../domain/provisioning/provisioning-job.port.js';
import { AdvanceProvisioningAfterPaidUseCase } from '../subscription/advance-provisioning-after-paid.use-case.js';
import { RequestProvisioningUseCase } from '../subscription/subscription.use-cases.js';

type ProvisioningJobMetrics = {
  recordProvisioningJob(result: 'SUCCEEDED' | 'RETRY' | 'FAILED' | 'DEAD_LETTER'): void;
  observeProvisioningJobDuration(jobType: string, seconds: number): void;
  setProvisioningJobsPending?(count: number): void;
  setProvisioningJobsLagSeconds?(seconds: number): void;
};

/**
 * Worker tick — claim pending jobs and execute (H1 scale foundation, doc 39).
 * Concurrency bounded by claimNext(limit). Not a 50k/s claim.
 */
export class ProcessProvisioningJobsUseCase {
  constructor(
    private readonly jobs: ProvisioningJobPort,
    private readonly requestProvisioning: RequestProvisioningUseCase,
    private readonly advanceAfterPaid: AdvanceProvisioningAfterPaidUseCase,
    private readonly metrics?: ProvisioningJobMetrics,
  ) {}

  async execute(input?: { limit?: number; actorId?: string }) {
    const actorId = input?.actorId ?? 'provisioning-worker';
    const backlog = await this.jobs.getBacklogStats();
    this.metrics?.setProvisioningJobsPending?.(backlog.pending);
    this.metrics?.setProvisioningJobsLagSeconds?.(backlog.oldestAgeSeconds);
    const claimed = await this.jobs.claimNext(input?.limit ?? 5);
    const results: Array<Record<string, unknown>> = [];

    for (const job of claimed) {
      const started = Date.now();
      try {
        if (job.jobType === 'REQUEST_PROVISION') {
          const req = await this.requestProvisioning.execute({
            actorId,
            subscriptionId: job.subscriptionId,
          });
          await this.jobs.markSucceeded(job.id, { requestId: req.id, outcome: req.outcome });
          results.push({ id: job.id, status: 'SUCCEEDED', type: job.jobType });
          this.metrics?.recordProvisioningJob('SUCCEEDED');
          this.metrics?.observeProvisioningJobDuration(job.jobType, (Date.now() - started) / 1000);
          continue;
        }
        if (job.jobType === 'ADVANCE_AFTER_PAID') {
          const advanced = await this.advanceAfterPaid.execute({
            actorId,
            subscriptionId: job.subscriptionId,
          });
          const ready = advanced.ready === true || advanced.advanced === true;
          if (!ready && advanced.reason === 'TENANT_NOT_READY') {
            await this.jobs.markFailed(job.id, 'TENANT_NOT_READY', { retryDelayMs: 15_000 });
            results.push({ id: job.id, status: 'RETRY', type: job.jobType });
            this.metrics?.recordProvisioningJob('RETRY');
            this.metrics?.observeProvisioningJobDuration(job.jobType, (Date.now() - started) / 1000);
            continue;
          }
          await this.jobs.markSucceeded(job.id, advanced as Record<string, unknown>);
          results.push({ id: job.id, status: 'SUCCEEDED', type: job.jobType });
          this.metrics?.recordProvisioningJob('SUCCEEDED');
          this.metrics?.observeProvisioningJobDuration(job.jobType, (Date.now() - started) / 1000);
          continue;
        }
        await this.jobs.markFailed(job.id, `Unsupported jobType ${job.jobType}`, {
          deadLetter: true,
        });
        results.push({ id: job.id, status: 'DEAD_LETTER', type: job.jobType });
        this.metrics?.recordProvisioningJob('DEAD_LETTER');
        this.metrics?.observeProvisioningJobDuration(job.jobType, (Date.now() - started) / 1000);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const dead = job.attemptCount + 1 >= job.maxAttempts;
        await this.jobs.markFailed(job.id, message, { deadLetter: dead, retryDelayMs: 30_000 });
        results.push({ id: job.id, status: dead ? 'DEAD_LETTER' : 'FAILED', error: message });
        this.metrics?.recordProvisioningJob(dead ? 'DEAD_LETTER' : 'FAILED');
        this.metrics?.observeProvisioningJobDuration(job.jobType, (Date.now() - started) / 1000);
      }
    }

    return { processed: claimed.length, results };
  }
}

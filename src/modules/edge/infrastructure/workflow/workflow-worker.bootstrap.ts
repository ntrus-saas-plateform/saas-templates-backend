import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import { JOB_SCHEDULER_PORT } from '../../../../core/domain/ports/job-scheduler.port.js';
import type { JobSchedulerPort } from '../../../../core/domain/ports/job-scheduler.port.js';
import { LoggerService } from '../../../../shared/logging/logger.service.js';
import { CacheService } from '../../../../shared/database/cache.service.js';
import {
  ClaimStepUseCase,
  ExecuteClaimedStepUseCase,
  ReconcileWorkflowsUseCase,
} from '../../application/workflow/workflow.use-cases.js';
import { randomUUID } from 'node:crypto';

const LEADER_LOCK_KEY = 'platform:lock:edge-workflow-worker';
const LEADER_LOCK_TTL_SECONDS = 20;

/**
 * P7.4 worker loop: JobScheduler every:Ns → claim (TX) → handler OUTSIDE TX → persist with fencing.
 * Optional Redis leader lock (same family as marketing wait worker).
 */
@Injectable()
export class WorkflowWorkerBootstrap implements OnModuleInit {
  private readonly instanceId = randomUUID();

  constructor(
    @Inject(JOB_SCHEDULER_PORT) private readonly scheduler: JobSchedulerPort,
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly cache: CacheService,
    private readonly claim: ClaimStepUseCase,
    private readonly execute: ExecuteClaimedStepUseCase,
    private readonly reconcile: ReconcileWorkflowsUseCase,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit(): void {
    const enabled = (this.config as { WORKFLOW_WORKER_ENABLED?: boolean }).WORKFLOW_WORKER_ENABLED;
    if (enabled === false) {
      this.logger.info('Workflow worker disabled (WORKFLOW_WORKER_ENABLED=false)');
      return;
    }

    const intervalSeconds =
      (this.config as { WORKFLOW_WORKER_INTERVAL_SECONDS?: number }).WORKFLOW_WORKER_INTERVAL_SECONDS ??
      5;
    const reconcileSeconds =
      (this.config as { WORKFLOW_RECONCILE_INTERVAL_SECONDS?: number })
        .WORKFLOW_RECONCILE_INTERVAL_SECONDS ?? 30;

    this.scheduler.register({
      name: 'edge-workflow-worker-poll',
      cronExpression: `every:${intervalSeconds}s`,
      handler: async () => {
        await this.pollOnce();
      },
    });

    this.scheduler.register({
      name: 'edge-workflow-reconcile',
      cronExpression: `every:${reconcileSeconds}s`,
      handler: async () => {
        const acquired = await this.cache.setNx(
          LEADER_LOCK_KEY,
          this.instanceId,
          LEADER_LOCK_TTL_SECONDS,
        );
        if (!acquired) return;
        try {
          const result = await this.reconcile.execute({
            actorId: `system:workflow-reconcile:${this.instanceId}`,
            limit: 50,
          });
          if (result.count > 0) {
            this.logger.info('Workflow reconcile batch', {
              count: result.count,
              actions: result.actions.slice(0, 20),
            });
          }
        } finally {
          await this.cache.releaseLock(LEADER_LOCK_KEY, this.instanceId);
        }
      },
    });

    this.logger.info('Workflow worker jobs registered', { intervalSeconds, reconcileSeconds });
  }

  /** Claim inside repo TX; execute handler outside; persist outcome with fencing. */
  async pollOnce(): Promise<void> {
    const workerId =
      (this.config as { WORKFLOW_WORKER_ID?: string }).WORKFLOW_WORKER_ID ??
      `workflow-worker:${this.instanceId}`;
    const leaseMs =
      (this.config as { WORKFLOW_STEP_LEASE_MS?: number }).WORKFLOW_STEP_LEASE_MS ?? 30_000;

    const claimed = await this.claim.execute({ workerId, leaseMs });
    if (!claimed) return;

    // Handler execution MUST stay outside any open DB transaction.
    try {
      await this.execute.execute({
        step: claimed.step,
        workflow: claimed.workflow,
        workerId,
      });
    } catch (error) {
      this.logger.warn('Workflow step handler failed after claim', {
        stepId: claimed.step.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

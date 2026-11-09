import { Injectable, Inject, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import { CacheService } from '../../../../shared/database/cache.service.js';
import { LoggerService } from '../../../../shared/logging/logger.service.js';
import { ResumeWaitingMarketingJourneysUseCase } from '../../application/marketing/marketing-orchestration.use-cases.js';

const LEADER_LOCK_KEY = 'platform:lock:marketing-journey-wait-worker';
const LEADER_LOCK_TTL_SECONDS = 20;

/**
 * Polls due journey WAIT schedules and resumes them.
 * Leader-locked so multi-instance deployments do not double-resume.
 */
@Injectable()
export class MarketingJourneyWaitWorker implements OnModuleInit, OnModuleDestroy {
  private interval: ReturnType<typeof setInterval> | null = null;
  private readonly instanceId = randomUUID();
  private running = false;

  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly cache: CacheService,
    private readonly logger: LoggerService,
    private readonly resumeWaits: ResumeWaitingMarketingJourneysUseCase,
  ) {}

  onModuleInit(): void {
    if (!this.config.MARKETING_WAIT_WORKER_ENABLED) {
      this.logger.info('Marketing journey WAIT worker disabled');
      return;
    }
    const intervalMs = this.config.MARKETING_WAIT_POLL_INTERVAL_MS;
    this.interval = setInterval(() => {
      void this.tick();
    }, intervalMs);
    this.logger.info('Marketing journey WAIT worker started', { intervalMs });
  }

  onModuleDestroy(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const acquired = await this.cache.setNx(
        LEADER_LOCK_KEY,
        this.instanceId,
        LEADER_LOCK_TTL_SECONDS,
      );
      if (!acquired) return;

      try {
        const result = await this.resumeWaits.execute({
          limit: this.config.MARKETING_WAIT_BATCH_SIZE,
        });
        if (result.processed > 0) {
          this.logger.info('Marketing journey WAIT resume batch', {
            processed: result.processed,
            statuses: result.results.map((r) => r.status),
          });
        }
      } finally {
        await this.cache.releaseLock(LEADER_LOCK_KEY, this.instanceId);
      }
    } catch (error) {
      this.logger.warn('Marketing journey WAIT worker tick failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.running = false;
    }
  }
}

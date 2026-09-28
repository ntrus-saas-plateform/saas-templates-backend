import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { JobSchedulerPort, ScheduledJob } from '../../core/domain/ports/job-scheduler.port.js';
import { RedisDistributedLock } from './redis-distributed-lock.js';
import { LoggerService } from '../logging/logger.service.js';

interface RegisteredJob extends ScheduledJob {
  intervalMs: number;
  timer: ReturnType<typeof setInterval> | null;
}

@Injectable()
export class JobSchedulerService implements JobSchedulerPort, OnModuleInit, OnModuleDestroy {
  private readonly jobs = new Map<string, RegisteredJob>();
  private running = false;

  constructor(
    private readonly lock: RedisDistributedLock,
    private readonly logger: LoggerService,
  ) {}

  register(job: ScheduledJob): void {
    const intervalMs = parseCronToInterval(job.cronExpression);
    this.jobs.set(job.name, { ...job, intervalMs, timer: null });
  }

  onModuleInit(): void {
    this.start();
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    for (const [name, job] of this.jobs) {
      job.timer = setInterval(() => {
        void this.executeJob(name);
      }, job.intervalMs);
    }

    this.logger.info('Job scheduler started', { jobCount: this.jobs.size });
  }

  stop(): void {
    this.running = false;
    for (const job of this.jobs.values()) {
      if (job.timer) clearInterval(job.timer);
      job.timer = null;
    }
  }

  onModuleDestroy(): void {
    this.stop();
  }

  private async executeJob(name: string): Promise<void> {
    const job = this.jobs.get(name);
    if (!job) return;

    const lockKey = `scheduler:lock:${name}`;
    await this.lock.withLock(lockKey, 300, async () => {
      this.logger.debug(`Executing scheduled job: ${name}`);
      try {
        await job.handler();
      } catch (error) {
        this.logger.error(
          `Scheduled job failed: ${name}`,
          error instanceof Error ? error : undefined,
        );
      }
    });
  }
}

function parseCronToInterval(cron: string): number {
  if (cron.startsWith('every:')) {
    const seconds = Number(cron.replace('every:', '').replace('s', ''));
    return seconds * 1000;
  }
  return 60_000;
}

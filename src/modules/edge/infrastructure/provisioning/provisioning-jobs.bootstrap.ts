import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import { JOB_SCHEDULER_PORT } from '../../../../core/domain/ports/job-scheduler.port.js';
import type { JobSchedulerPort } from '../../../../core/domain/ports/job-scheduler.port.js';
import { LoggerService } from '../../../../shared/logging/logger.service.js';
import { ProcessProvisioningJobsUseCase } from '../../application/provisioning/process-provisioning-jobs.use-case.js';

/**
 * Registers provisioning job worker when EDGE_PROVISIONING_JOBS_ENABLED=true.
 * Default off — enable after migrate 134 + deferred advance mode (doc 39/40).
 */
@Injectable()
export class ProvisioningJobsBootstrap implements OnModuleInit {
  constructor(
    @Inject(JOB_SCHEDULER_PORT) private readonly scheduler: JobSchedulerPort,
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly processJobs: ProcessProvisioningJobsUseCase,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit(): void {
    if (!this.config.EDGE_PROVISIONING_JOBS_ENABLED) {
      this.logger.info('Provisioning jobs disabled (EDGE_PROVISIONING_JOBS_ENABLED=false)');
      return;
    }

    const interval = this.config.EDGE_PROVISIONING_JOBS_INTERVAL_SECONDS;
    const limit = this.config.EDGE_PROVISIONING_JOBS_BATCH_SIZE;

    this.scheduler.register({
      name: 'edge-provisioning-jobs-process',
      cronExpression: `every:${interval}s`,
      handler: async () => {
        const result = await this.processJobs.execute({
          limit,
          actorId: 'system:provisioning-jobs',
        });
        this.logger.info(
          'Provisioning jobs tick completed',
          result as unknown as Record<string, unknown>,
        );
      },
    });

    this.logger.info('Provisioning jobs registered', { intervalSeconds: interval, batchSize: limit });
  }
}

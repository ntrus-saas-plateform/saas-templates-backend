import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import { JOB_SCHEDULER_PORT } from '../../../../core/domain/ports/job-scheduler.port.js';
import type { JobSchedulerPort } from '../../../../core/domain/ports/job-scheduler.port.js';
import { LoggerService } from '../../../../shared/logging/logger.service.js';
import { ProcessDueBillingSchedulesUseCase } from '../../application/billing/billing-lifecycle.use-cases.js';
import { MarkOverdueInvoicesUseCase } from '../../application/billing/billing-lifecycle.use-cases.js';

/**
 * Registers P6 billing background jobs when BILLING_JOBS_ENABLED=true.
 * Default off — operators enable after migrate 090–094.
 */
@Injectable()
export class BillingJobsBootstrap implements OnModuleInit {
  constructor(
    @Inject(JOB_SCHEDULER_PORT) private readonly scheduler: JobSchedulerPort,
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly processDue: ProcessDueBillingSchedulesUseCase,
    private readonly markOverdue: MarkOverdueInvoicesUseCase,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit(): void {
    if (!this.config.BILLING_JOBS_ENABLED) {
      this.logger.info('Billing jobs disabled (BILLING_JOBS_ENABLED=false)');
      return;
    }

    this.scheduler.register({
      name: 'edge-billing-process-due-schedules',
      cronExpression: `every:${this.config.BILLING_PROCESS_DUE_INTERVAL_SECONDS}s`,
      handler: async () => {
        const result = await this.processDue.execute({
          actorId: 'system:billing-process-due',
        });
        this.logger.info('Billing process-due completed', result as unknown as Record<string, unknown>);
      },
    });

    this.scheduler.register({
      name: 'edge-billing-mark-overdue',
      cronExpression: `every:${this.config.BILLING_OVERDUE_INTERVAL_SECONDS}s`,
      handler: async () => {
        const result = await this.markOverdue.execute({
          actorId: 'system:billing-mark-overdue',
        });
        this.logger.info('Billing mark-overdue completed', result as unknown as Record<string, unknown>);
      },
    });

    this.logger.info('Billing jobs registered', {
      processDueSeconds: this.config.BILLING_PROCESS_DUE_INTERVAL_SECONDS,
      overdueSeconds: this.config.BILLING_OVERDUE_INTERVAL_SECONDS,
    });
  }
}

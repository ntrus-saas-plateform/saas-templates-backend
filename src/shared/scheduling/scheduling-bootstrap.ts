import { Injectable, OnModuleInit } from '@nestjs/common';
import { JobSchedulerService } from './job-scheduler.service.js';
import { TenantDatabaseManager } from '../database/tenant-database.manager.js';
import { LoggerService } from '../logging/logger.service.js';

@Injectable()
export class SchedulingBootstrap implements OnModuleInit {
  constructor(
    private readonly scheduler: JobSchedulerService,
    private readonly dbManager: TenantDatabaseManager,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit(): void {
    this.scheduler.register({
      name: 'control-plane-health-check',
      cronExpression: 'every:60s',
      handler: async () => {
        const health = await this.dbManager.healthCheck();
        this.logger.debug('Control plane health check', { ...health });
      },
    });
  }
}

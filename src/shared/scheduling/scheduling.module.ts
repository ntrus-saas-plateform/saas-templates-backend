import { Global, Module } from '@nestjs/common';
import { JOB_SCHEDULER_PORT } from '../../core/domain/ports/job-scheduler.port.js';
import { JobSchedulerService } from './job-scheduler.service.js';
import { RedisDistributedLock } from './redis-distributed-lock.js';
import { SchedulingBootstrap } from './scheduling-bootstrap.js';

@Global()
@Module({
  providers: [
    RedisDistributedLock,
    JobSchedulerService,
    SchedulingBootstrap,
    { provide: JOB_SCHEDULER_PORT, useExisting: JobSchedulerService },
  ],
  exports: [JOB_SCHEDULER_PORT, RedisDistributedLock, JobSchedulerService],
})
export class SchedulingModule {}

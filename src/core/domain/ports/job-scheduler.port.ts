export interface ScheduledJob {
  readonly name: string;
  readonly cronExpression: string;
  readonly handler: () => Promise<void>;
}

export interface JobSchedulerPort {
  register(job: ScheduledJob): void;
  start(): void;
  stop(): void;
}

export const JOB_SCHEDULER_PORT = Symbol('JOB_SCHEDULER_PORT');

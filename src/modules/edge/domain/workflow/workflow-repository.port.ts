import type {
  WorkflowAttemptRecord,
  WorkflowCheckpointRecord,
  WorkflowCompensationRecord,
  WorkflowDeadLetterRecord,
  WorkflowDefinitionRecord,
  WorkflowDefinitionSnapshot,
  WorkflowDefinitionStatus,
  WorkflowDefinitionVersionRecord,
  WorkflowHistoryEntry,
  WorkflowHistoryResourceType,
  WorkflowHumanTaskRecord,
  WorkflowInstanceRecord,
  WorkflowInstanceState,
  WorkflowStepRecord,
  WorkflowStepStatus,
  WorkflowWorkerRecord,
} from './workflow.types.js';

export const WORKFLOW_REPOSITORY_PORT = Symbol('WORKFLOW_REPOSITORY_PORT');

export interface WorkflowListFilter {
  limit?: number;
  offset?: number;
  status?: string;
  q?: string;
}

export interface ClaimStepResult {
  step: WorkflowStepRecord;
  workflow: WorkflowInstanceRecord;
  attempt: WorkflowAttemptRecord;
}

export interface WorkflowRepositoryPort {
  // Definitions
  createDefinition(
    input: Omit<WorkflowDefinitionRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      version?: number;
      draftSnapshot: WorkflowDefinitionSnapshot;
    },
    client?: unknown,
  ): Promise<{ definition: WorkflowDefinitionRecord; version: WorkflowDefinitionVersionRecord }>;
  updateDefinitionDraft(
    id: string,
    patch: Partial<WorkflowDefinitionRecord> & { draftSnapshot?: WorkflowDefinitionSnapshot },
    expectedVersion: number,
    client?: unknown,
  ): Promise<WorkflowDefinitionRecord>;
  getDefinition(id: string): Promise<WorkflowDefinitionRecord | null>;
  getDefinitionByCode(code: string): Promise<WorkflowDefinitionRecord | null>;
  listDefinitions(
    filter: WorkflowListFilter,
  ): Promise<{ items: WorkflowDefinitionRecord[]; total: number }>;
  getDefinitionVersion(
    definitionId: string,
    versionNumber: number,
  ): Promise<WorkflowDefinitionVersionRecord | null>;
  getLatestDefinitionVersion(
    definitionId: string,
  ): Promise<WorkflowDefinitionVersionRecord | null>;
  setDefinitionStatus(
    id: string,
    status: WorkflowDefinitionStatus,
    expectedVersion: number,
    meta: { approvedBy?: string | null; publishedAt?: Date | null },
    client?: unknown,
  ): Promise<WorkflowDefinitionRecord>;
  publishDefinitionVersion(
    definitionId: string,
    versionNumber: number,
    snapshot: WorkflowDefinitionSnapshot,
    client?: unknown,
  ): Promise<WorkflowDefinitionVersionRecord>;

  // Instances
  createInstance(
    input: Omit<WorkflowInstanceRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      version?: number;
    },
    client?: unknown,
  ): Promise<WorkflowInstanceRecord>;
  getInstance(id: string): Promise<WorkflowInstanceRecord | null>;
  getInstanceByIdempotencyKey(key: string): Promise<WorkflowInstanceRecord | null>;
  listInstances(
    filter: WorkflowListFilter & { workflowType?: string },
  ): Promise<{ items: WorkflowInstanceRecord[]; total: number }>;
  updateInstanceState(
    id: string,
    patch: Partial<WorkflowInstanceRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<WorkflowInstanceRecord>;
  listInstancesForReconcile(limit: number): Promise<WorkflowInstanceRecord[]>;

  // Steps
  createSteps(
    steps: Array<
      Omit<WorkflowStepRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & { version?: number }
    >,
    client?: unknown,
  ): Promise<WorkflowStepRecord[]>;
  getStep(id: string): Promise<WorkflowStepRecord | null>;
  listSteps(workflowId: string): Promise<WorkflowStepRecord[]>;
  updateStep(
    id: string,
    patch: Partial<WorkflowStepRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<WorkflowStepRecord>;
  /**
   * Atomically claim one eligible READY/RETRY_PENDING step with FOR UPDATE SKIP LOCKED.
   * Increments fencing token and sets lease.
   */
  claimStepForUpdateSkipLocked(params: {
    workerId: string;
    leaseMs: number;
    handlerKeys?: string[];
    client?: unknown;
  }): Promise<ClaimStepResult | null>;
  renewLease(params: {
    stepId: string;
    workerId: string;
    fencingToken: number;
    expectedVersion: number;
    leaseMs: number;
    client?: unknown;
  }): Promise<WorkflowStepRecord>;
  completeStep(params: {
    stepId: string;
    workerId: string;
    fencingToken: number;
    expectedVersion: number;
    outputSnapshot: Record<string, unknown>;
    client?: unknown;
  }): Promise<WorkflowStepRecord>;
  failStep(params: {
    stepId: string;
    workerId: string;
    fencingToken: number;
    expectedVersion: number;
    errorClass: string;
    diagnostics?: Record<string, unknown>;
    nextStatus: WorkflowStepStatus;
    nextRetryAt?: Date | null;
    client?: unknown;
  }): Promise<WorkflowStepRecord>;
  listExpiredLeases(now: Date, limit: number): Promise<WorkflowStepRecord[]>;
  listDueRetries(now: Date, limit: number): Promise<WorkflowStepRecord[]>;

  // Attempts / checkpoints
  appendAttempt(
    input: Omit<WorkflowAttemptRecord, 'id' | 'createdAt'>,
    client?: unknown,
  ): Promise<WorkflowAttemptRecord>;
  listAttempts(workflowId: string): Promise<WorkflowAttemptRecord[]>;
  createCheckpoint(
    input: Omit<WorkflowCheckpointRecord, 'id' | 'createdAt'>,
    client?: unknown,
  ): Promise<WorkflowCheckpointRecord>;
  listCheckpoints(workflowId: string): Promise<WorkflowCheckpointRecord[]>;

  // Compensations
  createCompensation(
    input: Omit<WorkflowCompensationRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      version?: number;
    },
    client?: unknown,
  ): Promise<WorkflowCompensationRecord>;
  listCompensations(workflowId: string): Promise<WorkflowCompensationRecord[]>;
  updateCompensation(
    id: string,
    patch: Partial<WorkflowCompensationRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<WorkflowCompensationRecord>;

  // Human tasks
  createHumanTask(
    input: Omit<WorkflowHumanTaskRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      version?: number;
    },
    client?: unknown,
  ): Promise<WorkflowHumanTaskRecord>;
  getHumanTask(id: string): Promise<WorkflowHumanTaskRecord | null>;
  listHumanTasks(
    filter: WorkflowListFilter & { workflowId?: string },
  ): Promise<{ items: WorkflowHumanTaskRecord[]; total: number }>;
  updateHumanTask(
    id: string,
    patch: Partial<WorkflowHumanTaskRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<WorkflowHumanTaskRecord>;
  listExpiredHumanTasks(now: Date, limit: number): Promise<WorkflowHumanTaskRecord[]>;

  // History / DLQ / workers
  appendHistory(
    entry: Omit<WorkflowHistoryEntry, 'id' | 'createdAt'>,
    client?: unknown,
  ): Promise<WorkflowHistoryEntry>;
  listHistory(
    filter: WorkflowListFilter & {
      workflowId?: string;
      resourceType?: WorkflowHistoryResourceType | string;
      resourceId?: string;
    },
  ): Promise<{ items: WorkflowHistoryEntry[]; total: number }>;
  createDeadLetter(
    input: Omit<WorkflowDeadLetterRecord, 'id' | 'createdAt' | 'resolvedAt' | 'resolvedBy'>,
    client?: unknown,
  ): Promise<WorkflowDeadLetterRecord>;
  listDeadLetters(
    filter: WorkflowListFilter,
  ): Promise<{ items: WorkflowDeadLetterRecord[]; total: number }>;

  upsertWorker(
    input: {
      workerId: string;
      identity: string;
      workerVersion: string;
      status?: WorkflowWorkerRecord['status'];
      metadata?: Record<string, unknown>;
    },
    client?: unknown,
  ): Promise<WorkflowWorkerRecord>;
  heartbeatWorker(
    workerId: string,
    metadata?: Record<string, unknown>,
    client?: unknown,
  ): Promise<WorkflowWorkerRecord>;
  getWorker(workerId: string): Promise<WorkflowWorkerRecord | null>;
  listWorkers(
    filter: WorkflowListFilter,
  ): Promise<{ items: WorkflowWorkerRecord[]; total: number }>;
}

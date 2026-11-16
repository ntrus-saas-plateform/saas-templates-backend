import { WorkflowStepStatus, type WorkflowStepRecord } from './workflow.types.js';

export const WORKFLOW_LEASE_PORT = Symbol('WORKFLOW_LEASE_PORT');

/**
 * P7.4 authoritative lease/fencing validation.
 *
 * A fencing token is only meaningful when compared against the token the
 * engine CURRENTLY holds for the step — never against a value supplied by the
 * caller. `assertFencingToken(x, x)` is therefore worthless as stale-worker
 * protection: this port is the authoritative check used immediately before any
 * external mutation (P7.7 mandate §2).
 */
export type LeaseValidationReason =
  | 'DEPENDENCY_UNAVAILABLE'
  | 'STEP_NOT_FOUND'
  | 'WORKFLOW_MISMATCH'
  | 'MISSING_TOKEN'
  | 'MALFORMED_TOKEN'
  | 'STALE_TOKEN'
  | 'TOKEN_AHEAD'
  | 'WRONG_WORKER'
  | 'LEASE_NOT_HELD'
  | 'LEASE_EXPIRED'
  | 'LEASE_RECLAIMED'
  | 'STEP_NOT_EXECUTABLE';

export type LeaseValidationResult =
  | {
      valid: true;
      fencingToken: number;
      ownerWorkerId: string | null;
      leaseExpiresAt: Date | null;
      status: WorkflowStepStatus;
    }
  | { valid: false; reason: LeaseValidationReason; detail?: string };

export interface WorkflowLeasePort {
  /**
   * Validate the caller's claim on a step against the persisted lease state.
   * Fail-closed: any missing/malformed/expired/reclaimed state is a rejection.
   */
  validateLease(params: {
    workflowId: string;
    stepId: string;
    workerId: string;
    fencingToken: number;
    /** Injection point for deterministic tests (defaults to now). */
    now?: Date;
  }): Promise<LeaseValidationResult>;
}

/** Statuses in which a worker legitimately holds a live lease. */
const EXECUTABLE_STATUSES: ReadonlySet<string> = new Set<string>([
  WorkflowStepStatus.CLAIMED,
  WorkflowStepStatus.RUNNING,
  WorkflowStepStatus.COMPENSATING,
]);

/**
 * Authoritative implementation: reads the persisted step row (the same row the
 * engine fences writes with) and rejects stale/expired/reclaimed claims.
 */
export class RepositoryWorkflowLeaseValidator implements WorkflowLeasePort {
  constructor(
    private readonly getStep: (stepId: string) => Promise<WorkflowStepRecord | null>,
  ) {}

  async validateLease(params: {
    workflowId: string;
    stepId: string;
    workerId: string;
    fencingToken: number;
    now?: Date;
  }): Promise<LeaseValidationResult> {
    if (!Number.isInteger(params.fencingToken)) {
      return { valid: false, reason: 'MALFORMED_TOKEN', detail: 'not an integer' };
    }
    if (params.fencingToken < 1) {
      return {
        valid: false,
        reason: 'MISSING_TOKEN',
        detail: 'token 0 / negative is never issued by the engine',
      };
    }
    if (!params.stepId || !params.workflowId || !params.workerId) {
      return { valid: false, reason: 'STEP_NOT_FOUND', detail: 'claim identity incomplete' };
    }

    let step: WorkflowStepRecord | null;
    try {
      step = await this.getStep(params.stepId);
    } catch {
      return { valid: false, reason: 'DEPENDENCY_UNAVAILABLE', detail: 'lease store unreachable' };
    }
    if (!step) return { valid: false, reason: 'STEP_NOT_FOUND' };
    if (step.workflowId !== params.workflowId) {
      return { valid: false, reason: 'WORKFLOW_MISMATCH', detail: 'step belongs to another workflow' };
    }

    if (step.fencingToken !== params.fencingToken) {
      return step.fencingToken > params.fencingToken
        ? {
            valid: false,
            reason: 'STALE_TOKEN',
            detail: `provided ${params.fencingToken} < authoritative ${step.fencingToken}`,
          }
        : {
            valid: false,
            reason: 'TOKEN_AHEAD',
            detail: `provided ${params.fencingToken} > authoritative ${step.fencingToken}`,
          };
    }

    if (step.ownerWorkerId && step.ownerWorkerId !== params.workerId) {
      return { valid: false, reason: 'WRONG_WORKER', detail: 'lease owned by another worker' };
    }
    if (!step.leaseExpiresAt) {
      return { valid: false, reason: 'LEASE_NOT_HELD', detail: 'no active lease on step' };
    }
    const now = params.now ?? new Date();
    if (step.leaseExpiresAt.getTime() <= now.getTime()) {
      return { valid: false, reason: 'LEASE_EXPIRED', detail: 'lease expired (reclaimable)' };
    }
    if (!EXECUTABLE_STATUSES.has(String(step.status))) {
      return {
        valid: false,
        reason: 'STEP_NOT_EXECUTABLE',
        detail: `step status ${step.status} is not under lease execution`,
      };
    }

    return {
      valid: true,
      fencingToken: step.fencingToken,
      ownerWorkerId: step.ownerWorkerId,
      leaseExpiresAt: step.leaseExpiresAt,
      status: step.status,
    };
  }
}

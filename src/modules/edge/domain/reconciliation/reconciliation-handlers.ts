import type {
  WorkflowHandlerInput,
  WorkflowHandlerOutcome,
  WorkflowHandlerRegistryPort,
  WorkflowStepHandler,
} from '../workflow/workflow-handler.port.js';
import {
  RECONCILIATION_HANDLER_KEYS,
  ReconciliationErrorCode,
  type ReconciliationHandlerKey,
} from './reconciliation.types.js';

export type ReconciliationLiveExecutor = (
  input: WorkflowHandlerInput,
  key: ReconciliationHandlerKey,
) => Promise<WorkflowHandlerOutcome>;

function failure(
  code: ReconciliationErrorCode | string,
  message: string,
  diagnostics?: Record<string, unknown>,
  retryable = false,
): WorkflowHandlerOutcome {
  return {
    status: 'FAILED',
    errorClass: code,
    message,
    retryable,
    diagnostics,
  };
}

/**
 * P7.13 workflow step handler. Delegates to the live executor.
 * NEVER simulates success when the executor is absent (fail-closed).
 * Compensation → WAITING_APPROVAL (never blind delete).
 */
export class ReconciliationProvisioningHandler implements WorkflowStepHandler {
  readonly version = '1.0.0-p713';

  constructor(
    readonly key: ReconciliationHandlerKey,
    private readonly liveExecutor?: ReconciliationLiveExecutor,
  ) {}

  async execute(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    if (!this.liveExecutor) {
      return failure(
        ReconciliationErrorCode.PROVIDER_UNAVAILABLE,
        `Handler ${this.key} has no live executor wired`,
        { handlerKey: this.key },
      );
    }
    try {
      return await this.liveExecutor(input, this.key);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failure(ReconciliationErrorCode.PROVIDER_UNAVAILABLE, message, {
        handlerKey: this.key,
      });
    }
  }

  async compensate(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    void input;
    return {
      status: 'WAITING_APPROVAL',
      instructions:
        'Compensation suspended — reconciliation must not blind-delete; require operator review',
      requiredPermission: 'platform:reconciliation:approve',
    };
  }
}

export function registerReconciliationHandlers(
  registry: WorkflowHandlerRegistryPort,
  keys: readonly ReconciliationHandlerKey[] = RECONCILIATION_HANDLER_KEYS,
  liveExecutor?: ReconciliationLiveExecutor,
): void {
  for (const key of keys) {
    registry.register(new ReconciliationProvisioningHandler(key, liveExecutor));
  }
}

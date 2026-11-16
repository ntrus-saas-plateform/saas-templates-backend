import type {
  WorkflowHandlerInput,
  WorkflowHandlerOutcome,
  WorkflowHandlerRegistryPort,
  WorkflowStepHandler,
} from '../workflow/workflow-handler.port.js';
import {
  ACTIVATION_ALL_HANDLER_KEYS,
  ActivationErrorCode,
  type ActivationAllHandlerKey,
} from './activation.types.js';

export type ActivationLiveExecutor = (
  input: WorkflowHandlerInput,
  key: ActivationAllHandlerKey,
) => Promise<WorkflowHandlerOutcome>;

function failure(
  code: ActivationErrorCode | string,
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
 * P7.10 workflow step handler. Delegates to the live executor.
 * NEVER simulates success when the executor is absent (fail-closed).
 * Compensation NEVER silently marks ACTIVE — suspends for approval.
 */
export class ActivationProvisioningHandler implements WorkflowStepHandler {
  readonly version = '1.0.0-p710';

  constructor(
    readonly key: ActivationAllHandlerKey,
    private readonly liveExecutor?: ActivationLiveExecutor,
  ) {}

  async execute(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    if (!this.liveExecutor) {
      return failure(
        ActivationErrorCode.PROVIDER_UNAVAILABLE,
        `Handler ${this.key} has no live executor wired`,
        { handlerKey: this.key },
      );
    }
    try {
      return await this.liveExecutor(input, this.key);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failure(ActivationErrorCode.PROVIDER_UNAVAILABLE, message, {
        handlerKey: this.key,
      });
    }
  }

  async compensate(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    void input;
    // Fail-closed: never silently ACTIVE on compensate.
    return {
      status: 'WAITING_APPROVAL',
      instructions:
        'Compensation suspended — activation must not silently become ACTIVE; require operator review',
      requiredPermission: 'platform:activation:activate',
    };
  }
}

export function registerActivationHandlers(
  registry: WorkflowHandlerRegistryPort,
  keys: readonly ActivationAllHandlerKey[] = ACTIVATION_ALL_HANDLER_KEYS,
  liveExecutor?: ActivationLiveExecutor,
): void {
  for (const key of keys) {
    registry.register(new ActivationProvisioningHandler(key, liveExecutor));
  }
}

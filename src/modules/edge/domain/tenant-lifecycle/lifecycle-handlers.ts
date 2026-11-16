import type {
  WorkflowHandlerInput,
  WorkflowHandlerOutcome,
  WorkflowHandlerRegistryPort,
  WorkflowStepHandler,
} from '../workflow/workflow-handler.port.js';
import {
  LIFECYCLE_HANDLER_KEYS,
  LifecycleErrorCode,
  type LifecycleHandlerKey,
} from './lifecycle.types.js';

export type LifecycleLiveExecutor = (
  input: WorkflowHandlerInput,
  key: LifecycleHandlerKey,
) => Promise<WorkflowHandlerOutcome>;

function failure(
  code: LifecycleErrorCode | string,
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

const DESTRUCTIVE_KEYS = new Set<LifecycleHandlerKey>([
  'lifecycle.mark_deprovisioned',
  'lifecycle.coord_experience_deactivate',
  'lifecycle.coord_infra_quiesce',
  'lifecycle.coord_product_control_suspend',
]);

/**
 * P7.11 workflow step handler. Delegates to the live executor.
 * NEVER simulates success when the executor is absent (fail-closed).
 * Destructive compensate → WAITING_APPROVAL (never silent deprovision).
 */
export class LifecycleProvisioningHandler implements WorkflowStepHandler {
  readonly version = '1.0.0-p711';

  constructor(
    readonly key: LifecycleHandlerKey,
    private readonly liveExecutor?: LifecycleLiveExecutor,
  ) {}

  async execute(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    if (!this.liveExecutor) {
      return failure(
        LifecycleErrorCode.PROVIDER_UNAVAILABLE,
        `Handler ${this.key} has no live executor wired`,
        { handlerKey: this.key },
      );
    }
    try {
      return await this.liveExecutor(input, this.key);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failure(LifecycleErrorCode.PROVIDER_UNAVAILABLE, message, {
        handlerKey: this.key,
      });
    }
  }

  async compensate(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    void input;
    if (DESTRUCTIVE_KEYS.has(this.key) || this.key === 'lifecycle.mark_deprovisioning') {
      return {
        status: 'WAITING_APPROVAL',
        instructions:
          'Compensation suspended — destructive lifecycle steps must not silently deprovision; require operator review',
        requiredPermission: 'platform:lifecycle:deprovision',
      };
    }
    return {
      status: 'WAITING_APPROVAL',
      instructions:
        'Compensation suspended — lifecycle must not silently flip status; require operator review',
      requiredPermission: 'platform:lifecycle:suspend',
    };
  }
}

export function registerLifecycleHandlers(
  registry: WorkflowHandlerRegistryPort,
  keys: readonly LifecycleHandlerKey[] = LIFECYCLE_HANDLER_KEYS,
  liveExecutor?: LifecycleLiveExecutor,
): void {
  for (const key of keys) {
    registry.register(new LifecycleProvisioningHandler(key, liveExecutor));
  }
}

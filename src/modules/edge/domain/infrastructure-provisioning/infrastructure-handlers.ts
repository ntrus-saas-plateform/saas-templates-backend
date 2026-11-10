import type {
  WorkflowHandlerInput,
  WorkflowHandlerOutcome,
  WorkflowHandlerRegistryPort,
  WorkflowStepHandler,
} from '../workflow/workflow-handler.port.js';
import {
  INFRASTRUCTURE_HANDLER_KEYS,
  InfrastructureErrorCode,
  type InfrastructureHandlerKey,
} from './infrastructure.types.js';

export type InfrastructureLiveExecutor = (
  input: WorkflowHandlerInput,
  key: InfrastructureHandlerKey,
) => Promise<WorkflowHandlerOutcome>;

function failure(
  code: InfrastructureErrorCode,
  message: string,
  diagnostics?: Record<string, unknown>,
): WorkflowHandlerOutcome {
  return {
    status: 'FAILED',
    errorClass: code,
    message,
    retryable:
      code === InfrastructureErrorCode.TIMEOUT ||
      code === InfrastructureErrorCode.DEPENDENCY_UNAVAILABLE ||
      code === InfrastructureErrorCode.PROVIDER_UNAVAILABLE,
    diagnostics,
  };
}

/**
 * P7.6 workflow step handler. Delegates to live executor (use cases + adapters).
 * Never simulates success when executor is absent.
 */
export class InfrastructureProvisioningHandler implements WorkflowStepHandler {
  readonly version = '1.0.0-p76';

  constructor(
    readonly key: InfrastructureHandlerKey,
    private readonly liveExecutor?: InfrastructureLiveExecutor,
  ) {}

  async execute(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    if (!this.liveExecutor) {
      return failure(
        InfrastructureErrorCode.DEPENDENCY_UNAVAILABLE,
        `Handler ${this.key} has no live executor wired`,
        { handlerKey: this.key },
      );
    }
    if (!input.fencingToken && input.fencingToken !== 0) {
      return failure(
        InfrastructureErrorCode.VALIDATION,
        'fencingToken required',
        { handlerKey: this.key },
      );
    }
    try {
      return await this.liveExecutor(input, this.key);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failure(InfrastructureErrorCode.DEPENDENCY_UNAVAILABLE, message, {
        handlerKey: this.key,
      });
    }
  }

  async compensate(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    if (!this.liveExecutor) {
      return failure(
        InfrastructureErrorCode.DEPENDENCY_UNAVAILABLE,
        `Compensation for ${this.key} unavailable`,
      );
    }
    // Compensation is only safe via resource.deprovision with explicit assessment.
    if (this.key !== 'resource.deprovision') {
      return {
        status: 'WAITING_APPROVAL',
        instructions:
          'Compensation suspended — use resource.deprovision after safety assessment',
        requiredPermission: 'platform:infrastructure:deprovision',
      };
    }
    return this.liveExecutor(input, this.key);
  }
}

export function registerInfrastructureHandlers(
  registry: WorkflowHandlerRegistryPort,
  keys: readonly InfrastructureHandlerKey[] = INFRASTRUCTURE_HANDLER_KEYS,
  liveExecutor?: InfrastructureLiveExecutor,
): void {
  for (const key of keys) {
    registry.register(new InfrastructureProvisioningHandler(key, liveExecutor));
  }
}

import type {
  WorkflowHandlerInput,
  WorkflowHandlerOutcome,
  WorkflowHandlerRegistryPort,
  WorkflowStepHandler,
} from '../workflow/workflow-handler.port.js';
import {
  ConfigurationErrorCode,
  CONFIGURATION_HANDLER_KEYS,
  type ConfigurationHandlerKey,
} from './configuration.types.js';

export type ConfigurationLiveExecutor = (
  input: WorkflowHandlerInput,
  key: ConfigurationHandlerKey,
) => Promise<WorkflowHandlerOutcome>;

function failure(
  code: ConfigurationErrorCode | string,
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
 * P7.8 workflow step handler. Delegates to the live executor (registry apply +
 * entitlement deploy). NEVER simulates success when the executor is absent.
 */
export class ConfigurationProvisioningHandler implements WorkflowStepHandler {
  readonly version = '1.0.0-p78';

  constructor(
    readonly key: ConfigurationHandlerKey,
    private readonly liveExecutor?: ConfigurationLiveExecutor,
  ) {}

  async execute(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    if (!this.liveExecutor) {
      return failure(
        ConfigurationErrorCode.PROVIDER_UNAVAILABLE,
        `Handler ${this.key} has no live executor wired`,
        { handlerKey: this.key },
      );
    }
    try {
      return await this.liveExecutor(input, this.key);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failure(ConfigurationErrorCode.PROVIDER_UNAVAILABLE, message, {
        handlerKey: this.key,
      });
    }
  }

  async compensate(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    if (!this.liveExecutor) {
      return failure(
        ConfigurationErrorCode.PROVIDER_UNAVAILABLE,
        `Compensation for ${this.key} unavailable`,
      );
    }
    if (this.key !== 'configuration.rollback_bundle') {
      return {
        status: 'WAITING_APPROVAL',
        instructions:
          'Compensation suspended — use configuration.rollback_bundle after entitlement safety assessment',
        requiredPermission: 'platform:configuration:rollback',
      };
    }
    return this.liveExecutor(input, this.key);
  }
}

export function registerConfigurationHandlers(
  registry: WorkflowHandlerRegistryPort,
  keys: readonly ConfigurationHandlerKey[] = CONFIGURATION_HANDLER_KEYS,
  liveExecutor?: ConfigurationLiveExecutor,
): void {
  for (const key of keys) {
    registry.register(new ConfigurationProvisioningHandler(key, liveExecutor));
  }
}

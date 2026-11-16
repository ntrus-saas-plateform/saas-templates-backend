import type {
  WorkflowHandlerInput,
  WorkflowHandlerOutcome,
  WorkflowHandlerRegistryPort,
  WorkflowStepHandler,
} from '../workflow/workflow-handler.port.js';
import {
  CONNECTIVITY_AGENT_HANDLER_KEYS,
  ConnectivityAgentErrorCode,
  type ConnectivityAgentHandlerKey,
} from './connectivity-agent.types.js';

export type ConnectivityAgentLiveExecutor = (
  input: WorkflowHandlerInput,
  key: ConnectivityAgentHandlerKey,
) => Promise<WorkflowHandlerOutcome>;

function failure(
  code: ConnectivityAgentErrorCode | string,
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
 * P7.14 workflow step handler. Delegates to the live executor.
 * NEVER simulates success when the executor is absent (fail-closed).
 */
export class ConnectivityAgentProvisioningHandler implements WorkflowStepHandler {
  readonly version = '1.0.0-p714';

  constructor(
    readonly key: ConnectivityAgentHandlerKey,
    private readonly liveExecutor?: ConnectivityAgentLiveExecutor,
  ) {}

  async execute(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    if (!this.liveExecutor) {
      return failure(
        ConnectivityAgentErrorCode.PROVIDER_UNAVAILABLE,
        `Handler ${this.key} has no live executor wired`,
        { handlerKey: this.key },
      );
    }
    try {
      return await this.liveExecutor(input, this.key);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failure(ConnectivityAgentErrorCode.PROVIDER_UNAVAILABLE, message, {
        handlerKey: this.key,
      });
    }
  }

  async compensate(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    void input;
    return {
      status: 'WAITING_APPROVAL',
      instructions:
        'Compensation suspended — connectivity agent mutations require operator review (no silent re-enable)',
      requiredPermission: 'platform:agents:revoke',
    };
  }
}

export function registerConnectivityAgentHandlers(
  registry: WorkflowHandlerRegistryPort,
  keys: readonly ConnectivityAgentHandlerKey[] = CONNECTIVITY_AGENT_HANDLER_KEYS,
  liveExecutor?: ConnectivityAgentLiveExecutor,
): void {
  for (const key of keys) {
    registry.register(new ConnectivityAgentProvisioningHandler(key, liveExecutor));
  }
}

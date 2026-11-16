import type {
  WorkflowHandlerInput,
  WorkflowHandlerOutcome,
  WorkflowHandlerRegistryPort,
  WorkflowStepHandler,
} from '../workflow/workflow-handler.port.js';
import {
  ONBOARDING_HANDLER_KEYS,
  OnboardingErrorCode,
  type OnboardingHandlerKey,
} from './onboarding.types.js';

export type OnboardingLiveExecutor = (
  input: WorkflowHandlerInput,
  key: OnboardingHandlerKey,
) => Promise<WorkflowHandlerOutcome>;

function failure(
  code: OnboardingErrorCode | string,
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
 * P7.12 workflow step handler. Delegates to the live executor.
 * NEVER simulates success when the executor is absent (fail-closed).
 * Compensation → WAITING_APPROVAL (never silent close / never invent CRM).
 */
export class OnboardingProvisioningHandler implements WorkflowStepHandler {
  readonly version = '1.0.0-p712';

  constructor(
    readonly key: OnboardingHandlerKey,
    private readonly liveExecutor?: OnboardingLiveExecutor,
  ) {}

  async execute(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    if (!this.liveExecutor) {
      return failure(
        OnboardingErrorCode.PROVIDER_UNAVAILABLE,
        `Handler ${this.key} has no live executor wired`,
        { handlerKey: this.key },
      );
    }
    try {
      return await this.liveExecutor(input, this.key);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failure(OnboardingErrorCode.PROVIDER_UNAVAILABLE, message, {
        handlerKey: this.key,
      });
    }
  }

  async compensate(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    void input;
    return {
      status: 'WAITING_APPROVAL',
      instructions:
        'Compensation suspended — onboarding must not silently close or invent CRM invites; require operator review',
      requiredPermission: 'platform:onboarding:close',
    };
  }
}

export function registerOnboardingHandlers(
  registry: WorkflowHandlerRegistryPort,
  keys: readonly OnboardingHandlerKey[] = ONBOARDING_HANDLER_KEYS,
  liveExecutor?: OnboardingLiveExecutor,
): void {
  for (const key of keys) {
    registry.register(new OnboardingProvisioningHandler(key, liveExecutor));
  }
}

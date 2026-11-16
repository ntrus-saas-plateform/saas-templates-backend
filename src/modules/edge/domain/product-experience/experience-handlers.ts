import type {
  WorkflowHandlerInput,
  WorkflowHandlerOutcome,
  WorkflowHandlerRegistryPort,
  WorkflowStepHandler,
} from '../workflow/workflow-handler.port.js';
import {
  EXPERIENCE_HANDLER_KEYS,
  ExperienceErrorCode,
  type ExperienceHandlerKey,
} from './experience.types.js';

export type ExperienceLiveExecutor = (
  input: WorkflowHandlerInput,
  key: ExperienceHandlerKey,
) => Promise<WorkflowHandlerOutcome>;

function failure(
  code: ExperienceErrorCode | string,
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
 * P7.9 workflow step handler. Delegates to the live executor.
 * NEVER simulates success when the executor is absent (fail-closed).
 * Does NOT manage business IAM users/roles/memberships/organizations.
 */
export class ExperienceProvisioningHandler implements WorkflowStepHandler {
  readonly version = '1.0.0-p79';

  constructor(
    readonly key: ExperienceHandlerKey,
    private readonly liveExecutor?: ExperienceLiveExecutor,
  ) {}

  async execute(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    if (!this.liveExecutor) {
      return failure(
        ExperienceErrorCode.PROVIDER_UNAVAILABLE,
        `Handler ${this.key} has no live executor wired`,
        { handlerKey: this.key },
      );
    }
    try {
      return await this.liveExecutor(input, this.key);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failure(ExperienceErrorCode.PROVIDER_UNAVAILABLE, message, {
        handlerKey: this.key,
      });
    }
  }

  async compensate(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    if (!this.liveExecutor) {
      return failure(
        ExperienceErrorCode.PROVIDER_UNAVAILABLE,
        `Compensation for ${this.key} unavailable`,
      );
    }
    if (this.key !== 'experience.deactivate') {
      return {
        status: 'WAITING_APPROVAL',
        instructions:
          'Compensation suspended — use experience.deactivate after ownership/TLS safety assessment',
        requiredPermission: 'platform:experience:deploy',
      };
    }
    return this.liveExecutor(input, this.key);
  }
}

export function registerExperienceHandlers(
  registry: WorkflowHandlerRegistryPort,
  keys: readonly ExperienceHandlerKey[] = EXPERIENCE_HANDLER_KEYS,
  liveExecutor?: ExperienceLiveExecutor,
): void {
  for (const key of keys) {
    registry.register(new ExperienceProvisioningHandler(key, liveExecutor));
  }
}

import type {
  WorkflowHandlerInput,
  WorkflowHandlerOutcome,
  WorkflowHandlerRegistryPort,
  WorkflowStepHandler,
} from '../workflow/workflow-handler.port.js';
import {
  CERTIFICATION_HANDLER_KEYS,
  CertificationErrorCode,
  type CertificationHandlerKey,
} from './certification.types.js';

export type CertificationLiveExecutor = (
  input: WorkflowHandlerInput,
  key: CertificationHandlerKey,
) => Promise<WorkflowHandlerOutcome>;

function failure(
  code: CertificationErrorCode | string,
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
 * P7.15 workflow step handler. Delegates to the live executor.
 * NEVER simulates success when the executor is absent (fail-closed).
 */
export class CertificationProvisioningHandler implements WorkflowStepHandler {
  readonly version = '1.0.0-p715';

  constructor(
    readonly key: CertificationHandlerKey,
    private readonly liveExecutor?: CertificationLiveExecutor,
  ) {}

  async execute(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    if (!this.liveExecutor) {
      return failure(
        CertificationErrorCode.PROVIDER_UNAVAILABLE,
        `Handler ${this.key} has no live executor wired`,
        { handlerKey: this.key },
      );
    }
    try {
      return await this.liveExecutor(input, this.key);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failure(CertificationErrorCode.PROVIDER_UNAVAILABLE, message, {
        handlerKey: this.key,
      });
    }
  }

  async compensate(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    void input;
    return {
      status: 'WAITING_APPROVAL',
      instructions:
        'Compensation suspended — certification must not silently re-certify; require operator review',
      requiredPermission: 'platform:certification:certify',
    };
  }
}

export function registerCertificationHandlers(
  registry: WorkflowHandlerRegistryPort,
  keys: readonly CertificationHandlerKey[] = CERTIFICATION_HANDLER_KEYS,
  liveExecutor?: CertificationLiveExecutor,
): void {
  for (const key of keys) {
    registry.register(new CertificationProvisioningHandler(key, liveExecutor));
  }
}

import type {
  WorkflowHandlerInput,
  WorkflowHandlerOutcome,
  WorkflowHandlerRegistryPort,
  WorkflowStepHandler,
} from '../workflow/workflow-handler.port.js';
import { KeycloakErrorCode, KEYCLOAK_HANDLER_KEYS, type KeycloakHandlerKey } from './keycloak.types.js';

export type KeycloakLiveExecutor = (
  input: WorkflowHandlerInput,
  key: KeycloakHandlerKey,
) => Promise<WorkflowHandlerOutcome>;

/**
 * Fencing discipline: the workflow engine issues monotonically increasing
 * positive integers. Token 0 / negative / non-numeric means "stale or absent"
 * and must never reach Keycloak (P7.7 fencing invariant).
 */
function isValidFencingToken(token: unknown): token is number {
  return typeof token === 'number' && Number.isInteger(token) && token >= 1;
}

function failure(
  code: KeycloakErrorCode,
  message: string,
  diagnostics?: Record<string, unknown>,
  retryable = false,
): WorkflowHandlerOutcome {
  return {
    status: 'FAILED',
    errorClass: code,
    message,
    retryable:
      retryable ||
      code === KeycloakErrorCode.TIMEOUT ||
      code === KeycloakErrorCode.DEPENDENCY_UNAVAILABLE ||
      code === KeycloakErrorCode.SERVER_UNAVAILABLE,
    diagnostics,
  };
}

/**
 * P7.7 workflow step handler. Delegates to the live executor (use cases + real
 * Keycloak adapters). NEVER simulates success when the executor is absent.
 */
export class KeycloakProvisioningHandler implements WorkflowStepHandler {
  readonly version = '1.0.0-p77';

  constructor(
    readonly key: KeycloakHandlerKey,
    private readonly liveExecutor?: KeycloakLiveExecutor,
  ) {}

  async execute(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    if (!this.liveExecutor) {
      return failure(
        KeycloakErrorCode.DEPENDENCY_UNAVAILABLE,
        `Handler ${this.key} has no live executor wired`,
        { handlerKey: this.key },
      );
    }
    if (!isValidFencingToken(input.fencingToken)) {
      return failure(
        KeycloakErrorCode.VALIDATION,
        'fencingToken required: a positive integer issued by the workflow engine',
        { handlerKey: this.key, fencingToken: input.fencingToken ?? null },
      );
    }
    try {
      return await this.liveExecutor(input, this.key);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return failure(KeycloakErrorCode.DEPENDENCY_UNAVAILABLE, message, {
        handlerKey: this.key,
      });
    }
  }

  async compensate(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    if (!this.liveExecutor) {
      return failure(
        KeycloakErrorCode.DEPENDENCY_UNAVAILABLE,
        `Compensation for ${this.key} unavailable`,
      );
    }
    // Compensation runs under the same fencing discipline as execution.
    if (!isValidFencingToken(input.fencingToken)) {
      return failure(
        KeycloakErrorCode.VALIDATION,
        'fencingToken required: a positive integer issued by the workflow engine',
        { handlerKey: this.key, fencingToken: input.fencingToken ?? null },
      );
    }
    // Only explicit deprovision is a valid compensation — and it is approval-gated.
    if (this.key !== 'keycloak.deprovision_topology') {
      return {
        status: 'WAITING_APPROVAL',
        instructions:
          'Compensation suspended — use keycloak.deprovision_topology after ownership + safety assessment',
        requiredPermission: 'platform:keycloak:deprovision',
      };
    }
    return this.liveExecutor(input, this.key);
  }
}

export function registerKeycloakHandlers(
  registry: WorkflowHandlerRegistryPort,
  keys: readonly KeycloakHandlerKey[] = KEYCLOAK_HANDLER_KEYS,
  liveExecutor?: KeycloakLiveExecutor,
): void {
  for (const key of keys) {
    registry.register(new KeycloakProvisioningHandler(key, liveExecutor));
  }
}
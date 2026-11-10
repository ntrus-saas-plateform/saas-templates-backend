import {
  FUTURE_PROVISIONING_HANDLER_KEYS,
  WorkflowErrorClass,
  type FutureProvisioningHandlerKey,
} from './workflow.types.js';

export const WORKFLOW_HANDLER_REGISTRY_PORT = Symbol('WORKFLOW_HANDLER_REGISTRY_PORT');
/** @deprecated use WORKFLOW_HANDLER_REGISTRY_PORT */
export const WORKFLOW_HANDLER_REGISTRY = WORKFLOW_HANDLER_REGISTRY_PORT;

export type WorkflowHandlerInput = {
  workflowId: string;
  stepId: string;
  stepKey: string;
  handlerKey: string;
  fencingToken: number;
  attemptNumber: number;
  inputSnapshot: Record<string, unknown>;
  workflowInput: Record<string, unknown>;
  correlationId: string;
  workerId: string;
  idempotencyKey?: string;
  executionContext?: Record<string, unknown>;
};

export type WorkflowHandlerOutcome =
  | {
      status: 'SUCCEEDED';
      outputSnapshot?: Record<string, unknown>;
      checkpoint?: Record<string, unknown>;
    }
  | {
      status: 'FAILED';
      errorClass: WorkflowErrorClass | string;
      message: string;
      diagnostics?: Record<string, unknown>;
      retryable?: boolean;
    }
  | {
      status: 'WAITING_APPROVAL';
      instructions?: string;
      requiredPermission?: string;
    };

export type WorkflowStepHandler = {
  readonly key: string;
  readonly version: string;
  execute(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome>;
  compensate?(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome>;
};

export interface WorkflowHandlerRegistryPort {
  register(handler: WorkflowStepHandler): void;
  get(handlerKey: string): WorkflowStepHandler | null;
  listKeys(): string[];
  has(handlerKey: string): boolean;
}

export class InMemoryWorkflowHandlerRegistry implements WorkflowHandlerRegistryPort {
  private readonly handlers = new Map<string, WorkflowStepHandler>();

  register(handler: WorkflowStepHandler): void {
    this.handlers.set(handler.key, handler);
  }

  get(handlerKey: string): WorkflowStepHandler | null {
    return this.handlers.get(handlerKey) ?? null;
  }

  listKeys(): string[] {
    return [...this.handlers.keys()].sort();
  }

  has(handlerKey: string): boolean {
    return this.handlers.has(handlerKey);
  }
}

/**
 * Placeholder for future P7.5 / P7.6 / P7.7 provisioning keys.
 * ALWAYS fails with DEPENDENCY_UNAVAILABLE — never simulates success.
 */
export class UnavailableProvisioningHandler implements WorkflowStepHandler {
  readonly key: string;
  readonly version = '0.0.0-unavailable';

  constructor(key: FutureProvisioningHandlerKey | string) {
    this.key = key;
  }

  async execute(_input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    return {
      status: 'FAILED',
      errorClass: WorkflowErrorClass.DEPENDENCY_UNAVAILABLE,
      message: `Handler "${this.key}" is not configured in P7.4; provisioning adapters arrive in P7.5+`,
      retryable: true,
      diagnostics: { handlerKey: this.key, available: false },
    };
  }

  async compensate(_input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    return {
      status: 'FAILED',
      errorClass: WorkflowErrorClass.DEPENDENCY_UNAVAILABLE,
      message: `Compensation for "${this.key}" is unavailable in P7.4`,
      retryable: false,
      diagnostics: { handlerKey: this.key, available: false },
    };
  }
}

export class NoopApproveHandler implements WorkflowStepHandler {
  readonly key = 'noop:approve';
  readonly version = '1.0.0';

  async execute(_input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    return {
      status: 'WAITING_APPROVAL',
      instructions: 'Operator approval required',
      requiredPermission: 'platform:workflow_task:approve',
    };
  }
}

export class NoopCheckpointHandler implements WorkflowStepHandler {
  readonly key = 'noop:checkpoint';
  readonly version = '1.0.0';

  async execute(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    return {
      status: 'SUCCEEDED',
      outputSnapshot: { checkpointed: true, at: new Date().toISOString() },
      checkpoint: { stepKey: input.stepKey, fencingToken: input.fencingToken },
    };
  }
}

export function registerUnavailableProvisioningHandlers(
  registry: WorkflowHandlerRegistryPort,
  keys: readonly string[] = FUTURE_PROVISIONING_HANDLER_KEYS,
): void {
  for (const key of keys) {
    registry.register(new UnavailableProvisioningHandler(key));
  }
}

export function createDefaultWorkflowHandlerRegistry(): InMemoryWorkflowHandlerRegistry {
  const registry = new InMemoryWorkflowHandlerRegistry();
  registry.register(new NoopApproveHandler());
  registry.register(new NoopCheckpointHandler());
  registerUnavailableProvisioningHandlers(registry);
  return registry;
}

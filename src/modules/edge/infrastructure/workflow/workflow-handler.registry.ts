import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  createDefaultWorkflowHandlerRegistry,
  type WorkflowHandlerRegistryPort,
  type WorkflowStepHandler,
} from '../../domain/workflow/workflow-handler.port.js';
import {
  registerProductControlFoundationHandlers,
  type ProductControlLiveExecutor,
} from '../../domain/product-control/product-control-handlers.js';
import { PRODUCT_CONTROL_FOUNDATION_HANDLER_KEYS } from '../../domain/product-control/product-control.types.js';

export const PRODUCT_CONTROL_LIVE_EXECUTOR = Symbol('PRODUCT_CONTROL_LIVE_EXECUTOR');

/**
 * Nest-injectable façade over the domain default registry
 * (noop:*, product_control.* foundation, unavailable/unimplemented mutative keys).
 * When a live Product Control executor is provided, foundation handlers are re-registered
 * to call use cases / HTTP client.
 */
@Injectable()
export class WorkflowHandlerRegistry implements WorkflowHandlerRegistryPort {
  private readonly inner = createDefaultWorkflowHandlerRegistry();

  constructor(
    @Optional()
    @Inject(PRODUCT_CONTROL_LIVE_EXECUTOR)
    liveExecutor?: ProductControlLiveExecutor | null,
  ) {
    if (liveExecutor) {
      registerProductControlFoundationHandlers(
        this.inner,
        PRODUCT_CONTROL_FOUNDATION_HANDLER_KEYS,
        liveExecutor,
      );
    }
  }

  register(handler: WorkflowStepHandler): void {
    this.inner.register(handler);
  }

  get(handlerKey: string): WorkflowStepHandler | null {
    return this.inner.get(handlerKey);
  }

  listKeys(): string[] {
    return this.inner.listKeys();
  }

  has(handlerKey: string): boolean {
    return this.inner.has(handlerKey);
  }
}

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
import {
  registerInfrastructureHandlers,
  type InfrastructureLiveExecutor,
} from '../../domain/infrastructure-provisioning/infrastructure-handlers.js';
import { INFRASTRUCTURE_HANDLER_KEYS } from '../../domain/infrastructure-provisioning/infrastructure.types.js';

export const PRODUCT_CONTROL_LIVE_EXECUTOR = Symbol('PRODUCT_CONTROL_LIVE_EXECUTOR');
export const INFRASTRUCTURE_LIVE_EXECUTOR = Symbol('INFRASTRUCTURE_LIVE_EXECUTOR');

/**
 * Nest-injectable façade over the domain default registry.
 * Live executors re-register P7.5 / P7.6 handlers with real use-case wiring.
 */
@Injectable()
export class WorkflowHandlerRegistry implements WorkflowHandlerRegistryPort {
  private readonly inner = createDefaultWorkflowHandlerRegistry();

  constructor(
    @Optional()
    @Inject(PRODUCT_CONTROL_LIVE_EXECUTOR)
    liveProductControl?: ProductControlLiveExecutor | null,
    @Optional()
    @Inject(INFRASTRUCTURE_LIVE_EXECUTOR)
    liveInfrastructure?: InfrastructureLiveExecutor | null,
  ) {
    if (liveProductControl) {
      registerProductControlFoundationHandlers(
        this.inner,
        PRODUCT_CONTROL_FOUNDATION_HANDLER_KEYS,
        liveProductControl,
      );
    }
    if (liveInfrastructure) {
      registerInfrastructureHandlers(
        this.inner,
        INFRASTRUCTURE_HANDLER_KEYS,
        liveInfrastructure,
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

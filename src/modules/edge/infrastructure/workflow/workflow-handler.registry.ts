import { Injectable } from '@nestjs/common';
import {
  createDefaultWorkflowHandlerRegistry,
  type WorkflowHandlerRegistryPort,
  type WorkflowStepHandler,
} from '../../domain/workflow/workflow-handler.port.js';

/**
 * Nest-injectable façade over the domain default registry
 * (noop:approve, noop:checkpoint, unavailable:p75/76/77 + future P7.5–P7.7 keys).
 */
@Injectable()
export class WorkflowHandlerRegistry implements WorkflowHandlerRegistryPort {
  private readonly inner = createDefaultWorkflowHandlerRegistry();

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

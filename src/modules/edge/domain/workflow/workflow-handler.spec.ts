import { describe, expect, it } from 'vitest';
import {
  InMemoryWorkflowHandlerRegistry,
  UnavailableProvisioningHandler,
  createDefaultWorkflowHandlerRegistry,
  registerUnavailableProvisioningHandlers,
} from './workflow-handler.port.js';
import {
  FUTURE_PROVISIONING_HANDLER_KEYS,
  WorkflowErrorClass,
} from './workflow.types.js';

describe('UnavailableProvisioningHandler', () => {
  it('always fails with DEPENDENCY_UNAVAILABLE and never succeeds', async () => {
    const handler = new UnavailableProvisioningHandler('p7.5.product_control.provision');
    const result = await handler.execute({
      workflowId: 'wf-1',
      stepId: 'step-1',
      stepKey: 'provision',
      handlerKey: handler.key,
      fencingToken: 1,
      attemptNumber: 1,
      inputSnapshot: {},
      workflowInput: {},
      correlationId: 'corr-1',
      workerId: 'worker-1',
    });
    expect(result.status).toBe('FAILED');
    if (result.status === 'FAILED') {
      expect(result.errorClass).toBe(WorkflowErrorClass.DEPENDENCY_UNAVAILABLE);
    }
  });

  it('registers future provisioning keys as unavailable', () => {
    const registry = new InMemoryWorkflowHandlerRegistry();
    registerUnavailableProvisioningHandlers(registry);
    for (const key of FUTURE_PROVISIONING_HANDLER_KEYS) {
      expect(registry.has(key)).toBe(true);
      expect(registry.get(key)).toBeInstanceOf(UnavailableProvisioningHandler);
    }
  });

  it('default registry includes noop + unavailable handlers', () => {
    const registry = createDefaultWorkflowHandlerRegistry();
    expect(registry.has('noop:approve')).toBe(true);
    expect(registry.has('noop:checkpoint')).toBe(true);
    expect(registry.has('unavailable:p75')).toBe(true);
  });
});

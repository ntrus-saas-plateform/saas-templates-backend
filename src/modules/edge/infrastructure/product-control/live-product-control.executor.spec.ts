import { describe, expect, it, vi } from 'vitest';
import { createLiveProductControlExecutor } from './live-product-control.executor.js';
import type { ControlV1BusinessBackendClient } from './control-v1-business-backend.client.js';
import type { WorkflowHandlerInput } from '../../domain/workflow/workflow-handler.port.js';

function baseInput(overrides: Partial<WorkflowHandlerInput> = {}): WorkflowHandlerInput {
  return {
    workflowId: 'wf-1',
    stepId: 'step-1',
    stepKey: 'provision',
    handlerKey: 'p7.5.product_control.provision',
    fencingToken: 1,
    attemptNumber: 1,
    inputSnapshot: { tenantId: 'tenant-abc' },
    workflowInput: {},
    correlationId: 'corr-1',
    workerId: 'worker-1',
    ...overrides,
  };
}

describe('createLiveProductControlExecutor provision/activate', () => {
  const lease = {
    validateLease: vi.fn(async () => ({ valid: true as const })),
  };
  const authorization = {
    revalidateBoundAuthorization: vi.fn(),
  };
  const noopUc = { execute: vi.fn() };

  it('provision SUCCEEDED on BB 2xx', async () => {
    const bbControl = {
      isConfigured: () => true,
      provision: vi.fn(async () => ({
        ok: true,
        status: 200,
        body: { status: 'provisioned' },
        text: '{"status":"provisioned"}',
      })),
      getTenantReady: vi.fn(),
      getTenantState: vi.fn(),
    } as unknown as ControlV1BusinessBackendClient;

    const exec = createLiveProductControlExecutor({
      handshake: noopUc as never,
      discoverContract: noopUc as never,
      discoverCapabilities: noopUc as never,
      health: noopUc as never,
      authorization: authorization as never,
      lease: lease as never,
      bbControl,
    });

    const out = await exec(baseInput(), 'p7.5.product_control.provision');
    expect(out.status).toBe('SUCCEEDED');
    if (out.status === 'SUCCEEDED') {
      expect(out.outputSnapshot?.tenantId).toBe('tenant-abc');
      expect(out.outputSnapshot?.bbControl).toBe(true);
    }
    expect(bbControl.provision).toHaveBeenCalled();
  });

  it('provision FAILED DEPENDENCY_UNAVAILABLE when BB URL unset', async () => {
    const bbControl = {
      isConfigured: () => false,
      provision: vi.fn(),
      getTenantReady: vi.fn(),
      getTenantState: vi.fn(),
    } as unknown as ControlV1BusinessBackendClient;

    const exec = createLiveProductControlExecutor({
      handshake: noopUc as never,
      discoverContract: noopUc as never,
      discoverCapabilities: noopUc as never,
      health: noopUc as never,
      authorization: authorization as never,
      lease: lease as never,
      bbControl,
    });

    const out = await exec(baseInput(), 'product_control.provision');
    expect(out.status).toBe('FAILED');
    if (out.status === 'FAILED') {
      expect(out.errorClass).toBe('DEPENDENCY_UNAVAILABLE');
    }
    expect(bbControl.provision).not.toHaveBeenCalled();
  });

  it('activate SUCCEEDED when tenant ready', async () => {
    const bbControl = {
      isConfigured: () => true,
      provision: vi.fn(),
      getTenantReady: vi.fn(async () => ({
        ok: true,
        status: 200,
        body: { ready: true },
        text: '{"ready":true}',
      })),
      getTenantState: vi.fn(),
    } as unknown as ControlV1BusinessBackendClient;

    const exec = createLiveProductControlExecutor({
      handshake: noopUc as never,
      discoverContract: noopUc as never,
      discoverCapabilities: noopUc as never,
      health: noopUc as never,
      authorization: authorization as never,
      lease: lease as never,
      bbControl,
    });

    const out = await exec(
      baseInput({
        handlerKey: 'p7.5.product_control.activate',
        inputSnapshot: { tenant_id: 'tenant-abc' },
      }),
      'p7.5.product_control.activate',
    );
    expect(out.status).toBe('SUCCEEDED');
  });

  it('activate FAILED retryable when not ready', async () => {
    const bbControl = {
      isConfigured: () => true,
      provision: vi.fn(),
      getTenantReady: vi.fn(async () => ({
        ok: false,
        status: 503,
        body: { ready: false },
        text: '{"ready":false}',
      })),
      getTenantState: vi.fn(),
    } as unknown as ControlV1BusinessBackendClient;

    const exec = createLiveProductControlExecutor({
      handshake: noopUc as never,
      discoverContract: noopUc as never,
      discoverCapabilities: noopUc as never,
      health: noopUc as never,
      authorization: authorization as never,
      lease: lease as never,
      bbControl,
    });

    const out = await exec(
      baseInput({ handlerKey: 'product_control.activate' }),
      'product_control.activate',
    );
    expect(out.status).toBe('FAILED');
    if (out.status === 'FAILED') {
      expect(out.retryable).toBe(true);
      expect(out.errorClass).toBe('DEPENDENCY_UNAVAILABLE');
    }
  });
});

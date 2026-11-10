import { describe, expect, it } from 'vitest';
import {
  ProductControlFoundationHandler,
} from '../product-control/product-control-handlers.js';
import { ProductControlErrorCode } from '../product-control/product-control.types.js';
import {
  InMemoryWorkflowHandlerRegistry,
  UnavailableProvisioningHandler,
  createDefaultWorkflowHandlerRegistry,
  registerUnavailableProvisioningHandlers,
} from './workflow-handler.port.js';
import { FUTURE_PROVISIONING_HANDLER_KEYS } from './workflow.types.js';

describe('UnavailableProvisioningHandler', () => {
  it('always fails with OPERATION_NOT_IMPLEMENTED and never succeeds', async () => {
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
      expect(result.errorClass).toBe('OPERATION_NOT_IMPLEMENTED');
      expect(result.retryable).toBe(false);
    }
  });

  it('registers future provisioning keys as unavailable/unimplemented', () => {
    const registry = new InMemoryWorkflowHandlerRegistry();
    registerUnavailableProvisioningHandlers(registry);
    for (const key of FUTURE_PROVISIONING_HANDLER_KEYS) {
      expect(registry.has(key)).toBe(true);
      expect(registry.get(key)).toBeInstanceOf(UnavailableProvisioningHandler);
    }
  });

  it('default registry includes noop + product_control + p7.6 + unimplemented', () => {
    const registry = createDefaultWorkflowHandlerRegistry();
    expect(registry.has('noop:approve')).toBe(true);
    expect(registry.has('noop:checkpoint')).toBe(true);
    expect(registry.has('product_control.handshake')).toBe(true);
    expect(registry.get('product_control.handshake')).toBeInstanceOf(
      ProductControlFoundationHandler,
    );
    expect(registry.has('infrastructure.validate_plan')).toBe(true);
    expect(registry.has('database.provision')).toBe(true);
    expect(registry.has('unavailable:p76')).toBe(true);
    expect(registry.has('unavailable:p77')).toBe(true);
  });

  it('foundation handshake succeeds with validated discovery snapshot', async () => {
    const registry = createDefaultWorkflowHandlerRegistry();
    const handler = registry.get('product_control.handshake')!;
    const result = await handler.execute({
      workflowId: 'wf-1',
      stepId: 'step-1',
      stepKey: 'handshake',
      handlerKey: 'product_control.handshake',
      fencingToken: 1,
      attemptNumber: 1,
      inputSnapshot: {
        endpointStatus: 'ACTIVE',
        requiredContractVersion: '1.0.0',
        discovery: {
          productId: 'prod-1',
          productCode: 'PHARMA',
          productControlId: 'pc-1',
          productControlVersion: '1.0.0',
          supportedProtocolVersions: ['1'],
          supportedContractVersions: ['1.0.0'],
          supportedCapabilities: ['control.handshake'],
          supportedOperationTypes: ['handshake'],
          authenticationMethods: ['OAUTH2_CC'],
          signatureAlgorithms: ['HS256'],
          callbackSupport: true,
          idempotencySupport: true,
          correlationSupport: true,
          healthStatus: 'HEALTHY',
          contractFingerprint: 'fp-1',
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      },
      workflowInput: {},
      correlationId: 'corr-1',
      workerId: 'worker-1',
    });
    expect(result.status).toBe('SUCCEEDED');
  });

  it('quarantined endpoint cannot dispatch foundation handlers', async () => {
    const handler = new ProductControlFoundationHandler('product_control.verify_health');
    const result = await handler.execute({
      workflowId: 'wf-1',
      stepId: 'step-1',
      stepKey: 'health',
      handlerKey: handler.key,
      fencingToken: 1,
      attemptNumber: 1,
      inputSnapshot: { endpointStatus: 'QUARANTINED' },
      workflowInput: {},
      correlationId: 'corr-1',
      workerId: 'worker-1',
    });
    expect(result.status).toBe('FAILED');
    if (result.status === 'FAILED') {
      expect(result.errorClass).toBe(ProductControlErrorCode.AUTHORIZATION_FAILED);
      expect(result.retryable).toBe(false);
    }
  });
});

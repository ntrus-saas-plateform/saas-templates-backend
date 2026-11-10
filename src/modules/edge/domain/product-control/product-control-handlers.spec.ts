import { describe, expect, it } from 'vitest';
import {
  InMemoryWorkflowHandlerRegistry,
  createDefaultWorkflowHandlerRegistry,
} from '../workflow/workflow-handler.port.js';
import {
  OperationNotImplementedHandler,
  ProductControlFoundationHandler,
  registerProductControlFoundationHandlers,
} from './product-control-handlers.js';
import {
  PRODUCT_CONTROL_FOUNDATION_HANDLER_KEYS,
  ProductControlErrorCode,
} from './product-control.types.js';

const discovery = {
  productId: 'prod-1',
  productCode: 'PHARMA',
  productControlId: 'pc-1',
  productControlVersion: '1.0.0',
  supportedProtocolVersions: ['1'],
  supportedContractVersions: ['1.0.0'],
  supportedCapabilities: [
    'control.handshake',
    'control.discover_contract',
    'control.discover_capabilities',
    'control.verify_connectivity',
    'control.verify_health',
    'control.verify_conformance',
  ],
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
};

describe('product control foundation handlers', () => {
  it('registers all six foundation keys', () => {
    const registry = new InMemoryWorkflowHandlerRegistry();
    registerProductControlFoundationHandlers(registry);
    for (const key of PRODUCT_CONTROL_FOUNDATION_HANDLER_KEYS) {
      expect(registry.has(key)).toBe(true);
      expect(registry.get(key)).toBeInstanceOf(ProductControlFoundationHandler);
    }
  });

  it('succeeds for each foundation op with discovery snapshot', async () => {
    const registry = createDefaultWorkflowHandlerRegistry();
    for (const key of PRODUCT_CONTROL_FOUNDATION_HANDLER_KEYS) {
      const result = await registry.get(key)!.execute({
        workflowId: 'wf',
        stepId: 'st',
        stepKey: key,
        handlerKey: key,
        fencingToken: 1,
        attemptNumber: 1,
        inputSnapshot: {
          endpointStatus: 'ACTIVE',
          requiredContractVersion: '1.0.0',
          declaredCapabilities: discovery.supportedCapabilities,
          discovery,
        },
        workflowInput: {},
        correlationId: 'c',
        workerId: 'w',
      });
      expect(result.status, key).toBe('SUCCEEDED');
    }
  });

  it('fails honestly without discovery when client is not wired', async () => {
    const handler = new ProductControlFoundationHandler('product_control.handshake');
    const result = await handler.execute({
      workflowId: 'wf',
      stepId: 'st',
      stepKey: 'handshake',
      handlerKey: handler.key,
      fencingToken: 1,
      attemptNumber: 1,
      inputSnapshot: { endpointStatus: 'ACTIVE' },
      workflowInput: {},
      correlationId: 'c',
      workerId: 'w',
    });
    expect(result.status).toBe('FAILED');
    if (result.status === 'FAILED') {
      expect(result.errorClass).toBe(ProductControlErrorCode.DEPENDENCY_UNAVAILABLE);
      expect(result.retryable).toBe(true);
    }
  });

  it('keeps mutative handlers as OPERATION_NOT_IMPLEMENTED', async () => {
    const handler = new OperationNotImplementedHandler('p7.5.product_control.provision');
    const result = await handler.execute({
      workflowId: 'wf',
      stepId: 'st',
      stepKey: 'provision',
      handlerKey: handler.key,
      fencingToken: 1,
      attemptNumber: 1,
      inputSnapshot: {},
      workflowInput: {},
      correlationId: 'c',
      workerId: 'w',
    });
    expect(result.status).toBe('FAILED');
    if (result.status === 'FAILED') {
      expect(result.errorClass).toBe(ProductControlErrorCode.OPERATION_NOT_IMPLEMENTED);
      expect(result.retryable).toBe(false);
    }
  });
});

import { randomUUID } from 'node:crypto';
import type {
  DiscoverProductControlCapabilitiesUseCase,
  DiscoverProductControlContractUseCase,
  HandshakeProductControlEndpointUseCase,
  HealthCheckProductControlEndpointUseCase,
} from '../../application/product-control/product-control.use-cases.js';
import type {
  ProductControlLiveExecutor,
} from '../../domain/product-control/product-control-handlers.js';
import {
  classifyProductControlError,
  isRetryableProductControlError,
} from '../../domain/product-control/error-classification.js';
import type { ProductControlFoundationHandlerKey } from '../../domain/product-control/product-control.types.js';
import type {
  WorkflowHandlerInput,
  WorkflowHandlerOutcome,
} from '../../domain/workflow/workflow-handler.port.js';

/**
 * Bridges P7.4 workflow handlers → P7.5 application use cases / HTTP client.
 */
export function createLiveProductControlExecutor(deps: {
  handshake: HandshakeProductControlEndpointUseCase;
  discoverContract: DiscoverProductControlContractUseCase;
  discoverCapabilities: DiscoverProductControlCapabilitiesUseCase;
  health: HealthCheckProductControlEndpointUseCase;
}): ProductControlLiveExecutor {
  return async (
    input: WorkflowHandlerInput,
    key: ProductControlFoundationHandlerKey,
  ): Promise<WorkflowHandlerOutcome> => {
    const endpointId =
      (typeof input.inputSnapshot.endpointId === 'string' && input.inputSnapshot.endpointId) ||
      (typeof input.workflowInput.endpointId === 'string' && input.workflowInput.endpointId) ||
      null;
    if (!endpointId) {
      return {
        status: 'FAILED',
        errorClass: 'VALIDATION',
        message: `Live ${key} requires endpointId in input`,
        retryable: false,
        diagnostics: { handlerKey: key },
      };
    }

    const actorId =
      (typeof input.executionContext?.actorId === 'string' && input.executionContext.actorId) ||
      input.workerId ||
      'workflow-worker';
    const correlationId = input.correlationId || randomUUID();
    const idempotencyKey =
      input.idempotencyKey ||
      `${key}:${input.workflowId}:${input.stepId}:${input.attemptNumber}`;

    try {
      let exchange;
      switch (key) {
        case 'product_control.handshake':
          exchange = await deps.handshake.execute({
            actorId,
            correlationId,
            endpointId,
            idempotencyKey,
          });
          break;
        case 'product_control.discover_contract':
          exchange = await deps.discoverContract.execute({
            actorId,
            correlationId,
            endpointId,
            idempotencyKey,
          });
          break;
        case 'product_control.discover_capabilities':
          exchange = await deps.discoverCapabilities.execute({
            actorId,
            correlationId,
            endpointId,
            idempotencyKey,
          });
          break;
        case 'product_control.verify_health':
        case 'product_control.verify_connectivity':
        case 'product_control.verify_conformance':
          exchange = await deps.health.execute({
            actorId,
            correlationId,
            endpointId,
            idempotencyKey: `${key}:${idempotencyKey}`,
          });
          break;
        default:
          return {
            status: 'FAILED',
            errorClass: 'OPERATION_NOT_IMPLEMENTED',
            message: `No live executor for ${key}`,
            retryable: false,
          };
      }

      if (exchange.status === 'SUCCEEDED' || exchange.status === 'RECONCILED') {
        return {
          status: 'SUCCEEDED',
          outputSnapshot: {
            handlerKey: key,
            live: true,
            exchangeId: exchange.id,
            httpStatus: exchange.httpStatus,
            responseDigest: exchange.responseDigest,
          },
        };
      }

      const code = classifyProductControlError(
        exchange.errorClassification ?? 'DEPENDENCY_UNAVAILABLE',
      );
      return {
        status: 'FAILED',
        errorClass: code,
        message: `Live ${key} exchange ended as ${exchange.status}`,
        retryable: isRetryableProductControlError(code),
        diagnostics: {
          exchangeId: exchange.id,
          errorClassification: exchange.errorClassification,
        },
      };
    } catch (err) {
      const code = classifyProductControlError(err);
      return {
        status: 'FAILED',
        errorClass: code,
        message: err instanceof Error ? err.message : `Live ${key} failed`,
        retryable: isRetryableProductControlError(code),
        diagnostics: { handlerKey: key },
      };
    }
  };
}

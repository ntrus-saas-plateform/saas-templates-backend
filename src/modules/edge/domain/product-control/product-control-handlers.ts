import type {
  WorkflowHandlerInput,
  WorkflowHandlerOutcome,
  WorkflowHandlerRegistryPort,
  WorkflowStepHandler,
} from '../workflow/workflow-handler.port.js';
import { assertEndpointAllowsDispatch, isEndpointOperational } from './endpoint-lifecycle.js';
import {
  evaluateContractCompatibility,
  parseDiscoveryDocument,
} from './contract-validation.js';
import {
  FOUNDATION_OPERATION_CAPABILITIES,
  matchRequiredCapabilities,
} from './capability-matching.js';
import {
  classifyProductControlError,
  isRetryableProductControlError,
} from './error-classification.js';
import {
  PRODUCT_CONTROL_FOUNDATION_HANDLER_KEYS,
  ProductControlEndpointStatus,
  ProductControlErrorCode,
  type ProductControlFoundationHandlerKey,
} from './product-control.types.js';

function readEndpointStatus(input: WorkflowHandlerInput): ProductControlEndpointStatus | null {
  const raw =
    input.inputSnapshot.endpointStatus ??
    input.workflowInput.endpointStatus ??
    input.executionContext?.endpointStatus;
  if (typeof raw !== 'string') return null;
  if ((Object.values(ProductControlEndpointStatus) as string[]).includes(raw)) {
    return raw as ProductControlEndpointStatus;
  }
  return null;
}

function foundationFailure(
  code: ProductControlErrorCode,
  message: string,
  diagnostics?: Record<string, unknown>,
): WorkflowHandlerOutcome {
  return {
    status: 'FAILED',
    errorClass: code,
    message,
    retryable: isRetryableProductControlError(code),
    diagnostics,
  };
}

/** Optional live wiring — use cases / client called when no discovery snapshot is supplied. */
export type ProductControlLiveExecutor = (
  input: WorkflowHandlerInput,
  key: ProductControlFoundationHandlerKey,
) => Promise<WorkflowHandlerOutcome>;

/**
 * Real P7.5 foundation handler for non-mutative Product Control operations.
 * Prefers validated discovery/handshake snapshot in input; otherwise delegates
 * to a live executor (use cases + HTTP client) when wired.
 */
export class ProductControlFoundationHandler implements WorkflowStepHandler {
  readonly version = '1.0.0-foundation';

  constructor(
    readonly key: ProductControlFoundationHandlerKey,
    private readonly liveExecutor?: ProductControlLiveExecutor,
  ) {}

  async execute(input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    const endpointStatus = readEndpointStatus(input);
    if (!endpointStatus) {
      return foundationFailure(
        ProductControlErrorCode.VALIDATION,
        `Handler ${this.key} requires endpointStatus in input`,
        { handlerKey: this.key },
      );
    }

    try {
      assertEndpointAllowsDispatch(endpointStatus);
    } catch (err) {
      const code = classifyProductControlError(err);
      return foundationFailure(
        code === ProductControlErrorCode.DEPENDENCY_UNAVAILABLE
          ? ProductControlErrorCode.AUTHORIZATION_FAILED
          : code,
        `Endpoint forbids dispatch (${endpointStatus})`,
        { endpointStatus, handlerKey: this.key },
      );
    }

    if (
      !isEndpointOperational(endpointStatus) &&
      endpointStatus !== ProductControlEndpointStatus.VALIDATING &&
      endpointStatus !== ProductControlEndpointStatus.PENDING_VALIDATION
    ) {
      return foundationFailure(
        ProductControlErrorCode.ENDPOINT_UNAVAILABLE,
        `Endpoint status ${endpointStatus} is not operational`,
        { endpointStatus },
      );
    }

    const requiredCapability = FOUNDATION_OPERATION_CAPABILITIES[this.key];
    const declaredCaps = input.inputSnapshot.declaredCapabilities;
    if (requiredCapability && Array.isArray(declaredCaps)) {
      const match = matchRequiredCapabilities({
        required: [requiredCapability],
        declared: declaredCaps.filter((c): c is string => typeof c === 'string'),
        knownCatalog: Object.values(FOUNDATION_OPERATION_CAPABILITIES),
      });
      if (!match.matched) {
        return foundationFailure(match.code, 'Required capability not declared', {
          missing: match.missing,
          unknownDeclared: match.unknownDeclared,
        });
      }
    }

    const discoveryRaw =
      input.inputSnapshot.discovery ??
      input.inputSnapshot.handshake ??
      input.workflowInput.discovery;

    if (discoveryRaw !== undefined) {
      const parsed = parseDiscoveryDocument(discoveryRaw);
      if (!parsed.ok) {
        return foundationFailure(parsed.code, parsed.reasons.join('; '), {
          reasons: parsed.reasons,
        });
      }

      const requiredVersion =
        (typeof input.inputSnapshot.requiredContractVersion === 'string'
          ? input.inputSnapshot.requiredContractVersion
          : null) ??
        (typeof input.workflowInput.requiredContractVersion === 'string'
          ? input.workflowInput.requiredContractVersion
          : parsed.document.supportedContractVersions[0]);

      if (requiredVersion) {
        const compat = evaluateContractCompatibility({
          requiredContractVersion: requiredVersion,
          supportedContractVersions: parsed.document.supportedContractVersions,
        });
        if (!compat.compatible) {
          return foundationFailure(compat.code, compat.reasons.join('; '), {
            reasons: compat.reasons,
          });
        }
      }

      return {
        status: 'SUCCEEDED',
        outputSnapshot: {
          handlerKey: this.key,
          foundation: true,
          operation: this.key,
          productId: parsed.document.productId,
          contractFingerprint: parsed.document.contractFingerprint,
          supportedCapabilities: parsed.document.supportedCapabilities,
          healthStatus: parsed.document.healthStatus,
        },
      };
    }

    if (this.liveExecutor) {
      return this.liveExecutor(input, this.key);
    }

    return foundationFailure(
      ProductControlErrorCode.DEPENDENCY_UNAVAILABLE,
      `Product Control client not configured for live ${this.key}; provide discovery snapshot or wire client adapter`,
      { handlerKey: this.key, foundation: true },
    );
  }
}

export class OperationNotImplementedHandler implements WorkflowStepHandler {
  readonly version = '0.0.0-not-implemented';

  constructor(readonly key: string) {}

  async execute(_input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    return {
      status: 'FAILED',
      errorClass: ProductControlErrorCode.OPERATION_NOT_IMPLEMENTED,
      message: `Handler "${this.key}" is not implemented (mutative / future P7.6–P7.7)`,
      retryable: false,
      diagnostics: { handlerKey: this.key, available: false },
    };
  }

  async compensate(_input: WorkflowHandlerInput): Promise<WorkflowHandlerOutcome> {
    return {
      status: 'FAILED',
      errorClass: ProductControlErrorCode.OPERATION_NOT_IMPLEMENTED,
      message: `Compensation for "${this.key}" is not implemented`,
      retryable: false,
      diagnostics: { handlerKey: this.key, available: false },
    };
  }
}

export function registerProductControlFoundationHandlers(
  registry: WorkflowHandlerRegistryPort,
  keys: readonly ProductControlFoundationHandlerKey[] = PRODUCT_CONTROL_FOUNDATION_HANDLER_KEYS,
  liveExecutor?: ProductControlLiveExecutor,
): void {
  for (const key of keys) {
    registry.register(new ProductControlFoundationHandler(key, liveExecutor));
  }
}

export function registerOperationNotImplementedHandlers(
  registry: WorkflowHandlerRegistryPort,
  keys: readonly string[],
): void {
  for (const key of keys) {
    registry.register(new OperationNotImplementedHandler(key));
  }
}

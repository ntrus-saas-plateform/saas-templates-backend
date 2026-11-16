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
import type { WorkflowAuthorizationPort } from '../../domain/workflow/workflow-authorization.port.js';
import type { WorkflowLeasePort } from '../../domain/workflow/workflow-lease.port.js';
import type {
  WorkflowHandlerInput,
  WorkflowHandlerOutcome,
} from '../../domain/workflow/workflow-handler.port.js';

const AUTHORIZATION_TIMEOUT_MS = 5_000;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}

function intOf(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) return Number(v.trim());
  return null;
}

function snap(input: WorkflowHandlerInput): Record<string, unknown> {
  return { ...input.workflowInput, ...input.inputSnapshot, ...(input.executionContext ?? {}) };
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Bridges P7.4 workflow handlers → P7.5 application use cases / HTTP client.
 *
 * AUD-P0-02: lease/fencing is mandatory before any live Product Control call.
 * When a provisioning authorization is bound on the workflow, it is revalidated
 * fail-closed (discovery must not proceed under revoked/expired auth).
 */
export function createLiveProductControlExecutor(deps: {
  handshake: HandshakeProductControlEndpointUseCase;
  discoverContract: DiscoverProductControlContractUseCase;
  discoverCapabilities: DiscoverProductControlCapabilitiesUseCase;
  health: HealthCheckProductControlEndpointUseCase;
  authorization: WorkflowAuthorizationPort;
  lease: WorkflowLeasePort;
}): ProductControlLiveExecutor {
  const validateLease = async (input: WorkflowHandlerInput) => {
    if (!deps.lease) {
      return { valid: false as const, reason: 'DEPENDENCY_UNAVAILABLE', detail: 'lease port not wired' };
    }
    if (!Number.isInteger(input.fencingToken) || input.fencingToken < 1) {
      return {
        valid: false as const,
        reason: 'MISSING_TOKEN',
        detail: 'fencingToken must be a positive integer issued by the engine',
      };
    }
    if (!input.workflowId || !input.stepId || !input.workerId) {
      return { valid: false as const, reason: 'STEP_NOT_FOUND', detail: 'claim identity incomplete' };
    }
    try {
      return await deps.lease.validateLease({
        workflowId: input.workflowId,
        stepId: input.stepId,
        workerId: input.workerId,
        fencingToken: input.fencingToken,
      });
    } catch {
      return { valid: false as const, reason: 'DEPENDENCY_UNAVAILABLE', detail: 'lease validation failed' };
    }
  };

  const revalidateIfBound = async (
    s: Record<string, unknown>,
  ): Promise<{ allowed: true } | { allowed: false; reason: string }> => {
    const rowId = str(s.authorizationRowId) ?? str(s.authorizationId) ?? null;
    const version = intOf(s.authorizationVersion);
    const provisioningRequestId = str(s.provisioningRequestId) ?? null;

    // Unbound discovery is allowed only when no auth identity is present at all.
    // Partial/stale identity is fail-closed.
    if (!rowId && version == null && !provisioningRequestId) {
      return { allowed: true };
    }
    if (!rowId || version == null || version < 1) {
      return { allowed: false, reason: 'AUTHORIZATION_REFERENCE_INCOMPLETE' };
    }
    if (!deps.authorization) {
      return { allowed: false, reason: 'AUTHORIZATION_PORT_MISSING' };
    }
    try {
      const view = await withTimeout(
        deps.authorization.revalidateBoundAuthorization({
          authorizationRowId: rowId,
          authorizationVersion: version,
          provisioningRequestId,
        }),
        AUTHORIZATION_TIMEOUT_MS,
        'P7.1 authorization revalidation',
      );
      if (!view) return { allowed: false, reason: 'AUTHORIZATION_INVALID' };
      return { allowed: true };
    } catch {
      return { allowed: false, reason: 'AUTHORIZATION_TIMEOUT' };
    }
  };

  return async (
    input: WorkflowHandlerInput,
    key: ProductControlFoundationHandlerKey,
  ): Promise<WorkflowHandlerOutcome> => {
    const leaseCheck = await validateLease(input);
    if (!leaseCheck.valid) {
      return {
        status: 'FAILED',
        errorClass: 'AUTHORIZATION',
        message: `P7.4 fencing/lease rejected: ${leaseCheck.reason}${
          leaseCheck.detail ? ` (${leaseCheck.detail})` : ''
        }`,
        retryable: false,
        diagnostics: { handlerKey: key, leaseReason: leaseCheck.reason },
      };
    }

    const auth = await revalidateIfBound(snap(input));
    if (!auth.allowed) {
      return {
        status: 'FAILED',
        errorClass: 'AUTHORIZATION',
        message: `P7.1 authorization rejected: ${auth.reason}`,
        retryable: false,
        diagnostics: { handlerKey: key, authReason: auth.reason },
      };
    }

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

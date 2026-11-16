import { randomUUID } from 'node:crypto';
import type {
  DiscoverProductControlCapabilitiesUseCase,
  DiscoverProductControlContractUseCase,
  HandshakeProductControlEndpointUseCase,
  HealthCheckProductControlEndpointUseCase,
} from '../../application/product-control/product-control.use-cases.js';
import type {
  ProductControlLiveExecutor,
  ProductControlLiveHandlerKey,
} from '../../domain/product-control/product-control-handlers.js';
import {
  classifyProductControlError,
  isRetryableProductControlError,
} from '../../domain/product-control/error-classification.js';
import { ProductControlErrorCode } from '../../domain/product-control/product-control.types.js';
import type { WorkflowAuthorizationPort } from '../../domain/workflow/workflow-authorization.port.js';
import type { WorkflowLeasePort } from '../../domain/workflow/workflow-lease.port.js';
import type {
  WorkflowHandlerInput,
  WorkflowHandlerOutcome,
} from '../../domain/workflow/workflow-handler.port.js';
import type { ControlV1BusinessBackendClient } from './control-v1-business-backend.client.js';

const AUTHORIZATION_TIMEOUT_MS = 5_000;

const PROVISION_KEYS = new Set<string>([
  'product_control.provision',
  'p7.5.product_control.provision',
]);
const ACTIVATE_KEYS = new Set<string>([
  'product_control.activate',
  'p7.5.product_control.activate',
]);

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

function bbUnavailable(key: string): WorkflowHandlerOutcome {
  return {
    status: 'FAILED',
    errorClass: ProductControlErrorCode.DEPENDENCY_UNAVAILABLE,
    message:
      'EDGE_BB_CONTROL_BASE_URL is not configured; cannot live-call Business Backend control/v1',
    retryable: true,
    diagnostics: { handlerKey: key, bbControlConfigured: false },
  };
}

/**
 * Bridges P7.4 workflow handlers → P7.5 application use cases / HTTP client / BB control.
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
  bbControl?: ControlV1BusinessBackendClient | null;
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

  const runProvision = async (
    input: WorkflowHandlerInput,
    key: string,
  ): Promise<WorkflowHandlerOutcome> => {
    if (!deps.bbControl?.isConfigured()) return bbUnavailable(key);
    const s = snap(input);
    const tenantId = str(s.tenantId) ?? str(s.tenant_id);
    if (!tenantId) {
      return {
        status: 'FAILED',
        errorClass: ProductControlErrorCode.VALIDATION,
        message: `Live ${key} requires tenantId (or tenant_id) in input`,
        retryable: false,
        diagnostics: { handlerKey: key },
      };
    }
    const productId = str(s.productId) ?? str(s.product_id);
    const idempotencyKey =
      input.idempotencyKey ||
      `${key}:${input.workflowId}:${input.stepId}:${input.attemptNumber}`;

    const body: Record<string, unknown> = {
      ...s,
      tenant_id: tenantId,
      tenantId,
    };
    if (productId) {
      body.product_id = productId;
      body.productId = productId;
    }

    try {
      const res = await deps.bbControl.provision(body, idempotencyKey);
      if (res.ok && res.status >= 200 && res.status < 300) {
        return {
          status: 'SUCCEEDED',
          outputSnapshot: {
            handlerKey: key,
            live: true,
            bbControl: true,
            httpStatus: res.status,
            tenantId,
            productId: productId ?? null,
            response: res.body,
          },
        };
      }
      const code = classifyProductControlError(
        res.status === 401 || res.status === 403
          ? `HTTP_${res.status}`
          : res.text || `HTTP_${res.status}`,
      );
      return {
        status: 'FAILED',
        errorClass: code,
        message: `BB provision failed with HTTP ${res.status}`,
        retryable: isRetryableProductControlError(code),
        diagnostics: {
          handlerKey: key,
          httpStatus: res.status,
          body: res.body,
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

  const runActivate = async (
    input: WorkflowHandlerInput,
    key: string,
  ): Promise<WorkflowHandlerOutcome> => {
    if (!deps.bbControl?.isConfigured()) return bbUnavailable(key);
    const s = snap(input);
    const tenantId = str(s.tenantId) ?? str(s.tenant_id);
    if (!tenantId) {
      return {
        status: 'FAILED',
        errorClass: ProductControlErrorCode.VALIDATION,
        message: `Live ${key} requires tenantId (or tenant_id) in input`,
        retryable: false,
        diagnostics: { handlerKey: key },
      };
    }

    try {
      const res = await deps.bbControl.getTenantReady(tenantId);
      const ready =
        res.ok &&
        (res.body.ready === true ||
          res.body.status === 'ready' ||
          String(res.body.status ?? '').toLowerCase() === 'ready');

      if (ready) {
        return {
          status: 'SUCCEEDED',
          outputSnapshot: {
            handlerKey: key,
            live: true,
            bbControl: true,
            httpStatus: res.status,
            tenantId,
            ready: true,
            response: res.body,
          },
        };
      }

      return {
        status: 'FAILED',
        errorClass: ProductControlErrorCode.DEPENDENCY_UNAVAILABLE,
        message: `Tenant ${tenantId} is not ready on Business Backend (HTTP ${res.status})`,
        retryable: true,
        diagnostics: {
          handlerKey: key,
          httpStatus: res.status,
          ready: false,
          body: res.body,
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

  return async (
    input: WorkflowHandlerInput,
    key: ProductControlLiveHandlerKey,
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

    if (PROVISION_KEYS.has(key)) {
      return runProvision(input, key);
    }
    if (ACTIVATE_KEYS.has(key)) {
      return runActivate(input, key);
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

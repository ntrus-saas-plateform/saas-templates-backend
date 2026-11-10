import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ProductControlEndpointStatus } from './product-control.types.js';

const ENDPOINT_TRANSITIONS: Record<
  ProductControlEndpointStatus,
  readonly ProductControlEndpointStatus[]
> = {
  [ProductControlEndpointStatus.PENDING_VALIDATION]: [
    ProductControlEndpointStatus.VALIDATING,
    ProductControlEndpointStatus.REVOKED,
  ],
  [ProductControlEndpointStatus.VALIDATING]: [
    ProductControlEndpointStatus.ACTIVE,
    ProductControlEndpointStatus.PENDING_VALIDATION,
    ProductControlEndpointStatus.QUARANTINED,
    ProductControlEndpointStatus.REVOKED,
  ],
  [ProductControlEndpointStatus.ACTIVE]: [
    ProductControlEndpointStatus.DEGRADED,
    ProductControlEndpointStatus.UNAVAILABLE,
    ProductControlEndpointStatus.QUARANTINED,
    ProductControlEndpointStatus.REVOKED,
  ],
  [ProductControlEndpointStatus.DEGRADED]: [
    ProductControlEndpointStatus.ACTIVE,
    ProductControlEndpointStatus.UNAVAILABLE,
    ProductControlEndpointStatus.QUARANTINED,
    ProductControlEndpointStatus.REVOKED,
  ],
  [ProductControlEndpointStatus.UNAVAILABLE]: [
    ProductControlEndpointStatus.ACTIVE,
    ProductControlEndpointStatus.DEGRADED,
    ProductControlEndpointStatus.QUARANTINED,
    ProductControlEndpointStatus.REVOKED,
  ],
  [ProductControlEndpointStatus.QUARANTINED]: [
    ProductControlEndpointStatus.PENDING_VALIDATION,
    ProductControlEndpointStatus.REVOKED,
  ],
  [ProductControlEndpointStatus.REVOKED]: [],
};

const SENSITIVE_TARGETS = new Set<ProductControlEndpointStatus>([
  ProductControlEndpointStatus.QUARANTINED,
  ProductControlEndpointStatus.REVOKED,
]);

export function canTransitionEndpoint(
  from: ProductControlEndpointStatus,
  to: ProductControlEndpointStatus,
): boolean {
  if (from === to) return true;
  return ENDPOINT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertEndpointTransition(
  from: ProductControlEndpointStatus,
  to: ProductControlEndpointStatus,
  reason?: string | null,
): void {
  if (from === to) return;
  if (!canTransitionEndpoint(from, to)) {
    throw new DomainError(
      ErrorCode.INVALID_STATE_TRANSITION,
      `Invalid Product Control endpoint transition ${from} → ${to}`,
      [{ from, to }],
    );
  }
  if (SENSITIVE_TARGETS.has(to) && (!reason || reason.trim().length === 0)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Reason required for endpoint transition to ${to}`,
      [{ from, to }],
    );
  }
}

/** QUARANTINED / REVOKED must never receive control operations. */
export function assertEndpointAllowsDispatch(status: ProductControlEndpointStatus): void {
  if (
    status === ProductControlEndpointStatus.QUARANTINED ||
    status === ProductControlEndpointStatus.REVOKED
  ) {
    throw new DomainError(
      ErrorCode.FORBIDDEN,
      `Endpoint status ${status} forbids control dispatch`,
      [{ status }],
    );
  }
}

export function isEndpointOperational(status: ProductControlEndpointStatus): boolean {
  return (
    status === ProductControlEndpointStatus.ACTIVE ||
    status === ProductControlEndpointStatus.DEGRADED
  );
}

export function allowedEndpointTransitions(
  from: ProductControlEndpointStatus,
): readonly ProductControlEndpointStatus[] {
  return ENDPOINT_TRANSITIONS[from] ?? [];
}

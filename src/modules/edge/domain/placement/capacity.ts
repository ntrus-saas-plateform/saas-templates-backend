import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { CapacityRequirements } from './placement.types.js';
import { CapacityResourceType } from './placement.types.js';

const KNOWN_RESOURCE_TYPES = new Set<string>(Object.values(CapacityResourceType));

export function computeAvailable(params: {
  totalCapacity: number;
  unavailableCapacity: number;
  reservedCapacity: number;
  allocatedCapacity: number;
}): number {
  return (
    params.totalCapacity -
    params.unavailableCapacity -
    params.reservedCapacity -
    params.allocatedCapacity
  );
}

export function assertNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, `${field} must be a non-negative finite number`, [
      { field, message: 'must be >= 0' },
    ]);
  }
}

/** Capacity measurement is fresh when validUntil is strictly after now. */
export function isFresh(validUntil: Date, now: Date): boolean {
  return validUntil.getTime() > now.getTime();
}

/**
 * Validate capacity requirement map: known resource types, positive finite quantities.
 * Empty map is allowed (no capacity demand) but callers must not treat missing inventory as unlimited.
 */
export function validateQuantities(quantities: CapacityRequirements): CapacityRequirements {
  if (quantities == null || typeof quantities !== 'object' || Array.isArray(quantities)) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'resource quantities must be an object', [
      { field: 'resourceQuantities', message: 'must be a map' },
    ]);
  }

  const normalized: CapacityRequirements = {};
  for (const [rawKey, rawValue] of Object.entries(quantities)) {
    const key = String(rawKey);
    if (!KNOWN_RESOURCE_TYPES.has(key)) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, `Unknown capacity resource type: ${key}`, [
        { field: 'resourceQuantities', message: `unknown type ${key}` },
      ]);
    }
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value <= 0) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Quantity for ${key} must be a positive finite number`,
        [{ field: key, message: 'must be > 0' }],
      );
    }
    normalized[key] = value;
  }
  return normalized;
}

export function hasSufficientCapacity(
  available: number,
  required: number,
): boolean {
  return Number.isFinite(available) && Number.isFinite(required) && available >= required;
}

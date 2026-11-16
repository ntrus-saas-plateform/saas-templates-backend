import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  ServiceLifecycleStatus,
  ServiceObservationStatus,
} from './service-catalog.types.js';

export function slugifyServiceCode(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export function assertServiceCode(code: string): void {
  const trimmed = code.trim();
  if (trimmed.length < 2 || trimmed.length > 64) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'serviceCode must be 2–64 characters',
      [{ code: 'SERVICE_CODE_INVALID' }],
    );
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(trimmed)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'serviceCode has invalid characters',
      [{ code: 'SERVICE_CODE_INVALID' }],
    );
  }
}

/** Observation honesty: VERIFIED requires an explicit verification source in metadata. */
export function assertObservationTransition(
  from: string,
  to: string,
  metadata: Record<string, unknown>,
): void {
  if (from === to) return;
  if (to === ServiceObservationStatus.VERIFIED) {
    const source = metadata.verificationSource;
    if (typeof source !== 'string' || source.trim().length < 3) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'VERIFIED observation requires metadata.verificationSource',
        [{ code: 'OBSERVATION_VERIFICATION_REQUIRED' }],
      );
    }
  }
  if (to === ServiceObservationStatus.UNKNOWN && from === ServiceObservationStatus.VERIFIED) {
    // allowed — telemetry loss must surface as UNKNOWN/STALE elsewhere, not silent healthy
  }
}

export function assertLifecycleAllowsDependency(lifecycleStatus: string): void {
  if (lifecycleStatus === ServiceLifecycleStatus.RETIRED) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      'Retired services cannot gain new dependencies',
      [{ code: 'SERVICE_RETIRED' }],
    );
  }
}

export function assertNoSelfDependency(serviceId: string, dependsOnServiceId: string): void {
  if (serviceId === dependsOnServiceId) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'A service cannot depend on itself',
      [{ code: 'SELF_DEPENDENCY_FORBIDDEN' }],
    );
  }
}

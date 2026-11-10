import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { InfrastructureErrorCode, ResourceStatus } from './infrastructure.types.js';

const ALLOWED: Record<ResourceStatus, readonly ResourceStatus[]> = {
  [ResourceStatus.PLANNED]: [
    ResourceStatus.VALIDATING,
    ResourceStatus.RESERVED,
    ResourceStatus.FAILED,
    ResourceStatus.DEPROVISIONING,
    ResourceStatus.DEPROVISIONED,
  ],
  [ResourceStatus.VALIDATING]: [
    ResourceStatus.RESERVED,
    ResourceStatus.FAILED,
    ResourceStatus.PLANNED,
  ],
  [ResourceStatus.RESERVED]: [
    ResourceStatus.PROVISIONING,
    ResourceStatus.FAILED,
    ResourceStatus.DEPROVISIONING,
  ],
  [ResourceStatus.PROVISIONING]: [
    ResourceStatus.CONFIGURING,
    ResourceStatus.VERIFYING,
    ResourceStatus.FAILED,
    ResourceStatus.UNKNOWN,
    ResourceStatus.RECONCILIATION_REQUIRED,
  ],
  [ResourceStatus.CONFIGURING]: [
    ResourceStatus.VERIFYING,
    ResourceStatus.FAILED,
    ResourceStatus.UNKNOWN,
    ResourceStatus.RECONCILIATION_REQUIRED,
  ],
  [ResourceStatus.VERIFYING]: [
    ResourceStatus.READY,
    ResourceStatus.FAILED,
    ResourceStatus.DEGRADED,
    ResourceStatus.RECONCILIATION_REQUIRED,
  ],
  [ResourceStatus.READY]: [
    ResourceStatus.DEGRADED,
    ResourceStatus.RECONCILIATION_REQUIRED,
    ResourceStatus.DEPROVISIONING,
    ResourceStatus.QUARANTINED,
  ],
  [ResourceStatus.DEGRADED]: [
    ResourceStatus.READY,
    ResourceStatus.FAILED,
    ResourceStatus.RECONCILIATION_REQUIRED,
    ResourceStatus.DEPROVISIONING,
    ResourceStatus.QUARANTINED,
  ],
  [ResourceStatus.FAILED]: [
    ResourceStatus.RECONCILIATION_REQUIRED,
    ResourceStatus.DEPROVISIONING,
    ResourceStatus.QUARANTINED,
    ResourceStatus.PLANNED,
  ],
  [ResourceStatus.UNKNOWN]: [
    ResourceStatus.RECONCILIATION_REQUIRED,
    ResourceStatus.READY,
    ResourceStatus.FAILED,
    ResourceStatus.QUARANTINED,
  ],
  [ResourceStatus.RECONCILIATION_REQUIRED]: [
    ResourceStatus.READY,
    ResourceStatus.DEGRADED,
    ResourceStatus.FAILED,
    ResourceStatus.QUARANTINED,
    ResourceStatus.UNKNOWN,
  ],
  [ResourceStatus.DEPROVISIONING]: [
    ResourceStatus.DEPROVISIONED,
    ResourceStatus.FAILED,
    ResourceStatus.UNKNOWN,
    ResourceStatus.RECONCILIATION_REQUIRED,
  ],
  [ResourceStatus.DEPROVISIONED]: [],
  [ResourceStatus.QUARANTINED]: [
    ResourceStatus.RECONCILIATION_REQUIRED,
    ResourceStatus.DEPROVISIONING,
    ResourceStatus.FAILED,
  ],
};

export function assertResourceTransition(
  from: ResourceStatus,
  to: ResourceStatus,
): void {
  const allowed = ALLOWED[from] ?? [];
  if (!allowed.includes(to)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid resource transition ${from} → ${to}`,
      [{ code: InfrastructureErrorCode.VALIDATION, from, to }],
    );
  }
}

/** READY requires verification evidence — never skip VERIFYING. */
export function assertReadyRequiresVerification(args: {
  from: ResourceStatus;
  to: ResourceStatus;
  connectivityVerified?: boolean;
  isolationVerified?: boolean;
}): void {
  assertResourceTransition(args.from, args.to);
  if (args.to === ResourceStatus.READY) {
    if (args.from !== ResourceStatus.VERIFYING && args.from !== ResourceStatus.DEGRADED) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'READY requires VERIFYING (or recovery from DEGRADED)',
        [{ code: InfrastructureErrorCode.RESOURCE_NOT_READY }],
      );
    }
    if (args.connectivityVerified === false || args.isolationVerified === false) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'READY requires connectivity and isolation verification evidence',
        [{ code: InfrastructureErrorCode.RESOURCE_NOT_READY }],
      );
    }
  }
}

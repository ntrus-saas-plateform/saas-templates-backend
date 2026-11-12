import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { KeycloakErrorCode, KeycloakTopologyStatus } from './keycloak.types.js';

const TRANSITIONS: Record<KeycloakTopologyStatus, readonly KeycloakTopologyStatus[]> = {
  [KeycloakTopologyStatus.PLANNED]: [
    KeycloakTopologyStatus.PENDING,
    KeycloakTopologyStatus.PROVISIONING,
    KeycloakTopologyStatus.FAILED,
    KeycloakTopologyStatus.DEPROVISIONED,
  ],
  [KeycloakTopologyStatus.PENDING]: [
    KeycloakTopologyStatus.PROVISIONING,
    KeycloakTopologyStatus.FAILED,
    KeycloakTopologyStatus.DEPROVISIONING_PENDING,
  ],
  [KeycloakTopologyStatus.PROVISIONING]: [
    KeycloakTopologyStatus.CONFIGURING,
    KeycloakTopologyStatus.VERIFYING,
    KeycloakTopologyStatus.READY,
    KeycloakTopologyStatus.FAILED,
    KeycloakTopologyStatus.QUARANTINED,
  ],
  [KeycloakTopologyStatus.CONFIGURING]: [
    KeycloakTopologyStatus.VERIFYING,
    KeycloakTopologyStatus.READY,
    KeycloakTopologyStatus.FAILED,
    KeycloakTopologyStatus.QUARANTINED,
  ],
  [KeycloakTopologyStatus.VERIFYING]: [
    KeycloakTopologyStatus.READY,
    KeycloakTopologyStatus.FAILED,
    KeycloakTopologyStatus.QUARANTINED,
  ],
  [KeycloakTopologyStatus.READY]: [
    KeycloakTopologyStatus.DEGRADED,
    KeycloakTopologyStatus.RECONCILIATION_REQUIRED,
    KeycloakTopologyStatus.QUARANTINED,
    KeycloakTopologyStatus.DEPROVISIONING_PENDING,
    KeycloakTopologyStatus.PROVISIONING,
  ],
  [KeycloakTopologyStatus.DEGRADED]: [
    KeycloakTopologyStatus.READY,
    KeycloakTopologyStatus.RECONCILIATION_REQUIRED,
    KeycloakTopologyStatus.QUARANTINED,
    KeycloakTopologyStatus.DEPROVISIONING_PENDING,
  ],
  [KeycloakTopologyStatus.FAILED]: [
    KeycloakTopologyStatus.PROVISIONING,
    KeycloakTopologyStatus.QUARANTINED,
    KeycloakTopologyStatus.DEPROVISIONING_PENDING,
    KeycloakTopologyStatus.DEPROVISIONED,
  ],
  [KeycloakTopologyStatus.RECONCILIATION_REQUIRED]: [
    KeycloakTopologyStatus.CONFIGURING,
    KeycloakTopologyStatus.PROVISIONING,
    KeycloakTopologyStatus.VERIFYING,
    KeycloakTopologyStatus.READY,
    KeycloakTopologyStatus.QUARANTINED,
    KeycloakTopologyStatus.FAILED,
    KeycloakTopologyStatus.DEPROVISIONING_PENDING,
  ],
  [KeycloakTopologyStatus.QUARANTINED]: [
    KeycloakTopologyStatus.PROVISIONING,
    KeycloakTopologyStatus.VERIFYING,
    KeycloakTopologyStatus.DEPROVISIONING_PENDING,
    KeycloakTopologyStatus.FAILED,
  ],
  [KeycloakTopologyStatus.DEPROVISIONING_PENDING]: [
    KeycloakTopologyStatus.DEPROVISIONED,
    KeycloakTopologyStatus.QUARANTINED,
    KeycloakTopologyStatus.FAILED,
  ],
  [KeycloakTopologyStatus.DEPROVISIONED]: [],
};

export function canTransition(
  from: KeycloakTopologyStatus | string,
  to: KeycloakTopologyStatus | string,
): boolean {
  const allowed = TRANSITIONS[from as KeycloakTopologyStatus];
  return Array.isArray(allowed) && allowed.includes(to as KeycloakTopologyStatus);
}

export function assertTopologyTransition(
  from: KeycloakTopologyStatus | string,
  to: KeycloakTopologyStatus | string,
): void {
  if (!canTransition(from, to)) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, `Invalid Keycloak topology transition ${from} → ${to}`, [
      { code: KeycloakErrorCode.VALIDATION, from, to },
    ]);
  }
}

/** READY always requires prior verification (fail-closed). */
export function assertReadyRequiresVerification(
  from: KeycloakTopologyStatus | string,
  to: KeycloakTopologyStatus | string,
): void {
  if (to !== KeycloakTopologyStatus.READY) return;
  if (from !== KeycloakTopologyStatus.VERIFYING && from !== KeycloakTopologyStatus.READY) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Keycloak topology cannot reach READY without verification',
      [{ code: KeycloakErrorCode.VALIDATION, from, to }],
    );
  }
}

export function isTerminal(status: KeycloakTopologyStatus | string): boolean {
  return status === KeycloakTopologyStatus.DEPROVISIONED;
}

export function isDestructive(status: KeycloakTopologyStatus | string): boolean {
  return (
    status === KeycloakTopologyStatus.DEPROVISIONING_PENDING ||
    status === KeycloakTopologyStatus.DEPROVISIONED
  );
}
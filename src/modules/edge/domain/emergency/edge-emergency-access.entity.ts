import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export enum EmergencyAccessStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export interface EdgeEmergencyAccess {
  readonly id: string;
  readonly requesterId: string;
  readonly approverId: string | null;
  readonly scope: Readonly<Record<string, unknown>>;
  readonly justification: string;
  readonly status: EmergencyAccessStatus;
  readonly startsAt: Date | null;
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}

const ALLOWED: Readonly<Record<EmergencyAccessStatus, readonly EmergencyAccessStatus[]>> = {
  [EmergencyAccessStatus.REQUESTED]: [
    EmergencyAccessStatus.APPROVED,
    EmergencyAccessStatus.REVOKED,
  ],
  [EmergencyAccessStatus.APPROVED]: [EmergencyAccessStatus.ACTIVE, EmergencyAccessStatus.REVOKED],
  [EmergencyAccessStatus.ACTIVE]: [EmergencyAccessStatus.REVOKED, EmergencyAccessStatus.EXPIRED],
  [EmergencyAccessStatus.REVOKED]: [],
  [EmergencyAccessStatus.EXPIRED]: [],
};

export function assertEmergencyAccessTransition(
  from: EmergencyAccessStatus,
  to: EmergencyAccessStatus,
): void {
  if (from === to) return;
  if (!ALLOWED[from].includes(to)) {
    throw new DomainError(
      ErrorCode.INVALID_STATE_TRANSITION,
      `Illegal emergency access transition: ${from} → ${to}`,
      [{ from, to }],
    );
  }
}

export function isEmergencyAccessUsable(
  grant: EdgeEmergencyAccess,
  now = new Date(),
): boolean {
  if (
    grant.status !== EmergencyAccessStatus.ACTIVE &&
    grant.status !== EmergencyAccessStatus.APPROVED
  ) {
    return false;
  }
  if (grant.revokedAt) return false;
  if (grant.expiresAt && grant.expiresAt <= now) return false;
  if (grant.startsAt && grant.startsAt > now) return false;
  return true;
}

import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export enum PlatformAdministratorStatus {
  INVITED = 'INVITED',
  INVITATION_PENDING = 'INVITATION_PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATION_PENDING = 'DEACTIVATION_PENDING',
  DEACTIVATED = 'DEACTIVATED',
}

export interface PlatformAdministrator {
  readonly id: string;
  readonly externalIdentityId: string;
  readonly email: string;
  readonly displayName: string;
  readonly preferredLanguage: string;
  readonly timezone: string;
  readonly profilePictureRef: string | null;
  readonly status: PlatformAdministratorStatus;
  readonly emailVerified: boolean;
  readonly mfaEnrolled: boolean;
  readonly lastSuccessfulAccessAt: Date | null;
  readonly suspendedAt: Date | null;
  readonly deactivatedAt: Date | null;
  readonly suspensionReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
}

const ALLOWED_TRANSITIONS: Readonly<
  Record<PlatformAdministratorStatus, readonly PlatformAdministratorStatus[]>
> = {
  [PlatformAdministratorStatus.INVITED]: [
    PlatformAdministratorStatus.INVITATION_PENDING,
    PlatformAdministratorStatus.ACTIVE,
    PlatformAdministratorStatus.DEACTIVATED,
  ],
  [PlatformAdministratorStatus.INVITATION_PENDING]: [
    PlatformAdministratorStatus.ACTIVE,
    PlatformAdministratorStatus.INVITED,
    PlatformAdministratorStatus.DEACTIVATED,
  ],
  [PlatformAdministratorStatus.ACTIVE]: [
    PlatformAdministratorStatus.SUSPENDED,
    PlatformAdministratorStatus.DEACTIVATION_PENDING,
  ],
  [PlatformAdministratorStatus.SUSPENDED]: [
    PlatformAdministratorStatus.ACTIVE,
    PlatformAdministratorStatus.DEACTIVATION_PENDING,
  ],
  [PlatformAdministratorStatus.DEACTIVATION_PENDING]: [
    PlatformAdministratorStatus.DEACTIVATED,
    PlatformAdministratorStatus.ACTIVE,
  ],
  [PlatformAdministratorStatus.DEACTIVATED]: [],
};

export function canTransitionAdministratorStatus(
  from: PlatformAdministratorStatus,
  to: PlatformAdministratorStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertAdministratorTransition(
  from: PlatformAdministratorStatus,
  to: PlatformAdministratorStatus,
): void {
  if (!canTransitionAdministratorStatus(from, to)) {
    throw new DomainError(
      ErrorCode.INVALID_STATE_TRANSITION,
      `Illegal administrator status transition: ${from} → ${to}`,
      [{ from, to }],
    );
  }
}

export function isAdministratorAccessible(status: PlatformAdministratorStatus): boolean {
  return status === PlatformAdministratorStatus.ACTIVE;
}

export function isAdministratorAuthenticatable(status: PlatformAdministratorStatus): boolean {
  return status === PlatformAdministratorStatus.ACTIVE;
}

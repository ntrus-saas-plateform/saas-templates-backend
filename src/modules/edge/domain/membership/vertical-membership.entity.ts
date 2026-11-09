import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export enum MembershipStatus {
  INVITED = 'INVITED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REVOKED = 'REVOKED',
}

export interface VerticalMembership {
  readonly id: string;
  readonly administratorId: string;
  readonly verticalId: string;
  readonly status: MembershipStatus;
  readonly invitationId: string | null;
  readonly invitedBy: string | null;
  readonly activatedAt: Date | null;
  readonly suspendedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly reason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const ALLOWED_TRANSITIONS: Readonly<Record<MembershipStatus, readonly MembershipStatus[]>> = {
  [MembershipStatus.INVITED]: [MembershipStatus.ACTIVE, MembershipStatus.REVOKED],
  [MembershipStatus.ACTIVE]: [MembershipStatus.SUSPENDED, MembershipStatus.REVOKED],
  [MembershipStatus.SUSPENDED]: [MembershipStatus.ACTIVE, MembershipStatus.REVOKED],
  [MembershipStatus.REVOKED]: [],
};

export function canTransitionMembershipStatus(
  from: MembershipStatus,
  to: MembershipStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertMembershipTransition(from: MembershipStatus, to: MembershipStatus): void {
  if (!canTransitionMembershipStatus(from, to)) {
    throw new DomainError(
      ErrorCode.INVALID_STATE_TRANSITION,
      `Illegal membership status transition: ${from} → ${to}`,
      [{ from, to }],
    );
  }
}

export function isMembershipActive(status: MembershipStatus): boolean {
  return status === MembershipStatus.ACTIVE;
}

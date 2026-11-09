import { createHash, randomBytes } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export enum EdgeInvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  CANCELLED = 'CANCELLED',
}

export interface EdgeInvitation {
  readonly id: string;
  readonly email: string;
  readonly invitedBy: string;
  readonly tokenHash: string;
  readonly status: EdgeInvitationStatus;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly verticalIds: readonly string[];
  readonly roleCodes: readonly string[];
  readonly workflowState: string | null;
  readonly deliveryStatus: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function generateInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}

export function isInvitationUsable(invitation: EdgeInvitation, now = new Date()): boolean {
  if (invitation.status !== EdgeInvitationStatus.PENDING) return false;
  return invitation.expiresAt > now;
}

export function assertInvitationUsable(invitation: EdgeInvitation, now = new Date()): void {
  if (invitation.status !== EdgeInvitationStatus.PENDING) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Invitation is not pending (status=${invitation.status})`,
      [{ invitationId: invitation.id, status: invitation.status }],
    );
  }
  if (invitation.expiresAt <= now) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invitation has expired', [
      { invitationId: invitation.id },
    ]);
  }
}

export function markInvitationAccepted(
  invitation: EdgeInvitation,
  acceptedAt = new Date(),
): Pick<EdgeInvitation, 'status' | 'acceptedAt'> {
  assertInvitationUsable(invitation, acceptedAt);
  return {
    status: EdgeInvitationStatus.ACCEPTED,
    acceptedAt,
  };
}

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export interface Invitation {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly email: string;
  readonly invitedBy: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly status: InvitationStatus;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly createdAt: Date;
}

export function isInvitationUsable(invitation: Invitation): boolean {
  if (invitation.status !== InvitationStatus.PENDING) return false;
  return invitation.expiresAt > new Date();
}

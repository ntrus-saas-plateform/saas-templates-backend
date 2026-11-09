import { createHash, randomBytes } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  isAdministratorAccessible,
  type PlatformAdministrator,
} from '../administrator/platform-administrator.entity.js';
import {
  isMembershipActive,
  type VerticalMembership,
} from '../membership/vertical-membership.entity.js';
import { isVerticalOperational, type Vertical } from '../vertical/vertical.entity.js';

export enum WorkspaceSessionStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export interface WorkspaceSession {
  readonly id: string;
  readonly administratorId: string;
  readonly membershipId: string;
  readonly verticalId: string;
  readonly tokenHash: string;
  readonly status: WorkspaceSessionStatus;
  readonly expiresAt: Date;
  readonly lastRenewedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly revocationReason: string | null;
  readonly createdAt: Date;
}

export function generateWorkspaceSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashWorkspaceSessionToken(token) };
}

export function hashWorkspaceSessionToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}

export function isWorkspaceSessionActive(session: WorkspaceSession, now = new Date()): boolean {
  if (session.status !== WorkspaceSessionStatus.ACTIVE) return false;
  if (session.revokedAt) return false;
  return session.expiresAt > now;
}

export function assertWorkspaceSessionValid(input: {
  session: WorkspaceSession;
  administrator: PlatformAdministrator;
  membership: VerticalMembership;
  vertical: Vertical;
  now?: Date;
}): void {
  const now = input.now ?? new Date();
  if (!isWorkspaceSessionActive(input.session, now)) {
    throw new DomainError(ErrorCode.UNAUTHORIZED, 'Workspace session is not active', [
      { sessionId: input.session.id, status: input.session.status },
    ]);
  }
  if (!isAdministratorAccessible(input.administrator.status)) {
    throw new DomainError(ErrorCode.UNAUTHORIZED, 'Administrator is not active', [
      { administratorId: input.administrator.id },
    ]);
  }
  if (!isMembershipActive(input.membership.status)) {
    throw new DomainError(ErrorCode.FORBIDDEN, 'Membership is not active', [
      { membershipId: input.membership.id },
    ]);
  }
  if (!isVerticalOperational(input.vertical.status)) {
    throw new DomainError(ErrorCode.FORBIDDEN, 'Vertical is not operational', [
      { verticalId: input.vertical.id, status: input.vertical.status },
    ]);
  }
  if (input.session.administratorId !== input.administrator.id) {
    throw new DomainError(ErrorCode.FORBIDDEN, 'Session administrator mismatch');
  }
  if (input.session.membershipId !== input.membership.id) {
    throw new DomainError(ErrorCode.FORBIDDEN, 'Session membership mismatch');
  }
  if (input.session.verticalId !== input.vertical.id) {
    throw new DomainError(ErrorCode.FORBIDDEN, 'Session vertical mismatch');
  }
  if (input.membership.administratorId !== input.administrator.id) {
    throw new DomainError(ErrorCode.FORBIDDEN, 'Membership administrator mismatch');
  }
  if (input.membership.verticalId !== input.vertical.id) {
    throw new DomainError(ErrorCode.FORBIDDEN, 'Membership vertical mismatch');
  }
}

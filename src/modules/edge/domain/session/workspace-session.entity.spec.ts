import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import { PlatformAdministratorStatus } from '../administrator/platform-administrator.entity.js';
import { MembershipStatus } from '../membership/vertical-membership.entity.js';
import { VerticalStatus } from '../vertical/vertical.entity.js';
import {
  assertWorkspaceSessionValid,
  generateWorkspaceSessionToken,
  hashWorkspaceSessionToken,
  isWorkspaceSessionActive,
  WorkspaceSessionStatus,
} from './workspace-session.entity.js';

describe('WorkspaceSession validation', () => {
  const now = new Date('2026-01-01T12:00:00Z');

  it('hashes tokens stably and generates unique tokens', () => {
    const a = generateWorkspaceSessionToken();
    const b = generateWorkspaceSessionToken();
    expect(a.token).not.toEqual(b.token);
    expect(hashWorkspaceSessionToken(a.token)).toEqual(a.tokenHash);
  });

  it('rejects expired or revoked sessions', () => {
    expect(
      isWorkspaceSessionActive(
        {
          id: 's1',
          administratorId: 'a1',
          membershipId: 'm1',
          verticalId: 'v1',
          tokenHash: 'h',
          status: WorkspaceSessionStatus.ACTIVE,
          expiresAt: new Date('2026-01-01T11:00:00Z'),
          lastRenewedAt: null,
          revokedAt: null,
          revocationReason: null,
          createdAt: now,
        },
        now,
      ),
    ).toBe(false);
  });

  it('validates membership/vertical/admin ACTIVE binding', () => {
    expect(() =>
      assertWorkspaceSessionValid({
        now,
        session: {
          id: 's1',
          administratorId: 'a1',
          membershipId: 'm1',
          verticalId: 'v1',
          tokenHash: 'h',
          status: WorkspaceSessionStatus.ACTIVE,
          expiresAt: new Date('2026-01-01T13:00:00Z'),
          lastRenewedAt: null,
          revokedAt: null,
          revocationReason: null,
          createdAt: now,
        },
        administrator: {
          id: 'a1',
          externalIdentityId: 'sub',
          email: 'a@example.com',
          displayName: 'A',
          preferredLanguage: 'en',
          timezone: 'UTC',
          profilePictureRef: null,
          status: PlatformAdministratorStatus.ACTIVE,
          emailVerified: true,
          mfaEnrolled: false,
          lastSuccessfulAccessAt: null,
          suspendedAt: null,
          deactivatedAt: null,
          suspensionReason: null,
          createdAt: now,
          updatedAt: now,
          createdBy: null,
          updatedBy: null,
        },
        membership: {
          id: 'm1',
          administratorId: 'a1',
          verticalId: 'v1',
          status: MembershipStatus.ACTIVE,
          invitationId: null,
          invitedBy: null,
          activatedAt: now,
          suspendedAt: null,
          revokedAt: null,
          reason: null,
          createdAt: now,
          updatedAt: now,
        },
        vertical: {
          id: 'v1',
          code: 'retail',
          slug: 'retail',
          displayName: 'Retail',
          description: null,
          status: VerticalStatus.ACTIVE,
          iconRef: null,
          visualIdentityRef: null,
          keycloakOrganizationId: 'kc',
          configurationVersion: 1,
          activatedAt: now,
          suspendedAt: null,
          deactivatedAt: null,
          suspensionReason: null,
          createdAt: now,
          updatedAt: now,
          createdBy: null,
          updatedBy: null,
        },
      }),
    ).not.toThrow();
  });

  it('rejects suspended administrator', () => {
    expect(() =>
      assertWorkspaceSessionValid({
        now,
        session: {
          id: 's1',
          administratorId: 'a1',
          membershipId: 'm1',
          verticalId: 'v1',
          tokenHash: 'h',
          status: WorkspaceSessionStatus.ACTIVE,
          expiresAt: new Date('2026-01-01T13:00:00Z'),
          lastRenewedAt: null,
          revokedAt: null,
          revocationReason: null,
          createdAt: now,
        },
        administrator: {
          id: 'a1',
          externalIdentityId: 'sub',
          email: 'a@example.com',
          displayName: 'A',
          preferredLanguage: 'en',
          timezone: 'UTC',
          profilePictureRef: null,
          status: PlatformAdministratorStatus.SUSPENDED,
          emailVerified: true,
          mfaEnrolled: false,
          lastSuccessfulAccessAt: null,
          suspendedAt: now,
          deactivatedAt: null,
          suspensionReason: 'x',
          createdAt: now,
          updatedAt: now,
          createdBy: null,
          updatedBy: null,
        },
        membership: {
          id: 'm1',
          administratorId: 'a1',
          verticalId: 'v1',
          status: MembershipStatus.ACTIVE,
          invitationId: null,
          invitedBy: null,
          activatedAt: now,
          suspendedAt: null,
          revokedAt: null,
          reason: null,
          createdAt: now,
          updatedAt: now,
        },
        vertical: {
          id: 'v1',
          code: 'retail',
          slug: 'retail',
          displayName: 'Retail',
          description: null,
          status: VerticalStatus.ACTIVE,
          iconRef: null,
          visualIdentityRef: null,
          keycloakOrganizationId: 'kc',
          configurationVersion: 1,
          activatedAt: now,
          suspendedAt: null,
          deactivatedAt: null,
          suspensionReason: null,
          createdAt: now,
          updatedAt: now,
          createdBy: null,
          updatedBy: null,
        },
      }),
    ).toThrow(DomainError);
  });
});

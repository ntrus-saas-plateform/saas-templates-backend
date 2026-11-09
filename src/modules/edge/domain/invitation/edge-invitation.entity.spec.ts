import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  EdgeInvitationStatus,
  generateInvitationToken,
  hashInvitationToken,
  markInvitationAccepted,
  type EdgeInvitation,
} from './edge-invitation.entity.js';

describe('Edge invitation token security', () => {
  it('stores only sha256 hash of generated token', () => {
    const { token, tokenHash } = generateInvitationToken();
    expect(tokenHash).toEqual(hashInvitationToken(token));
    expect(tokenHash).not.toEqual(token);
  });

  it('enforces single-use accept (PENDING only)', () => {
    const invitation: EdgeInvitation = {
      id: 'i1',
      email: 'a@example.com',
      invitedBy: 'actor',
      tokenHash: 'hash',
      status: EdgeInvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      verticalIds: [],
      roleCodes: [],
      workflowState: null,
      deliveryStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const accepted = markInvitationAccepted(invitation);
    expect(accepted.status).toBe(EdgeInvitationStatus.ACCEPTED);

    expect(() =>
      markInvitationAccepted({
        ...invitation,
        status: EdgeInvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      }),
    ).toThrow(DomainError);
  });

  it('rejects expired invitations', () => {
    expect(() =>
      markInvitationAccepted({
        id: 'i1',
        email: 'a@example.com',
        invitedBy: 'actor',
        tokenHash: 'hash',
        status: EdgeInvitationStatus.PENDING,
        expiresAt: new Date(Date.now() - 1000),
        acceptedAt: null,
        verticalIds: [],
        roleCodes: [],
        workflowState: null,
        deliveryStatus: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toThrow(/expired/i);
  });
});

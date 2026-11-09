import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  assertMembershipTransition,
  canTransitionMembershipStatus,
  isMembershipActive,
  MembershipStatus,
} from './vertical-membership.entity.js';

describe('VerticalMembership lifecycle', () => {
  it('allows INVITED → ACTIVE → SUSPENDED → ACTIVE → REVOKED', () => {
    expect(canTransitionMembershipStatus(MembershipStatus.INVITED, MembershipStatus.ACTIVE)).toBe(
      true,
    );
    expect(
      canTransitionMembershipStatus(MembershipStatus.ACTIVE, MembershipStatus.SUSPENDED),
    ).toBe(true);
    expect(
      canTransitionMembershipStatus(MembershipStatus.SUSPENDED, MembershipStatus.ACTIVE),
    ).toBe(true);
    expect(canTransitionMembershipStatus(MembershipStatus.ACTIVE, MembershipStatus.REVOKED)).toBe(
      true,
    );
  });

  it('rejects REVOKED → ACTIVE', () => {
    expect(() =>
      assertMembershipTransition(MembershipStatus.REVOKED, MembershipStatus.ACTIVE),
    ).toThrow(DomainError);
  });

  it('marks only ACTIVE as active', () => {
    expect(isMembershipActive(MembershipStatus.ACTIVE)).toBe(true);
    expect(isMembershipActive(MembershipStatus.INVITED)).toBe(false);
  });
});

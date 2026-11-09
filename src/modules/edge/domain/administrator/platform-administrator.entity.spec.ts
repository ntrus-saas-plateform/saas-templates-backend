import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  assertAdministratorTransition,
  canTransitionAdministratorStatus,
  isAdministratorAccessible,
  PlatformAdministratorStatus,
} from './platform-administrator.entity.js';

describe('PlatformAdministrator lifecycle', () => {
  it('allows INVITED → INVITATION_PENDING → ACTIVE', () => {
    expect(
      canTransitionAdministratorStatus(
        PlatformAdministratorStatus.INVITED,
        PlatformAdministratorStatus.INVITATION_PENDING,
      ),
    ).toBe(true);
    expect(
      canTransitionAdministratorStatus(
        PlatformAdministratorStatus.INVITATION_PENDING,
        PlatformAdministratorStatus.ACTIVE,
      ),
    ).toBe(true);
  });

  it('allows ACTIVE → SUSPENDED → ACTIVE', () => {
    expect(() =>
      assertAdministratorTransition(
        PlatformAdministratorStatus.ACTIVE,
        PlatformAdministratorStatus.SUSPENDED,
      ),
    ).not.toThrow();
    expect(() =>
      assertAdministratorTransition(
        PlatformAdministratorStatus.SUSPENDED,
        PlatformAdministratorStatus.ACTIVE,
      ),
    ).not.toThrow();
  });

  it('rejects DEACTIVATED → ACTIVE', () => {
    expect(() =>
      assertAdministratorTransition(
        PlatformAdministratorStatus.DEACTIVATED,
        PlatformAdministratorStatus.ACTIVE,
      ),
    ).toThrow(DomainError);
  });

  it('marks only ACTIVE as accessible', () => {
    expect(isAdministratorAccessible(PlatformAdministratorStatus.ACTIVE)).toBe(true);
    expect(isAdministratorAccessible(PlatformAdministratorStatus.SUSPENDED)).toBe(false);
  });
});

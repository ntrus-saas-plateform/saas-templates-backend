import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  assertVerticalTransition,
  canTransitionVerticalStatus,
  evaluateVerticalReadiness,
  VerticalStatus,
  type Vertical,
} from './vertical.entity.js';

function baseVertical(overrides: Partial<Vertical> = {}): Vertical {
  return {
    id: 'v1',
    code: 'retail',
    slug: 'retail',
    displayName: 'Retail',
    description: null,
    status: VerticalStatus.DRAFT,
    iconRef: null,
    visualIdentityRef: null,
    keycloakOrganizationId: 'kc-org',
    configurationVersion: 1,
    activatedAt: null,
    suspendedAt: null,
    deactivatedAt: null,
    suspensionReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

describe('Vertical lifecycle', () => {
  it('allows DRAFT → CONFIGURING → READY_FOR_ACTIVATION → ACTIVE', () => {
    expect(canTransitionVerticalStatus(VerticalStatus.DRAFT, VerticalStatus.CONFIGURING)).toBe(
      true,
    );
    expect(
      canTransitionVerticalStatus(
        VerticalStatus.CONFIGURING,
        VerticalStatus.READY_FOR_ACTIVATION,
      ),
    ).toBe(true);
    expect(
      canTransitionVerticalStatus(VerticalStatus.READY_FOR_ACTIVATION, VerticalStatus.ACTIVE),
    ).toBe(true);
  });

  it('rejects ACTIVE → DRAFT', () => {
    expect(() =>
      assertVerticalTransition(VerticalStatus.ACTIVE, VerticalStatus.DRAFT),
    ).toThrow(DomainError);
  });

  it('allows ACTIVE → DEPRECATED → RETIRED → ARCHIVED', () => {
    expect(canTransitionVerticalStatus(VerticalStatus.ACTIVE, VerticalStatus.DEPRECATED)).toBe(
      true,
    );
    expect(
      canTransitionVerticalStatus(VerticalStatus.DEPRECATED, VerticalStatus.RETIRED),
    ).toBe(true);
    expect(canTransitionVerticalStatus(VerticalStatus.RETIRED, VerticalStatus.ARCHIVED)).toBe(
      true,
    );
  });

  it('rejects ARCHIVED → ACTIVE', () => {
    expect(() =>
      assertVerticalTransition(VerticalStatus.ARCHIVED, VerticalStatus.ACTIVE),
    ).toThrow(DomainError);
  });

  it('evaluates readiness requirements', () => {
    expect(evaluateVerticalReadiness(baseVertical()).ready).toBe(true);
    expect(
      evaluateVerticalReadiness(
        baseVertical({ keycloakOrganizationId: null, configurationVersion: 0 }),
      ).missing,
    ).toEqual(expect.arrayContaining(['keycloakOrganizationId', 'configurationVersion']));
  });
});

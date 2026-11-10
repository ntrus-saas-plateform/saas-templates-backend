import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  EntitlementCapabilityKind,
  SubscriptionStatus,
  assertNotActiveWithoutGates,
  assertSingleProductSubscription,
  assertSubscriptionStatusTransition,
  assertTrialNotPaid,
  nextPeriodEnd,
  resolveEffectiveEntitlements,
  assertAddonCompatible,
  assertNoSelfApproval,
  assertSnapshotImmutable,
} from './subscription.entity.js';

describe('subscription lifecycle transitions', () => {
  it('allows Draft → Pending Activation → Active', () => {
    assertSubscriptionStatusTransition(
      SubscriptionStatus.DRAFT,
      SubscriptionStatus.PENDING_ACTIVATION,
    );
    assertSubscriptionStatusTransition(
      SubscriptionStatus.PENDING_ACTIVATION,
      SubscriptionStatus.ACTIVE,
    );
  });

  it('rejects Active → Draft', () => {
    expect(() =>
      assertSubscriptionStatusTransition(
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.DRAFT,
      ),
    ).toThrow(DomainError);
  });

  it('blocks activation without commercial validation', () => {
    expect(() =>
      assertNotActiveWithoutGates({
        toStatus: SubscriptionStatus.ACTIVE,
        commercialValidated: false,
      }),
    ).toThrow(/commercial validation/i);
  });

  it('blocks activation without provisioning when required', () => {
    expect(() =>
      assertNotActiveWithoutGates({
        toStatus: SubscriptionStatus.ACTIVE,
        commercialValidated: true,
        provisioningRequired: true,
        provisioningConfirmed: false,
      }),
    ).toThrow(/provisioning confirmation/i);
  });

  it('blocks activation when billing required without billing confirmation', () => {
    expect(() =>
      assertNotActiveWithoutGates({
        toStatus: SubscriptionStatus.ACTIVE,
        commercialValidated: true,
        billingRequired: true,
        billingConfirmed: false,
      }),
    ).toThrow(/billing coordination/i);
  });

  it('allows PENDING_ACTIVATION → FAILED_ACTIVATION', () => {
    assertSubscriptionStatusTransition(
      SubscriptionStatus.PENDING_ACTIVATION,
      SubscriptionStatus.FAILED_ACTIVATION,
    );
  });
});

describe('single product rule', () => {
  it('rejects multi-product items', () => {
    expect(() =>
      assertSingleProductSubscription({
        productId: 'p1',
        itemProductIds: ['p1', 'p2'],
      }),
    ).toThrow(/same product/i);
  });
});

describe('trial honesty', () => {
  it('rejects labeling trial as paid', () => {
    expect(() => assertTrialNotPaid({ isTrial: true, labelAsPaid: true })).toThrow(
      /not be labeled/i,
    );
  });
});

describe('entitlement resolution', () => {
  it('ORs feature flags and MAXes quotas then applies contractual ceiling', () => {
    const resolved = resolveEffectiveEntitlements([
      {
        sourceType: 'PLAN',
        sourceRef: 'plan-a',
        capabilityCode: 'advanced_reporting',
        kind: EntitlementCapabilityKind.FEATURE_FLAG,
        enabled: false,
      },
      {
        sourceType: 'ADDON',
        sourceRef: 'addon-1',
        capabilityCode: 'advanced_reporting',
        kind: EntitlementCapabilityKind.FEATURE_FLAG,
        enabled: true,
      },
      {
        sourceType: 'PLAN',
        sourceRef: 'plan-a',
        capabilityCode: 'max_sites',
        kind: EntitlementCapabilityKind.CAPACITY,
        numericLimit: 5,
      },
      {
        sourceType: 'ADDON',
        sourceRef: 'addon-sites',
        capabilityCode: 'max_sites',
        kind: EntitlementCapabilityKind.CAPACITY,
        numericLimit: 8,
      },
      {
        sourceType: 'CONTRACTUAL_EXTENSION',
        sourceRef: 'ent-ext',
        capabilityCode: 'max_sites',
        kind: EntitlementCapabilityKind.CAPACITY,
        numericLimit: 10,
      },
    ]);

    const reporting = resolved.find((r) => r.capabilityCode === 'advanced_reporting')!;
    expect(reporting.enabled).toBe(true);
    expect(reporting.conflictResolution).toBe('BOOLEAN_OR');

    const sites = resolved.find((r) => r.capabilityCode === 'max_sites')!;
    expect(sites.numericLimit).toBe(10);
    expect(sites.conflictResolution).toBe('CONTRACTUAL_CEILING_OVERRIDE');
  });

  it('rejects mutually exclusive conflicts', () => {
    expect(() =>
      resolveEffectiveEntitlements([
        {
          sourceType: 'PLAN',
          capabilityCode: 'tier_a',
          kind: EntitlementCapabilityKind.MUTUALLY_EXCLUSIVE,
          mutuallyExclusiveGroup: 'tier',
          enabled: true,
        },
        {
          sourceType: 'ADDON',
          capabilityCode: 'tier_b',
          kind: EntitlementCapabilityKind.MUTUALLY_EXCLUSIVE,
          mutuallyExclusiveGroup: 'tier',
          enabled: true,
        },
      ]),
    ).toThrow(/Mutually exclusive/i);
  });

  it('rejects unknown kinds', () => {
    expect(() =>
      resolveEffectiveEntitlements([
        {
          sourceType: 'PLAN',
          capabilityCode: 'x',
          kind: 'WEIRD',
          enabled: true,
        },
      ]),
    ).toThrow(/Unknown entitlement kind/i);
  });

  it('forbids silent snapshot overwrite', () => {
    expect(() => assertSnapshotImmutable({ attemptedUpdate: true })).toThrow(
      /immutable/i,
    );
  });
});

describe('renewal period math', () => {
  it('advances annual periods without mutating history', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const end = nextPeriodEnd({ from, billingFrequency: 'ANNUAL' });
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('addon compatibility', () => {
  it('rejects cross-product addons', () => {
    expect(() =>
      assertAddonCompatible({
        addonProductId: 'p2',
        subscriptionProductId: 'p1',
        available: true,
        eligible: true,
      }),
    ).toThrow(/different product/i);
  });
});

describe('governance', () => {
  it('forbids self-approval', () => {
    expect(() =>
      assertNoSelfApproval({ requesterId: 'a', decisionBy: 'a' }),
    ).toThrow(/Self-approval/i);
  });
});

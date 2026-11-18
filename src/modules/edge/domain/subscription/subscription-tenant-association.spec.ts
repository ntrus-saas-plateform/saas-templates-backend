import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  AssociationStatus,
  AssociationType,
  assertAssociationIntegrity,
  assertCanActivateAssociation,
  assertPlanChangeKeepsProductTenant,
  assertTerminalTransition,
  resolveProductTenantId,
  type SubscriptionTenantAssociation,
} from './subscription-tenant-association.js';

function assoc(
  patch: Partial<SubscriptionTenantAssociation>,
): SubscriptionTenantAssociation {
  return {
    id: 'a1',
    accountId: 'acc-1',
    productId: 'prod-1',
    productTenantId: 'tenant-1',
    productTenantRef: 'tenant-1',
    subscriptionId: 'sub-1',
    associationType: AssociationType.INITIAL,
    associationStatus: AssociationStatus.ACTIVE,
    environmentSlot: 'DEFAULT',
    effectiveFrom: new Date(),
    effectiveUntil: null,
    supersedesAssociationId: null,
    sourceEventId: null,
    correlationId: null,
    metadata: {},
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...patch,
  };
}

describe('subscription-tenant-association (D-CARD-01)', () => {
  it('resolves UUID and edge:UUID tenant refs', () => {
    expect(resolveProductTenantId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBe(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    expect(resolveProductTenantId('edge:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')).toBe(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    );
    expect(resolveProductTenantId('not-a-uuid')).toBeNull();
  });

  it('enforces account/product integrity', () => {
    expect(() =>
      assertAssociationIntegrity({
        subscriptionAccountId: 'a',
        subscriptionProductId: 'p',
        associationAccountId: 'b',
        associationProductId: 'p',
      }),
    ).toThrow(DomainError);
    expect(() =>
      assertAssociationIntegrity({
        subscriptionAccountId: 'a',
        subscriptionProductId: 'p',
        associationAccountId: 'a',
        associationProductId: 'p',
        productTenantProductId: 'other',
      }),
    ).toThrow(DomainError);
  });

  it('blocks second ACTIVE association per subscription unless replace', () => {
    expect(() =>
      assertCanActivateAssociation({
        existingActiveForSubscription: assoc({}),
        existingActiveForTenantSlot: null,
        subscriptionId: 'sub-1',
        productTenantId: 'tenant-1',
      }),
    ).toThrow(DomainError);

    expect(() =>
      assertCanActivateAssociation({
        existingActiveForSubscription: assoc({}),
        existingActiveForTenantSlot: null,
        subscriptionId: 'sub-1',
        productTenantId: 'tenant-1',
        allowReplace: true,
      }),
    ).not.toThrow();
  });

  it('blocks ACTIVE tenant slot held by another subscription', () => {
    expect(() =>
      assertCanActivateAssociation({
        existingActiveForSubscription: null,
        existingActiveForTenantSlot: assoc({
          subscriptionId: 'sub-other',
          productTenantId: 'tenant-1',
        }),
        subscriptionId: 'sub-1',
        productTenantId: 'tenant-1',
      }),
    ).toThrow(DomainError);
  });

  it('forbids reactivating terminal associations in-place', () => {
    expect(() =>
      assertTerminalTransition(AssociationStatus.CLOSED, AssociationStatus.ACTIVE),
    ).toThrow(DomainError);
    expect(() =>
      assertTerminalTransition(AssociationStatus.ACTIVE, AssociationStatus.SUPERSEDED),
    ).not.toThrow();
  });

  it('requires ACTIVE association for plan/addon changes and blocks tenant swap', () => {
    expect(() =>
      assertPlanChangeKeepsProductTenant({
        changeType: 'PLAN_CHANGE',
        activeAssociation: null,
      }),
    ).toThrow(DomainError);

    expect(() =>
      assertPlanChangeKeepsProductTenant({
        changeType: 'PLAN_CHANGE',
        activeAssociation: assoc({ productTenantId: 'tenant-1' }),
        proposedProductTenantId: 'tenant-other',
      }),
    ).toThrow(DomainError);

    expect(() =>
      assertPlanChangeKeepsProductTenant({
        changeType: 'ADDON_ADD',
        activeAssociation: assoc({ productTenantId: 'tenant-1' }),
        proposedProductTenantId: 'tenant-1',
      }),
    ).not.toThrow();
  });
});

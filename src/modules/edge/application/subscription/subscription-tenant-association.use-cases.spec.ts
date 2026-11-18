import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import { AssociationStatus, AssociationType } from '../../domain/subscription/subscription-tenant-association.js';
import { BindSubscriptionTenantAssociationUseCase } from './subscription-tenant-association.use-cases.js';

describe('BindSubscriptionTenantAssociationUseCase', () => {
  const sub = {
    id: 'sub-1',
    accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    productId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  };

  it('creates INITIAL ACTIVE association', async () => {
    const created = {
      id: 'assoc-1',
      associationStatus: AssociationStatus.ACTIVE,
      associationType: AssociationType.INITIAL,
      subscriptionId: sub.id,
      productTenantId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    };
    const subscriptions = {
      getById: vi.fn(async () => sub),
    };
    const associations = {
      getActiveBySubscription: vi.fn(async () => null),
      getActiveByProductTenant: vi.fn(async () => null),
      create: vi.fn(async (input: Record<string, unknown>) => ({
        ...created,
        ...input,
      })),
      transitionStatus: vi.fn(),
    };

    const uc = new BindSubscriptionTenantAssociationUseCase(
      subscriptions as never,
      associations as never,
    );
    const result = await uc.execute({
      actorId: 'op-1',
      subscriptionId: sub.id,
      productTenantRef: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });

    expect(associations.create).toHaveBeenCalledOnce();
    expect(result.associationStatus).toBe(AssociationStatus.ACTIVE);
    expect(associations.create.mock.calls[0]![0]).toMatchObject({
      associationType: AssociationType.INITIAL,
      associationStatus: AssociationStatus.ACTIVE,
      accountId: sub.accountId,
      productId: sub.productId,
    });
  });

  it('supersedes existing ACTIVE on plan change', async () => {
    const existing = {
      id: 'assoc-old',
      subscriptionId: sub.id,
      productTenantId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      associationStatus: AssociationStatus.ACTIVE,
    };
    const subscriptions = { getById: vi.fn(async () => sub) };
    const associations = {
      getActiveBySubscription: vi.fn(async () => existing),
      getActiveByProductTenant: vi.fn(async () => existing),
      transitionStatus: vi.fn(async (input: { id: string }) => ({
        ...existing,
        id: input.id,
        associationStatus: AssociationStatus.SUPERSEDED,
      })),
      create: vi.fn(async (input: Record<string, unknown>) => ({
        id: 'assoc-new',
        ...input,
      })),
    };

    const uc = new BindSubscriptionTenantAssociationUseCase(
      subscriptions as never,
      associations as never,
    );
    await uc.execute({
      actorId: 'op-1',
      subscriptionId: sub.id,
      productTenantRef: 'edge:cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      supersedeExisting: true,
      associationType: AssociationType.PLAN_CHANGE,
    });

    expect(associations.transitionStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'assoc-old',
        toStatus: AssociationStatus.SUPERSEDED,
      }),
    );
    expect(associations.create.mock.calls[0]![0]).toMatchObject({
      associationType: AssociationType.PLAN_CHANGE,
      supersedesAssociationId: 'assoc-old',
    });
  });

  it('rejects conflict without supersede', async () => {
    const subscriptions = { getById: vi.fn(async () => sub) };
    const associations = {
      getActiveBySubscription: vi.fn(async () => ({
        id: 'assoc-old',
        subscriptionId: sub.id,
        productTenantId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      })),
      getActiveByProductTenant: vi.fn(async () => null),
      create: vi.fn(),
      transitionStatus: vi.fn(),
    };
    const uc = new BindSubscriptionTenantAssociationUseCase(
      subscriptions as never,
      associations as never,
    );
    await expect(
      uc.execute({
        actorId: 'op-1',
        subscriptionId: sub.id,
        productTenantRef: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(associations.create).not.toHaveBeenCalled();
  });
});

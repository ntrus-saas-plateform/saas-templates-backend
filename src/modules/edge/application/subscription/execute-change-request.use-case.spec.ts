import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import { AssociationStatus } from '../../domain/subscription/subscription-tenant-association.js';
import { EntitlementCapabilityKind } from '../../domain/subscription/subscription.entity.js';
import { ExecuteChangeRequestUseCase } from './subscription.use-cases.js';

describe('ExecuteChangeRequestUseCase (upgrade without new tenant)', () => {
  const sub = {
    id: 'sub-1',
    accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    productId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    planId: 'old-plan',
    enterpriseProfile: {},
  };

  const activeAssociation = {
    id: 'assoc-1',
    subscriptionId: sub.id,
    productTenantId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    productTenantRef: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    associationStatus: AssociationStatus.ACTIVE,
  };

  it('rejects PLAN_CHANGE without ACTIVE association', async () => {
    const subscriptions = {
      getChangeRequest: vi.fn(async () => ({
        id: 'ch-1',
        subscriptionId: sub.id,
        changeType: 'PLAN_CHANGE',
        approvalStatus: 'APPROVED',
        proposedConfig: { planCode: 'SYNTIX_PROFESSIONAL' },
      })),
      listChangeRequests: vi.fn(),
      updateChangeRequest: vi.fn(),
    };
    const associations = {
      getActiveBySubscription: vi.fn(async () => null),
    };
    const uc = new ExecuteChangeRequestUseCase(
      subscriptions as never,
      undefined,
      associations as never,
    );
    await expect(
      uc.execute({ actorId: 'op', subscriptionId: sub.id, changeId: 'ch-1' }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('recalculates entitlements and retains product tenant on PLAN_CHANGE', async () => {
    const items = [
      {
        id: 'item-old',
        itemType: 'PLAN',
        status: 'ACTIVE',
        offerRef: 'SYNTIX_LITE',
        snapshot: { capabilities: [] },
      },
    ];
    const subscriptions = {
      getChangeRequest: vi.fn(async () => ({
        id: 'ch-1',
        subscriptionId: sub.id,
        changeType: 'PLAN_CHANGE',
        approvalStatus: 'APPROVED',
        proposedConfig: { planCode: 'SYNTIX_PROFESSIONAL' },
      })),
      listChangeRequests: vi.fn(),
      updateChangeRequest: vi.fn(async (id: string, patch: Record<string, unknown>) => ({
        id,
        ...patch,
      })),
      updateSubscription: vi.fn(async () => sub),
      getById: vi.fn(async () => sub),
      listItems: vi.fn(async () => items),
      updateItemStatus: vi.fn(async (id: string, status: string) => ({
        id,
        status,
      })),
      addItem: vi.fn(async (input: Record<string, unknown>) => ({
        id: 'item-new',
        ...input,
      })),
      createEntitlementSnapshot: vi.fn(async (input: Record<string, unknown>) => ({
        id: 'snap-1',
        version: 2,
        ...input,
      })),
      listScheduledChanges: vi.fn(async () => []),
    };
    const associations = {
      getActiveBySubscription: vi.fn(async () => activeAssociation),
    };
    const publish = {
      execute: vi.fn(async () => ({ id: 'pub-1', status: 'PUBLISHED' })),
    };

    const uc = new ExecuteChangeRequestUseCase(
      subscriptions as never,
      undefined,
      associations as never,
      publish as never,
    );
    const result = await uc.execute({
      actorId: 'op',
      subscriptionId: sub.id,
      changeId: 'ch-1',
    });

    expect(subscriptions.updateItemStatus).toHaveBeenCalledWith(
      'item-old',
      'REMOVED',
      expect.any(Date),
    );
    expect(subscriptions.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        itemType: 'PLAN',
        offerRef: 'SYNTIX_PROFESSIONAL',
        snapshot: expect.objectContaining({
          capabilities: expect.arrayContaining([
            expect.objectContaining({
              capabilityCode: 'purchasing',
              kind: EntitlementCapabilityKind.FEATURE_FLAG,
            }),
          ]),
        }),
      }),
    );
    expect(publish.execute).toHaveBeenCalledOnce();
    expect(result.productTenantRetained).toBe(activeAssociation.productTenantId);
    expect(result.association).toEqual(activeAssociation);
  });

  it('blocks proposed tenant swap on ADDON_ADD', async () => {
    const subscriptions = {
      getChangeRequest: vi.fn(async () => ({
        id: 'ch-2',
        subscriptionId: sub.id,
        changeType: 'ADDON_ADD',
        approvalStatus: 'APPROVED',
        proposedConfig: {
          offerRef: 'ADDON_API_CAPACITY',
          productTenantId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          capabilities: [
            {
              capabilityCode: 'api',
              kind: EntitlementCapabilityKind.FEATURE_FLAG,
              enabled: true,
            },
          ],
        },
      })),
      listChangeRequests: vi.fn(),
      updateChangeRequest: vi.fn(),
    };
    const associations = {
      getActiveBySubscription: vi.fn(async () => activeAssociation),
    };
    const uc = new ExecuteChangeRequestUseCase(
      subscriptions as never,
      undefined,
      associations as never,
    );
    await expect(
      uc.execute({ actorId: 'op', subscriptionId: sub.id, changeId: 'ch-2' }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

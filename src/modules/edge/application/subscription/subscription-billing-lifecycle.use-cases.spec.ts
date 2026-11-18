import { describe, expect, it, vi } from 'vitest';
import { SubscriptionStatus } from '../../domain/subscription/subscription.entity.js';
import { ApplyDunningPolicyUseCase } from './subscription-billing-lifecycle.use-cases.js';

describe('ApplyDunningPolicyUseCase', () => {
  const policy = {
    id: 'pol-1',
    code: 'DUNNING_DEFAULT',
    policyType: 'DUNNING',
    status: 'ACTIVE',
    rules: {
      graceDays: 7,
      maxRetries: 3,
      restrictDuringGrace: true,
      suspendAfterGrace: true,
      suspendOnEscalate: true,
      reactivateOnResolve: true,
      restrictionMode: 'PAST_DUE',
    },
  };

  it('marks PAST_DUE during grace for linked subscription', async () => {
    const markPastDue = { execute: vi.fn(async () => ({ id: 'sub-1', status: 'PAST_DUE' })) };
    const suspend = { execute: vi.fn() };
    const reactivate = { execute: vi.fn() };
    const billing = {
      getCollectionCase: vi.fn(async () => ({
        id: 'case-1',
        billingAccountId: 'ba-1',
        invoiceId: 'inv-1',
        status: 'OPEN',
        overdueSince: new Date('2026-11-15T00:00:00Z'),
        policyCode: 'DUNNING_DEFAULT',
        metadata: {},
        nextActionAt: null,
      })),
      getBillingPolicyByCode: vi.fn(async () => policy),
      listDunningAttempts: vi.fn(async () => []),
      getInvoice: vi.fn(async () => ({ id: 'inv-1', subscriptionId: 'sub-1' })),
      listSubscriptionIdsForBillingAccount: vi.fn(async () => ['sub-1']),
      updateCollectionCase: vi.fn(async (_id: string, patch: Record<string, unknown>) => ({
        id: 'case-1',
        ...patch,
      })),
    };
    const subscriptions = {
      getById: vi.fn(async () => ({
        id: 'sub-1',
        status: SubscriptionStatus.ACTIVE,
      })),
    };

    const uc = new ApplyDunningPolicyUseCase(
      billing as never,
      subscriptions as never,
      markPastDue as never,
      suspend as never,
      reactivate as never,
    );

    const result = await uc.execute({
      actorId: 'ops-1',
      caseId: 'case-1',
      asOf: new Date('2026-11-17T00:00:00Z'),
    });

    expect(result.evaluation.action).toBe('MARK_PAST_DUE');
    expect(markPastDue.execute).toHaveBeenCalledOnce();
    expect(suspend.execute).not.toHaveBeenCalled();
    expect(result.applied[0]?.nextStatus).toBe('PAST_DUE');
  });

  it('suspends on escalate via policy', async () => {
    const markPastDue = { execute: vi.fn() };
    const suspend = {
      execute: vi.fn(async () => ({ id: 'sub-1', status: 'SUSPENDED' })),
    };
    const reactivate = { execute: vi.fn() };
    const billing = {
      getCollectionCase: vi.fn(async () => ({
        id: 'case-2',
        billingAccountId: 'ba-1',
        invoiceId: 'inv-1',
        status: 'ESCALATED',
        overdueSince: new Date('2026-11-16T00:00:00Z'),
        policyCode: 'DUNNING_DEFAULT',
        metadata: {},
        nextActionAt: null,
      })),
      getBillingPolicyByCode: vi.fn(async () => policy),
      listDunningAttempts: vi.fn(async () => []),
      getInvoice: vi.fn(async () => ({ id: 'inv-1', subscriptionId: 'sub-1' })),
      listSubscriptionIdsForBillingAccount: vi.fn(async () => []),
      updateCollectionCase: vi.fn(async () => ({ id: 'case-2' })),
    };
    const subscriptions = {
      getById: vi.fn(async () => ({
        id: 'sub-1',
        status: SubscriptionStatus.PAST_DUE,
      })),
    };

    const uc = new ApplyDunningPolicyUseCase(
      billing as never,
      subscriptions as never,
      markPastDue as never,
      suspend as never,
      reactivate as never,
    );

    const result = await uc.execute({ actorId: 'ops-1', caseId: 'case-2' });
    expect(result.evaluation.action).toBe('SUSPEND');
    expect(suspend.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: 'sub-1',
        reason: 'PAYMENT_DELINQUENCY',
        syncBb: true,
      }),
    );
  });

  it('reactivates on resolve', async () => {
    const markPastDue = { execute: vi.fn() };
    const suspend = { execute: vi.fn() };
    const reactivate = {
      execute: vi.fn(async () => ({ id: 'sub-1', status: 'ACTIVE' })),
    };
    const billing = {
      getCollectionCase: vi.fn(async () => ({
        id: 'case-3',
        billingAccountId: 'ba-1',
        invoiceId: 'inv-1',
        status: 'RESOLVED',
        overdueSince: new Date('2026-11-01T00:00:00Z'),
        policyCode: 'DUNNING_DEFAULT',
        metadata: {},
        nextActionAt: null,
      })),
      getBillingPolicyByCode: vi.fn(async () => policy),
      listDunningAttempts: vi.fn(async () => []),
      getInvoice: vi.fn(async () => ({ id: 'inv-1', subscriptionId: 'sub-1' })),
      listSubscriptionIdsForBillingAccount: vi.fn(async () => []),
      updateCollectionCase: vi.fn(async () => ({ id: 'case-3' })),
    };
    const subscriptions = {
      getById: vi.fn(async () => ({
        id: 'sub-1',
        status: SubscriptionStatus.SUSPENDED,
      })),
    };

    const uc = new ApplyDunningPolicyUseCase(
      billing as never,
      subscriptions as never,
      markPastDue as never,
      suspend as never,
      reactivate as never,
    );

    const result = await uc.execute({ actorId: 'ops-1', caseId: 'case-3' });
    expect(result.evaluation.action).toBe('REACTIVATE');
    expect(reactivate.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: 'sub-1',
        syncBb: true,
        republishEntitlements: true,
      }),
    );
  });
});

import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { BillingRepositoryPort } from '../../domain/ports/billing-repository.port.js';
import type { SubscriptionRepositoryPort } from '../../domain/ports/subscription-repository.port.js';
import {
  assertDunningPolicyActive,
  evaluateDunningLifecycle,
  parseDunningPolicyRules,
  PAYMENT_DELINQUENCY_REASON,
  type DunningEvaluation,
  type DunningLifecycleAction,
} from '../../domain/billing/dunning-policy.js';
import { SubscriptionStatus } from '../../domain/subscription/subscription.entity.js';
import {
  MarkSubscriptionPastDueUseCase,
  ReactivateSubscriptionUseCase,
  SuspendSubscriptionUseCase,
} from './subscription.use-cases.js';

export type ApplyDunningPolicyResult = {
  caseId: string;
  policyCode: string;
  evaluation: DunningEvaluation;
  subscriptionIds: string[];
  applied: Array<{
    subscriptionId: string;
    action: DunningLifecycleAction;
    previousStatus: string;
    nextStatus: string | null;
    skipped?: string;
  }>;
};

async function resolveSubscriptionIdsForCase(
  billing: BillingRepositoryPort,
  collectionCase: { billingAccountId: string; invoiceId: string },
): Promise<string[]> {
  const invoice = await billing.getInvoice(collectionCase.invoiceId);
  const ids = new Set<string>();
  if (invoice?.subscriptionId) ids.add(invoice.subscriptionId);
  const linked = await billing.listSubscriptionIdsForBillingAccount(
    collectionCase.billingAccountId,
  );
  for (const id of linked) ids.add(id);
  return [...ids];
}

/**
 * RGOM-E7.6 — Apply billing dunning policy to linked subscriptions.
 * Open → PAST_DUE (grace) ; post-grace / escalate → SUSPEND (+ BB) ; resolve → REACTIVATE (+ BB).
 */
export class ApplyDunningPolicyUseCase {
  constructor(
    private readonly billing: BillingRepositoryPort,
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly markPastDue: MarkSubscriptionPastDueUseCase,
    private readonly suspend: SuspendSubscriptionUseCase,
    private readonly reactivate: ReactivateSubscriptionUseCase,
  ) {}

  async execute(input: {
    actorId: string;
    caseId: string;
    asOf?: Date;
    /** Force action even if evaluation says NONE (ops override) — not used by default. */
    forceAction?: DunningLifecycleAction;
  }): Promise<ApplyDunningPolicyResult> {
    const collection = await this.billing.getCollectionCase(input.caseId);
    if (!collection) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Collection case not found');
    }

    const policyCode = collection.policyCode ?? 'DUNNING_DEFAULT';
    const policy = await this.billing.getBillingPolicyByCode(policyCode);
    if (policy) {
      assertDunningPolicyActive({ status: policy.status, policyType: policy.policyType });
    }
    const rules = parseDunningPolicyRules(policy?.rules ?? { graceDays: 7, maxRetries: 3 });
    const attempts = await this.billing.listDunningAttempts(collection.id);
    const evaluation = evaluateDunningLifecycle({
      caseStatus: collection.status,
      overdueSince: collection.overdueSince,
      asOf: input.asOf,
      rules,
      dunningAttemptCount: attempts.length,
    });

    const action = input.forceAction ?? evaluation.action;
    const subscriptionIds = await resolveSubscriptionIdsForCase(this.billing, collection);
    const applied: ApplyDunningPolicyResult['applied'] = [];

    if (action === 'NONE' || subscriptionIds.length === 0) {
      return {
        caseId: collection.id,
        policyCode,
        evaluation,
        subscriptionIds,
        applied:
          subscriptionIds.length === 0
            ? [
                {
                  subscriptionId: '',
                  action: 'NONE',
                  previousStatus: '',
                  nextStatus: null,
                  skipped: 'No subscription linked to invoice/billing account',
                },
              ]
            : [],
      };
    }

    for (const subscriptionId of subscriptionIds) {
      const sub = await this.subscriptions.getById(subscriptionId);
      if (!sub) {
        applied.push({
          subscriptionId,
          action,
          previousStatus: '',
          nextStatus: null,
          skipped: 'Subscription not found',
        });
        continue;
      }

      if (action === 'MARK_PAST_DUE') {
        if (sub.status === SubscriptionStatus.PAST_DUE) {
          applied.push({
            subscriptionId,
            action,
            previousStatus: sub.status,
            nextStatus: sub.status,
            skipped: 'Already PAST_DUE',
          });
          continue;
        }
        if (sub.status !== SubscriptionStatus.ACTIVE) {
          applied.push({
            subscriptionId,
            action,
            previousStatus: sub.status,
            nextStatus: null,
            skipped: `Cannot mark PAST_DUE from ${sub.status}`,
          });
          continue;
        }
        const updated = await this.markPastDue.execute({
          actorId: input.actorId,
          subscriptionId,
          reason: PAYMENT_DELINQUENCY_REASON,
          collectionCaseId: collection.id,
          graceEndsAt: evaluation.graceEndsAt,
        });
        applied.push({
          subscriptionId,
          action,
          previousStatus: sub.status,
          nextStatus: updated.status,
        });
        continue;
      }

      if (action === 'SUSPEND') {
        if (sub.status === SubscriptionStatus.SUSPENDED) {
          applied.push({
            subscriptionId,
            action,
            previousStatus: sub.status,
            nextStatus: sub.status,
            skipped: 'Already SUSPENDED',
          });
          continue;
        }
        if (
          sub.status !== SubscriptionStatus.ACTIVE &&
          sub.status !== SubscriptionStatus.PAST_DUE &&
          sub.status !== SubscriptionStatus.TRIALING
        ) {
          applied.push({
            subscriptionId,
            action,
            previousStatus: sub.status,
            nextStatus: null,
            skipped: `Cannot suspend from ${sub.status}`,
          });
          continue;
        }
        const updated = await this.suspend.execute({
          actorId: input.actorId,
          subscriptionId,
          reason: PAYMENT_DELINQUENCY_REASON,
          syncBb: true,
        });
        applied.push({
          subscriptionId,
          action,
          previousStatus: sub.status,
          nextStatus: updated.status,
        });
        continue;
      }

      if (action === 'REACTIVATE') {
        if (sub.status === SubscriptionStatus.ACTIVE) {
          applied.push({
            subscriptionId,
            action,
            previousStatus: sub.status,
            nextStatus: sub.status,
            skipped: 'Already ACTIVE',
          });
          continue;
        }
        if (
          sub.status !== SubscriptionStatus.SUSPENDED &&
          sub.status !== SubscriptionStatus.PAST_DUE
        ) {
          applied.push({
            subscriptionId,
            action,
            previousStatus: sub.status,
            nextStatus: null,
            skipped: `Cannot reactivate from ${sub.status}`,
          });
          continue;
        }
        const updated = await this.reactivate.execute({
          actorId: input.actorId,
          subscriptionId,
          syncBb: true,
          republishEntitlements: true,
        });
        applied.push({
          subscriptionId,
          action,
          previousStatus: sub.status,
          nextStatus: updated.status,
        });
      }
    }

    await this.billing.updateCollectionCase(collection.id, {
      metadata: {
        ...collection.metadata,
        lastDunningPolicyApply: {
          at: new Date().toISOString(),
          action,
          phase: evaluation.phase,
          correlationId: randomUUID(),
          applied,
        },
      },
      nextActionAt:
        evaluation.phase === 'GRACE' && evaluation.graceEndsAt
          ? evaluation.graceEndsAt
          : collection.nextActionAt,
    });

    return {
      caseId: collection.id,
      policyCode,
      evaluation,
      subscriptionIds,
      applied,
    };
  }
}

/** Cron/ops entrypoint — scan open collections and apply dunning policy. */
export class ProcessDunningBatchUseCase {
  constructor(
    private readonly billing: BillingRepositoryPort,
    private readonly applyPolicy: ApplyDunningPolicyUseCase,
  ) {}

  async execute(input: {
    actorId: string;
    limit?: number;
    asOf?: Date;
    statuses?: string[];
  }) {
    const statuses = input.statuses ?? ['OPEN', 'IN_PROGRESS', 'ESCALATED'];
    const limit = input.limit ?? 50;
    const results: ApplyDunningPolicyResult[] = [];
    const seen = new Set<string>();

    for (const status of statuses) {
      const cases = await this.billing.listCollectionCases({ status, limit });
      for (const c of cases) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        const result = await this.applyPolicy.execute({
          actorId: input.actorId,
          caseId: c.id,
          asOf: input.asOf,
        });
        results.push(result);
        if (results.length >= limit) break;
      }
      if (results.length >= limit) break;
    }

    return {
      scanned: results.length,
      suspended: results.filter((r) => r.applied.some((a) => a.action === 'SUSPEND' && !a.skipped))
        .length,
      pastDue: results.filter((r) =>
        r.applied.some((a) => a.action === 'MARK_PAST_DUE' && !a.skipped),
      ).length,
      reactivated: results.filter((r) =>
        r.applied.some((a) => a.action === 'REACTIVATE' && !a.skipped),
      ).length,
      results,
    };
  }
}

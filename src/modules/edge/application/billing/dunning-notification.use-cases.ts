import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { AcquisitionNotificationPort } from '../../domain/acquisition/acquisition-notification.port.js';
import {
  evaluateDunningLifecycle,
  parseDunningPolicyRules,
} from '../../domain/billing/dunning-policy.js';
import {
  planDunningNotification,
  resolveDunningRecipient,
} from '../../domain/billing/dunning-notification.js';
import type { BillingRepositoryPort } from '../../domain/ports/billing-repository.port.js';

/**
 * RGOM-E8.1 — Dispatch dunning notification for a collection case.
 * Queues email only (never claims DELIVERED); always records dunning attempt.
 */
export class DispatchDunningNotificationUseCase {
  constructor(
    private readonly billing: BillingRepositoryPort,
    private readonly notifications?: AcquisitionNotificationPort,
  ) {}

  async execute(input: {
    actorId: string;
    caseId: string;
    channel?: string;
    templateRef?: string | null;
    toEmail?: string | null;
  }) {
    const collection = await this.billing.getCollectionCase(input.caseId);
    if (!collection) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Collection case not found');
    }

    const policy = await this.billing.getBillingPolicyByCode(
      collection.policyCode ?? 'DUNNING_DEFAULT',
    );
    const rules = parseDunningPolicyRules(policy?.rules ?? {});
    const attempts = await this.billing.listDunningAttempts(collection.id);
    const evaluation = evaluateDunningLifecycle({
      caseStatus: collection.status,
      overdueSince: collection.overdueSince,
      rules,
      dunningAttemptCount: attempts.length,
    });

    const planned = planDunningNotification(evaluation.phase);
    const channel = (input.channel ?? planned?.channel ?? 'EMAIL').toUpperCase();
    const templateRef =
      input.templateRef ?? planned?.templateRef ?? 'billing.dunning.generic.v1';

    const profile = await this.billing.getCurrentBillingProfile(collection.billingAccountId);
    const parties = await this.billing.listBillingParties(collection.billingAccountId);
    const partyEmail =
      parties.find((p) => p.email)?.email ??
      parties.find((p) => typeof p.address?.email === 'string')?.address?.email;

    const to =
      input.toEmail?.trim() ||
      resolveDunningRecipient({
        billingProfileEmail:
          typeof profile?.snapshot?.email === 'string' ? profile.snapshot.email : null,
        partyEmail: typeof partyEmail === 'string' ? partyEmail : null,
        metadataEmail:
          typeof collection.metadata?.email === 'string'
            ? collection.metadata.email
            : null,
      });

    const attempt = await this.billing.recordDunningAttempt({
      caseId: collection.id,
      channel,
      templateRef,
    });

    let queue: { enqueued: boolean; deliveryStatus: string; skipped?: string } = {
      enqueued: false,
      deliveryStatus: 'SKIPPED',
      skipped: 'No notification adapter or recipient',
    };

    if (channel === 'EMAIL' && this.notifications && to) {
      const correlationId = randomUUID();
      const result = await this.notifications.queueEmail({
        templateCode: templateRef,
        to,
        payload: {
          caseId: collection.id,
          billingAccountId: collection.billingAccountId,
          invoiceId: collection.invoiceId,
          phase: evaluation.phase,
          action: evaluation.action,
          graceEndsAt: evaluation.graceEndsAt?.toISOString() ?? null,
          actorId: input.actorId,
        },
        correlationId,
      });
      queue = {
        enqueued: true,
        deliveryStatus: result.deliveryStatus,
      };
    } else if (channel === 'EMAIL' && !to) {
      queue = {
        enqueued: false,
        deliveryStatus: 'SKIPPED',
        skipped: 'No recipient email on billing profile/parties',
      };
    } else if (!this.notifications) {
      queue = {
        enqueued: false,
        deliveryStatus: 'SKIPPED',
        skipped: 'Notification port not configured — attempt recorded only',
      };
    }

    return {
      data: {
        attempt,
        evaluation: {
          phase: evaluation.phase,
          action: evaluation.action,
          reason: evaluation.reason,
        },
        channel,
        templateRef,
        recipient: to,
        queue,
      },
    };
  }
}

import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  extractSetupFeeAmount,
  normalizeBillingFrequency,
  toScheduleFrequency,
} from '../../domain/billing/billing-cadence.js';
import type { BillingRepositoryPort } from '../../domain/ports/billing-repository.port.js';
import type { SubscriptionRepositoryPort } from '../../domain/ports/subscription-repository.port.js';

/**
 * RGOM-E8 — Set subscription billing cadence (monthly/annual/enterprise) + optional setup fee.
 */
export class ConfigureBillingCadenceUseCase {
  constructor(
    private readonly billing: BillingRepositoryPort,
    private readonly subscriptions: SubscriptionRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    billingFrequency: string;
    setupFeeAmount?: string | number | null;
    nextBillAt?: Date | string | null;
  }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');

    const frequency = normalizeBillingFrequency(input.billingFrequency);
    const setupFee =
      input.setupFeeAmount != null && input.setupFeeAmount !== ''
        ? String(
            typeof input.setupFeeAmount === 'number'
              ? input.setupFeeAmount.toFixed(2)
              : Number(String(input.setupFeeAmount)).toFixed(2),
          )
        : extractSetupFeeAmount(sub.commercialSnapshot);

    if (input.setupFeeAmount != null && input.setupFeeAmount !== '') {
      const n = Number(setupFee);
      if (!Number.isFinite(n) || n < 0) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid setupFeeAmount');
      }
    }

    const commercialSnapshot = {
      ...sub.commercialSnapshot,
      ...(setupFee ? { setupFee } : {}),
      billingFrequency: frequency,
      cadenceConfiguredAt: new Date().toISOString(),
      cadenceConfiguredBy: input.actorId,
    };

    const updated = await this.subscriptions.updateSubscription(sub.id, {
      billingFrequency: frequency === 'ENTERPRISE_CONTRACT' ? 'CUSTOM' : frequency,
      commercialSnapshot,
    });

    let account = await this.billing.getBillingAccountForSubscription(sub.id);
    if (!account) {
      account = await this.billing.createBillingAccount({
        commercialAccountId: sub.accountId,
        currency: sub.currency,
        createdBy: input.actorId,
      });
      await this.billing.linkSubscriptionToBillingAccount({
        billingAccountId: account.id,
        subscriptionId: sub.id,
      });
    }

    const nextBillAt =
      input.nextBillAt === null
        ? null
        : input.nextBillAt
          ? new Date(input.nextBillAt)
          : frequency === 'ENTERPRISE_CONTRACT' || frequency === 'ONE_TIME'
            ? null
            : new Date();

    const schedule = await this.billing.createBillingSchedule({
      subscriptionId: sub.id,
      billingAccountId: account.id,
      frequency: toScheduleFrequency(frequency),
      nextBillAt,
      metadata: {
        cadence: frequency,
        setupFee: setupFee ?? null,
        enterpriseContract: frequency === 'ENTERPRISE_CONTRACT',
      },
    });

    return {
      data: {
        subscription: updated,
        schedule,
        billingFrequency: frequency,
        setupFee: setupFee ?? null,
      },
    };
  }
}

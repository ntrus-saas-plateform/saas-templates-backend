import { Injectable } from '@nestjs/common';
import type {
  BillingCoordinationConfirmInput,
  BillingCoordinationConfirmResult,
  BillingCoordinationRequestInput,
  BillingCoordinationRequestResult,
  SubscriptionBillingCoordinationPort,
} from '../../domain/subscription/billing-coordination.port.js';

@Injectable()
export class UnavailableSubscriptionBillingAdapter implements SubscriptionBillingCoordinationPort {
  async requestCoordination(
    _input: BillingCoordinationRequestInput,
  ): Promise<BillingCoordinationRequestResult> {
    return {
      outcome: 'UNAVAILABLE',
      failureCode: 'PROVIDER_NOT_CONFIGURED',
      failureMessage:
        'No billing coordination provider configured; P5 does not create invoices or payments',
    };
  }

  async confirmCoordination(
    _input: BillingCoordinationConfirmInput,
  ): Promise<BillingCoordinationConfirmResult> {
    return {
      outcome: 'UNAVAILABLE',
      failureCode: 'PROVIDER_NOT_CONFIGURED',
      failureMessage:
        'No billing coordination provider configured; cannot confirm billing without P6',
    };
  }
}

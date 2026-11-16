import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  AttachPaymentMethodInput,
  AttachPaymentMethodResult,
  ConfirmPaymentIntentInput,
  ConfirmPaymentIntentResult,
  CreateCustomerInput,
  CreateCustomerResult,
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  FetchPaymentStatusInput,
  FetchPaymentStatusResult,
  PaymentProviderPort,
  RefundPaymentInput,
  RefundPaymentResult,
} from '../../domain/billing/payment-provider.port.js';

const PROVIDER_CODE = 'sandbox';

type SandboxIntent = {
  providerIntentRef: string;
  amount: string;
  currency: string;
  confirmed: boolean;
  billingAccountId: string;
};

/**
 * In-memory lab PSP. Succeeds only when this adapter is explicitly selected and called —
 * never invents payment success for other resolver modes.
 */
@Injectable()
export class SandboxPaymentProviderAdapter implements PaymentProviderPort {
  private readonly intents = new Map<string, SandboxIntent>();

  async createCustomer(_input: CreateCustomerInput): Promise<CreateCustomerResult> {
    return {
      outcome: 'SUCCEEDED',
      provider: PROVIDER_CODE,
      providerCustomerRef: `sandbox_cus_${randomUUID()}`,
    };
  }

  async attachPaymentMethod(
    _input: AttachPaymentMethodInput,
  ): Promise<AttachPaymentMethodResult> {
    return {
      outcome: 'SUCCEEDED',
      provider: PROVIDER_CODE,
      providerMethodRef: `sandbox_pm_${randomUUID()}`,
      brand: 'visa',
      last4: '4242',
    };
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
    const providerIntentRef = `sandbox_pi_${randomUUID()}`;
    this.intents.set(providerIntentRef, {
      providerIntentRef,
      amount: input.amount,
      currency: input.currency,
      confirmed: false,
      billingAccountId: input.billingAccountId,
    });
    return {
      outcome: 'REQUESTED',
      provider: PROVIDER_CODE,
      providerIntentRef,
      clientSecret: `sandbox_secret_${providerIntentRef}`,
    };
  }

  async confirmPaymentIntent(
    input: ConfirmPaymentIntentInput,
  ): Promise<ConfirmPaymentIntentResult> {
    const intent = this.intents.get(input.providerIntentRef);
    if (!intent) {
      return {
        outcome: 'FAILED',
        failureCode: 'INTENT_NOT_FOUND',
        failureMessage: `Unknown sandbox payment intent ${input.providerIntentRef}`,
      };
    }
    intent.confirmed = true;
    this.intents.set(intent.providerIntentRef, intent);
    return {
      outcome: 'SUCCEEDED',
      provider: PROVIDER_CODE,
      providerRef: intent.providerIntentRef,
      status: 'paid',
    };
  }

  async refundPayment(_input: RefundPaymentInput): Promise<RefundPaymentResult> {
    return {
      outcome: 'SUCCEEDED',
      provider: PROVIDER_CODE,
      providerRef: `sandbox_re_${randomUUID()}`,
    };
  }

  async fetchPaymentStatus(input: FetchPaymentStatusInput): Promise<FetchPaymentStatusResult> {
    const intent = this.intents.get(input.providerIntentRef);
    if (!intent) {
      return {
        outcome: 'FAILED',
        provider: PROVIDER_CODE,
        providerRef: input.providerIntentRef,
        status: 'FAILED',
      };
    }
    if (intent.confirmed) {
      return {
        outcome: 'SUCCEEDED',
        provider: PROVIDER_CODE,
        providerRef: intent.providerIntentRef,
        status: 'paid',
      };
    }
    return {
      outcome: 'REQUESTED',
      provider: PROVIDER_CODE,
      providerRef: intent.providerIntentRef,
      status: 'REQUESTED',
    };
  }
}

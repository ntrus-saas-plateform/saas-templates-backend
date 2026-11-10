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

@Injectable()
export class UnavailablePaymentProviderAdapter implements PaymentProviderPort {
  private unavailable(code: string, message: string) {
    return {
      outcome: 'UNAVAILABLE' as const,
      failureCode: code,
      failureMessage: message,
    };
  }

  async createCustomer(_input: CreateCustomerInput): Promise<CreateCustomerResult> {
    return this.unavailable(
      'PROVIDER_NOT_CONFIGURED',
      'No payment provider configured; cannot create provider customer',
    );
  }

  async attachPaymentMethod(_input: AttachPaymentMethodInput): Promise<AttachPaymentMethodResult> {
    return this.unavailable(
      'PROVIDER_NOT_CONFIGURED',
      'No payment provider configured; cannot attach payment method',
    );
  }

  async createPaymentIntent(_input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
    return this.unavailable(
      'PROVIDER_NOT_CONFIGURED',
      'No payment provider configured; payment intent requires external PSP',
    );
  }

  async confirmPaymentIntent(
    _input: ConfirmPaymentIntentInput,
  ): Promise<ConfirmPaymentIntentResult> {
    return this.unavailable(
      'PROVIDER_NOT_CONFIGURED',
      'Cannot confirm payment without provider proof or verified webhook',
    );
  }

  async refundPayment(_input: RefundPaymentInput): Promise<RefundPaymentResult> {
    return this.unavailable(
      'PROVIDER_NOT_CONFIGURED',
      'No payment provider configured; cannot refund',
    );
  }

  async fetchPaymentStatus(_input: FetchPaymentStatusInput): Promise<FetchPaymentStatusResult> {
    return this.unavailable(
      'PROVIDER_NOT_CONFIGURED',
      'Cannot fetch payment status without configured provider',
    );
  }
}

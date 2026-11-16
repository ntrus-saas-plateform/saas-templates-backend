import { Injectable, Inject } from '@nestjs/common';
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
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import { UnavailablePaymentProviderAdapter } from './unavailable-payment.adapter.js';
import { HttpWebhookPaymentProviderAdapter } from './http-webhook-payment.adapter.js';
import { SandboxPaymentProviderAdapter } from './sandbox-payment.adapter.js';

type PaymentAdapterMode = 'unavailable' | 'http_webhook' | 'sandbox';

/**
 * Routes payment calls by BILLING_PAYMENT_ADAPTER (or auto from webhook URL).
 * Default UNAVAILABLE — never invents success without provider.
 * Sandbox is never auto-selected; set BILLING_PAYMENT_ADAPTER=sandbox explicitly.
 */
@Injectable()
export class ResolvingPaymentProviderAdapter implements PaymentProviderPort {
  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly unavailable: UnavailablePaymentProviderAdapter,
    private readonly httpWebhook: HttpWebhookPaymentProviderAdapter,
    private readonly sandbox: SandboxPaymentProviderAdapter,
  ) {}

  private resolveMode(): PaymentAdapterMode {
    const configured = this.config.BILLING_PAYMENT_ADAPTER;
    if (configured === 'sandbox') return 'sandbox';
    if (configured === 'http_webhook') return 'http_webhook';
    if (configured === 'auto') {
      // auto: http_webhook only when URL is set — never auto-select sandbox
      if (this.config.BILLING_PAYMENT_WEBHOOK_URL) return 'http_webhook';
      return 'unavailable';
    }
    return 'unavailable';
  }

  private adapter(): PaymentProviderPort {
    const mode = this.resolveMode();
    if (mode === 'sandbox') return this.sandbox;
    if (mode === 'http_webhook') return this.httpWebhook;
    return this.unavailable;
  }

  createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    return this.adapter().createCustomer(input);
  }

  attachPaymentMethod(input: AttachPaymentMethodInput): Promise<AttachPaymentMethodResult> {
    return this.adapter().attachPaymentMethod(input);
  }

  createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
    return this.adapter().createPaymentIntent(input);
  }

  confirmPaymentIntent(input: ConfirmPaymentIntentInput): Promise<ConfirmPaymentIntentResult> {
    return this.adapter().confirmPaymentIntent(input);
  }

  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    return this.adapter().refundPayment(input);
  }

  fetchPaymentStatus(input: FetchPaymentStatusInput): Promise<FetchPaymentStatusResult> {
    return this.adapter().fetchPaymentStatus(input);
  }
}

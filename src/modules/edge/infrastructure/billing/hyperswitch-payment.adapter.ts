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
import { HttpWebhookPaymentProviderAdapter } from './http-webhook-payment.adapter.js';

/**
 * HyperSwitch orchestration adapter (RGOM-E8 / SoT matrix).
 *
 * HyperSwitch is **payment orchestration only** — never catalogue / price / plan SoT.
 * This adapter delegates to the HTTP webhook PSP bridge; commercial amounts stay in Edge Billing.
 */
@Injectable()
export class HyperswitchPaymentProviderAdapter implements PaymentProviderPort {
  readonly orchestrationOnly = true as const;
  readonly providerName = 'hyperswitch';

  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly httpWebhook: HttpWebhookPaymentProviderAdapter,
  ) {}

  createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    return this.httpWebhook.createCustomer(input);
  }

  attachPaymentMethod(input: AttachPaymentMethodInput): Promise<AttachPaymentMethodResult> {
    return this.httpWebhook.attachPaymentMethod(input);
  }

  createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
    // Amounts originate from Edge invoice/intent — adapter must not invent catalogue prices.
    return this.httpWebhook.createPaymentIntent(input);
  }

  confirmPaymentIntent(input: ConfirmPaymentIntentInput): Promise<ConfirmPaymentIntentResult> {
    return this.httpWebhook.confirmPaymentIntent(input);
  }

  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    return this.httpWebhook.refundPayment(input);
  }

  fetchPaymentStatus(input: FetchPaymentStatusInput): Promise<FetchPaymentStatusResult> {
    return this.httpWebhook.fetchPaymentStatus(input);
  }

  /** Explicit invariant for arch tests / ops introspection. */
  assertsOrchestrationOnly(): { ok: true; soT: 'edge-billing'; role: 'orchestration' } {
    void this.config;
    return { ok: true, soT: 'edge-billing', role: 'orchestration' };
  }
}

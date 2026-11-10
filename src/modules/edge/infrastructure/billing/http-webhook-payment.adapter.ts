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
import { LoggerService } from '../../../../shared/logging/logger.service.js';

const PROVIDER_CODE = 'http_webhook';

/**
 * Outbound hand-off to configured webhook. 2xx with { providerRef, status } maps provider state.
 * Missing URL → UNAVAILABLE. Never treats client-side alone as paid.
 */
@Injectable()
export class HttpWebhookPaymentProviderAdapter implements PaymentProviderPort {
  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly logger: LoggerService,
  ) {}

  private missingUrl() {
    return {
      outcome: 'UNAVAILABLE' as const,
      failureCode: 'WEBHOOK_URL_MISSING',
      failureMessage:
        'HTTP webhook payment adapter requires BILLING_PAYMENT_WEBHOOK_URL',
    };
  }

  private async post(
    operation: string,
    body: Record<string, unknown>,
  ): Promise<{ ok: boolean; status: number; json?: Record<string, unknown>; text?: string }> {
    const url = this.config.BILLING_PAYMENT_WEBHOOK_URL;
    if (!url) return { ok: false, status: 0 };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Billing-Operation': operation,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.BILLING_PAYMENT_WEBHOOK_TIMEOUT_MS),
      });
      const text = await res.text().catch(() => '');
      let json: Record<string, unknown> | undefined;
      try {
        json = text ? (JSON.parse(text) as Record<string, unknown>) : undefined;
      } catch {
        json = undefined;
      }
      return { ok: res.ok, status: res.status, json, text };
    } catch (error) {
      this.logger.warn('Billing payment webhook transport error', {
        operation,
        error: error instanceof Error ? error.message : String(error),
      });
      return { ok: false, status: 0, text: error instanceof Error ? error.message : String(error) };
    }
  }

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    if (!this.config.BILLING_PAYMENT_WEBHOOK_URL) return this.missingUrl();
    const res = await this.post('createCustomer', {
      billingAccountId: input.billingAccountId,
      correlationId: input.correlationId,
      email: input.email ?? null,
    });
    if (!res.ok) {
      return {
        outcome: 'FAILED',
        failureCode: res.status ? `HTTP_${res.status}` : 'WEBHOOK_TRANSPORT_ERROR',
        failureMessage: res.text?.slice(0, 500) ?? 'Webhook failed',
      };
    }
    const ref = String(res.json?.providerRef ?? res.json?.providerCustomerRef ?? '');
    if (!ref) {
      return {
        outcome: 'FAILED',
        failureCode: 'INVALID_WEBHOOK_RESPONSE',
        failureMessage: 'Webhook success missing providerRef',
      };
    }
    return { outcome: 'SUCCEEDED', provider: PROVIDER_CODE, providerCustomerRef: ref };
  }

  async attachPaymentMethod(input: AttachPaymentMethodInput): Promise<AttachPaymentMethodResult> {
    if (!this.config.BILLING_PAYMENT_WEBHOOK_URL) return this.missingUrl();
    const res = await this.post('attachPaymentMethod', { ...input });
    if (!res.ok) {
      return {
        outcome: 'FAILED',
        failureCode: res.status ? `HTTP_${res.status}` : 'WEBHOOK_TRANSPORT_ERROR',
        failureMessage: res.text?.slice(0, 500) ?? 'Webhook failed',
      };
    }
    const ref = String(res.json?.providerRef ?? res.json?.providerMethodRef ?? '');
    if (!ref) {
      return {
        outcome: 'FAILED',
        failureCode: 'INVALID_WEBHOOK_RESPONSE',
        failureMessage: 'Webhook success missing providerRef',
      };
    }
    return {
      outcome: 'SUCCEEDED',
      provider: PROVIDER_CODE,
      providerMethodRef: ref,
      brand: (res.json?.brand as string | undefined) ?? null,
      last4: (res.json?.last4 as string | undefined) ?? null,
    };
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
    if (!this.config.BILLING_PAYMENT_WEBHOOK_URL) return this.missingUrl();
    const res = await this.post('createPaymentIntent', { ...input });
    if (!res.ok) {
      return {
        outcome: 'FAILED',
        failureCode: res.status ? `HTTP_${res.status}` : 'WEBHOOK_TRANSPORT_ERROR',
        failureMessage: res.text?.slice(0, 500) ?? 'Webhook failed',
      };
    }
    const providerRef = String(res.json?.providerRef ?? res.json?.providerIntentRef ?? '');
    const status = String(res.json?.status ?? 'REQUESTED').toUpperCase();
    if (!providerRef) {
      return {
        outcome: 'FAILED',
        failureCode: 'INVALID_WEBHOOK_RESPONSE',
        failureMessage: 'Webhook success missing providerRef',
      };
    }
    const allowed = new Set(['REQUESTED', 'REQUIRES_ACTION', 'SUCCEEDED']);
    if (!allowed.has(status)) {
      return {
        outcome: 'FAILED',
        failureCode: 'INVALID_WEBHOOK_STATUS',
        failureMessage: `Unsupported webhook status ${status}`,
      };
    }
    return {
      outcome: status as 'REQUESTED' | 'REQUIRES_ACTION' | 'SUCCEEDED',
      provider: PROVIDER_CODE,
      providerIntentRef: providerRef,
      clientSecret: (res.json?.clientSecret as string | undefined) ?? null,
    };
  }

  async confirmPaymentIntent(
    input: ConfirmPaymentIntentInput,
  ): Promise<ConfirmPaymentIntentResult> {
    if (!this.config.BILLING_PAYMENT_WEBHOOK_URL) return this.missingUrl();
    const res = await this.post('confirmPaymentIntent', { ...input });
    if (!res.ok) {
      return {
        outcome: 'FAILED',
        failureCode: res.status ? `HTTP_${res.status}` : 'WEBHOOK_TRANSPORT_ERROR',
        failureMessage: res.text?.slice(0, 500) ?? 'Webhook failed',
      };
    }
    const providerRef = String(res.json?.providerRef ?? input.providerIntentRef);
    const status = String(res.json?.status ?? 'REQUESTED').toUpperCase();
    const allowed = new Set(['REQUESTED', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED']);
    if (!allowed.has(status)) {
      return {
        outcome: 'FAILED',
        failureCode: 'INVALID_WEBHOOK_STATUS',
        failureMessage: `Unsupported webhook status ${status}`,
      };
    }
    if (status === 'FAILED') {
      return {
        outcome: 'FAILED',
        failureCode: 'PROVIDER_FAILED',
        failureMessage: 'Provider reported payment failed',
      };
    }
    return {
      outcome: status as 'REQUESTED' | 'REQUIRES_ACTION' | 'SUCCEEDED',
      provider: input.provider,
      providerRef,
      status,
    };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    if (!this.config.BILLING_PAYMENT_WEBHOOK_URL) return this.missingUrl();
    const res = await this.post('refundPayment', { ...input });
    if (!res.ok) {
      return {
        outcome: 'FAILED',
        failureCode: res.status ? `HTTP_${res.status}` : 'WEBHOOK_TRANSPORT_ERROR',
        failureMessage: res.text?.slice(0, 500) ?? 'Webhook failed',
      };
    }
    const providerRef = String(res.json?.providerRef ?? '');
    const status = String(res.json?.status ?? 'REQUESTED').toUpperCase();
    if (!providerRef) {
      return {
        outcome: 'FAILED',
        failureCode: 'INVALID_WEBHOOK_RESPONSE',
        failureMessage: 'Webhook success missing providerRef',
      };
    }
    if (status !== 'SUCCEEDED' && status !== 'REQUESTED') {
      return {
        outcome: 'FAILED',
        failureCode: 'INVALID_WEBHOOK_STATUS',
        failureMessage: `Unsupported refund status ${status}`,
      };
    }
    return {
      outcome: status as 'SUCCEEDED' | 'REQUESTED',
      provider: input.provider,
      providerRef,
    };
  }

  async fetchPaymentStatus(input: FetchPaymentStatusInput): Promise<FetchPaymentStatusResult> {
    if (!this.config.BILLING_PAYMENT_WEBHOOK_URL) return this.missingUrl();
    const res = await this.post('fetchPaymentStatus', { ...input });
    if (!res.ok) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: res.status ? `HTTP_${res.status}` : 'WEBHOOK_TRANSPORT_ERROR',
        failureMessage: res.text?.slice(0, 500) ?? 'Webhook failed',
      };
    }
    const providerRef = String(res.json?.providerRef ?? input.providerIntentRef);
    const status = String(res.json?.status ?? 'REQUESTED').toUpperCase();
    const allowed = new Set(['REQUESTED', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED']);
    if (!allowed.has(status)) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'INVALID_WEBHOOK_STATUS',
        failureMessage: `Unsupported webhook status ${status}`,
      };
    }
    return {
      outcome: status as 'REQUESTED' | 'REQUIRES_ACTION' | 'SUCCEEDED' | 'FAILED',
      provider: input.provider,
      providerRef,
      status,
    };
  }
}

import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { MarketingRepositoryPort } from '../../domain/ports/marketing-repository.port.js';
import { IngestMarketingDeliveryReceiptUseCase } from './marketing-orchestration.use-cases.js';
import {
  extractResendDeliveryCorrelation,
  mapResendEventToReceiptStatus,
  verifyResendSvixSignature,
  type ResendWebhookHeaders,
} from '../../infrastructure/marketing/resend-svix.verify.js';

export class ProcessResendMarketingWebhookUseCase {
  constructor(
    private readonly marketing: MarketingRepositoryPort,
    private readonly ingestReceipt: IngestMarketingDeliveryReceiptUseCase,
    private readonly webhookSecret: string | undefined,
  ) {}

  async execute(input: {
    rawBody: string;
    headers: ResendWebhookHeaders;
  }) {
    if (!this.webhookSecret) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'RESEND_WEBHOOK_SECRET is not configured',
      );
    }

    const signatureValid = verifyResendSvixSignature({
      payload: input.rawBody,
      headers: input.headers,
      webhookSecret: this.webhookSecret,
    });
    if (!signatureValid) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'Resend webhook signature invalid');
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(input.rawBody) as Record<string, unknown>;
    } catch {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid Resend webhook JSON');
    }

    const correlation = extractResendDeliveryCorrelation(parsed);
    const receiptStatus = mapResendEventToReceiptStatus(correlation.eventType);

    let attempt =
      (correlation.deliveryAttemptId
        ? await this.marketing.getDeliveryAttempt(correlation.deliveryAttemptId)
        : null) ??
      (correlation.providerMessageId
        ? await this.marketing.findDeliveryByProviderMessageId(correlation.providerMessageId)
        : null);

    if (!attempt) {
      throw new DomainError(
        ErrorCode.RESOURCE_NOT_FOUND,
        'No delivery attempt matches Resend webhook',
        [
          {
            emailId: correlation.providerMessageId,
            deliveryAttemptId: correlation.deliveryAttemptId,
          },
        ],
      );
    }

    const providerEventId = input.headers.id || `${correlation.eventType}:${attempt.id}`;

    return this.ingestReceipt.execute({
      deliveryAttemptId: attempt.id,
      providerEventId,
      receiptStatus,
      signatureValid: true,
      rawPayload: parsed,
      source: 'provider_webhook',
    });
  }
}

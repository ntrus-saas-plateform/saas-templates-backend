import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { MarketingRepositoryPort } from '../../domain/ports/marketing-repository.port.js';
import {
  extractWhatsAppStatusReceipts,
  verifyMetaWhatsAppSignature,
} from '../../infrastructure/marketing/meta-whatsapp-webhook.verify.js';
import { IngestMarketingDeliveryReceiptUseCase } from './marketing-orchestration.use-cases.js';

export class ProcessMetaWhatsAppMarketingWebhookUseCase {
  constructor(
    private readonly marketing: MarketingRepositoryPort,
    private readonly ingestReceipt: IngestMarketingDeliveryReceiptUseCase,
    private readonly appSecret: string | undefined,
  ) {}

  async execute(input: { rawBody: string; signatureHeader?: string }) {
    if (!this.appSecret) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'WHATSAPP_APP_SECRET is not configured',
      );
    }
    const ok = verifyMetaWhatsAppSignature({
      rawBody: input.rawBody,
      signatureHeader: input.signatureHeader,
      appSecret: this.appSecret,
    });
    if (!ok) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'WhatsApp webhook signature invalid');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(input.rawBody);
    } catch {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid WhatsApp webhook JSON');
    }

    const statuses = extractWhatsAppStatusReceipts(parsed);
    const results: Array<Record<string, unknown>> = [];

    for (const st of statuses) {
      if (st.receiptStatus === 'UNKNOWN' && st.providerEventId.endsWith(':sent')) {
        results.push({
          providerMessageId: st.providerMessageId,
          skipped: true,
          reason: 'sent_keeps_submitted',
        });
        continue;
      }
      const attempt = await this.marketing.findDeliveryByProviderMessageId(
        st.providerMessageId,
      );
      if (!attempt) {
        results.push({
          providerMessageId: st.providerMessageId,
          skipped: true,
          reason: 'delivery_not_found',
        });
        continue;
      }
      const ingested = await this.ingestReceipt.execute({
        deliveryAttemptId: attempt.id,
        providerEventId: st.providerEventId,
        receiptStatus: st.receiptStatus,
        signatureValid: true,
        rawPayload: parsed as Record<string, unknown>,
        source: 'provider_webhook',
      });
      results.push({
        providerMessageId: st.providerMessageId,
        deliveryAttemptId: attempt.id,
        ...ingested,
      });
    }

    return { processed: results.length, results };
  }
}

export class VerifyMetaWhatsAppWebhookSubscriptionUseCase {
  constructor(private readonly verifyToken: string | undefined) {}

  execute(input: { mode?: string; token?: string; challenge?: string }): string {
    if (input.mode !== 'subscribe') {
      throw new DomainError(ErrorCode.FORBIDDEN, 'Invalid WhatsApp webhook mode');
    }
    if (!this.verifyToken || input.token !== this.verifyToken) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'WhatsApp verify token mismatch');
    }
    if (!input.challenge) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Missing hub.challenge');
    }
    return input.challenge;
  }
}

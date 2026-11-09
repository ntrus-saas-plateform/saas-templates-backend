import { Injectable, Inject } from '@nestjs/common';
import type {
  ChannelSendRequest,
  ChannelSendResult,
  MarketingChannelAdapterPort,
} from '../../domain/marketing/channel-adapter.port.js';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import { LoggerService } from '../../../../shared/logging/logger.service.js';

const RESEND_API_URL = 'https://api.resend.com/emails';

/** Resend tags allow only [A-Za-z0-9_-], max 256. */
function sanitizeResendTag(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 256);
}

/**
 * Live Resend HTTP hand-off for Edge marketing EMAIL channel.
 * ACCEPTED on 2xx with Resend email id — never invents DELIVERED.
 */
@Injectable()
export class ResendMarketingChannelAdapter implements MarketingChannelAdapterPort {
  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly logger: LoggerService,
  ) {}

  async send(request: ChannelSendRequest): Promise<ChannelSendResult> {
    if (request.channelType !== 'EMAIL') {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'CHANNEL_UNSUPPORTED',
        failureMessage: `Resend adapter only supports EMAIL (got ${request.channelType})`,
      };
    }

    const apiKey = this.config.RESEND_API_KEY;
    if (!apiKey) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'RESEND_API_KEY_MISSING',
        failureMessage: 'RESEND_API_KEY is not configured',
      };
    }

    const to = request.toEmailNormalized?.trim();
    if (!to) {
      return {
        outcome: 'REJECTED',
        retryable: false,
        failureCode: 'MISSING_RECIPIENT',
        failureMessage: 'Lead has no normalized email',
      };
    }

    const from =
      (typeof request.settings.from === 'string' && request.settings.from.trim()) ||
      this.config.MARKETING_RESEND_FROM ||
      this.config.MAIL_FROM;
    if (!from) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'MAIL_FROM_MISSING',
        failureMessage: 'MARKETING_RESEND_FROM / MAIL_FROM is not configured',
      };
    }

    const subject =
      request.subject?.trim() ||
      (typeof request.settings.subject === 'string' && request.settings.subject.trim()) ||
      'Okapi';
    const html =
      request.html?.trim() ||
      (typeof request.settings.html === 'string' && request.settings.html) ||
      undefined;
    const text =
      request.text?.trim() ||
      (typeof request.settings.text === 'string' && request.settings.text) ||
      (!html ? ' ' : undefined);

    if (!html && !text) {
      return {
        outcome: 'REJECTED',
        retryable: false,
        failureCode: 'MISSING_CONTENT',
        failureMessage: 'Resend send requires subject + html or text content',
      };
    }

    try {
      const res = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': request.idempotencyKey,
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          ...(html ? { html } : {}),
          ...(text ? { text } : {}),
          tags: [
            {
              name: 'delivery_attempt_id',
              value: sanitizeResendTag(request.deliveryAttemptId),
            },
            { name: 'lead_id', value: sanitizeResendTag(request.leadId) },
            {
              name: 'idempotency_key',
              value: sanitizeResendTag(request.idempotencyKey),
            },
          ],
        }),
      });

      const bodyText = await res.text().catch(() => '');
      if (!res.ok) {
        const failureMessage = `Resend ${res.status}: ${bodyText.slice(0, 400)}`;
        this.logger.warn('Resend marketing send rejected', {
          status: res.status,
          deliveryAttemptId: request.deliveryAttemptId,
        });
        return {
          outcome: 'REJECTED',
          retryable: res.status >= 500 || res.status === 429,
          failureCode: `RESEND_HTTP_${res.status}`,
          failureMessage,
        };
      }

      let providerMessageId = `resend-${request.idempotencyKey.slice(0, 24)}`;
      try {
        const json = JSON.parse(bodyText) as { id?: string };
        if (json.id) providerMessageId = json.id;
      } catch {
        /* keep fallback id */
      }

      return { outcome: 'ACCEPTED', providerMessageId };
    } catch (error) {
      this.logger.warn('Resend marketing transport error', {
        error: error instanceof Error ? error.message : String(error),
        deliveryAttemptId: request.deliveryAttemptId,
      });
      return {
        outcome: 'REJECTED',
        retryable: true,
        failureCode: 'RESEND_TRANSPORT_ERROR',
        failureMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

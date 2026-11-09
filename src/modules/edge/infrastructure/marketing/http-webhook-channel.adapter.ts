import { Injectable, Inject } from '@nestjs/common';
import type {
  ChannelSendRequest,
  ChannelSendResult,
  MarketingChannelAdapterPort,
} from '../../domain/marketing/channel-adapter.port.js';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import { LoggerService } from '../../../../shared/logging/logger.service.js';

/**
 * Posts a provider hand-off payload to a configured webhook URL.
 * 2xx → ACCEPTED (SUBMITTED). Non-2xx → REJECTED. Missing URL → UNAVAILABLE.
 * Never invents DELIVERED.
 */
@Injectable()
export class HttpWebhookMarketingChannelAdapter implements MarketingChannelAdapterPort {
  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly logger: LoggerService,
  ) {}

  async send(request: ChannelSendRequest): Promise<ChannelSendResult> {
    const url =
      (typeof request.settings.webhookUrl === 'string' && request.settings.webhookUrl) ||
      this.config.MARKETING_CHANNEL_WEBHOOK_URL;

    if (!url) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'WEBHOOK_URL_MISSING',
        failureMessage: 'HTTP webhook adapter requires MARKETING_CHANNEL_WEBHOOK_URL or settings.webhookUrl',
      };
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': request.idempotencyKey,
        },
        body: JSON.stringify({
          channelType: request.channelType,
          providerRef: request.providerRef,
          toEmailNormalized: request.toEmailNormalized,
          leadId: request.leadId,
          templateId: request.templateId,
          idempotencyKey: request.idempotencyKey,
          metadata: request.metadata ?? {},
        }),
        signal: AbortSignal.timeout(this.config.MARKETING_CHANNEL_WEBHOOK_TIMEOUT_MS),
      });

      if (res.ok) {
        let providerMessageId = `http-${request.idempotencyKey.slice(0, 32)}`;
        try {
          const body = (await res.json()) as { providerMessageId?: string; id?: string };
          providerMessageId = body.providerMessageId ?? body.id ?? providerMessageId;
        } catch {
          /* ignore non-JSON success bodies */
        }
        return { outcome: 'ACCEPTED', providerMessageId };
      }

      const text = await res.text().catch(() => '');
      return {
        outcome: 'REJECTED',
        retryable: res.status >= 500,
        failureCode: `HTTP_${res.status}`,
        failureMessage: text.slice(0, 500) || res.statusText,
      };
    } catch (error) {
      this.logger.warn('Marketing HTTP webhook adapter failed', {
        error: error instanceof Error ? error.message : String(error),
        channelType: request.channelType,
      });
      return {
        outcome: 'REJECTED',
        retryable: true,
        failureCode: 'WEBHOOK_TRANSPORT_ERROR',
        failureMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

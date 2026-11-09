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
 * Meta WhatsApp Cloud API template hand-off for marketing WHATSAPP channel.
 * ACCEPTED on Graph API success — never invents DELIVERED.
 */
@Injectable()
export class MetaWhatsAppMarketingChannelAdapter implements MarketingChannelAdapterPort {
  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly logger: LoggerService,
  ) {}

  async send(request: ChannelSendRequest): Promise<ChannelSendResult> {
    if (request.channelType !== 'WHATSAPP') {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'CHANNEL_UNSUPPORTED',
        failureMessage: `Meta WhatsApp adapter only supports WHATSAPP (got ${request.channelType})`,
      };
    }

    if (this.config.WHATSAPP_PROVIDER !== 'meta') {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'WHATSAPP_PROVIDER_NOOP',
        failureMessage: 'WHATSAPP_PROVIDER is not meta',
      };
    }

    const token = this.config.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = this.config.WHATSAPP_PHONE_NUMBER_ID;
    const templateName =
      (typeof request.settings.templateName === 'string' && request.settings.templateName) ||
      this.config.WHATSAPP_CAMPAIGN_TEMPLATE_NAME;
    const language =
      (typeof request.settings.templateLanguage === 'string' &&
        request.settings.templateLanguage) ||
      this.config.WHATSAPP_CAMPAIGN_TEMPLATE_LANGUAGE;

    if (!token || !phoneNumberId || !templateName) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'WHATSAPP_NOT_CONFIGURED',
        failureMessage:
          'WhatsApp marketing requires WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and campaign template',
      };
    }

    const toRaw =
      request.toPhoneE164?.trim() ||
      (typeof request.settings.toPhoneE164 === 'string'
        ? request.settings.toPhoneE164
        : null);
    if (!toRaw) {
      return {
        outcome: 'REJECTED',
        retryable: false,
        failureCode: 'MISSING_RECIPIENT_PHONE',
        failureMessage: 'Lead has no phone for WhatsApp delivery',
      };
    }
    const to = toRaw.replace(/^\+/, '');

    const bodyParams =
      Array.isArray(request.settings.templateBodyParams) &&
      request.settings.templateBodyParams.every((p) => typeof p === 'string')
        ? (request.settings.templateBodyParams as string[])
        : [];

    const components: Array<Record<string, unknown>> = [];
    if (bodyParams.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyParams.map((text) => ({ type: 'text', text })),
      });
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        ...(components.length ? { components } : {}),
      },
    };

    try {
      const res = await fetch(
        `https://graph.facebook.com/${this.config.WHATSAPP_API_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );
      const bodyText = await res.text().catch(() => '');
      if (!res.ok) {
        this.logger.warn('WhatsApp marketing send rejected', {
          status: res.status,
          deliveryAttemptId: request.deliveryAttemptId,
        });
        return {
          outcome: 'REJECTED',
          retryable: res.status >= 500 || res.status === 429,
          failureCode: `WHATSAPP_HTTP_${res.status}`,
          failureMessage: bodyText.slice(0, 400) || res.statusText,
        };
      }

      let providerMessageId = `wa-${request.idempotencyKey.slice(0, 24)}`;
      try {
        const json = JSON.parse(bodyText) as { messages?: Array<{ id?: string }> };
        if (json.messages?.[0]?.id) providerMessageId = json.messages[0].id;
      } catch {
        /* keep fallback */
      }
      return { outcome: 'ACCEPTED', providerMessageId };
    } catch (error) {
      this.logger.warn('WhatsApp marketing transport error', {
        error: error instanceof Error ? error.message : String(error),
        deliveryAttemptId: request.deliveryAttemptId,
      });
      return {
        outcome: 'REJECTED',
        retryable: true,
        failureCode: 'WHATSAPP_TRANSPORT_ERROR',
        failureMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

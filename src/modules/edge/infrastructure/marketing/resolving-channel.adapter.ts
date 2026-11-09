import { Injectable, Inject } from '@nestjs/common';
import type {
  ChannelSendRequest,
  ChannelSendResult,
  MarketingChannelAdapterPort,
} from '../../domain/marketing/channel-adapter.port.js';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import { UnavailableMarketingChannelAdapter } from './unavailable-channel.adapter.js';
import { LoggingAcceptedMarketingChannelAdapter } from './logging-accepted-channel.adapter.js';
import { HttpWebhookMarketingChannelAdapter } from './http-webhook-channel.adapter.js';
import { ResendMarketingChannelAdapter } from './resend-channel.adapter.js';
import { MetaWhatsAppMarketingChannelAdapter } from './meta-whatsapp-channel.adapter.js';

/**
 * Routes by channel type then configured mode.
 * WHATSAPP → Meta when WHATSAPP_PROVIDER=meta.
 * EMAIL → MARKETING_CHANNEL_ADAPTER (resend/auto/…).
 */
@Injectable()
export class ResolvingMarketingChannelAdapter implements MarketingChannelAdapterPort {
  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly unavailable: UnavailableMarketingChannelAdapter,
    private readonly loggingAccepted: LoggingAcceptedMarketingChannelAdapter,
    private readonly httpWebhook: HttpWebhookMarketingChannelAdapter,
    private readonly resend: ResendMarketingChannelAdapter,
    private readonly whatsapp: MetaWhatsAppMarketingChannelAdapter,
  ) {}

  async send(request: ChannelSendRequest): Promise<ChannelSendResult> {
    if (request.channelType === 'WHATSAPP') {
      return this.whatsapp.send(request);
    }

    const mode =
      this.config.MARKETING_CHANNEL_ADAPTER === 'auto'
        ? this.config.RESEND_API_KEY
          ? 'resend'
          : 'unavailable'
        : this.config.MARKETING_CHANNEL_ADAPTER;

    switch (mode) {
      case 'logging_accepted':
        return this.loggingAccepted.send(request);
      case 'http_webhook':
        return this.httpWebhook.send(request);
      case 'resend':
        return this.resend.send(request);
      case 'unavailable':
      default:
        return this.unavailable.send(request);
    }
  }
}

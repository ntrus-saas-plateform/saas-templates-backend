import { Injectable } from '@nestjs/common';
import type {
  ChannelSendRequest,
  ChannelSendResult,
  MarketingChannelAdapterPort,
} from '../../domain/marketing/channel-adapter.port.js';

/**
 * Default adapter when no live ESP is configured.
 * Never invents DELIVERED — returns UNAVAILABLE so callers mark FAILED/REQUESTED honestly.
 */
@Injectable()
export class UnavailableMarketingChannelAdapter implements MarketingChannelAdapterPort {
  async send(request: ChannelSendRequest): Promise<ChannelSendResult> {
    return {
      outcome: 'UNAVAILABLE',
      failureCode: 'PROVIDER_NOT_CONFIGURED',
      failureMessage: `No live adapter for channel ${request.channelType} (providerRef=${request.providerRef ?? 'none'})`,
    };
  }
}

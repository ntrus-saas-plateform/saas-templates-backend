import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type {
  ChannelSendRequest,
  ChannelSendResult,
  MarketingChannelAdapterPort,
} from '../../domain/marketing/channel-adapter.port.js';
import { LoggerService } from '../../../../shared/logging/logger.service.js';

/**
 * Dev/lab adapter: accepts hand-off into an audit log only.
 * Never returns DELIVERED — receipts remain the only delivery confirmation path.
 */
@Injectable()
export class LoggingAcceptedMarketingChannelAdapter implements MarketingChannelAdapterPort {
  constructor(private readonly logger: LoggerService) {}

  async send(request: ChannelSendRequest): Promise<ChannelSendResult> {
    const providerMessageId = `log-${createHash('sha256')
      .update(`${request.idempotencyKey}:${request.leadId}:${request.channelType}`)
      .digest('hex')
      .slice(0, 24)}`;

    this.logger.info('Marketing channel hand-off accepted by logging adapter', {
      channelType: request.channelType,
      providerRef: request.providerRef,
      leadId: request.leadId,
      idempotencyKey: request.idempotencyKey,
      providerMessageId,
      correlationHint: randomUUID(),
    });

    return { outcome: 'ACCEPTED', providerMessageId };
  }
}

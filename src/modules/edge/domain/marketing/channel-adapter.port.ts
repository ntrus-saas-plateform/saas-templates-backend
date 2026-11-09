export const MARKETING_CHANNEL_ADAPTER_PORT = Symbol('MARKETING_CHANNEL_ADAPTER_PORT');

export type ChannelSendRequest = {
  readonly channelType: string;
  readonly providerRef: string | null;
  readonly secretRef: string | null;
  readonly settings: Record<string, unknown>;
  readonly toEmailNormalized: string | null;
  readonly toPhoneE164: string | null;
  readonly leadId: string;
  readonly templateId: string | null;
  readonly idempotencyKey: string;
  readonly deliveryAttemptId: string;
  readonly subject?: string | null;
  readonly html?: string | null;
  readonly text?: string | null;
  readonly metadata?: Record<string, unknown>;
};

/**
 * Adapter result for provider hand-off.
 * DELIVERED is never returned here — only receipts may confirm delivery.
 */
export type ChannelSendResult =
  | {
      readonly outcome: 'ACCEPTED';
      readonly providerMessageId: string;
    }
  | {
      readonly outcome: 'REJECTED';
      readonly retryable: boolean;
      readonly failureCode: string;
      readonly failureMessage: string;
    }
  | {
      readonly outcome: 'UNAVAILABLE';
      readonly failureCode: string;
      readonly failureMessage: string;
    };

export interface MarketingChannelAdapterPort {
  send(request: ChannelSendRequest): Promise<ChannelSendResult>;
}

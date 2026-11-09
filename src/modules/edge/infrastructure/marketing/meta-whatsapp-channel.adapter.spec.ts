import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseEnvironment } from '../../../../shared/configuration/environment.schema.js';
import type { LoggerService } from '../../../../shared/logging/logger.service.js';
import { MetaWhatsAppMarketingChannelAdapter } from './meta-whatsapp-channel.adapter.js';

const logger = {
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as LoggerService;

const baseRequest = {
  channelType: 'WHATSAPP' as const,
  providerRef: 'meta',
  secretRef: null,
  settings: {},
  toEmailNormalized: null,
  toPhoneE164: '+15551234567',
  leadId: 'lead-1',
  templateId: null,
  idempotencyKey: 'idem-wa-1',
  deliveryAttemptId: 'attempt-1',
};

describe('MetaWhatsAppMarketingChannelAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns UNAVAILABLE when provider is noop', async () => {
    const adapter = new MetaWhatsAppMarketingChannelAdapter(
      parseEnvironment({
        CONTROL_PLANE_DB_PASSWORD: 'test',
        WHATSAPP_PROVIDER: 'noop',
      }),
      logger,
    );
    const result = await adapter.send(baseRequest);
    expect(result.outcome).toBe('UNAVAILABLE');
  });

  it('returns ACCEPTED with Graph message id (never DELIVERED)', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ messages: [{ id: 'wamid.1' }] }), {
          status: 200,
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new MetaWhatsAppMarketingChannelAdapter(
      parseEnvironment({
        CONTROL_PLANE_DB_PASSWORD: 'test',
        WHATSAPP_PROVIDER: 'meta',
        WHATSAPP_ACCESS_TOKEN: 'token',
        WHATSAPP_PHONE_NUMBER_ID: '123',
        WHATSAPP_CAMPAIGN_TEMPLATE_NAME: 'hello_world',
      }),
      logger,
    );

    const result = await adapter.send(baseRequest);
    expect(result).toEqual({
      outcome: 'ACCEPTED',
      providerMessageId: 'wamid.1',
    });
    expect(result).not.toMatchObject({ outcome: 'DELIVERED' });
  });

  it('rejects missing phone', async () => {
    const adapter = new MetaWhatsAppMarketingChannelAdapter(
      parseEnvironment({
        CONTROL_PLANE_DB_PASSWORD: 'test',
        WHATSAPP_PROVIDER: 'meta',
        WHATSAPP_ACCESS_TOKEN: 'token',
        WHATSAPP_PHONE_NUMBER_ID: '123',
        WHATSAPP_CAMPAIGN_TEMPLATE_NAME: 'hello_world',
      }),
      logger,
    );
    const result = await adapter.send({ ...baseRequest, toPhoneE164: null });
    expect(result.outcome).toBe('REJECTED');
  });
});

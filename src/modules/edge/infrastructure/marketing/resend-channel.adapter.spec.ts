import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseEnvironment } from '../../../../shared/configuration/environment.schema.js';
import type { LoggerService } from '../../../../shared/logging/logger.service.js';
import { ResendMarketingChannelAdapter } from './resend-channel.adapter.js';

const logger = {
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as LoggerService;

const baseRequest = {
  channelType: 'EMAIL',
  providerRef: 'resend',
  secretRef: null,
  settings: {},
  toEmailNormalized: 'lead@example.com',
  toPhoneE164: null,
  leadId: 'lead-1',
  templateId: null,
  idempotencyKey: 'idem-1',
  deliveryAttemptId: 'attempt-1',
  subject: 'Hello',
  html: '<p>Hi</p>',
  text: 'Hi',
};

describe('ResendMarketingChannelAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns UNAVAILABLE without API key', async () => {
    const adapter = new ResendMarketingChannelAdapter(
      parseEnvironment({ CONTROL_PLANE_DB_PASSWORD: 'test' }),
      logger,
    );
    const result = await adapter.send(baseRequest);
    expect(result.outcome).toBe('UNAVAILABLE');
  });

  it('returns ACCEPTED with Resend email id (never DELIVERED)', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: 'email_resend_1' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new ResendMarketingChannelAdapter(
      parseEnvironment({
        CONTROL_PLANE_DB_PASSWORD: 'test',
        RESEND_API_KEY: 're_test',
        MAIL_FROM: 'Okapi <noreply@example.com>',
      }),
      logger,
    );

    const result = await adapter.send(baseRequest);
    expect(result).toEqual({
      outcome: 'ACCEPTED',
      providerMessageId: 'email_resend_1',
    });
    expect(result).not.toMatchObject({ outcome: 'DELIVERED' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test',
          'Idempotency-Key': 'idem-1',
        }),
      }),
    );
  });

  it('rejects non-EMAIL channels', async () => {
    const adapter = new ResendMarketingChannelAdapter(
      parseEnvironment({
        CONTROL_PLANE_DB_PASSWORD: 'test',
        RESEND_API_KEY: 're_test',
        MAIL_FROM: 'Okapi <noreply@example.com>',
      }),
      logger,
    );
    const result = await adapter.send({ ...baseRequest, channelType: 'SMS' });
    expect(result.outcome).toBe('UNAVAILABLE');
  });
});

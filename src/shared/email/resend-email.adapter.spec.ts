import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseEnvironment } from '../configuration/environment.schema.js';
import type { LoggerService } from '../logging/logger.service.js';
import { ResendEmailAdapter } from './resend-email.adapter.js';

const logger = {
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as LoggerService;

describe('ResendEmailAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('sends via Resend HTTP API', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'email_1' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new ResendEmailAdapter(
      parseEnvironment({
        CONTROL_PLANE_DB_PASSWORD: 'test',
        RESEND_API_KEY: 're_test',
        MAIL_FROM: 'Atlas <invites@example.com>',
      }),
      logger,
    );

    const result = await adapter.send({
      to: 'invitee@example.com',
      subject: 'Invite',
      text: 'plain',
      html: '<p>html</p>',
    });

    expect(result).toEqual({ sent: true, provider: 'resend', messageId: 'email_1' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test',
        }),
      }),
    );
  });

  it('returns sent:false when Resend responds with an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('unauthorized', { status: 401 })),
    );

    const adapter = new ResendEmailAdapter(
      parseEnvironment({
        CONTROL_PLANE_DB_PASSWORD: 'test',
        RESEND_API_KEY: 're_test',
        MAIL_FROM: 'Atlas <invites@example.com>',
      }),
      logger,
    );

    const result = await adapter.send({
      to: 'invitee@example.com',
      subject: 'Invite',
      text: 'plain',
      html: '<p>html</p>',
    });

    expect(result.sent).toBe(false);
    expect(result.provider).toBe('resend');
    expect(result.error).toMatch(/401/);
  });
});

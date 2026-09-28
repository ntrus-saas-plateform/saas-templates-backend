import { describe, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { parseEnvironment } from '../configuration/environment.schema.js';
import type { LoggerService } from '../logging/logger.service.js';
import { SmtpEmailAdapter } from './smtp-email.adapter.js';

const sendMail = vi.fn(async () => ({ messageId: 'smtp-1' }));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail })),
  },
}));

const logger = {
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as LoggerService;

describe('SmtpEmailAdapter', () => {
  it('sends via nodemailer SMTP', async () => {
    const adapter = new SmtpEmailAdapter(
      parseEnvironment({
        CONTROL_PLANE_DB_PASSWORD: 'test',
        SMTP_HOST: 'smtp.resend.com',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_USER: 'resend',
        SMTP_PASSWORD: 're_test',
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

    expect(result).toEqual({ sent: true, provider: 'smtp', messageId: 'smtp-1' });
    expect(nodemailer.createTransport).toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'invitee@example.com',
        from: 'Atlas <invites@example.com>',
      }),
    );
  });
});

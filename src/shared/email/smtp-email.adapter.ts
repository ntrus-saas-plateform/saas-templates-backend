import nodemailer, { type Transporter } from 'nodemailer';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';
import type { LoggerService } from '../logging/logger.service.js';
import type {
  EmailSendResult,
  EmailSenderPort,
  SendEmailRequest,
} from '../../core/domain/ports/email-sender.port.js';

export class SmtpEmailAdapter implements EmailSenderPort {
  readonly provider = 'smtp' as const;
  private readonly transporter: Transporter;

  constructor(
    private readonly config: EnvironmentConfig,
    private readonly logger: LoggerService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE || config.SMTP_PORT === 465,
      auth: config.SMTP_USER
        ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD ?? '' }
        : undefined,
    });
  }

  async send(request: SendEmailRequest): Promise<EmailSendResult> {
    if (!this.config.SMTP_HOST) {
      return { sent: false, provider: 'smtp', error: 'SMTP_HOST is not configured' };
    }
    const from = request.from?.trim() || this.config.MAIL_FROM;
    if (!from) {
      return { sent: false, provider: 'smtp', error: 'MAIL_FROM is not configured' };
    }

    try {
      const info = await this.transporter.sendMail({
        from,
        to: request.to,
        subject: request.subject,
        text: request.text,
        html: request.html,
      });
      return { sent: true, provider: 'smtp', messageId: info.messageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SMTP send failed';
      this.logger.warn('SMTP email send failed', { error: message });
      return { sent: false, provider: 'smtp', error: message };
    }
  }
}

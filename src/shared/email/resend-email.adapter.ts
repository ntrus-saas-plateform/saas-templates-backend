import type { EnvironmentConfig } from '../configuration/environment.schema.js';
import type { LoggerService } from '../logging/logger.service.js';
import type {
  EmailSendResult,
  EmailSenderPort,
  SendEmailRequest,
} from '../../core/domain/ports/email-sender.port.js';

const RESEND_API_URL = 'https://api.resend.com/emails';

export class ResendEmailAdapter implements EmailSenderPort {
  readonly provider = 'resend' as const;

  constructor(
    private readonly config: EnvironmentConfig,
    private readonly logger: LoggerService,
  ) {}

  async send(request: SendEmailRequest): Promise<EmailSendResult> {
    const apiKey = this.config.RESEND_API_KEY;
    if (!apiKey) {
      return { sent: false, provider: 'resend', error: 'RESEND_API_KEY is not configured' };
    }
    const from = request.from?.trim() || this.config.MAIL_FROM;
    if (!from) {
      return { sent: false, provider: 'resend', error: 'MAIL_FROM is not configured' };
    }

    try {
      const res = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [request.to],
          subject: request.subject,
          html: request.html,
          text: request.text,
        }),
      });

      const bodyText = await res.text().catch(() => '');
      if (!res.ok) {
        const error = `Resend ${res.status}: ${bodyText.slice(0, 240)}`;
        this.logger.warn('Resend email send failed', { status: res.status, error });
        return { sent: false, provider: 'resend', error };
      }

      let messageId: string | undefined;
      try {
        const json = JSON.parse(bodyText) as { id?: string };
        messageId = json.id;
      } catch {
        messageId = undefined;
      }

      return { sent: true, provider: 'resend', messageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Resend request failed';
      this.logger.warn('Resend email send failed', { error: message });
      return { sent: false, provider: 'resend', error: message };
    }
  }
}

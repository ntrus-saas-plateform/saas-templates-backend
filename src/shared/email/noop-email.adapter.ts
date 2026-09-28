import type { EmailSendResult, EmailSenderPort, SendEmailRequest } from '../../core/domain/ports/email-sender.port.js';

export class NoopEmailAdapter implements EmailSenderPort {
  readonly provider = 'none' as const;

  async send(_request: SendEmailRequest): Promise<EmailSendResult> {
    return { sent: false, provider: 'none' };
  }
}

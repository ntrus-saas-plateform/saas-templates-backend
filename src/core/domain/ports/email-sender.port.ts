export type MailProvider = 'none' | 'smtp' | 'resend';

export type SendEmailRequest = {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  /** Tenant/override From; adapters fall back to env MAIL_FROM. */
  readonly from?: string;
};

export type EmailSendResult = {
  readonly sent: boolean;
  readonly provider: MailProvider;
  readonly messageId?: string;
  readonly error?: string;
};

export interface EmailSenderPort {
  readonly provider: MailProvider;
  send(request: SendEmailRequest): Promise<EmailSendResult>;
}

export const EMAIL_SENDER_PORT = Symbol('EMAIL_SENDER_PORT');

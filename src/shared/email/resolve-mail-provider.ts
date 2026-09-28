import type { EnvironmentConfig } from '../configuration/environment.schema.js';
import type { MailProvider } from '../../core/domain/ports/email-sender.port.js';

export function resolveMailProvider(config: EnvironmentConfig): MailProvider {
  if (config.MAIL_PROVIDER === 'none' || config.MAIL_PROVIDER === 'smtp' || config.MAIL_PROVIDER === 'resend') {
    return config.MAIL_PROVIDER;
  }
  if (config.RESEND_API_KEY) return 'resend';
  if (config.SMTP_HOST) return 'smtp';
  return 'none';
}

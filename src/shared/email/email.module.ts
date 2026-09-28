import { Global, Module } from '@nestjs/common';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';
import { LoggerService } from '../logging/logger.service.js';
import { EMAIL_SENDER_PORT } from '../../core/domain/ports/email-sender.port.js';
import { NoopEmailAdapter } from './noop-email.adapter.js';
import { ResendEmailAdapter } from './resend-email.adapter.js';
import { SmtpEmailAdapter } from './smtp-email.adapter.js';
import { resolveMailProvider } from './resolve-mail-provider.js';

@Global()
@Module({
  providers: [
    {
      provide: EMAIL_SENDER_PORT,
      useFactory: (config: EnvironmentConfig, logger: LoggerService) => {
        const provider = resolveMailProvider(config);
        if (provider === 'resend') return new ResendEmailAdapter(config, logger);
        if (provider === 'smtp') return new SmtpEmailAdapter(config, logger);
        return new NoopEmailAdapter();
      },
      inject: [APP_CONFIG, LoggerService],
    },
  ],
  exports: [EMAIL_SENDER_PORT],
})
export class EmailModule {}

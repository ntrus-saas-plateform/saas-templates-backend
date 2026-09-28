import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { parseEnvironment, type EnvironmentConfig } from './environment.schema.js';
import { ConfigurationResolverService } from './configuration-resolver.service.js';
import { ConfigurationResolverAdapter } from './configuration-resolver.adapter.js';
import { CONFIGURATION_RESOLVER_PORT } from '../../modules/identity/domain/ports/configuration-resolver.port.js';

export const APP_CONFIG = Symbol('APP_CONFIG');

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: (config) => parseEnvironment(config as Record<string, string | undefined>),
    }),
  ],
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): EnvironmentConfig => parseEnvironment(process.env),
    },
    ConfigurationResolverService,
    ConfigurationResolverAdapter,
    {
      provide: CONFIGURATION_RESOLVER_PORT,
      useExisting: ConfigurationResolverAdapter,
    },
  ],
  exports: [APP_CONFIG, ConfigurationResolverService, CONFIGURATION_RESOLVER_PORT],
})
export class ConfigurationModule {}

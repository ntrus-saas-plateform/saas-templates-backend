import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigurationModule, APP_CONFIG } from './shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from './shared/configuration/environment.schema.js';
import { TenancyModule } from './shared/tenancy/tenancy.module.js';
import { DatabaseModule } from './shared/database/database.module.js';
import { CacheModule } from './shared/database/cache.module.js';
import { AuthModule } from './shared/auth/auth.module.js';
import { MessagingModule } from './shared/messaging/messaging.module.js';
import { AuditModule } from './shared/audit/audit.module.js';
import { LoggingModule } from './shared/logging/logging.module.js';
import { ObservabilityModule } from './shared/observability/observability.module.js';
import { StorageModule } from './shared/storage/storage.module.js';
import { EmailModule } from './shared/email/email.module.js';
import { SchedulingModule } from './shared/scheduling/scheduling.module.js';
import { GlobalExceptionFilter } from './shared/errors/global-exception.filter.js';
import { RequestContextMiddleware } from './shared/security/request-context.middleware.js';
import { CsrfMiddleware } from './shared/security/csrf.middleware.js';
import { RequestLoggingMiddleware } from './shared/logging/request-logging.middleware.js';
import { PlatformModule } from './modules/platform/platform.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { EdgeModule } from './modules/edge/edge.module.js';
import { AuthorizationModule } from './shared/authorization/authorization.module.js';
import { KeycloakModule } from './shared/keycloak/keycloak.module.js';
import { FeatureFlagsModule } from './shared/feature-flags/feature-flags.module.js';

@Module({
  imports: [
    ConfigurationModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigurationModule],
      inject: [APP_CONFIG],
      useFactory: (config: EnvironmentConfig) => [
        {
          ttl: config.RATE_LIMIT_TTL * 1000,
          limit: config.RATE_LIMIT_LIMIT,
        },
      ],
    }),
    TenancyModule,
    DatabaseModule,
    CacheModule,
    AuthModule,
    AuthorizationModule,
    KeycloakModule,
    FeatureFlagsModule,
    MessagingModule,
    AuditModule,
    LoggingModule,
    ObservabilityModule,
    StorageModule,
    EmailModule,
    SchedulingModule,
    PlatformModule,
    IdentityModule,
    EdgeModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware, RequestLoggingMiddleware, CsrfMiddleware)
      .forRoutes('*');
  }
}

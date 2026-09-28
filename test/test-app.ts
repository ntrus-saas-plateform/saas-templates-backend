import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, Module, MiddlewareConsumer, NestModule, VersioningType } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigurationModule } from '../src/shared/configuration/configuration.module.js';
import { TenancyModule } from '../src/shared/tenancy/tenancy.module.js';
import { DatabaseModule } from '../src/shared/database/database.module.js';
import { CacheModule } from '../src/shared/database/cache.module.js';
import { AuthModule } from '../src/shared/auth/auth.module.js';
import { MessagingModule } from '../src/shared/messaging/messaging.module.js';
import { AuditModule } from '../src/shared/audit/audit.module.js';
import { LoggingModule } from '../src/shared/logging/logging.module.js';
import { ObservabilityModule } from '../src/shared/observability/observability.module.js';
import { PlatformModule } from '../src/modules/platform/platform.module.js';
import { IdentityModule } from '../src/modules/identity/identity.module.js';
import { AuthorizationModule } from '../src/shared/authorization/authorization.module.js';
import { KeycloakModule } from '../src/shared/keycloak/keycloak.module.js';
import { FeatureFlagsModule } from '../src/shared/feature-flags/feature-flags.module.js';
import { SchedulingModule } from '../src/shared/scheduling/scheduling.module.js';
import { StorageModule } from '../src/shared/storage/storage.module.js';
import { EmailModule } from '../src/shared/email/email.module.js';
import { GlobalExceptionFilter } from '../src/shared/errors/global-exception.filter.js';
import { RequestContextMiddleware } from '../src/shared/security/request-context.middleware.js';

@Module({
  imports: [
    ConfigurationModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    TenancyModule,
    DatabaseModule,
    CacheModule,
    AuthModule,
    MessagingModule,
    AuditModule,
    LoggingModule,
    ObservabilityModule,
    PlatformModule,
    IdentityModule,
    AuthorizationModule,
    KeycloakModule,
    FeatureFlagsModule,
    SchedulingModule,
    StorageModule,
    EmailModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: GlobalExceptionFilter }],
})
class TestAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}

export async function createTestApp(
  overrides: Array<{ provide: symbol | string | Function; useValue: unknown }> = [],
): Promise<INestApplication> {
  const moduleBuilder = Test.createTestingModule({
    imports: [TestAppModule],
  });

  for (const override of overrides) {
    moduleBuilder.overrideProvider(override.provide).useValue(override.useValue);
  }

  const moduleRef: TestingModule = await moduleBuilder.compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api', { exclude: ['liveness', 'readiness', 'health'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

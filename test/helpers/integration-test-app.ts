import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  Module,
  MiddlewareConsumer,
  NestModule,
  VersioningType,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigurationModule, APP_CONFIG } from '../../src/shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../src/shared/configuration/environment.schema.js';
import { TenancyModule } from '../../src/shared/tenancy/tenancy.module.js';
import { DatabaseModule } from '../../src/shared/database/database.module.js';
import { CacheModule } from '../../src/shared/database/cache.module.js';
import { AuthModule } from '../../src/shared/auth/auth.module.js';
import { MessagingModule } from '../../src/shared/messaging/messaging.module.js';
import { AuditModule } from '../../src/shared/audit/audit.module.js';
import { LoggingModule } from '../../src/shared/logging/logging.module.js';
import { ObservabilityModule } from '../../src/shared/observability/observability.module.js';
import { PlatformModule } from '../../src/modules/platform/platform.module.js';
import { FeatureFlagsModule } from '../../src/shared/feature-flags/feature-flags.module.js';
import { StorageModule } from '../../src/shared/storage/storage.module.js';
import { EmailModule } from '../../src/shared/email/email.module.js';
import { AuthorizationModule } from '../../src/shared/authorization/authorization.module.js';
import { KeycloakModule } from '../../src/shared/keycloak/keycloak.module.js';
import { SchedulingModule } from '../../src/shared/scheduling/scheduling.module.js';
import { GlobalExceptionFilter } from '../../src/shared/errors/global-exception.filter.js';
import { RequestContextMiddleware } from '../../src/shared/security/request-context.middleware.js';
import { OutboxPublisher } from '../../src/shared/messaging/outbox.publisher.js';
import { RabbitMqConsumer } from '../../src/shared/messaging/rabbitmq.consumer.js';
import { RabbitMqService } from '../../src/shared/messaging/rabbitmq.service.js';
import { CacheService } from '../../src/shared/database/cache.service.js';
import { KEYCLOAK_ADMIN_PORT } from '../../src/modules/identity/domain/ports/keycloak-admin.port.js';
import type { KeycloakAdminPort } from '../../src/modules/identity/domain/ports/keycloak-admin.port.js';

@Module({
  imports: [
    ConfigurationModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }]),
    TenancyModule,
    DatabaseModule,
    CacheModule,
    AuthModule,
    MessagingModule,
    AuditModule,
    LoggingModule,
    ObservabilityModule,
    AuthorizationModule,
    KeycloakModule,
    FeatureFlagsModule,
    StorageModule,
    EmailModule,
    SchedulingModule,
    PlatformModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: GlobalExceptionFilter }],
})
class IntegrationTestAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}

export interface IntegrationTestAppOptions {
  readonly jwtIssuer: string;
  readonly jwtJwksUri: string;
  readonly jwtAudience: string;
  readonly dbHost: string;
  readonly dbPort: number;
  readonly dbPassword: string;
}

export async function createIntegrationTestApp(
  options: IntegrationTestAppOptions,
): Promise<INestApplication> {
  process.env.NODE_ENV = 'test';
  process.env.AUTH_PERMISSION_DENY_BY_DEFAULT = 'false';
  process.env.CONTROL_PLANE_DB_HOST = options.dbHost;
  process.env.CONTROL_PLANE_DB_PORT = String(options.dbPort);
  process.env.CONTROL_PLANE_DB_NAME = 'platform_control';
  process.env.CONTROL_PLANE_DB_USER = 'platform';
  process.env.CONTROL_PLANE_DB_PASSWORD = options.dbPassword;
  process.env.TENANT_DB_PASSWORD = options.dbPassword;
  process.env.CONTROL_PLANE_DB_SSL = 'false';
  process.env.KEYCLOAK_ISSUER = options.jwtIssuer;
  process.env.KEYCLOAK_JWKS_URI = options.jwtJwksUri;
  process.env.KEYCLOAK_AUDIENCE = options.jwtAudience;
  process.env.RABBITMQ_CONSUMER_ENABLED = 'false';
  process.env.RECONCILIATION_JOB_ENABLED = 'false';
  process.env.TOKEN_DENYLIST_ENABLED = 'false';
  process.env.KEYCLOAK_TOKEN_INTROSPECTION_ENABLED = 'false';
  process.env.REDIS_HOST = '127.0.0.1';
  process.env.REDIS_PORT = '6379';

  const moduleBuilder = Test.createTestingModule({
    imports: [IntegrationTestAppModule],
  });

  moduleBuilder.overrideProvider(OutboxPublisher).useValue({
    onModuleInit: () => {},
    onModuleDestroy: () => {},
    publishPending: async () => {},
  });
  moduleBuilder.overrideProvider(RabbitMqConsumer).useValue({
    onModuleInit: async () => {},
    onModuleDestroy: async () => {},
  });
  moduleBuilder.overrideProvider(RabbitMqService).useValue({
    isConnected: () => true,
    publish: async () => {},
    onModuleDestroy: async () => {},
  });
  moduleBuilder.overrideProvider(CacheService).useValue({
    ping: async () => true,
    setNx: async () => true,
    releaseLock: async () => {},
    get: async () => null,
    set: async () => {},
    del: async () => {},
    onModuleDestroy: async () => {},
  });

  const keycloakE2eStub = new Proxy({} as KeycloakAdminPort, {
    get: (_target, prop) => {
      if (prop === 'isAvailable') return async () => true;
      if (prop === 'setUserActiveOrganization') return async () => undefined;
      return async () => undefined;
    },
  });
  moduleBuilder.overrideProvider(KEYCLOAK_ADMIN_PORT).useValue(keycloakE2eStub);

  const moduleRef: TestingModule = await moduleBuilder.compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api', { exclude: ['liveness', 'readiness', 'health'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

export function getAppConfig(app: INestApplication): EnvironmentConfig {
  return app.get(APP_CONFIG);
}

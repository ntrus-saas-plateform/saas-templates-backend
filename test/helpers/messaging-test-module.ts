import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigurationModule } from '../../src/shared/configuration/configuration.module.js';
import { TenancyModule } from '../../src/shared/tenancy/tenancy.module.js';
import { DatabaseModule } from '../../src/shared/database/database.module.js';
import { LoggingModule } from '../../src/shared/logging/logging.module.js';
import { MessagingModule } from '../../src/shared/messaging/messaging.module.js';
import { OutboxPublisher } from '../../src/shared/messaging/outbox.publisher.js';
import type { TestDatabaseEnvironment } from './test-database.js';

export interface MessagingTestModuleOptions {
  readonly dbEnv: TestDatabaseEnvironment;
  readonly rabbitMqUrl: string;
  readonly rabbitMqExchange?: string;
}

export async function createMessagingTestModule(
  options: MessagingTestModuleOptions,
): Promise<TestingModule> {
  process.env.NODE_ENV = 'test';
  process.env.CONTROL_PLANE_DB_HOST = options.dbEnv.host;
  process.env.CONTROL_PLANE_DB_PORT = String(options.dbEnv.port);
  process.env.CONTROL_PLANE_DB_NAME = options.dbEnv.controlPlaneDatabase;
  process.env.CONTROL_PLANE_DB_USER = options.dbEnv.user;
  process.env.CONTROL_PLANE_DB_PASSWORD = options.dbEnv.password;
  process.env.RABBITMQ_URL = options.rabbitMqUrl;
  process.env.RABBITMQ_EXCHANGE = options.rabbitMqExchange ?? 'platform.events';
  process.env.RABBITMQ_CONSUMER_ENABLED = 'true';

  return Test.createTestingModule({
    imports: [
      ConfigurationModule,
      TenancyModule,
      DatabaseModule,
      LoggingModule,
      MessagingModule,
    ],
  })
    .overrideProvider(OutboxPublisher)
    .useValue({
      onModuleInit: () => {},
      onModuleDestroy: () => {},
      publishPending: async () => {},
    })
    .compile();
}

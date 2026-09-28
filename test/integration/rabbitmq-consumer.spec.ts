import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RabbitMQContainer, type StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import pg from 'pg';
import { setupTestDatabase } from '../helpers/test-database.js';
import { createMessagingTestModule } from '../helpers/messaging-test-module.js';
import { waitUntil } from '../helpers/wait-until.js';
import { runTestcontainers } from '../helpers/testcontainers-env.js';
import { RabbitMqService } from '../../src/shared/messaging/rabbitmq.service.js';
import { createOrganizationSwitchedEvent } from '../../src/core/domain/events/organization-switched.event.js';
import { TENANT_A_ID, ORG_A1_ID, ORG_A2_ID, USER_A_ID } from '../helpers/test-constants.js';

describe.skipIf(!runTestcontainers)('RabbitMQ Consumer Integration (Testcontainers)', () => {
  let dbEnv: Awaited<ReturnType<typeof setupTestDatabase>>;
  let rabbitContainer: StartedRabbitMQContainer;
  let moduleRef: Awaited<ReturnType<typeof createMessagingTestModule>>;
  let rabbitMq: RabbitMqService;
  let tenantPool: pg.Pool;

  beforeAll(async () => {
    dbEnv = await setupTestDatabase();
    rabbitContainer = await new RabbitMQContainer('rabbitmq:3.13-management-alpine').start();

    moduleRef = await createMessagingTestModule({
      dbEnv,
      rabbitMqUrl: rabbitContainer.getAmqpUrl(),
    });
    await moduleRef.init();

    rabbitMq = moduleRef.get(RabbitMqService);

    tenantPool = new pg.Pool({
      host: dbEnv.host,
      port: dbEnv.port,
      database: dbEnv.tenantADatabase,
      user: dbEnv.user,
      password: dbEnv.password,
    });
  }, 180_000);

  afterAll(async () => {
    await moduleRef?.close();
    await tenantPool?.end();
    await rabbitContainer?.stop();
    await dbEnv?.stop();
  });

  it('consumes published event and persists integration_event_log', async () => {
    const event = createOrganizationSwitchedEvent({
      tenantId: TENANT_A_ID,
      organizationId: ORG_A2_ID,
      previousOrganizationId: ORG_A1_ID,
      userId: USER_A_ID,
      correlationId: 'corr-rmq-integration',
      traceId: 'trace-rmq-integration',
    });

    await rabbitMq.publish(event);

    await waitUntil(async () => {
      const result = await tenantPool.query(
        `SELECT event_id FROM integration_event_log WHERE event_id = $1`,
        [event.eventId],
      );
      return result.rowCount === 1;
    });

    const row = await tenantPool.query(
      `SELECT event_type, payload FROM integration_event_log WHERE event_id = $1`,
      [event.eventId],
    );
    expect(row.rows[0]?.event_type).toBe('platform.organization.switched.v1');
    expect(row.rows[0]?.payload.organizationId).toBe(ORG_A2_ID);
  });

  it('deduplicates duplicate event via inbox', async () => {
    const event = createOrganizationSwitchedEvent({
      tenantId: TENANT_A_ID,
      organizationId: ORG_A2_ID,
      previousOrganizationId: ORG_A1_ID,
      userId: USER_A_ID,
      correlationId: 'corr-rmq-dedup',
      traceId: null,
    });

    await rabbitMq.publish(event);
    await waitUntil(async () => {
      const result = await tenantPool.query(
        `SELECT 1 FROM integration_event_log WHERE event_id = $1`,
        [event.eventId],
      );
      return result.rowCount === 1;
    });

    await rabbitMq.publish(event);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const count = await tenantPool.query(
      `SELECT COUNT(*)::int AS count FROM integration_event_log WHERE event_id = $1`,
      [event.eventId],
    );
    expect(count.rows[0]?.count).toBe(1);
  });
});

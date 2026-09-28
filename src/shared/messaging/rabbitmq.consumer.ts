import { Injectable, Inject, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import { INBOX_DEDUPLICATOR_PORT } from '../../core/domain/ports/inbox.port.js';
import type { InboxDeduplicatorPort } from '../../core/domain/ports/inbox.port.js';
import type { IntegrationEvent } from '../../core/domain/events/integration-event.js';
import { TENANT_REGISTRY_PORT } from '../../modules/identity/domain/ports/tenant-registry.port.js';
import type { TenantRegistryPort } from '../../modules/identity/domain/ports/tenant-registry.port.js';
import { isTenantAccessible } from '../../modules/identity/domain/tenant/tenant.entity.js';
import { EMPTY_TENANT_CONTEXT } from '../../core/domain/context/tenant-context.js';
import { RabbitMqService, PermanentMessageError } from './rabbitmq.service.js';
import { LoggerService } from '../logging/logger.service.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { IntegrationEventDispatcher } from './integration-event.dispatcher.js';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';

const CONSUMER_ID = 'platform-core-default';

@Injectable()
export class RabbitMqConsumer implements OnModuleInit, OnModuleDestroy {
  private consumerTag: string | null = null;

  constructor(
    private readonly rabbitMq: RabbitMqService,
    @Inject(INBOX_DEDUPLICATOR_PORT) private readonly inbox: InboxDeduplicatorPort,
    @Inject(TENANT_REGISTRY_PORT) private readonly tenantRegistry: TenantRegistryPort,
    private readonly tenantContext: TenantContextService,
    private readonly dispatcher: IntegrationEventDispatcher,
    private readonly logger: LoggerService,
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.RABBITMQ_CONSUMER_ENABLED) return;
    try {
      this.consumerTag = await this.rabbitMq.startConsumer(
        'platform.events.queue',
        '#',
        (msg) => this.handleMessage(msg),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn('RabbitMQ consumer not started; broker unreachable', {
        error: message,
      });
    }
  }

  private async handleMessage(msg: ConsumeMessage): Promise<void> {
    let event: IntegrationEvent;
    try {
      event = JSON.parse(msg.content.toString()) as IntegrationEvent;
    } catch {
      throw new PermanentMessageError('Invalid message: malformed JSON');
    }

    if (!event.tenantId || !event.eventId) {
      throw new PermanentMessageError('Invalid message: missing tenantId or eventId');
    }

    const tenant = await this.tenantRegistry.findById(event.tenantId);
    if (!tenant || !isTenantAccessible(tenant.status)) {
      throw new PermanentMessageError(`Invalid message: tenant not accessible: ${event.tenantId}`);
    }

    if (msg.properties.headers?.tenantId && msg.properties.headers.tenantId !== event.tenantId) {
      throw new PermanentMessageError('Invalid message: header tenantId mismatch');
    }

    await this.tenantContext.runAsync(
      {
        ...EMPTY_TENANT_CONTEXT,
        tenantId: event.tenantId,
        organizationId: event.organizationId,
        subjectId: 'system:consumer',
        userId: null,
        correlationId: event.correlationId,
        requestId: event.eventId,
        traceId: event.traceId,
      },
      async () => this.processEvent(event),
    );
  }

  private async processEvent(event: IntegrationEvent): Promise<void> {
    const claimed = await this.inbox.tryClaim(event.tenantId, event.eventId, CONSUMER_ID);
    if (!claimed) {
      this.logger.debug('Skipping duplicate message', { eventId: event.eventId });
      return;
    }

    this.logger.info('Processing integration event', {
      eventType: event.eventType,
      eventId: event.eventId,
      tenantId: event.tenantId,
    });

    try {
      await this.dispatcher.dispatch(event);
    } catch (error) {
      await this.inbox.releaseClaim(event.tenantId, event.eventId, CONSUMER_ID);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.rabbitMq.stopConsumer(this.consumerTag);
  }
}

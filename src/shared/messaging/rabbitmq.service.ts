import { Injectable, Inject, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqplib from 'amqplib';
import type { ConsumeMessage } from 'amqplib';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';
import type { IntegrationEvent } from '../../core/domain/events/integration-event.js';

type AmqpConnection = Awaited<ReturnType<typeof amqplib.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection['createChannel']>>;

export class PermanentMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentMessageError';
  }
}

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private connection: AmqpConnection | null = null;
  private channel: AmqpChannel | null = null;
  private readonly consumerTags = new Map<string, string>();
  private readonly dlxExchange: string;
  private readonly maxRetries: number;

  constructor(@Inject(APP_CONFIG) private readonly config: EnvironmentConfig) {
    this.dlxExchange = `${this.config.RABBITMQ_EXCHANGE}.dlx`;
    this.maxRetries = this.config.RABBITMQ_MAX_RETRIES;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureChannel();
    } catch {
      // RabbitMQ may not be available in all environments during startup
    }
  }

  private async ensureChannel(): Promise<AmqpChannel> {
    if (this.channel) return this.channel;
    const conn = await amqplib.connect(this.config.RABBITMQ_URL);
    this.connection = conn;
    this.channel = await conn.createChannel();
    await this.channel.assertExchange(this.config.RABBITMQ_EXCHANGE, 'topic', { durable: true });
    await this.channel.assertExchange(this.dlxExchange, 'topic', { durable: true });
    await this.channel.assertQueue(`${this.config.RABBITMQ_EXCHANGE}.dlq`, { durable: true });
    await this.channel.bindQueue(
      `${this.config.RABBITMQ_EXCHANGE}.dlq`,
      this.dlxExchange,
      '#',
    );
    return this.channel;
  }

  async publish(event: IntegrationEvent): Promise<void> {
    const channel = await this.ensureChannel();
    channel.publish(
      this.config.RABBITMQ_EXCHANGE,
      event.eventType,
      Buffer.from(JSON.stringify(event)),
      {
        persistent: true,
        messageId: event.eventId,
        headers: {
          tenantId: event.tenantId,
          correlationId: event.correlationId,
          traceId: event.traceId,
        },
      },
    );
  }

  async startConsumer(
    queueName: string,
    routingPattern: string,
    handler: (msg: ConsumeMessage) => Promise<void>,
  ): Promise<string> {
    const channel = await this.ensureChannel();
    await channel.assertQueue(queueName, {
      durable: true,
      deadLetterExchange: this.dlxExchange,
      deadLetterRoutingKey: 'failed',
    });
    await channel.bindQueue(queueName, this.config.RABBITMQ_EXCHANGE, routingPattern);
    await channel.prefetch(this.config.RABBITMQ_PREFETCH);

    const { consumerTag } = await channel.consume(queueName, (msg) => {
      if (!msg) return;
      void (async () => {
        try {
          await handler(msg);
          channel.ack(msg);
        } catch (error) {
          const retryCount = this.getRetryCount(msg);
          const isPermanent = error instanceof PermanentMessageError;

          if (!isPermanent && retryCount < this.maxRetries) {
            channel.nack(msg, false, true);
            return;
          }

          channel.nack(msg, false, false);
        }
      })();
    });

    this.consumerTags.set(queueName, consumerTag);
    return consumerTag;
  }

  private getRetryCount(msg: ConsumeMessage): number {
    const deaths = msg.properties.headers?.['x-death'] as Array<{ count: number }> | undefined;
    if (!deaths?.length) return 0;
    return deaths.reduce((sum, entry) => sum + (entry.count ?? 0), 0);
  }

  async stopConsumer(consumerTag: string | null): Promise<void> {
    if (!consumerTag || !this.channel) return;
    await this.channel.cancel(consumerTag);
  }

  isConnected(): boolean {
    return this.channel !== null;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }
}

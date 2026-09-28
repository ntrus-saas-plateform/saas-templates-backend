import { Injectable, Inject, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { OUTBOX_STORE_PORT } from '../../core/domain/ports/outbox.port.js';
import type { OutboxStorePort } from '../../core/domain/ports/outbox.port.js';
import { CONTROL_PLANE_OUTBOX_STORE_PORT } from '../../core/domain/ports/control-plane-outbox.port.js';
import type { ControlPlaneOutboxStorePort } from '../../core/domain/ports/control-plane-outbox.port.js';
import { RabbitMqService } from './rabbitmq.service.js';
import { TenantDatabaseManager } from '../database/tenant-database.manager.js';
import { CacheService } from '../database/cache.service.js';
import { LoggerService } from '../logging/logger.service.js';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';

const LEADER_LOCK_KEY = 'platform:lock:outbox-publisher';
const LEADER_LOCK_TTL_SECONDS = 15;

@Injectable()
export class OutboxPublisher implements OnModuleInit, OnModuleDestroy {
  private interval: ReturnType<typeof setInterval> | null = null;
  private readonly batchSize = 50;
  private readonly instanceId = randomUUID();
  private leaderToken: string | null = null;

  constructor(
    @Inject(OUTBOX_STORE_PORT) private readonly outboxStore: OutboxStorePort,
    @Inject(CONTROL_PLANE_OUTBOX_STORE_PORT)
    private readonly controlPlaneOutboxStore: ControlPlaneOutboxStorePort,
    private readonly rabbitMq: RabbitMqService,
    private readonly dbManager: TenantDatabaseManager,
    private readonly cache: CacheService,
    private readonly logger: LoggerService,
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
  ) {}

  onModuleInit(): void {
    this.interval = setInterval(() => {
      void this.publishPending();
    }, this.config.OUTBOX_POLL_INTERVAL_MS);
  }

  async publishPending(): Promise<void> {
    if (!this.rabbitMq.isConnected()) return;

    const acquired = await this.cache.setNx(
      LEADER_LOCK_KEY,
      this.instanceId,
      LEADER_LOCK_TTL_SECONDS,
    );
    if (!acquired) return;

    this.leaderToken = this.instanceId;

    try {
      const pool = this.dbManager.getControlPlanePool();
      const tenants = await pool.query<{ id: string }>(
        `SELECT id FROM tenants WHERE status IN ('ACTIVE', 'READ_ONLY')`,
      );

      for (const row of tenants.rows) {
        await this.publishForTenant(row.id);
        await this.publishControlPlaneForTenant(row.id);
      }
    } finally {
      if (this.leaderToken) {
        await this.cache.releaseLock(LEADER_LOCK_KEY, this.leaderToken);
        this.leaderToken = null;
      }
    }
  }

  private async publishForTenant(tenantId: string): Promise<void> {
    try {
      const messages = await this.outboxStore.fetchPending(tenantId, this.batchSize);
      for (const message of messages) {
        try {
          await this.rabbitMq.publish(message.payload);
          await this.outboxStore.markPublished(tenantId, message.id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (message.attempts + 1 >= message.maxAttempts) {
            await this.outboxStore.markDeadLetter(tenantId, message.id, errorMessage);
          } else {
            await this.outboxStore.markFailed(tenantId, message.id, errorMessage);
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Outbox publish failed for tenant ${tenantId}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async publishControlPlaneForTenant(tenantId: string): Promise<void> {
    try {
      const messages = await this.controlPlaneOutboxStore.fetchPending(tenantId, this.batchSize);
      for (const message of messages) {
        try {
          await this.rabbitMq.publish(message.payload);
          await this.controlPlaneOutboxStore.markPublished(tenantId, message.id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (message.attempts + 1 >= message.maxAttempts) {
            await this.controlPlaneOutboxStore.markDeadLetter(tenantId, message.id, errorMessage);
          } else {
            await this.controlPlaneOutboxStore.markFailed(tenantId, message.id, errorMessage);
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Control-plane outbox publish failed for tenant ${tenantId}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  onModuleDestroy(): void {
    if (this.interval) clearInterval(this.interval);
  }
}

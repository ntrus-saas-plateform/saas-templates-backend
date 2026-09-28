import { Injectable, Inject, Optional } from '@nestjs/common';
import { Redis as RedisClient } from 'ioredis';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { LoggerService } from '../logging/logger.service.js';

/**
 * Redis cache with fail-open for get/set/del (P5): Redis outage must not take down
 * BusinessContext resolve / reads — callers fall back to source of truth.
 * Leader locks (setNx) fail closed (return false) so dual publishers do not race blindly.
 */
@Injectable()
export class CacheService {
  private readonly redis: RedisClient;

  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly tenantContext: TenantContextService,
    @Optional() private readonly logger?: LoggerService,
  ) {
    this.redis = new RedisClient({
      host: this.config.REDIS_HOST,
      port: this.config.REDIS_PORT,
      password: this.config.REDIS_PASSWORD || undefined,
      db: this.config.REDIS_DB,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
    });
  }

  private buildKey(namespace: string, key: string): string {
    const ctx = this.tenantContext.get();
    if (ctx.tenantId) {
      const orgPart = ctx.organizationId ? `:organization:${ctx.organizationId}` : '';
      return `tenant:${ctx.tenantId}${orgPart}:${namespace}:${key}`;
    }
    return `${namespace}:${key}`;
  }

  private warn(op: string, error: unknown): void {
    this.logger?.warn(`Redis ${op} failed (fail-open)`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  async get<T>(namespace: string, key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(this.buildKey(namespace, key));
      return value ? (JSON.parse(value) as T) : null;
    } catch (error) {
      this.warn('get', error);
      return null;
    }
  }

  async set(namespace: string, key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.setex(this.buildKey(namespace, key), ttlSeconds, JSON.stringify(value));
    } catch (error) {
      this.warn('set', error);
    }
  }

  async del(namespace: string, key: string): Promise<void> {
    try {
      await this.redis.del(this.buildKey(namespace, key));
    } catch (error) {
      this.warn('del', error);
    }
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.redis.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (error) {
      this.warn('setNx', error);
      return false;
    }
  }

  async releaseLock(key: string, token: string): Promise<void> {
    try {
      const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end`;
      await this.redis.eval(script, 1, key, token);
    } catch (error) {
      this.warn('releaseLock', error);
    }
  }

  getClient(): RedisClient {
    return this.redis;
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /** Caller-built key. Fail-open, same as get/set. The caller must already scope the key. */
  async getFullKey<T>(fullKey: string): Promise<T | null> {
    try {
      const value = await this.redis.get(fullKey);
      return value ? (JSON.parse(value) as T) : null;
    } catch (error) {
      this.warn('getFullKey', error);
      return null;
    }
  }

  async setFullKey(fullKey: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.setex(fullKey, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      this.warn('setFullKey', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      try {
        this.redis.disconnect();
      } catch {
        /* ignore */
      }
    }
  }
}

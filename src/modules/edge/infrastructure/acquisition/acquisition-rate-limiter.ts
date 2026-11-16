import { Injectable, Optional } from '@nestjs/common';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { CacheService } from '../../../../shared/database/cache.service.js';
import { LoggerService } from '../../../../shared/logging/logger.service.js';

export type RateLimitMode = 'redis' | 'local';

export type AssertAllowedResult = {
  mode: RateLimitMode;
};

/** Minimal Redis surface used by the INCR + EXPIRE limiter (ioredis-compatible). */
export type RateLimitRedisClient = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
};

type LocalBucket = { count: number; resetAt: number };

/**
 * Distributed rate limiter for public acquisition endpoints.
 *
 * Prefer Redis (INCR + EXPIRE) via CacheService when available.
 * Production abuse protection: Redis path is authoritative when healthy.
 * If Redis is unavailable, fall back to a process-local Map (still capped),
 * log a warning, and surface mode via X-RateLimit-Mode: local.
 */
@Injectable()
export class AcquisitionPublicRateLimiter {
  private readonly local = new Map<string, LocalBucket>();
  private localFallbackWarned = false;
  /** Test seam — prefer over CacheService when set. */
  private redisOverride: RateLimitRedisClient | null = null;

  constructor(
    @Optional() private readonly cache?: CacheService,
    @Optional() private readonly logger?: LoggerService,
  ) {}

  /** Unit-test helper: bind an in-memory / fake Redis client. */
  useRedisClientForTests(client: RateLimitRedisClient | null): void {
    this.redisOverride = client;
  }

  async assertAllowed(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<AssertAllowedResult> {
    if (!key?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'rate limit key required');
    }
    if (!Number.isFinite(limit) || limit < 1) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'rate limit must be >= 1');
    }
    if (!Number.isFinite(windowMs) || windowMs < 1) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'rate limit window must be >= 1ms');
    }

    const redis = this.resolveRedis();
    if (redis) {
      try {
        await this.assertRedis(redis, key, limit, windowMs);
        return { mode: 'redis' };
      } catch (error) {
        if (error instanceof DomainError) throw error;
        this.warnLocalFallback(error);
        this.assertLocal(key, limit, windowMs);
        return { mode: 'local' };
      }
    }

    this.warnLocalFallback(null);
    this.assertLocal(key, limit, windowMs);
    return { mode: 'local' };
  }

  private resolveRedis(): RateLimitRedisClient | null {
    if (this.redisOverride) return this.redisOverride;
    if (!this.cache) return null;
    try {
      return this.cache.getClient() as RateLimitRedisClient;
    } catch {
      return null;
    }
  }

  private async assertRedis(
    redis: RateLimitRedisClient,
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<void> {
    const redisKey = `rl:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      const ttlSec = Math.max(1, Math.ceil(windowMs / 1000));
      await redis.expire(redisKey, ttlSec);
    }
    if (count > limit) {
      throw new DomainError(ErrorCode.RATE_LIMITED, 'Too many public acquisition requests', [
        { key, limit, windowMs, count },
      ]);
    }
  }

  private assertLocal(key: string, limit: number, windowMs: number): void {
    const now = Date.now();
    const entry = this.local.get(key);
    if (!entry || entry.resetAt <= now) {
      this.local.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }
    if (entry.count >= limit) {
      throw new DomainError(ErrorCode.RATE_LIMITED, 'Too many public acquisition requests', [
        { key, limit, windowMs, mode: 'local' },
      ]);
    }
    entry.count += 1;
  }

  private warnLocalFallback(error: unknown): void {
    if (this.localFallbackWarned) return;
    this.localFallbackWarned = true;
    this.logger?.warn(
      'Acquisition public rate limiter falling back to process-local Map (Redis unavailable)',
      {
        error: error instanceof Error ? error.message : error != null ? String(error) : undefined,
        header: 'X-RateLimit-Mode: local',
      },
    );
  }

  /** Test helper — clear local buckets. */
  clearLocal(): void {
    this.local.clear();
  }
}

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CacheService } from '../database/cache.service.js';

@Injectable()
export class RedisDistributedLock {
  constructor(private readonly cache: CacheService) {}

  async acquire(lockKey: string, ttlSeconds: number): Promise<string | null> {
    const token = randomUUID();
    const acquired = await this.cache.setNx(lockKey, token, ttlSeconds);
    return acquired ? token : null;
  }

  async release(lockKey: string, token: string): Promise<void> {
    await this.cache.releaseLock(lockKey, token);
  }

  async withLock<T>(
    lockKey: string,
    ttlSeconds: number,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    const token = await this.acquire(lockKey, ttlSeconds);
    if (!token) return null;
    try {
      return await fn();
    } finally {
      await this.release(lockKey, token);
    }
  }
}

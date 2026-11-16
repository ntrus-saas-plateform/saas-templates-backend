import { describe, expect, it, vi } from 'vitest';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  AcquisitionPublicRateLimiter,
  type RateLimitRedisClient,
} from './acquisition-rate-limiter.js';

function memoryRedis(): RateLimitRedisClient & {
  store: Map<string, { count: number; ttl?: number }>;
} {
  const store = new Map<string, { count: number; ttl?: number }>();
  return {
    store,
    async incr(key: string) {
      const cur = store.get(key) ?? { count: 0 };
      cur.count += 1;
      store.set(key, cur);
      return cur.count;
    },
    async expire(key: string, seconds: number) {
      const cur = store.get(key);
      if (!cur) return 0;
      cur.ttl = seconds;
      store.set(key, cur);
      return 1;
    },
  };
}

describe('AcquisitionPublicRateLimiter', () => {
  it('allows up to limit then rejects via Redis INCR+EXPIRE', async () => {
    const redis = memoryRedis();
    const limiter = new AcquisitionPublicRateLimiter();
    limiter.useRedisClientForTests(redis);

    for (let i = 0; i < 3; i++) {
      await expect(
        limiter.assertAllowed('acq:public:leads:1.2.3.4', 3, 60_000),
      ).resolves.toEqual({ mode: 'redis' });
    }

    await expect(
      limiter.assertAllowed('acq:public:leads:1.2.3.4', 3, 60_000),
    ).rejects.toMatchObject({ code: ErrorCode.RATE_LIMITED });

    expect(redis.store.get('rl:acq:public:leads:1.2.3.4')?.ttl).toBe(60);
  });

  it('falls back to local Map when Redis throws (not DomainError)', async () => {
    const warn = vi.fn();
    const broken: RateLimitRedisClient = {
      incr: async () => {
        throw new Error('ECONNREFUSED');
      },
      expire: async () => 0,
    };
    const limiter = new AcquisitionPublicRateLimiter(undefined, { warn } as never);
    limiter.useRedisClientForTests(broken);

    const first = await limiter.assertAllowed('acq:public:analytics:9.9.9.9', 2, 60_000);
    expect(first).toEqual({ mode: 'local' });
    expect(warn).toHaveBeenCalled();

    await expect(
      limiter.assertAllowed('acq:public:analytics:9.9.9.9', 2, 60_000),
    ).resolves.toEqual({ mode: 'local' });

    await expect(
      limiter.assertAllowed('acq:public:analytics:9.9.9.9', 2, 60_000),
    ).rejects.toMatchObject({ code: ErrorCode.RATE_LIMITED });
  });

  it('uses process-local Map when no Redis client is configured', async () => {
    const limiter = new AcquisitionPublicRateLimiter();
    await expect(limiter.assertAllowed('k', 1, 60_000)).resolves.toEqual({ mode: 'local' });
    await expect(limiter.assertAllowed('k', 1, 60_000)).rejects.toBeInstanceOf(DomainError);
  });

  it('isolates keys', async () => {
    const redis = memoryRedis();
    const limiter = new AcquisitionPublicRateLimiter();
    limiter.useRedisClientForTests(redis);
    await limiter.assertAllowed('a', 1, 60_000);
    await expect(limiter.assertAllowed('b', 1, 60_000)).resolves.toEqual({ mode: 'redis' });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { CacheService } from './cache.service.js';

describe('CacheService fail-open (P5 Redis-down)', () => {
  function serviceWithBrokenRedis() {
    const service = new CacheService(
      {
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: 1,
        REDIS_DB: 0,
      } as never,
      { get: () => ({ tenantId: 't1', organizationId: 'o1' }) } as never,
      { warn: vi.fn() } as never,
    );
    const redis = {
      get: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      setex: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      del: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      set: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      eval: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      ping: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      quit: vi.fn(),
      disconnect: vi.fn(),
    };
    (service as unknown as { redis: typeof redis }).redis = redis;
    return { service, redis };
  }

  it('get returns null when Redis is down (resolve falls back to DB)', async () => {
    const { service } = serviceWithBrokenRedis();
    await expect(service.get('business-context', 't:o:v1')).resolves.toBeNull();
  });

  it('set/del do not throw when Redis is down', async () => {
    const { service } = serviceWithBrokenRedis();
    await expect(service.set('business-context', 'k', { a: 1 }, 60)).resolves.toBeUndefined();
    await expect(service.del('business-context', 'k')).resolves.toBeUndefined();
  });

  it('setNx fails closed (false) so outbox leader is not stolen blindly', async () => {
    const { service } = serviceWithBrokenRedis();
    await expect(service.setNx('lock', 'token', 10)).resolves.toBe(false);
  });

  it('ping returns false when Redis is down', async () => {
    const { service } = serviceWithBrokenRedis();
    await expect(service.ping()).resolves.toBe(false);
  });
});

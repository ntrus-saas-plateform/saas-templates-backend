import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenDenylistService } from './token-denylist.service.js';

describe('TokenDenylistService', () => {
  const redis = {
    setex: vi.fn(),
    get: vi.fn(),
  };
  const cache = { getClient: () => redis };
  const config = {
    TOKEN_DENYLIST_ENABLED: true,
    TOKEN_DENYLIST_TTL_SECONDS: 3600,
  };

  let service: TokenDenylistService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TokenDenylistService(cache as never, config as never);
  });

  it('marks subject tokens issued before revocation as revoked', async () => {
    redis.get.mockResolvedValueOnce(String(1_700_000_100));
    const revoked = await service.isRevoked('user-1', 1_700_000_000, null);
    expect(revoked).toBe(true);
  });

  it('allows tokens issued at or after revocation', async () => {
    redis.get.mockResolvedValueOnce(String(1_700_000_100));
    await expect(service.isRevoked('user-1', 1_700_000_100, null)).resolves.toBe(false);
    redis.get.mockResolvedValueOnce(String(1_700_000_100));
    await expect(service.isRevoked('user-1', 1_700_000_200, null)).resolves.toBe(false);
  });

  it('normalizes legacy millisecond revoked-at values', async () => {
    // 1_700_000_100_000 ms ≈ 1_700_000_100 s
    redis.get.mockResolvedValueOnce(String(1_700_000_100_000));
    await expect(service.isRevoked('user-1', 1_700_000_000, null)).resolves.toBe(true);
    redis.get.mockResolvedValueOnce(String(1_700_000_100_000));
    await expect(service.isRevoked('user-1', 1_700_000_200, null)).resolves.toBe(false);
  });
});

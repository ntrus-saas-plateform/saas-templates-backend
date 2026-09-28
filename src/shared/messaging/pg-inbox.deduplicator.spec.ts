import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgInboxDeduplicator } from './pg-inbox.deduplicator.js';

describe('PgInboxDeduplicator', () => {
  const query = vi.fn();
  const dbManager = { getPool: vi.fn(async () => ({ query })) };
  let deduplicator: PgInboxDeduplicator;

  beforeEach(() => {
    vi.clearAllMocks();
    deduplicator = new PgInboxDeduplicator(dbManager as never);
  });

  it('claims first message delivery', async () => {
    query.mockResolvedValue({ rowCount: 1 });
    await expect(deduplicator.tryClaim('tenant-1', 'msg-1', 'consumer-1')).resolves.toBe(true);
  });

  it('rejects duplicate message delivery', async () => {
    query.mockResolvedValue({ rowCount: 0 });
    await expect(deduplicator.tryClaim('tenant-1', 'msg-1', 'consumer-1')).resolves.toBe(false);
  });

  it('releases a failed claim', async () => {
    query.mockResolvedValue({ rowCount: 1 });
    await deduplicator.releaseClaim('tenant-1', 'msg-1', 'consumer-1');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM inbox_messages'),
      ['msg-1', 'consumer-1'],
    );
  });
});

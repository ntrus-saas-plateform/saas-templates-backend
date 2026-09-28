import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgIdempotencyStore } from './pg-idempotency.store.js';

describe('PgIdempotencyStore', () => {
  const clientQuery = vi.fn();
  const client = {
    query: clientQuery,
    release: vi.fn(),
  };
  const pool = { connect: vi.fn(async () => client), query: vi.fn() };
  const dbManager = { getControlPlanePool: () => pool };
  const config = { IDEMPOTENCY_TTL_SECONDS: 3600 };

  let store: PgIdempotencyStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new PgIdempotencyStore(dbManager as never, config as never);
  });

  it('acquires new idempotency key atomically', async () => {
    clientQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ key: 'k1' }] }) // INSERT
      .mockResolvedValueOnce({}); // COMMIT

    const result = await store.acquire('k1', 'tenant-1', 'hash-a');
    expect(result).toEqual({ type: 'acquired' });
  });

  it('replays completed request with same hash', async () => {
    clientQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // INSERT conflict
      .mockResolvedValueOnce({
        rows: [
          {
            key: 'k1',
            tenant_id: 'tenant-1',
            request_hash: 'hash-a',
            status_code: 201,
            response_body: '{"ok":true}',
            created_at: new Date(),
            expires_at: new Date(Date.now() + 3600000),
          },
        ],
      })
      .mockResolvedValueOnce({}); // COMMIT

    const result = await store.acquire('k1', 'tenant-1', 'hash-a');
    expect(result.type).toBe('replay');
  });

  it('conflicts when key reused with different payload', async () => {
    clientQuery
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            key: 'k1',
            tenant_id: 'tenant-1',
            request_hash: 'hash-b',
            status_code: 201,
            response_body: '{}',
            created_at: new Date(),
            expires_at: new Date(Date.now() + 3600000),
          },
        ],
      })
      .mockResolvedValueOnce({});

    const result = await store.acquire('k1', 'tenant-1', 'hash-a');
    expect(result).toEqual({ type: 'conflict' });
  });

  it('conflicts when request is still in progress', async () => {
    clientQuery
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            key: 'k1',
            tenant_id: 'tenant-1',
            request_hash: 'hash-a',
            status_code: 0,
            response_body: '',
            created_at: new Date(),
            expires_at: new Date(Date.now() + 3600000),
          },
        ],
      })
      .mockResolvedValueOnce({});

    const result = await store.acquire('k1', 'tenant-1', 'hash-a');
    expect(result).toEqual({ type: 'conflict' });
  });
});

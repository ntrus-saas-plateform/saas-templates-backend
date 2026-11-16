import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FsPrivateDocumentStorageAdapter } from './fs-private-document-storage.adapter.js';

describe('FsPrivateDocumentStorageAdapter', () => {
  let root: string;
  let adapter: FsPrivateDocumentStorageAdapter;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'acq-fs-'));
    adapter = new FsPrivateDocumentStorageAdapter({
      root,
      grantSecret: 'test-grant-secret',
    });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await rm(root, { recursive: true, force: true });
  });

  it('rejects http locators', async () => {
    await expect(
      adapter.registerPrivateObject({
        storageKey: 'doc-1',
        privateLocator: 'https://cdn.example/private.pdf',
        contentType: 'application/pdf',
        byteSize: 1024,
      }),
    ).rejects.toThrow(/HTTP/);
  });

  it('rejects path traversal in private locator', async () => {
    await expect(
      adapter.registerPrivateObject({
        storageKey: 'doc-1',
        privateLocator: 'file-private://../outside.pdf',
        contentType: 'application/pdf',
        byteSize: 1024,
      }),
    ).rejects.toThrow(/path traversal/i);
  });

  it('rejects disallowed content types', async () => {
    await expect(
      adapter.registerPrivateObject({
        storageKey: 'doc-1',
        privateLocator: 'file-private://apps/doc-1.pdf',
        contentType: 'application/zip',
        byteSize: 1024,
      }),
    ).rejects.toThrow(/contentType not allowed/);
  });

  it('registers allowlisted content under file-private locator', async () => {
    const result = await adapter.registerPrivateObject({
      storageKey: 'doc-1',
      privateLocator: 'file-private://apps/doc-1.pdf',
      contentType: 'application/pdf',
      byteSize: 2048,
    });
    expect(result.storageKey).toBe('doc-1');
  });

  it('issues opaque grants that expire', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
    const { grantToken, expiresAt } = await adapter.createAuthorizedReadGrant(
      'doc-1',
      'reviewer-1',
      30,
    );
    expect(grantToken).not.toMatch(/^https?:\/\//i);
    expect(grantToken).not.toContain('doc-1');
    expect(adapter.resolveAuthorizedReadGrant(grantToken)?.storageKey).toBe('doc-1');

    vi.setSystemTime(new Date(expiresAt.getTime() + 1));
    expect(adapter.resolveAuthorizedReadGrant(grantToken)).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { LocalFileStorage } from '../../src/shared/storage/local-file.storage.js';

describe('LocalFileStorage', () => {
  const storage = new LocalFileStorage();

  it('should upload and read a file', async () => {
    const data = Buffer.from('test file content');
    const result = await storage.upload('test-file.txt', data, {
      filename: 'test-file.txt',
      mimeType: 'text/plain',
      size: data.length,
      tenantId: 'tenant-test',
      organizationId: null,
    });

    expect(result.key).toBe('test-file.txt');
    expect(result.metadata.checksum).toHaveLength(64);
    expect(result.metadata.filename).toBe('test-file.txt');

    const read = await storage.read('tenant-test', 'test-file.txt');
    expect(read.body.toString()).toBe('test file content');

    await storage.delete('other-tenant', 'test-file.txt');
    const stillThere = await storage.read('tenant-test', 'test-file.txt');
    expect(stillThere.body.toString()).toBe('test file content');

    await storage.delete('tenant-test', 'test-file.txt');
  });
});

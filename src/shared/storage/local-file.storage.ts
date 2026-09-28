import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  FileStoragePort,
  FileMetadata,
  StoredFile,
} from '../../core/domain/ports/file-storage.port.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE_ROOT = join(__dirname, '..', '..', '..', 'storage');

@Injectable()
export class LocalFileStorage implements FileStoragePort {
  private resolvePath(tenantId: string, key: string): string {
    return join(STORAGE_ROOT, tenantId, key);
  }

  async upload(
    key: string,
    data: Buffer,
    metadata: Omit<FileMetadata, 'checksum'>,
  ): Promise<StoredFile> {
    const checksum = createHash('sha256').update(data).digest('hex');
    const filePath = this.resolvePath(metadata.tenantId, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, data);

    return {
      key,
      metadata: { ...metadata, checksum },
      url: `file://${filePath}`,
      expiresAt: null,
    };
  }

  async getSignedUrl(tenantId: string, key: string, _expiresInSeconds: number): Promise<string> {
    return `file://${this.resolvePath(tenantId, key)}`;
  }

  async delete(tenantId: string, key: string): Promise<void> {
    try {
      await unlink(this.resolvePath(tenantId, key));
    } catch {
      // File may not exist
    }
  }

  async read(tenantId: string, key: string): Promise<{ body: Buffer; contentType: string }> {
    const body = await readFile(this.resolvePath(tenantId, key));
    return { body, contentType: contentTypeFromKey(key) };
  }
}

function contentTypeFromKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

import { Injectable, Inject } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'node:crypto';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';
import type {
  FileStoragePort,
  FileMetadata,
  StoredFile,
} from '../../core/domain/ports/file-storage.port.js';

@Injectable()
export class S3FileStorage implements FileStoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(@Inject(APP_CONFIG) private readonly config: EnvironmentConfig) {
    this.bucket = config.S3_BUCKET;
    this.client = new S3Client({
      region: config.S3_REGION,
      endpoint: config.S3_ENDPOINT || undefined,
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY_ID,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: config.S3_FORCE_PATH_STYLE,
    });
  }

  private buildKey(tenantId: string, key: string): string {
    return `tenant/${tenantId}/${key}`;
  }

  async upload(
    key: string,
    data: Buffer,
    metadata: Omit<FileMetadata, 'checksum'>,
  ): Promise<StoredFile> {
    const checksum = createHash('sha256').update(data).digest('hex');
    const objectKey = this.buildKey(metadata.tenantId, key);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: data,
        ContentType: metadata.mimeType,
        Metadata: {
          filename: metadata.filename,
          checksum,
          tenantId: metadata.tenantId,
          organizationId: metadata.organizationId ?? '',
        },
      }),
    );

    const url = await this.getSignedUrl(metadata.tenantId, key, 3600);

    return {
      key,
      metadata: { ...metadata, checksum },
      url,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    };
  }

  async getSignedUrl(tenantId: string, key: string, expiresInSeconds: number): Promise<string> {
    const objectKey = this.buildKey(tenantId, key);
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      { expiresIn: expiresInSeconds },
    );
  }

  async delete(tenantId: string, key: string): Promise<void> {
    const objectKey = this.buildKey(tenantId, key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
  }

  async read(
    tenantId: string,
    key: string,
  ): Promise<{ body: Buffer; contentType: string }> {
    const objectKey = this.buildKey(tenantId, key);
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error(`Empty object: ${objectKey}`);
    }
    return {
      body: Buffer.from(bytes),
      contentType: res.ContentType ?? 'application/octet-stream',
    };
  }
}

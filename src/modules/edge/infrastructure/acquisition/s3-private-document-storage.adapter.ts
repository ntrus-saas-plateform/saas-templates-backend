import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  AcquisitionDocumentPutInput,
  AcquisitionDocumentScanStatus,
  AcquisitionDocumentStoragePort,
} from '../../domain/acquisition/document-storage.port.js';
import { assertAcquisitionDocumentPutConstraints } from './acquisition-document-storage.shared.js';
import { MalwareScanAdapter } from './malware-scan.adapter.js';

/**
 * Private S3 storage for acquisition documents.
 * Locator scheme: `s3-private://{bucket}/{key}` — never a permanent public URL.
 *
 * createAuthorizedReadGrant issues a short-lived presigned GET for authorized
 * reviewers only. Treat the grant as a capability token, not a public link.
 */
export class S3PrivateDocumentStorageAdapter implements AcquisitionDocumentStoragePort {
  private readonly bucket: string;
  private readonly client: S3Client;
  private readonly malware: MalwareScanAdapter;
  private readonly keyByStorageKey = new Map<string, string>();

  constructor(opts?: {
    bucket?: string;
    client?: S3Client;
    malware?: MalwareScanAdapter;
  }) {
    const bucket = (opts?.bucket || process.env.ACQUISITION_S3_BUCKET || '').trim();
    if (!bucket) {
      throw new Error(
        'ACQUISITION_S3_BUCKET is required for S3PrivateDocumentStorageAdapter',
      );
    }
    this.bucket = bucket;
    this.malware = opts?.malware ?? new MalwareScanAdapter();

    if (opts?.client) {
      this.client = opts.client;
      return;
    }

    const region = (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || '').trim();
    if (!region) {
      throw new Error(
        'AWS_REGION (or AWS_DEFAULT_REGION) is required when ACQUISITION_S3_BUCKET is set',
      );
    }
    // Credentials: default provider chain (env / shared config / IAM role).
    // Missing credentials surface as SDK errors on first Put/Get — fail clearly here if forced.
    if (
      process.env.AWS_ACCESS_KEY_ID &&
      !process.env.AWS_SECRET_ACCESS_KEY
    ) {
      throw new Error(
        'AWS_SECRET_ACCESS_KEY is required when AWS_ACCESS_KEY_ID is set for acquisition S3 storage',
      );
    }
    this.client = new S3Client({ region });
  }

  async registerPrivateObject(
    input: AcquisitionDocumentPutInput,
  ): Promise<{ storageKey: string }> {
    assertAcquisitionDocumentPutConstraints(input);
    const { bucket, key } = this.parseLocator(input.privateLocator);
    if (bucket !== this.bucket) {
      throw new Error(
        `privateLocator bucket "${bucket}" does not match ACQUISITION_S3_BUCKET "${this.bucket}"`,
      );
    }
    // Metadata-only Put when no body is supplied by the port — object may already exist.
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: input.contentType,
        ContentLength: 0,
        Body: Buffer.alloc(0),
        Metadata: {
          'acquisition-storage-key': input.storageKey,
          'acquisition-byte-size': String(input.byteSize),
          ...(input.checksumSha256
            ? { 'acquisition-checksum-sha256': input.checksumSha256 }
            : {}),
        },
      }),
    );
    this.keyByStorageKey.set(input.storageKey.trim(), key);
    return { storageKey: input.storageKey };
  }

  /**
   * Short-lived presigned GET for authorized reviewers only — not a permanent public URL.
   */
  async createAuthorizedReadGrant(
    storageKey: string,
    actorId: string,
    ttlSeconds: number,
  ): Promise<{ grantToken: string; expiresAt: Date }> {
    if (!storageKey?.trim() || !actorId?.trim()) {
      throw new Error('storageKey and actorId required for read grant');
    }
    const key =
      this.keyByStorageKey.get(storageKey.trim()) ||
      this.sanitizeKey(storageKey.trim());
    const ttl = Math.max(30, Math.min(ttlSeconds, 15 * 60));
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const grantToken = await getSignedUrl(this.client, command, { expiresIn: ttl });
    return { grantToken, expiresAt };
  }

  async requestMalwareScan(
    storageKey: string,
  ): Promise<{ status: AcquisitionDocumentScanStatus }> {
    const bytes = await this.tryGetObjectBytes(storageKey);
    return this.malware.scan(bytes);
  }

  private async tryGetObjectBytes(storageKey: string): Promise<Buffer | null> {
    try {
      const key =
        this.keyByStorageKey.get(storageKey.trim()) ||
        this.sanitizeKey(storageKey.trim());
      const out = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!out.Body) return null;
      const bytes = await out.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch {
      return null;
    }
  }

  private parseLocator(privateLocator: string): { bucket: string; key: string } {
    const trimmed = privateLocator.trim();
    const prefix = 's3-private://';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      throw new Error('public HTTP(S) locators are not allowed for acquisition documents');
    }
    if (!trimmed.startsWith(prefix)) {
      throw new Error(`S3 private locator must use ${prefix}{bucket}/{key}`);
    }
    const rest = trimmed.slice(prefix.length);
    const slash = rest.indexOf('/');
    if (slash <= 0 || slash === rest.length - 1) {
      throw new Error(`S3 private locator must use ${prefix}{bucket}/{key}`);
    }
    const bucket = rest.slice(0, slash);
    const key = this.sanitizeKey(rest.slice(slash + 1));
    return { bucket, key };
  }

  private sanitizeKey(key: string): string {
    const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized || normalized.includes('..')) {
      throw new Error('path traversal refused for private document storage');
    }
    return normalized;
  }
}

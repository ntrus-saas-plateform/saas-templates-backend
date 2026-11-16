import { createHmac, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  AcquisitionDocumentPutInput,
  AcquisitionDocumentStoragePort,
} from '../../domain/acquisition/document-storage.port.js';
import { assertAcquisitionDocumentPutConstraints } from './acquisition-document-storage.shared.js';
import { MalwareScanAdapter } from './malware-scan.adapter.js';

type GrantEntry = { storageKey: string; expiresAt: Date };

/**
 * Private FS storage for acquisition documents.
 * Locators are never HTTP URLs — scheme `file-private://{relative}`.
 * Authorized read grants are opaque HMAC tokens (in-memory map + TTL).
 */
export class FsPrivateDocumentStorageAdapter implements AcquisitionDocumentStoragePort {
  private readonly root: string;
  private readonly grantSecret: string;
  private readonly grants = new Map<string, GrantEntry>();
  private readonly malware: MalwareScanAdapter;

  constructor(opts?: {
    root?: string;
    grantSecret?: string;
    malware?: MalwareScanAdapter;
  }) {
    this.root = path.resolve(
      opts?.root ||
        process.env.ACQUISITION_PRIVATE_STORAGE_ROOT?.trim() ||
        '.data/acquisition-private',
    );
    this.grantSecret =
      opts?.grantSecret ||
      process.env.ACQUISITION_GRANT_SECRET?.trim() ||
      process.env.EDGE_CSRF_SECRET?.trim() ||
      'dev-only-acquisition-grant';
    this.malware = opts?.malware ?? new MalwareScanAdapter();
  }

  async registerPrivateObject(
    input: AcquisitionDocumentPutInput,
  ): Promise<{ storageKey: string }> {
    assertAcquisitionDocumentPutConstraints(input);
    const relative = this.relativeFromLocator(input.privateLocator);
    const absolute = this.resolveUnderRoot(relative);
    await mkdir(path.dirname(absolute), { recursive: true });
    // Marker metadata only — binary upload path is out-of-band; refuse inventing content.
    const metaPath = `${absolute}.meta.json`;
    await writeFile(
      metaPath,
      JSON.stringify({
        storageKey: input.storageKey,
        contentType: input.contentType,
        byteSize: input.byteSize,
        checksumSha256: input.checksumSha256 ?? null,
        privateLocator: `file-private://${relative.replace(/\\/g, '/')}`,
        registeredAt: new Date().toISOString(),
      }),
      'utf8',
    );
    return { storageKey: input.storageKey };
  }

  async createAuthorizedReadGrant(
    storageKey: string,
    actorId: string,
    ttlSeconds: number,
  ): Promise<{ grantToken: string; expiresAt: Date }> {
    if (!storageKey?.trim() || !actorId?.trim()) {
      throw new Error('storageKey and actorId required for read grant');
    }
    this.pruneExpiredGrants();
    const expiresAt = new Date(Date.now() + Math.max(30, ttlSeconds) * 1000);
    const nonce = randomBytes(16).toString('base64url');
    const material = `${storageKey}|${actorId}|${expiresAt.toISOString()}|${nonce}`;
    const grantToken = createHmac('sha256', this.grantSecret).update(material).digest('base64url');
    this.grants.set(grantToken, { storageKey: storageKey.trim(), expiresAt });
    return { grantToken, expiresAt };
  }

  /** Resolve a grant for authorized reviewers only — not a public URL. */
  resolveAuthorizedReadGrant(grantToken: string): { storageKey: string; expiresAt: Date } | null {
    this.pruneExpiredGrants();
    const entry = this.grants.get(grantToken);
    if (!entry) return null;
    if (entry.expiresAt.getTime() <= Date.now()) {
      this.grants.delete(grantToken);
      return null;
    }
    return entry;
  }

  async requestMalwareScan(
    storageKey: string,
  ): Promise<{ status: import('../../domain/acquisition/document-storage.port.js').AcquisitionDocumentScanStatus }> {
    const bytes = await this.tryReadObjectBytes(storageKey);
    return this.malware.scan(bytes);
  }

  private async tryReadObjectBytes(storageKey: string): Promise<Buffer | null> {
    try {
      const absolute = this.resolveUnderRoot(this.sanitizeRelative(storageKey));
      return await readFile(absolute);
    } catch {
      return null;
    }
  }

  private relativeFromLocator(privateLocator: string): string {
    const trimmed = privateLocator.trim();
    const prefix = 'file-private://';
    if (!trimmed.startsWith(prefix)) {
      throw new Error(
        `FS private locator must use ${prefix}{relative}; got scheme/path that is not private FS`,
      );
    }
    const relative = trimmed.slice(prefix.length).replace(/^\/+/, '');
    if (!relative) throw new Error('empty private relative path');
    return this.sanitizeRelative(relative);
  }

  private sanitizeRelative(relative: string): string {
    const normalized = relative.replace(/\\/g, '/');
    if (
      normalized.includes('..') ||
      normalized.startsWith('/') ||
      /^[a-zA-Z]:/.test(normalized)
    ) {
      throw new Error('path traversal refused for private document storage');
    }
    return normalized;
  }

  private resolveUnderRoot(relative: string): string {
    const absolute = path.resolve(this.root, relative);
    const rootWithSep = this.root.endsWith(path.sep) ? this.root : `${this.root}${path.sep}`;
    if (absolute !== this.root && !absolute.startsWith(rootWithSep)) {
      throw new Error('path traversal refused for private document storage');
    }
    return absolute;
  }

  private pruneExpiredGrants(): void {
    const now = Date.now();
    for (const [token, entry] of this.grants) {
      if (entry.expiresAt.getTime() <= now) this.grants.delete(token);
    }
  }
}

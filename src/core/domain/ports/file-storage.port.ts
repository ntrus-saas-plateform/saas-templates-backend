export interface FileMetadata {
  readonly filename: string;
  readonly mimeType: string;
  readonly size: number;
  readonly checksum: string;
  readonly tenantId: string;
  readonly organizationId: string | null;
}

export interface StoredFile {
  readonly key: string;
  readonly metadata: FileMetadata;
  readonly url: string;
  readonly expiresAt: Date | null;
}

export interface FileStoragePort {
  upload(
    key: string,
    data: Buffer,
    metadata: Omit<FileMetadata, 'checksum'>,
  ): Promise<StoredFile>;
  getSignedUrl(tenantId: string, key: string, expiresInSeconds: number): Promise<string>;
  delete(tenantId: string, key: string): Promise<void>;
  read(
    tenantId: string,
    key: string,
  ): Promise<{ body: Buffer; contentType: string }>;
}

export const FILE_STORAGE_PORT = Symbol('FILE_STORAGE_PORT');

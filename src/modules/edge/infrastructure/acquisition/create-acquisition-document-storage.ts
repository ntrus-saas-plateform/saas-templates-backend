import type { AcquisitionDocumentStoragePort } from '../../domain/acquisition/document-storage.port.js';
import { FsPrivateDocumentStorageAdapter } from './fs-private-document-storage.adapter.js';
import { PendingAcquisitionDocumentStorageAdapter } from './pending-document-storage.adapter.js';
import { S3PrivateDocumentStorageAdapter } from './s3-private-document-storage.adapter.js';

/**
 * Selectable factory for acquisition private document storage.
 * - ACQUISITION_STORAGE_MODE=pending → pending metadata-only adapter
 * - ACQUISITION_S3_BUCKET set → S3 private adapter
 * - default → FS private adapter under ACQUISITION_PRIVATE_STORAGE_ROOT
 */
export function createAcquisitionDocumentStorage(): AcquisitionDocumentStoragePort {
  const mode = (process.env.ACQUISITION_STORAGE_MODE || '').trim().toLowerCase();
  if (mode === 'pending') {
    return new PendingAcquisitionDocumentStorageAdapter();
  }
  if (process.env.ACQUISITION_S3_BUCKET?.trim()) {
    return new S3PrivateDocumentStorageAdapter();
  }
  return new FsPrivateDocumentStorageAdapter();
}

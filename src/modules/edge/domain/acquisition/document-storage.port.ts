/**
 * Private document storage port for P10 acquisition.
 * Implementations must never expose private objects via public URLs.
 * Binary content stays in object storage; CP DB only stores references/metadata.
 */

export const ACQUISITION_DOCUMENT_STORAGE_PORT = Symbol('ACQUISITION_DOCUMENT_STORAGE_PORT');

export type AcquisitionDocumentPutInput = {
  storageKey: string;
  contentType: string;
  byteSize: number;
  checksumSha256?: string | null;
  /** Opaque handle — never a public URL. */
  privateLocator: string;
};

export type AcquisitionDocumentScanStatus =
  | 'PENDING'
  | 'CLEAN'
  | 'INFECTED'
  | 'QUARANTINED'
  | 'SCAN_UNAVAILABLE';

export interface AcquisitionDocumentStoragePort {
  /**
   * Register a private object. Does not accept raw file bytes in the control-plane DB path.
   */
  registerPrivateObject(input: AcquisitionDocumentPutInput): Promise<{ storageKey: string }>;

  /**
   * Issue a short-lived, authenticated download capability for authorized reviewers only.
   * Must not be a permanent public URL.
   */
  createAuthorizedReadGrant(
    storageKey: string,
    actorId: string,
    ttlSeconds: number,
  ): Promise<{ grantToken: string; expiresAt: Date }>;

  /**
   * Malware scan integration. SCAN_UNAVAILABLE must not be treated as CLEAN.
   */
  requestMalwareScan(storageKey: string): Promise<{ status: AcquisitionDocumentScanStatus }>;
}

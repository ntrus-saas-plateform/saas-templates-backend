import { Injectable } from '@nestjs/common';
import type {
  AcquisitionDocumentPutInput,
  AcquisitionDocumentStoragePort,
  AcquisitionDocumentScanStatus,
} from '../../domain/acquisition/document-storage.port.js';
import { assertAcquisitionDocumentPutConstraints } from './acquisition-document-storage.shared.js';
import { MalwareScanAdapter } from './malware-scan.adapter.js';

/**
 * Honest pending adapter — registers metadata keys only.
 * Selected when ACQUISITION_STORAGE_MODE=pending.
 * Never returns public URLs. Never claims CLEAN when scan is unavailable.
 *
 * Malware scan delegated to MalwareScanAdapter (ClamAV / mock_* / SCAN_UNAVAILABLE).
 */
@Injectable()
export class PendingAcquisitionDocumentStorageAdapter implements AcquisitionDocumentStoragePort {
  private readonly malware: MalwareScanAdapter;

  constructor(malware?: MalwareScanAdapter) {
    this.malware = malware ?? new MalwareScanAdapter();
  }

  async registerPrivateObject(
    input: AcquisitionDocumentPutInput,
  ): Promise<{ storageKey: string }> {
    assertAcquisitionDocumentPutConstraints(input);
    return { storageKey: input.storageKey };
  }

  async createAuthorizedReadGrant(
    storageKey: string,
    actorId: string,
    ttlSeconds: number,
  ): Promise<{ grantToken: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + Math.max(30, ttlSeconds) * 1000);
    return {
      grantToken: `pending-grant:${storageKey}:${actorId}:${expiresAt.toISOString()}`,
      expiresAt,
    };
  }

  async requestMalwareScan(
    _storageKey: string,
  ): Promise<{ status: AcquisitionDocumentScanStatus }> {
    return this.malware.scan(null);
  }
}

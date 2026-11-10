import { describe, expect, it } from 'vitest';
import { buildInvoicePdfArtifact } from './invoice-pdf.js';

describe('buildInvoicePdfArtifact', () => {
  it('produces a PDF header and sha256 storage ref', () => {
    const doc = buildInvoicePdfArtifact({
      invoiceNumber: 'INV-1001',
      billingAccountId: '00000000-0000-4000-8000-000000000001',
      currency: 'USD',
      total: '120.00',
      issueAt: '2026-11-10T00:00:00.000Z',
      legalName: 'Acme SA',
    });
    expect(Buffer.from(doc.contentBase64, 'base64').toString('binary').startsWith('%PDF')).toBe(
      true,
    );
    expect(doc.contentSha256).toHaveLength(64);
    expect(doc.storageRef).toContain('INV-1001');
    expect(doc.storageRef).toContain(doc.contentSha256);
  });
});

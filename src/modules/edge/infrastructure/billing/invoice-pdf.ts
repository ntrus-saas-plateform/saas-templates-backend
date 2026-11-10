import { createHash } from 'node:crypto';

/**
 * Minimal PDF artifact for issued invoices.
 * Stored as immutable financial evidence — not regenerated from mutable state.
 */
export function buildInvoicePdfArtifact(input: {
  invoiceNumber: string;
  billingAccountId: string;
  currency: string;
  total: string;
  issueAt: string;
  legalName?: string;
}): { storageRef: string; contentBase64: string; contentSha256: string } {
  const lines = [
    `Invoice ${input.invoiceNumber}`,
    `Account ${input.billingAccountId}`,
    input.legalName ? `Bill to ${input.legalName}` : null,
    `Total ${input.total} ${input.currency}`,
    `Issued ${input.issueAt}`,
    'Okapi Edge — immutable billing artifact',
  ].filter(Boolean) as string[];

  const content = lines.join('\n');
  const pdf = buildMinimalPdf(content);
  const contentSha256 = createHash('sha256').update(pdf, 'binary').digest('hex');
  const storageRef = `billing://invoices/${input.invoiceNumber}.pdf#sha256=${contentSha256}`;
  return {
    storageRef,
    contentBase64: Buffer.from(pdf, 'binary').toString('base64'),
    contentSha256,
  };
}

function buildMinimalPdf(text: string): string {
  const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const stream = `BT /F1 10 Tf 50 750 Td (${escaped}) Tj ET`;
  const objects = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n',
    '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n',
    `4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'binary'));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, 'binary');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 0; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf;
}

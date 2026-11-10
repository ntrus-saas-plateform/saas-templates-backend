import { describe, expect, it } from 'vitest';
import { MinimalPdfProposalAdapter } from './minimal-pdf-proposal.adapter.js';

describe('MinimalPdfProposalAdapter', () => {
  it('generates a PDF artifact with %PDF header', async () => {
    const adapter = new MinimalPdfProposalAdapter();
    const result = await adapter.generate({
      proposalId: 'p1',
      proposalNumber: 'P-1000',
      title: 'Okapi Offer',
      language: 'fr',
      sections: [{ title: 'Need', body: 'POS for pharmacies' }],
    });
    expect(result.outcome).toBe('GENERATED');
    if (result.outcome !== 'GENERATED') return;
    const bytes = Buffer.from(result.bytesBase64, 'base64').toString('binary');
    expect(bytes.startsWith('%PDF')).toBe(true);
    expect(result.documentRef).toContain('p1');
  });
});

import { describe, expect, it } from 'vitest';
import { UnavailableSalesSignatureAdapter } from './unavailable-signature.adapter.js';

describe('UnavailableSalesSignatureAdapter', () => {
  const adapter = new UnavailableSalesSignatureAdapter();

  it('never invents a signature request success', async () => {
    const result = await adapter.requestSignature({
      contractId: 'c1',
      contractNumber: 'C-1',
      signers: [{ email: 'a@b.com' }],
      correlationId: 'corr',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
  });

  it('never invents provider confirmation', async () => {
    const result = await adapter.confirmSignature({
      contractId: 'c1',
      provider: 'docusign',
      externalId: 'ext-1',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
  });
});

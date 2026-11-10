import { describe, expect, it, vi } from 'vitest';
import { parseEnvironment } from '../../../../shared/configuration/environment.schema.js';
import { ResolvingSalesSignatureAdapter } from './resolving-signature.adapter.js';
import { UnavailableSalesSignatureAdapter } from './unavailable-signature.adapter.js';
import type { DocuSignSalesSignatureAdapter } from './docusign-signature.adapter.js';
import type { HelloSignSalesSignatureAdapter } from './hellosign-signature.adapter.js';

describe('ResolvingSalesSignatureAdapter', () => {
  const request = {
    contractId: 'c1',
    contractNumber: 'C-1',
    signers: [{ email: 'a@example.com' }],
    correlationId: 'corr-1',
  };

  it('defaults to unavailable', async () => {
    const unavailable = new UnavailableSalesSignatureAdapter();
    const docusign = {
      requestSignature: vi.fn(),
      confirmSignature: vi.fn(),
    } as unknown as DocuSignSalesSignatureAdapter;
    const hellosign = {
      requestSignature: vi.fn(),
      confirmSignature: vi.fn(),
    } as unknown as HelloSignSalesSignatureAdapter;

    const adapter = new ResolvingSalesSignatureAdapter(
      parseEnvironment({ CONTROL_PLANE_DB_PASSWORD: 'test' }),
      unavailable,
      docusign,
      hellosign,
    );

    const result = await adapter.requestSignature(request);
    expect(result.outcome).toBe('UNAVAILABLE');
    expect(docusign.requestSignature).not.toHaveBeenCalled();
  });

  it('auto selects docusign when credentials present', async () => {
    const unavailable = new UnavailableSalesSignatureAdapter();
    const docusign = {
      requestSignature: vi.fn(async () => ({
        outcome: 'REQUESTED' as const,
        provider: 'docusign',
        externalId: 'e1',
      })),
      confirmSignature: vi.fn(),
    } as unknown as DocuSignSalesSignatureAdapter;
    const hellosign = {
      requestSignature: vi.fn(),
      confirmSignature: vi.fn(),
    } as unknown as HelloSignSalesSignatureAdapter;

    const adapter = new ResolvingSalesSignatureAdapter(
      parseEnvironment({
        CONTROL_PLANE_DB_PASSWORD: 'test',
        SALES_SIGNATURE_ADAPTER: 'auto',
        DOCUSIGN_ACCESS_TOKEN: 'tok',
        DOCUSIGN_ACCOUNT_ID: 'acc',
      }),
      unavailable,
      docusign,
      hellosign,
    );

    const result = await adapter.requestSignature(request);
    expect(result.outcome).toBe('REQUESTED');
    expect(docusign.requestSignature).toHaveBeenCalled();
  });
});

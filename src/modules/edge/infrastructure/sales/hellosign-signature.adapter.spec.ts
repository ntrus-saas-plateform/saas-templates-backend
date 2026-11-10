import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseEnvironment } from '../../../../shared/configuration/environment.schema.js';
import type { LoggerService } from '../../../../shared/logging/logger.service.js';
import { HelloSignSalesSignatureAdapter } from './hellosign-signature.adapter.js';

const logger = {
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as LoggerService;

const request = {
  contractId: 'c1',
  contractNumber: 'C-1',
  signers: [{ email: 'a@example.com' }],
  documentRef: 'https://example.com/contract.pdf',
  correlationId: 'corr-1',
};

describe('HelloSignSalesSignatureAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns UNAVAILABLE without API key', async () => {
    const adapter = new HelloSignSalesSignatureAdapter(
      parseEnvironment({ CONTROL_PLANE_DB_PASSWORD: 'test' }),
      logger,
    );
    const result = await adapter.requestSignature(request);
    expect(result.outcome).toBe('UNAVAILABLE');
  });

  it('returns UNAVAILABLE without documentRef', async () => {
    const adapter = new HelloSignSalesSignatureAdapter(
      parseEnvironment({
        CONTROL_PLANE_DB_PASSWORD: 'test',
        HELLOSIGN_API_KEY: 'hs_key',
      }),
      logger,
    );
    const result = await adapter.requestSignature({
      ...request,
      documentRef: null,
    });
    expect(result.outcome).toBe('UNAVAILABLE');
  });

  it('returns REQUESTED with signature_request_id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              signature_request: { signature_request_id: 'sr-1' },
            }),
            { status: 200 },
          ),
      ),
    );

    const adapter = new HelloSignSalesSignatureAdapter(
      parseEnvironment({
        CONTROL_PLANE_DB_PASSWORD: 'test',
        HELLOSIGN_API_KEY: 'hs_key',
      }),
      logger,
    );

    const result = await adapter.requestSignature(request);
    expect(result).toEqual({
      outcome: 'REQUESTED',
      provider: 'hellosign',
      externalId: 'sr-1',
    });
  });

  it('confirms only when is_complete is true', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ signature_request: { is_complete: true } }),
            { status: 200 },
          ),
      ),
    );

    const adapter = new HelloSignSalesSignatureAdapter(
      parseEnvironment({
        CONTROL_PLANE_DB_PASSWORD: 'test',
        HELLOSIGN_API_KEY: 'hs_key',
      }),
      logger,
    );

    const result = await adapter.confirmSignature({
      contractId: 'c1',
      provider: 'hellosign',
      externalId: 'sr-1',
    });
    expect(result.outcome).toBe('CONFIRMED');
  });
});

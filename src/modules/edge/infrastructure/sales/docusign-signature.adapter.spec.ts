import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseEnvironment } from '../../../../shared/configuration/environment.schema.js';
import type { LoggerService } from '../../../../shared/logging/logger.service.js';
import { DocuSignSalesSignatureAdapter } from './docusign-signature.adapter.js';

const logger = {
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as LoggerService;

const request = {
  contractId: 'c1',
  contractNumber: 'C-1',
  signers: [{ email: 'a@example.com', name: 'A' }],
  correlationId: 'corr-1',
};

describe('DocuSignSalesSignatureAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns UNAVAILABLE without credentials', async () => {
    const adapter = new DocuSignSalesSignatureAdapter(
      parseEnvironment({ CONTROL_PLANE_DB_PASSWORD: 'test' }),
      logger,
    );
    const result = await adapter.requestSignature(request);
    expect(result.outcome).toBe('UNAVAILABLE');
  });

  it('returns REQUESTED with envelope id (never invents CONFIRMED)', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ envelopeId: 'env-1' }), { status: 201 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new DocuSignSalesSignatureAdapter(
      parseEnvironment({
        CONTROL_PLANE_DB_PASSWORD: 'test',
        DOCUSIGN_ACCESS_TOKEN: 'tok',
        DOCUSIGN_ACCOUNT_ID: 'acc',
      }),
      logger,
    );

    const result = await adapter.requestSignature(request);
    expect(result).toEqual({
      outcome: 'REQUESTED',
      provider: 'docusign',
      externalId: 'env-1',
    });
  });

  it('confirms only when envelope status is completed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: 'completed',
              completedDateTime: '2026-11-09T12:00:00Z',
            }),
            { status: 200 },
          ),
      ),
    );

    const adapter = new DocuSignSalesSignatureAdapter(
      parseEnvironment({
        CONTROL_PLANE_DB_PASSWORD: 'test',
        DOCUSIGN_ACCESS_TOKEN: 'tok',
        DOCUSIGN_ACCOUNT_ID: 'acc',
      }),
      logger,
    );

    const confirmed = await adapter.confirmSignature({
      contractId: 'c1',
      provider: 'docusign',
      externalId: 'env-1',
    });
    expect(confirmed).toEqual({
      outcome: 'CONFIRMED',
      confirmedAt: '2026-11-09T12:00:00Z',
    });
  });

  it('returns NOT_CONFIRMED when envelope is still sent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ status: 'sent' }), { status: 200 }),
      ),
    );

    const adapter = new DocuSignSalesSignatureAdapter(
      parseEnvironment({
        CONTROL_PLANE_DB_PASSWORD: 'test',
        DOCUSIGN_ACCESS_TOKEN: 'tok',
        DOCUSIGN_ACCOUNT_ID: 'acc',
      }),
      logger,
    );

    const result = await adapter.confirmSignature({
      contractId: 'c1',
      provider: 'docusign',
      externalId: 'env-1',
    });
    expect(result.outcome).toBe('NOT_CONFIRMED');
  });
});

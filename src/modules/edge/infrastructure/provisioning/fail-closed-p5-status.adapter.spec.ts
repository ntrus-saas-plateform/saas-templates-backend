import { FailClosedP5AuthorizationStatusAdapter } from './fail-closed-p5-status.adapter.js';
import type { EdgeP5S2STokenClient } from './edge-p5-s2s-token.client.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';

describe('FailClosedP5AuthorizationStatusAdapter (OQ-04 + S2S)', () => {
  const s2s = {
    isConfigured: vi.fn(() => false),
    getAccessToken: vi.fn(),
    clearCache: vi.fn(),
  } as unknown as EdgeP5S2STokenClient;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns UNAVAILABLE when status URL is not configured', async () => {
    const adapter = new FailClosedP5AuthorizationStatusAdapter(
      { EDGE_P5_AUTHORIZATION_STATUS_TIMEOUT_MS: 2000 } as EnvironmentConfig,
      s2s,
    );
    const result = await adapter.verifyCurrentStatus({
      authorizationId: 'a',
      authorizationVersion: 1,
      correlationId: 'c',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
    if (result.outcome === 'UNAVAILABLE') {
      expect(result.reasonCode).toBe('P5_STATUS_ENDPOINT_NOT_CONFIGURED');
    }
  });

  it('refuses unauthenticated call when S2S is not configured', async () => {
    (s2s.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const adapter = new FailClosedP5AuthorizationStatusAdapter(
      {
        EDGE_P5_AUTHORIZATION_STATUS_URL: 'https://p5.example/status',
        EDGE_P5_AUTHORIZATION_STATUS_TIMEOUT_MS: 2000,
        EDGE_P5_ALLOW_INSECURE_HTTP: false,
      } as EnvironmentConfig,
      s2s,
    );
    const result = await adapter.verifyCurrentStatus({
      authorizationId: 'a',
      authorizationVersion: 1,
      correlationId: 'c',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
    if (result.outcome === 'UNAVAILABLE') {
      expect(result.reasonCode).toBe('P5_S2S_NOT_CONFIGURED');
    }
  });

  it('rejects colliding Edge→P5 and P5→Edge client IDs', async () => {
    (s2s.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const adapter = new FailClosedP5AuthorizationStatusAdapter(
      {
        EDGE_P5_AUTHORIZATION_STATUS_URL: 'https://p5.example/status',
        EDGE_P5_S2S_CLIENT_ID: 'same-client',
        EDGE_P5_INBOUND_S2S_CLIENT_ID: 'same-client',
        EDGE_P5_ALLOW_INSECURE_HTTP: false,
      } as EnvironmentConfig,
      s2s,
    );
    const result = await adapter.verifyCurrentStatus({
      authorizationId: 'a',
      authorizationVersion: 1,
      correlationId: 'c',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
    if (result.outcome === 'UNAVAILABLE') {
      expect(result.reasonCode).toBe('P5_S2S_IDENTITY_COLLISION');
    }
  });

  it('rejects non-HTTPS status URL by default', async () => {
    (s2s.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const adapter = new FailClosedP5AuthorizationStatusAdapter(
      {
        EDGE_P5_AUTHORIZATION_STATUS_URL: 'http://p5.example/status',
        EDGE_P5_ALLOW_INSECURE_HTTP: false,
        EDGE_P5_S2S_CLIENT_ID: 'edge-out',
        EDGE_P5_INBOUND_S2S_CLIENT_ID: 'p5-in',
      } as EnvironmentConfig,
      s2s,
    );
    const result = await adapter.verifyCurrentStatus({
      authorizationId: 'a',
      authorizationVersion: 1,
      correlationId: 'c',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
    if (result.outcome === 'UNAVAILABLE') {
      expect(result.reasonCode).toBe('P5_STATUS_URL_MUST_BE_HTTPS');
    }
  });

  it('returns UNAVAILABLE when S2S token acquisition fails', async () => {
    (s2s.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (s2s.getAccessToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('P5_S2S_TOKEN_HTTP_401'),
    );
    const adapter = new FailClosedP5AuthorizationStatusAdapter(
      {
        EDGE_P5_AUTHORIZATION_STATUS_URL: 'https://p5.example/status',
        EDGE_P5_AUTHORIZATION_STATUS_TIMEOUT_MS: 2000,
        EDGE_P5_ALLOW_INSECURE_HTTP: false,
        EDGE_P5_S2S_CLIENT_ID: 'edge-out',
        EDGE_P5_INBOUND_S2S_CLIENT_ID: 'p5-in',
      } as EnvironmentConfig,
      s2s,
    );
    const result = await adapter.verifyCurrentStatus({
      authorizationId: 'a',
      authorizationVersion: 1,
      correlationId: 'c',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
    if (result.outcome === 'UNAVAILABLE') {
      expect(result.reasonCode).toBe('P5_S2S_AUTH_FAILED');
    }
  });

  it('enforces shared global deadline across token + status call', async () => {
    (s2s.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (s2s.getAccessToken as ReturnType<typeof vi.fn>).mockImplementation(
      async (signal?: AbortSignal) => {
        await new Promise((r) => setTimeout(r, 80));
        if (signal?.aborted) {
          const err = new Error('aborted');
          err.name = 'AbortError';
          throw err;
        }
        return 'token';
      },
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init?: { signal?: AbortSignal }) => {
        await new Promise((r) => setTimeout(r, 80));
        if (init?.signal?.aborted) {
          const err = new Error('aborted');
          err.name = 'AbortError';
          throw err;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ outcome: 'ACTIVE' }),
        };
      }),
    );
    const adapter = new FailClosedP5AuthorizationStatusAdapter(
      {
        EDGE_P5_AUTHORIZATION_STATUS_URL: 'https://p5.example/status',
        EDGE_P5_AUTHORIZATION_STATUS_TIMEOUT_MS: 100,
        EDGE_P5_ALLOW_INSECURE_HTTP: false,
        EDGE_P5_S2S_CLIENT_ID: 'edge-out',
        EDGE_P5_INBOUND_S2S_CLIENT_ID: 'p5-in',
      } as EnvironmentConfig,
      s2s,
    );
    const result = await adapter.verifyCurrentStatus({
      authorizationId: 'a',
      authorizationVersion: 1,
      correlationId: 'c',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
    if (result.outcome === 'UNAVAILABLE') {
      expect(result.reasonCode).toBe('P5_STATUS_TIMEOUT');
    }
    expect(s2s.getAccessToken).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('returns UNAVAILABLE on P5 timeout (AbortError)', async () => {
    (s2s.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (s2s.getAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue('token');
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw abortErr;
      }),
    );
    const adapter = new FailClosedP5AuthorizationStatusAdapter(
      {
        EDGE_P5_AUTHORIZATION_STATUS_URL: 'https://p5.example/status',
        EDGE_P5_AUTHORIZATION_STATUS_TIMEOUT_MS: 2000,
        EDGE_P5_ALLOW_INSECURE_HTTP: false,
        EDGE_P5_S2S_CLIENT_ID: 'edge-out',
        EDGE_P5_INBOUND_S2S_CLIENT_ID: 'p5-in',
      } as EnvironmentConfig,
      s2s,
    );
    const result = await adapter.verifyCurrentStatus({
      authorizationId: 'a',
      authorizationVersion: 1,
      correlationId: 'c',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
    if (result.outcome === 'UNAVAILABLE') {
      expect(result.reasonCode).toBe('P5_STATUS_TIMEOUT');
    }
  });

  it('returns UNAVAILABLE when P5 is unreachable', async () => {
    (s2s.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (s2s.getAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue('token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );
    const adapter = new FailClosedP5AuthorizationStatusAdapter(
      {
        EDGE_P5_AUTHORIZATION_STATUS_URL: 'https://p5.example/status',
        EDGE_P5_AUTHORIZATION_STATUS_TIMEOUT_MS: 2000,
        EDGE_P5_ALLOW_INSECURE_HTTP: false,
        EDGE_P5_S2S_CLIENT_ID: 'edge-out',
        EDGE_P5_INBOUND_S2S_CLIENT_ID: 'p5-in',
      } as EnvironmentConfig,
      s2s,
    );
    const result = await adapter.verifyCurrentStatus({
      authorizationId: 'a',
      authorizationVersion: 1,
      correlationId: 'c',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
    if (result.outcome === 'UNAVAILABLE') {
      expect(result.reasonCode).toBe('P5_STATUS_NETWORK_ERROR');
    }
  });
});

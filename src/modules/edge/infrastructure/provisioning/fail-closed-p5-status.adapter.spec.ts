import { FailClosedP5AuthorizationStatusAdapter } from './fail-closed-p5-status.adapter.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';

describe('FailClosedP5AuthorizationStatusAdapter (OQ-04)', () => {
  it('returns UNAVAILABLE when status URL is not configured', async () => {
    const adapter = new FailClosedP5AuthorizationStatusAdapter({
      EDGE_P5_AUTHORIZATION_STATUS_TIMEOUT_MS: 2000,
    } as EnvironmentConfig);
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

  it('returns UNAVAILABLE on timeout', async () => {
    const adapter = new FailClosedP5AuthorizationStatusAdapter({
      EDGE_P5_AUTHORIZATION_STATUS_URL: 'http://127.0.0.1:1/status',
      EDGE_P5_AUTHORIZATION_STATUS_TIMEOUT_MS: 50,
    } as EnvironmentConfig);
    const result = await adapter.verifyCurrentStatus({
      authorizationId: 'a',
      authorizationVersion: 1,
      correlationId: 'c',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
  });
});

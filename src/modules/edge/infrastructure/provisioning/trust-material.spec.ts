import { loadProvisioningTrustMaterial, assertTrustMaterialConfigured } from './trust-material.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';

describe('loadProvisioningTrustMaterial', () => {
  it('leaves issuers empty when not configured (fail-closed)', () => {
    const trust = loadProvisioningTrustMaterial({} as EnvironmentConfig);
    expect(trust.allowedIssuers).toEqual([]);
    expect(trust.keys).toEqual([]);
    expect(() => assertTrustMaterialConfigured(trust)).toThrow('ALLOWED_ISSUERS_NOT_CONFIGURED');
  });

  it('parses keys and issuers', () => {
    const trust = loadProvisioningTrustMaterial({
      EDGE_P7_AUTHORIZATION_ALLOWED_ISSUERS: 'okapi.edge.p5, other',
      EDGE_P7_AUTHORIZATION_PUBLIC_KEYS_JSON: JSON.stringify([
        { keyId: 'k1', algorithm: 'EdDSA', publicKeyPem: 'PEM' },
      ]),
    } as EnvironmentConfig);
    expect(trust.allowedIssuers).toEqual(['okapi.edge.p5', 'other']);
    expect(trust.keys).toHaveLength(1);
    expect(() => assertTrustMaterialConfigured(trust)).not.toThrow();
  });
});

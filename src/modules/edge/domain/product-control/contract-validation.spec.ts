import { describe, expect, it } from 'vitest';
import {
  assertDiscoveryNotExpired,
  assertFingerprintMatches,
  assertProductIdMatches,
  evaluateContractCompatibility,
  isHttpSuccessProofOfCompatibility,
  parseDiscoveryDocument,
} from './contract-validation.js';
import { ProductControlErrorCode } from './product-control.types.js';

function validDoc(overrides: Record<string, unknown> = {}) {
  return {
    productId: 'prod-1',
    productCode: 'PHARMA',
    productControlId: 'pc-1',
    productControlVersion: '1.0.0',
    supportedProtocolVersions: ['1'],
    supportedContractVersions: ['1.0.0', '1.1.0'],
    supportedCapabilities: ['control.handshake'],
    supportedOperationTypes: ['handshake'],
    authenticationMethods: ['OAUTH2_CC'],
    signatureAlgorithms: ['HS256'],
    callbackSupport: true,
    idempotencySupport: true,
    correlationSupport: true,
    healthStatus: 'HEALTHY',
    contractFingerprint: 'fp-abc',
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
    ...overrides,
  };
}

describe('contract validation', () => {
  it('accepts a complete discovery document', () => {
    const result = parseDiscoveryDocument(validDoc());
    expect(result.ok).toBe(true);
  });

  it('rejects missing required fields', () => {
    const { productId: _, ...rest } = validDoc();
    const result = parseDiscoveryDocument(rest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(ProductControlErrorCode.INVALID_RESPONSE);
    }
  });

  it('detects expired discovery', () => {
    const doc = validDoc({
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    const parsed = parseDiscoveryDocument(doc);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(() => assertDiscoveryNotExpired(parsed.document)).toThrow();
    }
  });

  it('rejects productId mismatch', () => {
    const parsed = parseDiscoveryDocument(validDoc());
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(() => assertProductIdMatches('other', parsed.document)).toThrow();
    }
  });

  it('rejects fingerprint mismatch', () => {
    const parsed = parseDiscoveryDocument(validDoc());
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(() => assertFingerprintMatches('other-fp', parsed.document)).toThrow();
    }
  });

  it('evaluates contract version compatibility', () => {
    expect(
      evaluateContractCompatibility({
        requiredContractVersion: '1.0.0',
        supportedContractVersions: ['1.0.0', '1.1.0'],
      }).compatible,
    ).toBe(true);
    const bad = evaluateContractCompatibility({
      requiredContractVersion: '2.0.0',
      supportedContractVersions: ['1.0.0'],
    });
    expect(bad.compatible).toBe(false);
    if (!bad.compatible) {
      expect(bad.code).toBe(ProductControlErrorCode.CONTRACT_INCOMPATIBLE);
    }
  });

  it('never treats HTTP 200 as proof of compatibility', () => {
    expect(isHttpSuccessProofOfCompatibility(200)).toBe(false);
  });
});

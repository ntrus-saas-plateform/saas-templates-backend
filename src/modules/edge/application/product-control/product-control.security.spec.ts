import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  isRetryableProductControlError,
  isSecurityError,
} from '../../domain/product-control/error-classification.js';
import { ProductControlErrorCode } from '../../domain/product-control/product-control.types.js';
import { assertProductIdMatches } from '../../domain/product-control/contract-validation.js';
import { FakeCredentialProvider } from '../../infrastructure/product-control/credential-provider.adapter.js';
import { HttpProductControlClient } from '../../infrastructure/product-control/http-product-control.client.js';
import { SignatureService } from '../../infrastructure/product-control/signature.service.js';

const discovery = {
  productId: 'prod-expected',
  productCode: 'PHARMA',
  productControlId: 'pc-1',
  productControlVersion: '1.0.0',
  supportedProtocolVersions: ['1'],
  supportedContractVersions: ['1.0.0'],
  supportedCapabilities: ['control.handshake'],
  supportedOperationTypes: ['handshake'],
  authenticationMethods: ['HMAC_SIGNED'],
  signatureAlgorithms: ['HS256'],
  callbackSupport: true,
  idempotencySupport: true,
  correlationSupport: true,
  healthStatus: 'HEALTHY',
  contractFingerprint: 'fp-1',
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

function baseReq(overrides: Record<string, unknown> = {}) {
  return {
    endpointId: 'ep-1',
    baseUrl: 'https://pc.example.com/v1',
    apiVersion: 'v1',
    contractVersion: '1.0.0',
    credentialRef: 'cred-1',
    authProfile: 'HMAC_SIGNED',
    operationCode: 'handshake',
    requestId: '11111111-1111-4111-8111-111111111111',
    correlationId: '22222222-2222-4222-8222-222222222222',
    idempotencyKey: 'idem-1',
    ...overrides,
  };
}

describe('P7.5 product-control security', () => {
  it('rejects invalid signature', async () => {
    const creds = new FakeCredentialProvider();
    creds.seed('cred-1', 'HMAC_SIGNED', { hmacSecret: 'secret-a' });
    const sigs = new SignatureService(creds);
    const result = await sigs.verify({
      algorithm: 'HS256',
      payload: 'hello',
      signature: createHmac('sha256', 'wrong-secret').update('hello').digest('hex'),
      keyMaterialRef: 'cred-1',
      issuedAt: new Date().toISOString(),
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/mismatch/i);
  });

  it('rejects expired credentials', async () => {
    const creds = new FakeCredentialProvider();
    creds.seed('cred-expired', 'HMAC_SIGNED', {
      hmacSecret: 's',
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(creds.resolve('cred-expired', 'HMAC_SIGNED')).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it('blocks SSRF redirect to non-allowlisted host', async () => {
    const creds = new FakeCredentialProvider();
    creds.seed('cred-1', 'HMAC_SIGNED', { hmacSecret: 'secret' });
    const sigs = new SignatureService(creds);
    const fetchImpl = vi.fn(async () => {
      return new Response(null, {
        status: 302,
        headers: { Location: 'https://evil.example/steal' },
      });
    });
    const client = new HttpProductControlClient(creds, sigs, {
      fetchImpl: fetchImpl as never,
    });
    await expect(client.handshake(baseReq())).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(DomainError);
      const d = err as DomainError;
      expect(String(d.details[0]?.code)).toBe(ProductControlErrorCode.AUTHORIZATION_FAILED);
      expect(d.message).toMatch(/SSRF|non-allowlisted/i);
      return true;
    });
  });

  it('rejects non-HTTPS base_url (TLS)', async () => {
    const creds = new FakeCredentialProvider();
    creds.seed('cred-1', 'HMAC_SIGNED', { hmacSecret: 'secret' });
    const sigs = new SignatureService(creds);
    const client = new HttpProductControlClient(creds, sigs, {
      fetchImpl: vi.fn() as never,
    });
    await expect(
      client.handshake(baseReq({ baseUrl: 'http://pc.example.com' })),
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(DomainError);
      expect(String((err as DomainError).details[0]?.code)).toBe(
        ProductControlErrorCode.TLS_VALIDATION_FAILED,
      );
      return true;
    });
  });

  it('detects product id mismatch', () => {
    expect(() =>
      assertProductIdMatches('prod-expected', {
        ...discovery,
        productId: 'prod-other',
      }),
    ).toThrow(DomainError);
  });

  it('marks security errors as not retryable', () => {
    for (const code of [
      ProductControlErrorCode.AUTHENTICATION_FAILED,
      ProductControlErrorCode.AUTHORIZATION_FAILED,
      ProductControlErrorCode.TLS_VALIDATION_FAILED,
      ProductControlErrorCode.SIGNATURE_INVALID,
      ProductControlErrorCode.REQUEST_EXPIRED,
    ]) {
      expect(isSecurityError(code)).toBe(true);
      expect(isRetryableProductControlError(code)).toBe(false);
    }
  });

  it('accepts valid HMAC signature within skew', async () => {
    const creds = new FakeCredentialProvider();
    creds.seed('cred-1', 'HMAC_SIGNED', { hmacSecret: 'secret-a' });
    const sigs = new SignatureService(creds);
    const payload = '{"ok":true}';
    const signature = createHmac('sha256', 'secret-a').update(payload).digest('hex');
    const result = await sigs.verify({
      algorithm: 'HS256',
      payload,
      signature,
      keyMaterialRef: 'cred-1',
      issuedAt: new Date().toISOString(),
    });
    expect(result).toEqual({ valid: true });
  });
});

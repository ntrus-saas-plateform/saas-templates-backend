import { generateKeyPairSync, sign as cryptoSign, createPrivateKey } from 'node:crypto';
import {
  canonicalizeAuthorizationPayload,
  computePayloadDigest,
  verifyAuthorizationIntegrity,
} from './authorization-verification.js';
import {
  AuthorizationVerificationStatus,
  type CanonicalProvisioningAuthorization,
  P7_AUTHORIZATION_AUDIENCE,
  P7_AUTHORIZATION_SCHEMA_VERSION,
} from './provisioning.types.js';

function baseAuth(
  overrides: Partial<CanonicalProvisioningAuthorization> = {},
): CanonicalProvisioningAuthorization {
  const issued = new Date().toISOString();
  return {
    authorization_id: '11111111-1111-4111-8111-111111111111',
    authorization_version: 1,
    schema_version: P7_AUTHORIZATION_SCHEMA_VERSION,
    authorization_type: 'PROVISION',
    operation: 'PROVISION_TENANT',
    account_id: '22222222-2222-4222-8222-222222222222',
    subscription_id: '33333333-3333-4333-8333-333333333333',
    product_id: '44444444-4444-4444-8444-444444444444',
    product_tenant_id: null,
    correlation_id: '55555555-5555-4555-8555-555555555555',
    causation_id: null,
    idempotency_key: 'idem-key-001234',
    decision: 'ALLOW',
    authorization_status: 'ACTIVE',
    decision_reason_code: null,
    decision_timestamp: issued,
    issued_at: issued,
    not_before: null,
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    entitlement_snapshot_reference: 'ent-snap-1',
    entitlement_version: '1',
    issuer: 'okapi.edge.p5',
    audience: P7_AUTHORIZATION_AUDIENCE,
    key_id: 'test-ed25519-1',
    signature_algorithm: 'EdDSA',
    signature: null,
    payload_digest: '',
    issued_by_service_identity: 'p5-authz-service',
    revocation_status: 'NOT_REVOKED',
    ...overrides,
  };
}

describe('authorization-verification (OQ-01)', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const keys = [{ keyId: 'test-ed25519-1', algorithm: 'EdDSA', publicKeyPem }];
  const allowedIssuers = ['okapi.edge.p5'];

  function sign(auth: CanonicalProvisioningAuthorization) {
    const canonical = canonicalizeAuthorizationPayload(auth);
    const digest = computePayloadDigest(canonical);
    const withDigest = { ...auth, payload_digest: digest };
    const toSign = canonicalizeAuthorizationPayload(withDigest);
    const sig = cryptoSign(null, Buffer.from(toSign), createPrivateKey(privateKeyPem));
    return { ...withDigest, signature: sig.toString('base64') };
  }

  it('accepts valid EdDSA signature + digest', () => {
    const auth = sign(baseAuth());
    const result = verifyAuthorizationIntegrity({ authorization: auth, keys, allowedIssuers });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(AuthorizationVerificationStatus.VERIFIED);
  });

  it('rejects missing issuer allow-list', () => {
    const auth = sign(baseAuth());
    const result = verifyAuthorizationIntegrity({ authorization: auth, keys, allowedIssuers: [] });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('ALLOWED_ISSUERS_NOT_CONFIGURED');
  });

  it('rejects digest mismatch', () => {
    const auth = sign(baseAuth());
    const tampered = { ...auth, payload_digest: '0'.repeat(64) };
    const result = verifyAuthorizationIntegrity({
      authorization: tampered,
      keys,
      allowedIssuers,
    });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('DIGEST_MISMATCH');
  });

  it('rejects unknown key id', () => {
    const rebuilt = sign(baseAuth({ key_id: 'missing' }));
    const result = verifyAuthorizationIntegrity({
      authorization: rebuilt,
      keys,
      allowedIssuers,
    });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('UNKNOWN_KEY_ID');
  });

  it('rejects algorithm mismatch for known key id', () => {
    const auth = sign(baseAuth());
    const altered = { ...auth, signature_algorithm: 'RS256' };
    const digest = computePayloadDigest(canonicalizeAuthorizationPayload(altered));
    const result = verifyAuthorizationIntegrity({
      authorization: { ...altered, payload_digest: digest },
      keys,
      allowedIssuers,
    });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('ALGORITHM_MISMATCH');
  });

  it('rejects invalid audience', () => {
    const auth = sign(baseAuth({ audience: 'wrong.audience' }));
    const result = verifyAuthorizationIntegrity({ authorization: auth, keys, allowedIssuers });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('INVALID_AUDIENCE');
  });

  it('rejects expired authorization', () => {
    const auth = sign(
      baseAuth({ expires_at: new Date(Date.now() - 120_000).toISOString() }),
    );
    const result = verifyAuthorizationIntegrity({ authorization: auth, keys, allowedIssuers });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(AuthorizationVerificationStatus.EXPIRED);
  });

  it('rejects revoked authorization', () => {
    const auth = sign(baseAuth({ revocation_status: 'REVOKED' }));
    const result = verifyAuthorizationIntegrity({ authorization: auth, keys, allowedIssuers });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(AuthorizationVerificationStatus.REVOKED);
  });

  it('rejects digest-only algorithm in production path', () => {
    const auth = baseAuth({
      signature_algorithm: 'none_digest_only',
      signature: null,
    });
    const digest = computePayloadDigest(canonicalizeAuthorizationPayload(auth));
    const result = verifyAuthorizationIntegrity({
      authorization: { ...auth, payload_digest: digest },
      keys,
      allowedIssuers,
    });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('DIGEST_ONLY_NOT_ALLOWED_IN_PRODUCTION');
  });

  it('rejects invalid issuer when allow-list set', () => {
    const auth = sign(baseAuth({ issuer: 'evil.issuer' }));
    const result = verifyAuthorizationIntegrity({ authorization: auth, keys, allowedIssuers });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('INVALID_ISSUER');
  });

  it('rejects invalid signature', () => {
    const auth = sign(baseAuth());
    const bad = { ...auth, signature: Buffer.from('not-a-real-sig').toString('base64') };
    const result = verifyAuthorizationIntegrity({
      authorization: bad,
      keys,
      allowedIssuers,
    });
    expect(result.ok).toBe(false);
    expect(['INVALID_SIGNATURE', 'SIGNATURE_VERIFICATION_ERROR']).toContain(
      result.reasonCode,
    );
  });
});

import { generateKeyPairSync, sign as cryptoSign, createPrivateKey } from 'node:crypto';
import { computePayloadDigest } from './authorization-verification.js';
import {
  canonicalizeRevocationPayload,
  verifyRevocationEventIntegrity,
  type CanonicalRevocationEvent,
  P7_REVOCATION_EVENT_NAME,
  P7_REVOCATION_SCHEMA_VERSION,
  P7_REVOCATION_CLOCK_SKEW_SECONDS,
} from './revocation-event.js';

describe('verifyRevocationEventIntegrity', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const keys = [{ keyId: 'k1', algorithm: 'EdDSA', publicKeyPem }];
  const issuers = ['okapi.edge.p5'];

  function sign(
    event: Omit<CanonicalRevocationEvent, 'payload_digest' | 'signature'>,
  ): CanonicalRevocationEvent {
    const draft = { ...event, payload_digest: '', signature: null } as CanonicalRevocationEvent;
    const payload_digest = computePayloadDigest(canonicalizeRevocationPayload(draft));
    const withDigest = { ...event, payload_digest, signature: null } as CanonicalRevocationEvent;
    const toSign = canonicalizeRevocationPayload(withDigest);
    const signature = cryptoSign(null, Buffer.from(toSign), createPrivateKey(privateKeyPem)).toString(
      'base64',
    );
    return { ...event, payload_digest, signature };
  }

  const base = (): Omit<CanonicalRevocationEvent, 'payload_digest' | 'signature'> => ({
    event_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    event_name: P7_REVOCATION_EVENT_NAME,
    schema_version: P7_REVOCATION_SCHEMA_VERSION,
    authorization_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    authorization_version: 1,
    revocation_version: 2,
    revoked_at: new Date().toISOString(),
    issuer: 'okapi.edge.p5',
    audience: 'okapi.edge.p7',
    key_id: 'k1',
    signature_algorithm: 'EdDSA',
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
  });

  it('accepts a valid signed revocation event', () => {
    const event = sign(base());
    const result = verifyRevocationEventIntegrity({ event, keys, allowedIssuers: issuers });
    expect(result.ok).toBe(true);
  });

  it('rejects bad issuer', () => {
    const event = sign({ ...base(), issuer: 'evil' });
    const result = verifyRevocationEventIntegrity({ event, keys, allowedIssuers: issuers });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('INVALID_ISSUER');
  });

  it('rejects bad audience', () => {
    const event = sign({ ...base(), audience: 'wrong' });
    const result = verifyRevocationEventIntegrity({ event, keys, allowedIssuers: issuers });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('INVALID_AUDIENCE');
  });

  it('rejects algorithm mismatch vs configured key', () => {
    const event = sign(base());
    const result = verifyRevocationEventIntegrity({
      event: { ...event, signature_algorithm: 'RS256' },
      keys,
      allowedIssuers: issuers,
    });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('ALGORITHM_MISMATCH');
  });

  it('rejects unknown key', () => {
    const event = sign({ ...base(), key_id: 'missing' });
    const result = verifyRevocationEventIntegrity({ event, keys, allowedIssuers: issuers });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('UNKNOWN_KEY_ID');
  });

  it('rejects empty issuer allow-list', () => {
    const event = sign(base());
    const result = verifyRevocationEventIntegrity({ event, keys, allowedIssuers: [] });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('ALLOWED_ISSUERS_NOT_CONFIGURED');
  });

  it('rejects invalid signature', () => {
    const event = sign(base());
    const result = verifyRevocationEventIntegrity({
      event: { ...event, signature: Buffer.from('forged').toString('base64') },
      keys,
      allowedIssuers: issuers,
    });
    expect(result.ok).toBe(false);
    expect(['INVALID_SIGNATURE', 'SIGNATURE_VERIFICATION_ERROR']).toContain(result.reasonCode);
  });

  it('rejects expired event', () => {
    const event = sign({
      ...base(),
      issued_at: new Date(Date.now() - 3600_000).toISOString(),
      expires_at: new Date(Date.now() - 120_000).toISOString(),
    });
    const result = verifyRevocationEventIntegrity({ event, keys, allowedIssuers: issuers });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('EVENT_EXPIRED');
  });

  it('rejects issued_at in the future beyond clock skew', () => {
    const event = sign({
      ...base(),
      issued_at: new Date(Date.now() + (P7_REVOCATION_CLOCK_SKEW_SECONDS + 120) * 1000).toISOString(),
      expires_at: new Date(Date.now() + (P7_REVOCATION_CLOCK_SKEW_SECONDS + 3600) * 1000).toISOString(),
    });
    const result = verifyRevocationEventIntegrity({ event, keys, allowedIssuers: issuers });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('ISSUED_AT_IN_FUTURE');
  });

  it('rejects missing expires_at', () => {
    const event = sign({ ...base(), expires_at: '' as unknown as string });
    const result = verifyRevocationEventIntegrity({ event, keys, allowedIssuers: issuers });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('EXPIRES_AT_REQUIRED');
  });

  it('rejects invalid issued_at', () => {
    const event = sign({ ...base(), issued_at: 'not-a-date' });
    const result = verifyRevocationEventIntegrity({ event, keys, allowedIssuers: issuers });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('INVALID_ISSUED_AT');
  });

  it('accepts rotated key when key_id matches active material', () => {
    const rotated = generateKeyPairSync('ed25519');
    const rotatedPem = rotated.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const rotatedPriv = rotated.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const eventBase = { ...base(), key_id: 'k2' };
    const draft = {
      ...eventBase,
      payload_digest: '',
      signature: null,
    } as CanonicalRevocationEvent;
    const payload_digest = computePayloadDigest(canonicalizeRevocationPayload(draft));
    const withDigest = { ...eventBase, payload_digest, signature: null } as CanonicalRevocationEvent;
    const signature = cryptoSign(
      null,
      Buffer.from(canonicalizeRevocationPayload(withDigest)),
      createPrivateKey(rotatedPriv),
    ).toString('base64');
    const event = { ...eventBase, payload_digest, signature };
    const result = verifyRevocationEventIntegrity({
      event,
      keys: [...keys, { keyId: 'k2', algorithm: 'EdDSA', publicKeyPem: rotatedPem }],
      allowedIssuers: issuers,
    });
    expect(result.ok).toBe(true);
  });
});

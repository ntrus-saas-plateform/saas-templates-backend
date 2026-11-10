import { createPublicKey, createVerify, verify as cryptoVerify } from 'node:crypto';
import { computePayloadDigest } from './authorization-verification.js';
import type { PublicKeyMaterial } from './authorization-verification.js';
import {
  AuthorizationVerificationStatus,
  type AuthorizationVerificationResult,
  P7_AUTHORIZATION_AUDIENCE,
  SignatureAlgorithm,
} from './provisioning.types.js';

export const P7_REVOCATION_EVENT_AUDIENCE = 'okapi.edge.p7' as const;
export const P7_REVOCATION_EVENT_NAME =
  'subscription.provisioning.authorization.revoked.v1' as const;
export const P7_REVOCATION_SCHEMA_VERSION = 'p5.provisioning_revocation.v1' as const;

/** Explicit clock skew for issued_at / expires_at checks (seconds). */
export const P7_REVOCATION_CLOCK_SKEW_SECONDS = 60;

/** Maximum event lifetime from issued_at to expires_at (anti-replay window bound). */
export const P7_REVOCATION_MAX_TTL_SECONDS = 24 * 3600;

export type CanonicalRevocationEvent = {
  readonly event_id: string;
  readonly event_name: string;
  readonly schema_version: string;
  readonly authorization_id: string;
  readonly authorization_version?: number | null;
  readonly revocation_version: number;
  readonly revoked_at: string;
  readonly revocation_reason_code?: string | null;
  readonly revocation_reference?: string | null;
  readonly issuer: string;
  readonly audience: string;
  readonly key_id: string;
  readonly signature_algorithm: string;
  readonly signature?: string | null;
  readonly payload_digest: string;
  readonly issued_at: string;
  /** Required by canonical contract — signed but temporally invalid events are rejected. */
  readonly expires_at: string;
  readonly correlation_id?: string | null;
};

export function canonicalizeRevocationPayload(event: CanonicalRevocationEvent): string {
  const clone: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(event)) {
    if (k === 'signature' || k === 'payload_digest') continue;
    if (v === undefined) continue;
    clone[k] = v;
  }
  const keys = Object.keys(clone).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(clone[k])}`).join(',')}}`;
}

/**
 * Verify a P5 revocation event (Option C): issuer allow-list, audience, temporal validity,
 * digest, key/alg match, signature. Operator paths must never call this with forged identity alone.
 */
export function verifyRevocationEventIntegrity(input: {
  event: CanonicalRevocationEvent;
  keys: readonly PublicKeyMaterial[];
  allowedIssuers: readonly string[];
  now?: Date;
  clockSkewSeconds?: number;
}): AuthorizationVerificationResult {
  const event = input.event;
  const now = input.now ?? new Date();
  const skewMs = (input.clockSkewSeconds ?? P7_REVOCATION_CLOCK_SKEW_SECONDS) * 1000;

  if (!event.event_id?.trim()) return reject('EVENT_ID_MISSING');
  if (event.event_name !== P7_REVOCATION_EVENT_NAME) {
    return reject('UNSUPPORTED_EVENT_NAME', { event_name: event.event_name });
  }
  if (event.schema_version !== P7_REVOCATION_SCHEMA_VERSION) {
    return reject('UNSUPPORTED_SCHEMA', { schema_version: event.schema_version });
  }
  if (
    event.audience !== P7_REVOCATION_EVENT_AUDIENCE &&
    event.audience !== P7_AUTHORIZATION_AUDIENCE
  ) {
    return reject('INVALID_AUDIENCE', { audience: event.audience });
  }
  if (!input.allowedIssuers.length) return reject('ALLOWED_ISSUERS_NOT_CONFIGURED');
  if (!input.allowedIssuers.includes(event.issuer)) {
    return reject('INVALID_ISSUER', { issuer: event.issuer });
  }
  if (!Number.isInteger(event.revocation_version) || event.revocation_version < 1) {
    return reject('INVALID_REVOCATION_VERSION');
  }
  if (!event.authorization_id) return reject('AUTHORIZATION_ID_MISSING');

  if (event.signature_algorithm === SignatureAlgorithm.NONE_DIGEST_ONLY) {
    return reject('DIGEST_ONLY_NOT_ALLOWED_IN_PRODUCTION');
  }
  if (!input.keys.length) return reject('TRUST_KEYS_NOT_CONFIGURED');
  const key = input.keys.find((k) => k.keyId === event.key_id);
  if (!key) return reject('UNKNOWN_KEY_ID', { key_id: event.key_id });
  if (key.algorithm !== event.signature_algorithm) {
    return reject('ALGORITHM_MISMATCH', {
      announced: event.signature_algorithm,
      configured: key.algorithm,
    });
  }

  const issuedAt = Date.parse(event.issued_at);
  if (Number.isNaN(issuedAt)) return reject('INVALID_ISSUED_AT');
  if (issuedAt > now.getTime() + skewMs) {
    return reject('ISSUED_AT_IN_FUTURE', {
      issued_at: event.issued_at,
      clockSkewSeconds: input.clockSkewSeconds ?? P7_REVOCATION_CLOCK_SKEW_SECONDS,
    });
  }

  if (!event.expires_at?.trim()) return reject('EXPIRES_AT_REQUIRED');
  const exp = Date.parse(event.expires_at);
  if (Number.isNaN(exp)) return reject('INVALID_EXPIRES_AT');
  if (exp <= issuedAt) {
    return reject('EXPIRES_AT_BEFORE_ISSUED_AT', {
      issued_at: event.issued_at,
      expires_at: event.expires_at,
    });
  }
  if (exp - issuedAt > P7_REVOCATION_MAX_TTL_SECONDS * 1000) {
    return reject('EXPIRES_AT_TTL_EXCEEDED', {
      maxTtlSeconds: P7_REVOCATION_MAX_TTL_SECONDS,
    });
  }
  if (now.getTime() - skewMs > exp) {
    return reject('EVENT_EXPIRED', { expires_at: event.expires_at });
  }

  const canonical = canonicalizeRevocationPayload(event);
  const digest = computePayloadDigest(canonical);
  if (digest !== event.payload_digest) {
    return reject('DIGEST_MISMATCH', { expected: digest });
  }
  if (!event.signature) return reject('SIGNATURE_MISSING');

  try {
    const signature = Buffer.from(event.signature, 'base64');
    const data = Buffer.from(canonical, 'utf8');
    let ok = false;
    if (event.signature_algorithm === SignatureAlgorithm.EdDSA) {
      ok = cryptoVerify(null, data, createPublicKey(key.publicKeyPem), signature);
    } else {
      const verifier = createVerify(
        event.signature_algorithm === SignatureAlgorithm.ES256 ? 'SHA256' : 'RSA-SHA256',
      );
      verifier.update(data);
      verifier.end();
      ok = verifier.verify(createPublicKey(key.publicKeyPem), signature);
    }
    if (!ok) return reject('INVALID_SIGNATURE');
  } catch (err) {
    return reject('SIGNATURE_VERIFICATION_ERROR', {
      message: err instanceof Error ? err.message : 'unknown',
    });
  }

  return {
    ok: true,
    status: AuthorizationVerificationStatus.VERIFIED,
    reasonCode: null,
  };
}

function reject(
  reasonCode: string,
  details?: Record<string, unknown>,
): AuthorizationVerificationResult {
  return {
    ok: false,
    status: AuthorizationVerificationStatus.REJECTED,
    reasonCode,
    details,
  };
}

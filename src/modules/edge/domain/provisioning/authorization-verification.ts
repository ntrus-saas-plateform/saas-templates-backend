import { createHash, createPublicKey, createVerify, verify as cryptoVerify } from 'node:crypto';
import {
  AuthorizationVerificationStatus,
  type AuthorizationVerificationResult,
  type CanonicalProvisioningAuthorization,
  P7_AUTHORIZATION_AUDIENCE,
  P7_AUTHORIZATION_SCHEMA_VERSION,
  ProvisioningDecision,
  ProvisioningEnvironmentSlot,
  RevocationStatus,
  SignatureAlgorithm,
} from './provisioning.types.js';

/** Fields excluded from the signed/digested canonical payload. */
const DIGEST_EXCLUDED = new Set(['signature', 'payload_digest']);

export function canonicalizeAuthorizationPayload(
  auth: CanonicalProvisioningAuthorization,
): string {
  const clone: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(auth)) {
    if (DIGEST_EXCLUDED.has(k)) continue;
    if (v === undefined) continue;
    clone[k] = v;
  }
  return stableStringify(clone);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function computePayloadDigest(canonicalJson: string): string {
  return createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
}

export type PublicKeyMaterial = {
  readonly keyId: string;
  readonly algorithm: SignatureAlgorithm | string;
  readonly publicKeyPem: string;
};

export function verifyAuthorizationIntegrity(input: {
  authorization: CanonicalProvisioningAuthorization;
  keys: readonly PublicKeyMaterial[];
  now?: Date;
  allowedIssuers?: readonly string[];
  clockSkewSeconds?: number;
}): AuthorizationVerificationResult {
  const auth = input.authorization;
  const now = input.now ?? new Date();
  const skewMs = (input.clockSkewSeconds ?? 60) * 1000;

  if (auth.schema_version !== P7_AUTHORIZATION_SCHEMA_VERSION) {
    return reject('UNSUPPORTED_SCHEMA', { schema_version: auth.schema_version });
  }
  if (auth.audience !== P7_AUTHORIZATION_AUDIENCE) {
    return reject('INVALID_AUDIENCE', { audience: auth.audience });
  }
  if (input.allowedIssuers && input.allowedIssuers.length > 0) {
    if (!input.allowedIssuers.includes(auth.issuer)) {
      return reject('INVALID_ISSUER', { issuer: auth.issuer });
    }
  }
  if (auth.decision !== ProvisioningDecision.ALLOW) {
    return reject('DECISION_DENY', { decision: auth.decision });
  }
  if (auth.revocation_status === RevocationStatus.REVOKED) {
    return {
      ok: false,
      status: AuthorizationVerificationStatus.REVOKED,
      reasonCode: 'AUTHORIZATION_REVOKED',
    };
  }
  if (
    auth.authorization_status === 'REVOKED' ||
    auth.authorization_status === 'EXPIRED' ||
    auth.authorization_status === 'SUPERSEDED'
  ) {
    return {
      ok: false,
      status:
        auth.authorization_status === 'EXPIRED'
          ? AuthorizationVerificationStatus.EXPIRED
          : AuthorizationVerificationStatus.REVOKED,
      reasonCode: `AUTHORIZATION_STATUS_${auth.authorization_status}`,
    };
  }

  const issuedAt = Date.parse(auth.issued_at);
  if (Number.isNaN(issuedAt)) {
    return reject('INVALID_ISSUED_AT');
  }
  if (auth.not_before) {
    const nbf = Date.parse(auth.not_before);
    if (Number.isNaN(nbf) || now.getTime() + skewMs < nbf) {
      return reject('NOT_YET_VALID', { not_before: auth.not_before });
    }
  }
  if (auth.expires_at) {
    const exp = Date.parse(auth.expires_at);
    if (Number.isNaN(exp) || now.getTime() - skewMs > exp) {
      return {
        ok: false,
        status: AuthorizationVerificationStatus.EXPIRED,
        reasonCode: 'AUTHORIZATION_EXPIRED',
        details: { expires_at: auth.expires_at },
      };
    }
  }

  const canonical = canonicalizeAuthorizationPayload(auth);
  const digest = computePayloadDigest(canonical);
  if (digest !== auth.payload_digest) {
    return reject('DIGEST_MISMATCH', { expected: digest });
  }

  const algorithm = auth.signature_algorithm as SignatureAlgorithm;
  if (algorithm === SignatureAlgorithm.NONE_DIGEST_ONLY) {
    // Production must not accept digest-only without residual-risk acceptance.
    // Fail-closed by default for Option C.
    return reject('DIGEST_ONLY_NOT_ALLOWED_IN_PRODUCTION');
  }

  const key = input.keys.find((k) => k.keyId === auth.key_id);
  if (!key) {
    return reject('UNKNOWN_KEY_ID', { key_id: auth.key_id });
  }
  if (!auth.signature) {
    return reject('SIGNATURE_MISSING');
  }

  try {
    const ok = verifyAsymmetricSignature({
      algorithm,
      publicKeyPem: key.publicKeyPem,
      canonicalJson: canonical,
      signatureB64: auth.signature,
    });
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

function verifyAsymmetricSignature(input: {
  algorithm: SignatureAlgorithm | string;
  publicKeyPem: string;
  canonicalJson: string;
  signatureB64: string;
}): boolean {
  const signature = Buffer.from(input.signatureB64, 'base64');
  const data = Buffer.from(input.canonicalJson, 'utf8');

  if (input.algorithm === SignatureAlgorithm.EdDSA) {
    const key = createPublicKey(input.publicKeyPem);
    return cryptoVerify(null, data, key, signature);
  }

  const verifier = createVerify(
    input.algorithm === SignatureAlgorithm.ES256 ? 'SHA256' : 'RSA-SHA256',
  );
  verifier.update(data);
  verifier.end();
  const key = createPublicKey(input.publicKeyPem);
  return verifier.verify(key, signature);
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

export function parseEnvironmentSlot(
  value: string | null | undefined,
): ProvisioningEnvironmentSlot {
  if (!value) return ProvisioningEnvironmentSlot.PROD;
  if (Object.values(ProvisioningEnvironmentSlot).includes(value as ProvisioningEnvironmentSlot)) {
    return value as ProvisioningEnvironmentSlot;
  }
  throw new Error(`UNSUPPORTED_ENVIRONMENT_SLOT:${value}`);
}

export function assertSlotEntitlement(input: {
  slot: ProvisioningEnvironmentSlot;
  slotEntitled?: boolean | null;
}): AuthorizationVerificationResult | null {
  if (input.slot === ProvisioningEnvironmentSlot.PROD) {
    return null;
  }
  if (input.slotEntitled !== true) {
    return reject('SLOT_ENTITLEMENT_REQUIRED', { slot: input.slot });
  }
  return null;
}

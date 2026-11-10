import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { CredentialProviderPort } from '../../domain/product-control/credential-provider.port.js';
import type {
  SignatureVerifierPort,
  SignatureVerifyInput,
  SignatureVerifyResult,
} from '../../domain/product-control/signature-verifier.port.js';

const DEFAULT_SKEW_MS = 5 * 60 * 1000;

/**
 * HMAC / digest verification for Product Control request/response/callback signatures.
 * Key material is resolved via opaque credential_ref — never read from PostgreSQL plaintext.
 */
export class SignatureService implements SignatureVerifierPort {
  constructor(private readonly credentials: CredentialProviderPort) {}

  digest(payload: string | Buffer): string {
    return createHash('sha256').update(payload).digest('hex');
  }

  async verify(input: SignatureVerifyInput): Promise<SignatureVerifyResult> {
    if (input.issuedAt) {
      const issued = Date.parse(input.issuedAt);
      if (Number.isNaN(issued)) {
        return { valid: false, reason: 'issuedAt is not a valid timestamp' };
      }
      const skew = input.maxSkewMs ?? DEFAULT_SKEW_MS;
      const now = Date.now();
      if (Math.abs(now - issued) > skew) {
        return { valid: false, reason: 'issuedAt outside allowed skew / expired' };
      }
    }

    const resolved = await this.credentials.resolve(input.keyMaterialRef, 'HMAC_SIGNED');
    const secret = resolved.material.hmacSecret;
    if (!secret) {
      return { valid: false, reason: 'No HMAC secret for credential ref' };
    }
    if (resolved.material.expiresAt && resolved.material.expiresAt.getTime() <= Date.now()) {
      return { valid: false, reason: 'Credential expired' };
    }

    const alg = input.algorithm.toUpperCase();
    if (alg !== 'HS256' && alg !== 'HMAC-SHA256' && alg !== 'SHA256') {
      return { valid: false, reason: `Unsupported signature algorithm ${input.algorithm}` };
    }

    const expected = createHmac('sha256', secret).update(input.payload).digest('hex');
    const provided = normalizeHex(input.signature);
    if (!provided || provided.length !== expected.length) {
      return { valid: false, reason: 'Signature length mismatch' };
    }
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(provided, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { valid: false, reason: 'Signature mismatch' };
    }
    return { valid: true };
  }

  /** Helper for outbound signing (tests / client). */
  signHmac(secret: string, payload: string | Buffer): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }
}

function normalizeHex(sig: string): string {
  const trimmed = sig.trim().replace(/^sha256=/i, '');
  if (/^[0-9a-f]+$/i.test(trimmed)) return trimmed.toLowerCase();
  try {
    return Buffer.from(trimmed, 'base64').toString('hex');
  } catch {
    return '';
  }
}

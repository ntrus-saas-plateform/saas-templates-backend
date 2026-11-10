export const SIGNATURE_VERIFIER_PORT = Symbol('SIGNATURE_VERIFIER_PORT');

export type SignatureVerifyInput = {
  algorithm: string;
  payload: string | Buffer;
  signature: string;
  keyMaterialRef: string;
  issuedAt?: string;
  maxSkewMs?: number;
};

export type SignatureVerifyResult =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Verifies request/response and callback signatures.
 * Rejects expired / replayed messages via issuedAt + skew window.
 */
export interface SignatureVerifierPort {
  verify(input: SignatureVerifyInput): Promise<SignatureVerifyResult>;
  digest(payload: string | Buffer): string;
}

import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ProductControlDiscoveryDocument } from './product-control.types.js';
import { ProductControlErrorCode } from './product-control.types.js';

const REQUIRED_DISCOVERY_FIELDS: readonly (keyof ProductControlDiscoveryDocument)[] = [
  'productId',
  'productCode',
  'productControlId',
  'productControlVersion',
  'supportedProtocolVersions',
  'supportedContractVersions',
  'supportedCapabilities',
  'supportedOperationTypes',
  'authenticationMethods',
  'signatureAlgorithms',
  'callbackSupport',
  'idempotencySupport',
  'correlationSupport',
  'healthStatus',
  'contractFingerprint',
  'issuedAt',
  'expiresAt',
];

export type ContractValidationResult =
  | { ok: true; document: ProductControlDiscoveryDocument }
  | {
      ok: false;
      code: ProductControlErrorCode;
      reasons: string[];
    };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

export function parseDiscoveryDocument(raw: unknown): ContractValidationResult {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      code: ProductControlErrorCode.INVALID_RESPONSE,
      reasons: ['Discovery document must be a non-null object'],
    };
  }
  const obj = raw as Record<string, unknown>;
  const missing: string[] = [];
  for (const field of REQUIRED_DISCOVERY_FIELDS) {
    if (obj[field] === undefined || obj[field] === null) missing.push(field);
  }
  if (missing.length > 0) {
    return {
      ok: false,
      code: ProductControlErrorCode.INVALID_RESPONSE,
      reasons: missing.map((f) => `Missing required field: ${f}`),
    };
  }

  const reasons: string[] = [];
  if (!isNonEmptyString(obj.productId)) reasons.push('productId must be a non-empty string');
  if (!isNonEmptyString(obj.productCode)) reasons.push('productCode must be a non-empty string');
  if (!isNonEmptyString(obj.productControlId)) {
    reasons.push('productControlId must be a non-empty string');
  }
  if (!isNonEmptyString(obj.productControlVersion)) {
    reasons.push('productControlVersion must be a non-empty string');
  }
  if (!isNonEmptyString(obj.contractFingerprint)) {
    reasons.push('contractFingerprint must be a non-empty string');
  }
  if (!isNonEmptyString(obj.issuedAt)) reasons.push('issuedAt must be a non-empty string');
  if (!isNonEmptyString(obj.expiresAt)) reasons.push('expiresAt must be a non-empty string');
  if (!isStringArray(obj.supportedProtocolVersions)) {
    reasons.push('supportedProtocolVersions must be string[]');
  }
  if (!isStringArray(obj.supportedContractVersions)) {
    reasons.push('supportedContractVersions must be string[]');
  }
  if (!isStringArray(obj.supportedCapabilities)) {
    reasons.push('supportedCapabilities must be string[]');
  }
  if (!isStringArray(obj.supportedOperationTypes)) {
    reasons.push('supportedOperationTypes must be string[]');
  }
  if (!isStringArray(obj.authenticationMethods)) {
    reasons.push('authenticationMethods must be string[]');
  }
  if (!isStringArray(obj.signatureAlgorithms)) {
    reasons.push('signatureAlgorithms must be string[]');
  }
  if (typeof obj.callbackSupport !== 'boolean') reasons.push('callbackSupport must be boolean');
  if (typeof obj.idempotencySupport !== 'boolean') {
    reasons.push('idempotencySupport must be boolean');
  }
  if (typeof obj.correlationSupport !== 'boolean') {
    reasons.push('correlationSupport must be boolean');
  }
  if (!isNonEmptyString(obj.healthStatus)) reasons.push('healthStatus must be a non-empty string');

  if (reasons.length > 0) {
    return { ok: false, code: ProductControlErrorCode.INVALID_RESPONSE, reasons };
  }

  return { ok: true, document: obj as unknown as ProductControlDiscoveryDocument };
}

export function assertDiscoveryNotExpired(
  document: ProductControlDiscoveryDocument,
  now: Date = new Date(),
): void {
  const expires = Date.parse(document.expiresAt);
  if (Number.isNaN(expires) || expires <= now.getTime()) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Product Control discovery response is expired',
      [{ expiresAt: document.expiresAt, code: ProductControlErrorCode.REQUEST_EXPIRED }],
    );
  }
}

export function assertProductIdMatches(
  expectedProductId: string,
  document: ProductControlDiscoveryDocument,
): void {
  if (document.productId !== expectedProductId) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Discovery productId does not match endpoint product',
      [
        {
          expectedProductId,
          actualProductId: document.productId,
          code: ProductControlErrorCode.CONTRACT_INCOMPATIBLE,
        },
      ],
    );
  }
}

export function assertFingerprintMatches(
  expectedFingerprint: string | null | undefined,
  document: ProductControlDiscoveryDocument,
): void {
  if (!expectedFingerprint) return;
  if (document.contractFingerprint !== expectedFingerprint) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Contract fingerprint mismatch',
      [
        {
          expectedFingerprint,
          actualFingerprint: document.contractFingerprint,
          code: ProductControlErrorCode.SIGNATURE_INVALID,
        },
      ],
    );
  }
}

export type ContractCompatibilityInput = {
  requiredContractVersion: string;
  supportedContractVersions: readonly string[];
  minimumSupportedVersion?: string | null;
  maximumSupportedVersion?: string | null;
};

export type ContractCompatibilityResult =
  | { compatible: true }
  | { compatible: false; code: ProductControlErrorCode; reasons: string[] };

function parseSemverParts(v: string): number[] | null {
  const cleaned = v.replace(/^v/i, '');
  const parts = cleaned.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return null;
  return parts;
}

function compareVersions(a: string, b: string): number | null {
  const pa = parseSemverParts(a);
  const pb = parseSemverParts(b);
  if (!pa || !pb) return null;
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av !== bv) return av < bv ? -1 : 1;
  }
  return 0;
}

export function evaluateContractCompatibility(
  input: ContractCompatibilityInput,
): ContractCompatibilityResult {
  const reasons: string[] = [];
  const supported = new Set(input.supportedContractVersions.map((v) => v.trim()));
  if (!supported.has(input.requiredContractVersion)) {
    reasons.push(
      `Required contract version ${input.requiredContractVersion} not in supported set`,
    );
  }
  if (input.minimumSupportedVersion) {
    const cmp = compareVersions(input.requiredContractVersion, input.minimumSupportedVersion);
    if (cmp !== null && cmp < 0) {
      reasons.push(
        `Required version ${input.requiredContractVersion} below minimum ${input.minimumSupportedVersion}`,
      );
    }
  }
  if (input.maximumSupportedVersion) {
    const cmp = compareVersions(input.requiredContractVersion, input.maximumSupportedVersion);
    if (cmp !== null && cmp > 0) {
      reasons.push(
        `Required version ${input.requiredContractVersion} above maximum ${input.maximumSupportedVersion}`,
      );
    }
  }
  if (reasons.length > 0) {
    return {
      compatible: false,
      code: ProductControlErrorCode.CONTRACT_INCOMPATIBLE,
      reasons,
    };
  }
  return { compatible: true };
}

/** HTTP 200 alone never implies contract compatibility. */
export function isHttpSuccessProofOfCompatibility(_httpStatus: number): boolean {
  return false;
}

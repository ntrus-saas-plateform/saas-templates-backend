import { ProductControlErrorCode } from './product-control.types.js';

const SECURITY_CODES = new Set<ProductControlErrorCode>([
  ProductControlErrorCode.AUTHENTICATION_FAILED,
  ProductControlErrorCode.AUTHORIZATION_FAILED,
  ProductControlErrorCode.TLS_VALIDATION_FAILED,
  ProductControlErrorCode.SIGNATURE_INVALID,
  ProductControlErrorCode.REQUEST_EXPIRED,
]);

const NON_RETRYABLE = new Set<ProductControlErrorCode>([
  ...SECURITY_CODES,
  ProductControlErrorCode.CONTRACT_INCOMPATIBLE,
  ProductControlErrorCode.CAPABILITY_UNSUPPORTED,
  ProductControlErrorCode.INVALID_RESPONSE,
  ProductControlErrorCode.OPERATION_NOT_IMPLEMENTED,
  ProductControlErrorCode.VALIDATION,
]);

const RETRYABLE = new Set<ProductControlErrorCode>([
  ProductControlErrorCode.ENDPOINT_UNAVAILABLE,
  ProductControlErrorCode.RATE_LIMITED,
  ProductControlErrorCode.TIMEOUT,
  ProductControlErrorCode.DEPENDENCY_UNAVAILABLE,
]);

export function isSecurityError(code: ProductControlErrorCode | string): boolean {
  return SECURITY_CODES.has(code as ProductControlErrorCode);
}

export function isRetryableProductControlError(
  code: ProductControlErrorCode | string,
): boolean {
  if (isSecurityError(code)) return false;
  if (NON_RETRYABLE.has(code as ProductControlErrorCode)) return false;
  if (RETRYABLE.has(code as ProductControlErrorCode)) return true;
  // UNKNOWN_OUTCOME is not a simple retry — needs reconciliation first.
  if (code === ProductControlErrorCode.UNKNOWN_OUTCOME) return false;
  return false;
}

export function classifyProductControlError(raw: unknown): ProductControlErrorCode {
  if (raw == null) return ProductControlErrorCode.DEPENDENCY_UNAVAILABLE;

  if (typeof raw === 'string') {
    const upper = raw.toUpperCase().replace(/[\s-]+/g, '_');
    if ((Object.values(ProductControlErrorCode) as string[]).includes(upper)) {
      return upper as ProductControlErrorCode;
    }
    if (/authn|unauthori[sz]ed|401|invalid.?token|credential/i.test(raw)) {
      return ProductControlErrorCode.AUTHENTICATION_FAILED;
    }
    if (/forbidden|403|authz|permission/i.test(raw)) {
      return ProductControlErrorCode.AUTHORIZATION_FAILED;
    }
    if (/tls|certificate|ssl/i.test(raw)) {
      return ProductControlErrorCode.TLS_VALIDATION_FAILED;
    }
    if (/signature|hmac|digest.?mismatch/i.test(raw)) {
      return ProductControlErrorCode.SIGNATURE_INVALID;
    }
    if (/expired|clock.?skew/i.test(raw)) {
      return ProductControlErrorCode.REQUEST_EXPIRED;
    }
    if (/contract|incompat/i.test(raw)) {
      return ProductControlErrorCode.CONTRACT_INCOMPATIBLE;
    }
    if (/capability|unsupported.?op/i.test(raw)) {
      return ProductControlErrorCode.CAPABILITY_UNSUPPORTED;
    }
    if (/429|rate.?limit/i.test(raw)) {
      return ProductControlErrorCode.RATE_LIMITED;
    }
    if (/timeout|timed.?out|ETIMEDOUT/i.test(raw)) {
      return ProductControlErrorCode.TIMEOUT;
    }
    if (/unknown.?outcome/i.test(raw)) {
      return ProductControlErrorCode.UNKNOWN_OUTCOME;
    }
    if (/not.?implemented|OPERATION_NOT_IMPLEMENTED/i.test(raw)) {
      return ProductControlErrorCode.OPERATION_NOT_IMPLEMENTED;
    }
    if (/invalid.?response|schema|json/i.test(raw)) {
      return ProductControlErrorCode.INVALID_RESPONSE;
    }
    if (/unavailable|ECONN|ENOTFOUND|5\d\d/i.test(raw)) {
      return ProductControlErrorCode.ENDPOINT_UNAVAILABLE;
    }
    return ProductControlErrorCode.DEPENDENCY_UNAVAILABLE;
  }

  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.code === 'string') return classifyProductControlError(obj.code);
    if (typeof obj.errorClass === 'string') {
      return classifyProductControlError(obj.errorClass);
    }
    if (typeof obj.message === 'string') return classifyProductControlError(obj.message);
    if (typeof obj.status === 'number') {
      if (obj.status === 401) return ProductControlErrorCode.AUTHENTICATION_FAILED;
      if (obj.status === 403) return ProductControlErrorCode.AUTHORIZATION_FAILED;
      if (obj.status === 429) return ProductControlErrorCode.RATE_LIMITED;
      if (obj.status >= 500) return ProductControlErrorCode.ENDPOINT_UNAVAILABLE;
    }
  }

  return ProductControlErrorCode.DEPENDENCY_UNAVAILABLE;
}

export function allMandateErrorCodes(): readonly ProductControlErrorCode[] {
  return Object.values(ProductControlErrorCode);
}

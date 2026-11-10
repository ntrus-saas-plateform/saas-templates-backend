import { describe, expect, it } from 'vitest';
import {
  allMandateErrorCodes,
  classifyProductControlError,
  isRetryableProductControlError,
  isSecurityError,
} from './error-classification.js';
import { ProductControlErrorCode } from './product-control.types.js';

describe('error classification', () => {
  it('covers all mandate error codes', () => {
    const codes = allMandateErrorCodes();
    expect(codes).toContain(ProductControlErrorCode.AUTHENTICATION_FAILED);
    expect(codes).toContain(ProductControlErrorCode.AUTHORIZATION_FAILED);
    expect(codes).toContain(ProductControlErrorCode.CONTRACT_INCOMPATIBLE);
    expect(codes).toContain(ProductControlErrorCode.CAPABILITY_UNSUPPORTED);
    expect(codes).toContain(ProductControlErrorCode.ENDPOINT_UNAVAILABLE);
    expect(codes).toContain(ProductControlErrorCode.TLS_VALIDATION_FAILED);
    expect(codes).toContain(ProductControlErrorCode.SIGNATURE_INVALID);
    expect(codes).toContain(ProductControlErrorCode.REQUEST_EXPIRED);
    expect(codes).toContain(ProductControlErrorCode.RATE_LIMITED);
    expect(codes).toContain(ProductControlErrorCode.TIMEOUT);
    expect(codes).toContain(ProductControlErrorCode.UNKNOWN_OUTCOME);
    expect(codes).toContain(ProductControlErrorCode.INVALID_RESPONSE);
    expect(codes).toContain(ProductControlErrorCode.OPERATION_NOT_IMPLEMENTED);
    expect(codes).toContain(ProductControlErrorCode.DEPENDENCY_UNAVAILABLE);
  });

  it('marks security errors as non-retryable', () => {
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

  it('allows retry for transient availability / rate limit / timeout', () => {
    expect(
      isRetryableProductControlError(ProductControlErrorCode.ENDPOINT_UNAVAILABLE),
    ).toBe(true);
    expect(isRetryableProductControlError(ProductControlErrorCode.RATE_LIMITED)).toBe(
      true,
    );
    expect(isRetryableProductControlError(ProductControlErrorCode.TIMEOUT)).toBe(true);
    expect(
      isRetryableProductControlError(ProductControlErrorCode.DEPENDENCY_UNAVAILABLE),
    ).toBe(true);
  });

  it('does not treat UNKNOWN_OUTCOME as a simple retry', () => {
    expect(isRetryableProductControlError(ProductControlErrorCode.UNKNOWN_OUTCOME)).toBe(
      false,
    );
  });

  it('classifies raw strings and HTTP status objects', () => {
    expect(classifyProductControlError('signature invalid')).toBe(
      ProductControlErrorCode.SIGNATURE_INVALID,
    );
    expect(classifyProductControlError('rate limit 429')).toBe(
      ProductControlErrorCode.RATE_LIMITED,
    );
    expect(classifyProductControlError({ status: 401 })).toBe(
      ProductControlErrorCode.AUTHENTICATION_FAILED,
    );
    expect(classifyProductControlError({ status: 503 })).toBe(
      ProductControlErrorCode.ENDPOINT_UNAVAILABLE,
    );
  });
});

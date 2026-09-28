import { DomainError, ErrorCode } from '../../core/domain/errors/domain-error.js';

const KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,240}$/;

export function assertSafeStorageKey(key: string | undefined): asserts key is string {
  if (!key || !KEY_PATTERN.test(key) || key.includes('..')) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid file key');
  }
}

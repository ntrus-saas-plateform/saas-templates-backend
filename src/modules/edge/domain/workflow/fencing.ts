import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

/**
 * Fencing tokens are monotonic per step.
 * Protected writes must present the exact token issued at claim/renew time.
 * A stale worker with an older token is rejected.
 */
export function assertFencingToken(expected: number, provided: number): void {
  if (!Number.isInteger(expected) || expected < 0) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid expected fencing token: ${expected}`,
      [{ expected, provided }],
    );
  }
  if (!Number.isInteger(provided) || provided < 0) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid provided fencing token: ${provided}`,
      [{ expected, provided }],
    );
  }
  if (provided !== expected) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      provided < expected
        ? `Stale fencing token ${provided} < expected ${expected}`
        : `Fencing token mismatch: provided ${provided}, expected ${expected}`,
      [{ expected, provided, stale: provided < expected }],
    );
  }
}

/** Next fencing token after a successful claim or reclaim. */
export function nextFencingToken(current: number): number {
  if (!Number.isInteger(current) || current < 0) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, `Invalid fencing token: ${current}`);
  }
  return current + 1;
}

export function isStaleFencingToken(expected: number, provided: number): boolean {
  return Number.isInteger(provided) && Number.isInteger(expected) && provided < expected;
}

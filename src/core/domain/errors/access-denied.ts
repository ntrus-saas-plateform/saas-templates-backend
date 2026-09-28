import { DomainError, ErrorCode } from './domain-error.js';

export const ACCESS_DENIED_MESSAGE = 'Access denied';

/** Generic denial — avoids revealing tenant/org/user existence (enumeration protection). */
export function accessDeniedError(): DomainError {
  return new DomainError(ErrorCode.FORBIDDEN, ACCESS_DENIED_MESSAGE, []);
}

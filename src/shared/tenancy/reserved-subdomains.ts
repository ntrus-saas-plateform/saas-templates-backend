import { DomainError, ErrorCode } from '../../core/domain/errors/domain-error.js';

export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  'www',
  'api',
  'admin',
  'app',
  'auth',
  'platform',
  'mail',
  'cdn',
  'status',
  'support',
  'docs',
]);

export function assertSubdomainAllowed(label: string): void {
  if (RESERVED_SUBDOMAINS.has(label.toLowerCase())) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Subdomain label '${label}' is reserved and cannot be used for tenant provisioning`,
      [{ label }],
    );
  }
}

import { accessDeniedError } from '../../../../core/domain/errors/access-denied.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ExecutionContext } from './execution-context.js';

export function requireSubject(ctx: ExecutionContext): ExecutionContext {
  if (!ctx.subjectId) {
    throw new DomainError(ErrorCode.UNAUTHORIZED, 'User context required');
  }
  return ctx;
}

export function assertTenantScope(ctx: ExecutionContext, tenantId: string): void {
  if (tenantId !== ctx.tenantId) {
    throw accessDeniedError();
  }
}

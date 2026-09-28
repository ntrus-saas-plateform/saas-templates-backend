import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ExecutionContext } from './execution-context.js';

export function requireSubject(ctx: ExecutionContext): ExecutionContext & { subjectId: string } {
  if (!ctx.subjectId) {
    throw new DomainError(ErrorCode.UNAUTHORIZED, 'User context required');
  }
  return { ...ctx, subjectId: ctx.subjectId };
}

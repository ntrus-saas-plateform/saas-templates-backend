import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

/**
 * Vertical isolation for product governance.
 *
 * - Global context (`scopeVerticalId === null`): access any vertical's products
 *   (caller must already hold global product permissions via EdgeAuthGuard).
 * - Workspace context (`scopeVerticalId` set): may only access products whose
 *   `productVerticalId` matches the active workspace vertical.
 */
export function assertProductVerticalAccess(input: {
  scopeVerticalId: string | null | undefined;
  productVerticalId: string;
  action?: string;
}): void {
  const scope = input.scopeVerticalId?.trim() || null;
  if (!scope) return;
  if (scope !== input.productVerticalId) {
    throw new DomainError(
      ErrorCode.FORBIDDEN,
      `Cross-vertical product access denied${input.action ? ` for ${input.action}` : ''}`,
      [{ scopeVerticalId: scope, productVerticalId: input.productVerticalId }],
    );
  }
}

/** When listing in a workspace, force the vertical filter to the session vertical. */
export function resolveProductListVerticalFilter(input: {
  scopeVerticalId: string | null | undefined;
  requestedVerticalId?: string | null;
}): string | undefined {
  const scope = input.scopeVerticalId?.trim() || null;
  if (scope) {
    if (
      input.requestedVerticalId &&
      input.requestedVerticalId.trim() &&
      input.requestedVerticalId !== scope
    ) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'Cannot list products for another vertical from this workspace',
        [{ scopeVerticalId: scope, requestedVerticalId: input.requestedVerticalId }],
      );
    }
    return scope;
  }
  return input.requestedVerticalId?.trim() || undefined;
}

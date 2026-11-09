import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export interface MarketSegment {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly verticalId: string;
  readonly parentSegmentId: string | null;
  readonly status: string;
  readonly version: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Prevents parent cycles. `ancestorIds` should be the chain of parents of the
 * proposed parent (including the parent itself), walking upward.
 */
export function assertNoSegmentCycle(
  segmentId: string,
  parentSegmentId: string | null,
  ancestorIdsOfParent: readonly string[],
): void {
  if (!parentSegmentId) return;
  if (parentSegmentId === segmentId) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Segment cannot be its own parent', [
      { segmentId },
    ]);
  }
  if (ancestorIdsOfParent.includes(segmentId)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Market segment parent would create a cycle',
      [{ segmentId, parentSegmentId }],
    );
  }
}

export function walkSegmentAncestors(
  segmentId: string,
  getParentId: (id: string) => string | null | undefined,
  maxDepth = 64,
): string[] {
  const chain: string[] = [];
  let current: string | null | undefined = segmentId;
  const seen = new Set<string>();
  for (let i = 0; i < maxDepth && current; i++) {
    if (seen.has(current)) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Existing segment parent cycle detected', [
        { segmentId: current },
      ]);
    }
    seen.add(current);
    chain.push(current);
    current = getParentId(current) ?? null;
  }
  return chain;
}

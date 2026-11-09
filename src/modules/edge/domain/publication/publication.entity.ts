import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ProductLifecycleStatus } from '../product/product.entity.js';
import { ProductVersionStatus } from '../product/product-version.entity.js';
import { ReadinessResult } from '../readiness/readiness.entity.js';

export interface PublicationSnapshot {
  readonly id: string;
  readonly productId: string;
  readonly productVersionId: string;
  readonly snapshot: Record<string, unknown>;
  readonly publishedBy: string | null;
  readonly publishedAt: Date;
  readonly approvalRefs: readonly unknown[];
}

export function assertPublicationAllowed(input: {
  readinessResult: ReadinessResult;
  versionStatus: ProductVersionStatus;
  productStatus: ProductLifecycleStatus;
}): void {
  if (input.readinessResult !== ReadinessResult.READY) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Publication requires readiness result READY',
      [{ readinessResult: input.readinessResult }],
    );
  }
  if (
    input.versionStatus !== ProductVersionStatus.VALIDATED &&
    input.versionStatus !== ProductVersionStatus.PUBLISHED
  ) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Publication requires version status VALIDATED or PUBLISHED',
      [{ versionStatus: input.versionStatus }],
    );
  }
  if (
    input.productStatus === ProductLifecycleStatus.RETIRED ||
    input.productStatus === ProductLifecycleStatus.ARCHIVED
  ) {
    throw new DomainError(ErrorCode.CONFLICT, 'Cannot publish a retired or archived product', [
      { productStatus: input.productStatus },
    ]);
  }
}

export function buildPublicationSnapshotPayload(input: {
  product: Record<string, unknown>;
  version: Record<string, unknown>;
  capabilities?: readonly unknown[];
  bindings?: readonly unknown[];
  readiness?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    product: input.product,
    version: input.version,
    capabilities: input.capabilities ?? [],
    bindings: input.bindings ?? [],
    readiness: input.readiness ?? null,
    frozenAt: new Date().toISOString(),
  };
}

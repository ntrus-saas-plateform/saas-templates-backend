import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export enum ProductVersionStatus {
  DRAFT = 'DRAFT',
  CONFIGURING = 'CONFIGURING',
  VALIDATION = 'VALIDATION',
  VALIDATED = 'VALIDATED',
  PUBLISHED = 'PUBLISHED',
  DEPRECATED = 'DEPRECATED',
  RETIRED = 'RETIRED',
  ARCHIVED = 'ARCHIVED',
}

export enum ProductReleaseType {
  MAJOR = 'MAJOR',
  MINOR = 'MINOR',
  PATCH = 'PATCH',
  HOTFIX = 'HOTFIX',
  SECURITY = 'SECURITY',
  LTS = 'LTS',
}

export interface EdgeProductVersion {
  readonly id: string;
  readonly productId: string;
  readonly version: string;
  readonly releaseName: string | null;
  readonly description: string | null;
  readonly status: ProductVersionStatus;
  readonly releaseType: ProductReleaseType;
  readonly apiCompatibility: string | null;
  readonly eventCompatibility: string | null;
  readonly minimumBackendVersion: string | null;
  readonly releaseDate: Date | null;
  readonly effectiveFrom: Date | null;
  readonly deprecatedAt: Date | null;
  readonly retiredAt: Date | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly createdBy: string | null;
}

const ALLOWED_TRANSITIONS: Readonly<
  Record<ProductVersionStatus, readonly ProductVersionStatus[]>
> = {
  [ProductVersionStatus.DRAFT]: [
    ProductVersionStatus.CONFIGURING,
    ProductVersionStatus.ARCHIVED,
  ],
  [ProductVersionStatus.CONFIGURING]: [
    ProductVersionStatus.DRAFT,
    ProductVersionStatus.VALIDATION,
    ProductVersionStatus.ARCHIVED,
  ],
  [ProductVersionStatus.VALIDATION]: [
    ProductVersionStatus.CONFIGURING,
    ProductVersionStatus.VALIDATED,
    ProductVersionStatus.ARCHIVED,
  ],
  [ProductVersionStatus.VALIDATED]: [
    ProductVersionStatus.VALIDATION,
    ProductVersionStatus.PUBLISHED,
    ProductVersionStatus.ARCHIVED,
  ],
  [ProductVersionStatus.PUBLISHED]: [
    ProductVersionStatus.DEPRECATED,
    ProductVersionStatus.RETIRED,
  ],
  [ProductVersionStatus.DEPRECATED]: [
    ProductVersionStatus.RETIRED,
    ProductVersionStatus.ARCHIVED,
  ],
  [ProductVersionStatus.RETIRED]: [ProductVersionStatus.ARCHIVED],
  [ProductVersionStatus.ARCHIVED]: [],
};

export function canTransitionProductVersionStatus(
  from: ProductVersionStatus,
  to: ProductVersionStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertProductVersionTransition(
  from: ProductVersionStatus,
  to: ProductVersionStatus,
): void {
  if (!canTransitionProductVersionStatus(from, to)) {
    throw new DomainError(
      ErrorCode.INVALID_STATE_TRANSITION,
      `Illegal product version status transition: ${from} → ${to}`,
      [{ from, to }],
    );
  }
}

/** Published (and later) versions are immutable — no field edits allowed. */
export function assertPublishedImmutable(status: ProductVersionStatus): void {
  if (
    status === ProductVersionStatus.PUBLISHED ||
    status === ProductVersionStatus.DEPRECATED ||
    status === ProductVersionStatus.RETIRED ||
    status === ProductVersionStatus.ARCHIVED
  ) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Product version with status ${status} is immutable`,
      [{ status }],
    );
  }
}

export function isVersionPublishable(status: ProductVersionStatus): boolean {
  return status === ProductVersionStatus.VALIDATED || status === ProductVersionStatus.PUBLISHED;
}

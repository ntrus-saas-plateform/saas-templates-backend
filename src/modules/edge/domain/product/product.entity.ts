import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export enum ProductLifecycleStatus {
  DRAFT = 'DRAFT',
  CONFIGURING = 'CONFIGURING',
  TECHNICAL_VALIDATION = 'TECHNICAL_VALIDATION',
  READY_FOR_PUBLICATION = 'READY_FOR_PUBLICATION',
  PUBLISHED = 'PUBLISHED',
  DEPRECATED = 'DEPRECATED',
  RETIRED = 'RETIRED',
  ARCHIVED = 'ARCHIVED',
}

export enum CommercialAvailability {
  UNAVAILABLE = 'UNAVAILABLE',
  INTERNAL_ONLY = 'INTERNAL_ONLY',
  BETA = 'BETA',
  CONTROLLED_ROLLOUT = 'CONTROLLED_ROLLOUT',
  AVAILABLE = 'AVAILABLE',
  DEPRECATED = 'DEPRECATED',
}

export interface EdgeProduct {
  readonly id: string;
  readonly code: string;
  readonly slug: string;
  readonly name: string;
  readonly shortDescription: string | null;
  readonly description: string | null;
  readonly verticalId: string;
  readonly productType: string | null;
  readonly lifecycleStatus: ProductLifecycleStatus;
  readonly technicalStatus: string | null;
  readonly commercialAvailability: CommercialAvailability;
  readonly defaultVersionId: string | null;
  readonly iconRef: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly rowVersion: number;
}

const ALLOWED_TRANSITIONS: Readonly<
  Record<ProductLifecycleStatus, readonly ProductLifecycleStatus[]>
> = {
  [ProductLifecycleStatus.DRAFT]: [
    ProductLifecycleStatus.CONFIGURING,
    ProductLifecycleStatus.ARCHIVED,
  ],
  [ProductLifecycleStatus.CONFIGURING]: [
    ProductLifecycleStatus.DRAFT,
    ProductLifecycleStatus.TECHNICAL_VALIDATION,
    ProductLifecycleStatus.ARCHIVED,
  ],
  [ProductLifecycleStatus.TECHNICAL_VALIDATION]: [
    ProductLifecycleStatus.CONFIGURING,
    ProductLifecycleStatus.READY_FOR_PUBLICATION,
    ProductLifecycleStatus.ARCHIVED,
  ],
  [ProductLifecycleStatus.READY_FOR_PUBLICATION]: [
    ProductLifecycleStatus.TECHNICAL_VALIDATION,
    ProductLifecycleStatus.PUBLISHED,
    ProductLifecycleStatus.ARCHIVED,
  ],
  [ProductLifecycleStatus.PUBLISHED]: [
    ProductLifecycleStatus.DEPRECATED,
    ProductLifecycleStatus.RETIRED,
  ],
  [ProductLifecycleStatus.DEPRECATED]: [
    ProductLifecycleStatus.RETIRED,
    ProductLifecycleStatus.ARCHIVED,
  ],
  [ProductLifecycleStatus.RETIRED]: [ProductLifecycleStatus.ARCHIVED],
  [ProductLifecycleStatus.ARCHIVED]: [],
};

export function canTransitionProductLifecycle(
  from: ProductLifecycleStatus,
  to: ProductLifecycleStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertProductLifecycleTransition(
  from: ProductLifecycleStatus,
  to: ProductLifecycleStatus,
): void {
  if (!canTransitionProductLifecycle(from, to)) {
    throw new DomainError(
      ErrorCode.INVALID_STATE_TRANSITION,
      `Illegal product lifecycle transition: ${from} → ${to}`,
      [{ from, to }],
    );
  }
}

export function isProductMutable(status: ProductLifecycleStatus): boolean {
  return (
    status !== ProductLifecycleStatus.PUBLISHED &&
    status !== ProductLifecycleStatus.RETIRED &&
    status !== ProductLifecycleStatus.ARCHIVED
  );
}

/**
 * D-CARD-01 / RGOM-E7 — Subscription ↔ Product Tenant association (cardinality B).
 * Temporal commercial binding; Product Tenant is durable per account+product.
 */

import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export enum AssociationType {
  INITIAL = 'INITIAL',
  RENEWAL = 'RENEWAL',
  PLAN_CHANGE = 'PLAN_CHANGE',
  REPLACEMENT = 'REPLACEMENT',
  REACTIVATION = 'REACTIVATION',
}

export enum AssociationStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUPERSEDED = 'SUPERSEDED',
  CLOSED = 'CLOSED',
}

export const DEFAULT_ENVIRONMENT_SLOT = 'DEFAULT';

export type SubscriptionTenantAssociation = {
  readonly id: string;
  readonly accountId: string;
  readonly productId: string;
  readonly productTenantId: string;
  readonly productTenantRef: string;
  readonly subscriptionId: string;
  readonly associationType: AssociationType | string;
  readonly associationStatus: AssociationStatus | string;
  readonly environmentSlot: string;
  readonly effectiveFrom: Date;
  readonly effectiveUntil: Date | null;
  readonly supersedesAssociationId: string | null;
  readonly sourceEventId: string | null;
  readonly correlationId: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type CreateAssociationInput = {
  accountId: string;
  productId: string;
  productTenantId: string;
  productTenantRef: string;
  subscriptionId: string;
  associationType: AssociationType | string;
  associationStatus?: AssociationStatus | string;
  environmentSlot?: string;
  effectiveFrom?: Date;
  supersedesAssociationId?: string | null;
  sourceEventId?: string | null;
  correlationId?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
};

/** Parse BB/Edge tenant key into UUID when possible. */
export function resolveProductTenantId(tenantRef: string): string | null {
  const raw = tenantRef.trim();
  if (!raw) return null;
  const stripped = raw.toLowerCase().startsWith('edge:') ? raw.slice(5) : raw;
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRe.test(stripped) ? stripped.toLowerCase() : null;
}

export function assertAssociationIntegrity(input: {
  subscriptionAccountId: string;
  subscriptionProductId: string;
  associationAccountId: string;
  associationProductId: string;
  productTenantProductId?: string | null;
}): void {
  if (input.subscriptionAccountId !== input.associationAccountId) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Association account_id must match subscription account_id (D-CARD-01)',
      [{ code: 'ASSOCIATION_ACCOUNT_MISMATCH' }],
    );
  }
  if (input.subscriptionProductId !== input.associationProductId) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Association product_id must match subscription product_id (D-CARD-01)',
      [{ code: 'ASSOCIATION_PRODUCT_MISMATCH' }],
    );
  }
  if (
    input.productTenantProductId &&
    input.productTenantProductId !== input.associationProductId
  ) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Product tenant product_id must match association product_id (D-CARD-01)',
      [{ code: 'TENANT_PRODUCT_MISMATCH' }],
    );
  }
}

export function assertCanActivateAssociation(input: {
  existingActiveForSubscription: SubscriptionTenantAssociation | null;
  existingActiveForTenantSlot: SubscriptionTenantAssociation | null;
  subscriptionId: string;
  productTenantId: string;
  allowReplace?: boolean;
}): void {
  if (
    input.existingActiveForSubscription &&
    input.existingActiveForSubscription.subscriptionId === input.subscriptionId &&
    !input.allowReplace
  ) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Subscription ${input.subscriptionId} already has an ACTIVE association`,
      [{ code: 'ACTIVE_ASSOCIATION_EXISTS', associationId: input.existingActiveForSubscription.id }],
    );
  }
  if (
    input.existingActiveForTenantSlot &&
    input.existingActiveForTenantSlot.subscriptionId !== input.subscriptionId &&
    !input.allowReplace
  ) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Product tenant ${input.productTenantId} already has an ACTIVE association for another subscription`,
      [
        {
          code: 'TENANT_ACTIVE_ASSOCIATION_EXISTS',
          associationId: input.existingActiveForTenantSlot.id,
          otherSubscriptionId: input.existingActiveForTenantSlot.subscriptionId,
        },
      ],
    );
  }
}

/**
 * RGOM-E7 — plan/addon changes must keep the durable Product Tenant (cardinality B).
 */
export function assertPlanChangeKeepsProductTenant(input: {
  readonly changeType: string;
  readonly activeAssociation: SubscriptionTenantAssociation | null;
  readonly proposedProductTenantId?: string | null;
}): void {
  const t = String(input.changeType);
  if (
    t !== 'PLAN_CHANGE' &&
    t !== 'ADDON_ADD' &&
    t !== 'ADDON_REMOVE' &&
    t !== 'QUANTITY_CHANGE' &&
    t !== 'ENTERPRISE_OVERLAY'
  ) {
    return;
  }
  if (!input.activeAssociation) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Commercial change requires an ACTIVE SubscriptionTenantAssociation (bind tenant first)',
      [{ code: 'ASSOCIATION_REQUIRED_FOR_CHANGE' }],
    );
  }
  if (
    input.proposedProductTenantId &&
    input.proposedProductTenantId !== input.activeAssociation.productTenantId
  ) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Upgrade/downgrade/add-on must keep the same product tenant (D-CARD-01 cardinality B)',
      [
        {
          code: 'TENANT_REUSE_REQUIRED',
          activeProductTenantId: input.activeAssociation.productTenantId,
          proposedProductTenantId: input.proposedProductTenantId,
        },
      ],
    );
  }
}

export function assertTerminalTransition(
  from: AssociationStatus | string,
  to: AssociationStatus | string,
): void {
  const f = String(from);
  const t = String(to);
  if (f === AssociationStatus.CLOSED || f === AssociationStatus.SUPERSEDED) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Cannot transition association from ${f} to ${t}; create a new row (D-CARD-01)`,
      [{ code: 'ASSOCIATION_IMMUTABLE_TERMINAL' }],
    );
  }
  const allowed: Record<string, readonly string[]> = {
    [AssociationStatus.PENDING]: [
      AssociationStatus.ACTIVE,
      AssociationStatus.CLOSED,
      AssociationStatus.SUPERSEDED,
    ],
    [AssociationStatus.ACTIVE]: [AssociationStatus.SUPERSEDED, AssociationStatus.CLOSED],
  };
  const next = allowed[f];
  if (!next?.includes(t)) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Illegal association transition ${f} → ${t}`,
      [{ code: 'ASSOCIATION_TRANSITION_ILLEGAL', from: f, to: t }],
    );
  }
}

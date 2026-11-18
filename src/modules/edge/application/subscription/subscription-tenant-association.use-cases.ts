import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { SubscriptionRepositoryPort } from '../../domain/ports/subscription-repository.port.js';
import type { SubscriptionTenantAssociationPort } from '../../domain/ports/subscription-tenant-association.port.js';
import {
  AssociationStatus,
  AssociationType,
  DEFAULT_ENVIRONMENT_SLOT,
  assertAssociationIntegrity,
  assertCanActivateAssociation,
  resolveProductTenantId,
  type SubscriptionTenantAssociation,
} from '../../domain/subscription/subscription-tenant-association.js';

export class ListSubscriptionTenantAssociationsUseCase {
  constructor(private readonly associations: SubscriptionTenantAssociationPort) {}

  execute(subscriptionId: string) {
    return this.associations.listBySubscription(subscriptionId);
  }
}

export class GetActiveSubscriptionTenantAssociationUseCase {
  constructor(private readonly associations: SubscriptionTenantAssociationPort) {}

  execute(subscriptionId: string) {
    return this.associations.getActiveBySubscription(subscriptionId);
  }
}

/**
 * Bind or replace ACTIVE association (cardinality B).
 * Used after provisioning complete / plan change keeping the same product tenant.
 */
export class BindSubscriptionTenantAssociationUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly associations: SubscriptionTenantAssociationPort,
  ) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    productTenantRef: string;
    productTenantId?: string;
    associationType?: AssociationType | string;
    environmentSlot?: string;
    correlationId?: string;
    supersedeExisting?: boolean;
  }): Promise<SubscriptionTenantAssociation> {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    }
    const productTenantRef = input.productTenantRef.trim();
    if (!productTenantRef) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'productTenantRef required');
    }
    const productTenantId =
      input.productTenantId?.trim() || resolveProductTenantId(productTenantRef);
    if (!productTenantId) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'productTenantId must be a UUID (or productTenantRef must embed a UUID)',
        [{ code: 'PRODUCT_TENANT_ID_REQUIRED' }],
      );
    }

    assertAssociationIntegrity({
      subscriptionAccountId: sub.accountId,
      subscriptionProductId: sub.productId,
      associationAccountId: sub.accountId,
      associationProductId: sub.productId,
    });

    const slot = input.environmentSlot ?? DEFAULT_ENVIRONMENT_SLOT;
    const activeSub = await this.associations.getActiveBySubscription(sub.id);
    const activeTenant = await this.associations.getActiveByProductTenant(
      productTenantId,
      slot,
    );

    const supersede = input.supersedeExisting === true;
    assertCanActivateAssociation({
      existingActiveForSubscription: activeSub,
      existingActiveForTenantSlot: activeTenant,
      subscriptionId: sub.id,
      productTenantId,
      allowReplace: supersede,
    });

    const now = new Date();
    const correlationId = input.correlationId ?? randomUUID();
    let supersedesId: string | null = null;

    if (supersede && activeSub) {
      await this.associations.transitionStatus({
        id: activeSub.id,
        toStatus: AssociationStatus.SUPERSEDED,
        effectiveUntil: now,
        metadataPatch: { supersededByCorrelationId: correlationId },
      });
      supersedesId = activeSub.id;
    }
    if (
      supersede &&
      activeTenant &&
      activeTenant.id !== activeSub?.id &&
      activeTenant.subscriptionId !== sub.id
    ) {
      await this.associations.transitionStatus({
        id: activeTenant.id,
        toStatus: AssociationStatus.SUPERSEDED,
        effectiveUntil: now,
        metadataPatch: { supersededByCorrelationId: correlationId },
      });
    }

    const associationType =
      input.associationType ??
      (activeSub || activeTenant ? AssociationType.PLAN_CHANGE : AssociationType.INITIAL);

    return this.associations.create({
      accountId: sub.accountId,
      productId: sub.productId,
      productTenantId,
      productTenantRef,
      subscriptionId: sub.id,
      associationType,
      associationStatus: AssociationStatus.ACTIVE,
      environmentSlot: slot,
      effectiveFrom: now,
      supersedesAssociationId: supersedesId,
      correlationId,
      createdBy: input.actorId,
      metadata: { boundVia: 'BindSubscriptionTenantAssociationUseCase' },
    });
  }
}

export class CloseSubscriptionTenantAssociationUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly associations: SubscriptionTenantAssociationPort,
  ) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    associationId?: string;
    reason?: string;
  }): Promise<SubscriptionTenantAssociation> {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    }
    const target =
      (input.associationId
        ? await this.associations.getById(input.associationId)
        : null) ?? (await this.associations.getActiveBySubscription(sub.id));
    if (!target || target.subscriptionId !== sub.id) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Active association not found');
    }
    return this.associations.transitionStatus({
      id: target.id,
      toStatus: AssociationStatus.CLOSED,
      effectiveUntil: new Date(),
      metadataPatch: {
        closedBy: input.actorId,
        reason: input.reason ?? 'operator_close',
      },
    });
  }
}

import type {
  CreateAssociationInput,
  SubscriptionTenantAssociation,
} from '../subscription/subscription-tenant-association.js';

export const SUBSCRIPTION_TENANT_ASSOCIATION_PORT = Symbol(
  'SUBSCRIPTION_TENANT_ASSOCIATION_PORT',
);

export type SubscriptionTenantAssociationPort = {
  create(input: CreateAssociationInput): Promise<SubscriptionTenantAssociation>;

  getById(id: string): Promise<SubscriptionTenantAssociation | null>;

  listBySubscription(subscriptionId: string): Promise<SubscriptionTenantAssociation[]>;

  getActiveBySubscription(
    subscriptionId: string,
  ): Promise<SubscriptionTenantAssociation | null>;

  getActiveByProductTenant(
    productTenantId: string,
    environmentSlot?: string,
  ): Promise<SubscriptionTenantAssociation | null>;

  transitionStatus(input: {
    id: string;
    toStatus: string;
    effectiveUntil?: Date | null;
    metadataPatch?: Record<string, unknown>;
  }): Promise<SubscriptionTenantAssociation>;
};

export const SUBSCRIPTION_PROVISIONING_COORDINATION_PORT = Symbol(
  'SUBSCRIPTION_PROVISIONING_COORDINATION_PORT',
);

export type ProvisioningRequestInput = {
  readonly subscriptionId: string;
  readonly subscriptionNumber: string;
  readonly accountId: string;
  readonly productId: string;
  readonly correlationId: string;
  readonly payload?: Record<string, unknown>;
};

export type ProvisioningRequestResult =
  | {
      readonly outcome: 'REQUESTED' | 'ACCEPTED';
      readonly externalRef?: string | null;
    }
  | {
      readonly outcome: 'UNAVAILABLE';
      readonly failureCode: string;
      readonly failureMessage: string;
    };

export type ProvisioningCompleteInput = {
  readonly requestId: string;
  readonly subscriptionId: string;
  readonly tenantRef?: string | null;
  readonly externalRef?: string | null;
};

export type ProvisioningCompleteResult =
  | { readonly outcome: 'COMPLETE'; readonly completedAt: string }
  | {
      readonly outcome: 'UNAVAILABLE' | 'NOT_COMPLETE';
      readonly failureCode: string;
      readonly failureMessage: string;
    };

/**
 * P7 provisioning integration — never invent TENANT_ACTIVE without provider confirmation.
 */
export interface SubscriptionProvisioningCoordinationPort {
  requestProvisioning(input: ProvisioningRequestInput): Promise<ProvisioningRequestResult>;
  completeProvisioning(input: ProvisioningCompleteInput): Promise<ProvisioningCompleteResult>;
}

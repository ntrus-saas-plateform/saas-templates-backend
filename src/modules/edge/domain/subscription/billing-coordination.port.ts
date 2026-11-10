export const SUBSCRIPTION_BILLING_COORDINATION_PORT = Symbol(
  'SUBSCRIPTION_BILLING_COORDINATION_PORT',
);

export type BillingCoordinationRequestInput = {
  readonly subscriptionId: string;
  readonly subscriptionNumber: string;
  readonly accountId: string;
  readonly productId: string;
  readonly correlationId: string;
  readonly billingAccountRef?: string | null;
  readonly payload?: Record<string, unknown>;
};

export type BillingCoordinationRequestResult =
  | {
      readonly outcome: 'REQUESTED';
      readonly externalRef?: string | null;
    }
  | {
      readonly outcome: 'UNAVAILABLE';
      readonly failureCode: string;
      readonly failureMessage: string;
    };

export type BillingCoordinationConfirmInput = {
  readonly coordinationId: string;
  readonly subscriptionId: string;
  readonly externalRef?: string | null;
};

export type BillingCoordinationConfirmResult =
  | { readonly outcome: 'CONFIRMED'; readonly confirmedAt: string }
  | {
      readonly outcome: 'UNAVAILABLE' | 'NOT_CONFIRMED';
      readonly failureCode: string;
      readonly failureMessage: string;
    };

/**
 * P6 billing integration — never invent PAID or invoice state without provider confirmation.
 */
export interface SubscriptionBillingCoordinationPort {
  requestCoordination(
    input: BillingCoordinationRequestInput,
  ): Promise<BillingCoordinationRequestResult>;
  confirmCoordination(
    input: BillingCoordinationConfirmInput,
  ): Promise<BillingCoordinationConfirmResult>;
}

export const PAYMENT_PROVIDER_PORT = Symbol('PAYMENT_PROVIDER_PORT');

export type PaymentProviderOutcome =
  | 'REQUESTED'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'UNAVAILABLE'
  | 'REQUIRES_ACTION';

export type CreateCustomerInput = {
  billingAccountId: string;
  correlationId: string;
  email?: string | null;
  metadata?: Record<string, unknown>;
};

export type CreateCustomerResult =
  | { outcome: 'SUCCEEDED'; provider: string; providerCustomerRef: string }
  | { outcome: 'UNAVAILABLE' | 'FAILED'; failureCode: string; failureMessage: string };

export type AttachPaymentMethodInput = {
  billingAccountId: string;
  providerCustomerRef: string;
  tokenRef: string;
  correlationId: string;
};

export type AttachPaymentMethodResult =
  | {
      outcome: 'SUCCEEDED';
      provider: string;
      providerMethodRef: string;
      brand?: string | null;
      last4?: string | null;
    }
  | { outcome: 'UNAVAILABLE' | 'FAILED'; failureCode: string; failureMessage: string };

export type CreatePaymentIntentInput = {
  billingAccountId: string;
  invoiceId?: string | null;
  amount: string;
  currency: string;
  correlationId: string;
  providerCustomerRef?: string | null;
  providerMethodRef?: string | null;
  metadata?: Record<string, unknown>;
};

export type CreatePaymentIntentResult =
  | {
      outcome: 'REQUESTED' | 'REQUIRES_ACTION' | 'SUCCEEDED';
      provider: string;
      providerIntentRef: string;
      clientSecret?: string | null;
    }
  | { outcome: 'UNAVAILABLE' | 'FAILED'; failureCode: string; failureMessage: string };

export type ConfirmPaymentIntentInput = {
  provider: string;
  providerIntentRef: string;
  correlationId: string;
};

export type ConfirmPaymentIntentResult =
  | {
      outcome: 'SUCCEEDED' | 'REQUIRES_ACTION' | 'REQUESTED';
      provider: string;
      providerRef: string;
      status: string;
    }
  | { outcome: 'UNAVAILABLE' | 'FAILED'; failureCode: string; failureMessage: string };

export type RefundPaymentInput = {
  provider: string;
  providerIntentRef: string;
  amount: string;
  currency: string;
  correlationId: string;
  reason?: string | null;
};

export type RefundPaymentResult =
  | { outcome: 'SUCCEEDED' | 'REQUESTED'; provider: string; providerRef: string }
  | { outcome: 'UNAVAILABLE' | 'FAILED'; failureCode: string; failureMessage: string };

export type FetchPaymentStatusInput = {
  provider: string;
  providerIntentRef: string;
};

export type FetchPaymentStatusResult =
  | {
      outcome: 'SUCCEEDED' | 'REQUIRES_ACTION' | 'REQUESTED' | 'FAILED';
      provider: string;
      providerRef: string;
      status: string;
    }
  | { outcome: 'UNAVAILABLE'; failureCode: string; failureMessage: string };

export interface PaymentProviderPort {
  createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult>;
  attachPaymentMethod(input: AttachPaymentMethodInput): Promise<AttachPaymentMethodResult>;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult>;
  confirmPaymentIntent(input: ConfirmPaymentIntentInput): Promise<ConfirmPaymentIntentResult>;
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;
  fetchPaymentStatus(input: FetchPaymentStatusInput): Promise<FetchPaymentStatusResult>;
}

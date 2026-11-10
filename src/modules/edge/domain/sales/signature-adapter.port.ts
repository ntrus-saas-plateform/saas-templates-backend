export const SALES_SIGNATURE_ADAPTER_PORT = Symbol('SALES_SIGNATURE_ADAPTER_PORT');

export type SignatureRequestInput = {
  readonly contractId: string;
  readonly contractNumber: string;
  readonly signers: readonly { email: string; name?: string; role?: string }[];
  readonly documentRef?: string | null;
  readonly correlationId: string;
};

export type SignatureRequestResult =
  | {
      readonly outcome: 'REQUESTED';
      readonly provider: string;
      readonly externalId: string;
    }
  | {
      readonly outcome: 'UNAVAILABLE';
      readonly failureCode: string;
      readonly failureMessage: string;
    };

export type SignatureConfirmationInput = {
  readonly contractId: string;
  readonly provider: string;
  readonly externalId: string;
  readonly providerEventId?: string | null;
};

export type SignatureConfirmationResult =
  | { readonly outcome: 'CONFIRMED'; readonly confirmedAt: string }
  | {
      readonly outcome: 'UNAVAILABLE' | 'NOT_CONFIRMED';
      readonly failureCode: string;
      readonly failureMessage: string;
    };

/**
 * Electronic signature providers are interchangeable.
 * Never invent EXECUTED / COMPLETED without provider confirmation.
 */
export interface SalesSignatureAdapterPort {
  requestSignature(input: SignatureRequestInput): Promise<SignatureRequestResult>;
  confirmSignature(
    input: SignatureConfirmationInput,
  ): Promise<SignatureConfirmationResult>;
}

export const SALES_PROPOSAL_DOCUMENT_ADAPTER_PORT = Symbol(
  'SALES_PROPOSAL_DOCUMENT_ADAPTER_PORT',
);

export type ProposalDocumentInput = {
  readonly proposalId: string;
  readonly proposalNumber: string;
  readonly title: string;
  readonly language: string;
  readonly sections: readonly { code?: string; title?: string; body?: string }[];
};

export type ProposalDocumentResult =
  | {
      readonly outcome: 'GENERATED';
      readonly format: 'application/pdf';
      readonly documentRef: string;
      readonly bytesBase64: string;
    }
  | {
      readonly outcome: 'UNAVAILABLE';
      readonly failureCode: string;
      readonly failureMessage: string;
    };

export interface SalesProposalDocumentAdapterPort {
  generate(input: ProposalDocumentInput): Promise<ProposalDocumentResult>;
}

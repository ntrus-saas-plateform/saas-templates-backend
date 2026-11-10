import { Injectable } from '@nestjs/common';
import type {
  SalesSignatureAdapterPort,
  SignatureConfirmationInput,
  SignatureConfirmationResult,
  SignatureRequestInput,
  SignatureRequestResult,
} from '../../domain/sales/signature-adapter.port.js';

/**
 * Default when no e-sign provider is configured.
 * Honest UNAVAILABLE — never invents signature completion.
 */
@Injectable()
export class UnavailableSalesSignatureAdapter implements SalesSignatureAdapterPort {
  async requestSignature(_input: SignatureRequestInput): Promise<SignatureRequestResult> {
    return {
      outcome: 'UNAVAILABLE',
      failureCode: 'PROVIDER_NOT_CONFIGURED',
      failureMessage:
        'No electronic signature provider configured; cannot request signature',
    };
  }

  async confirmSignature(
    _input: SignatureConfirmationInput,
  ): Promise<SignatureConfirmationResult> {
    return {
      outcome: 'UNAVAILABLE',
      failureCode: 'PROVIDER_NOT_CONFIGURED',
      failureMessage:
        'No electronic signature provider configured; cannot confirm execution',
    };
  }
}

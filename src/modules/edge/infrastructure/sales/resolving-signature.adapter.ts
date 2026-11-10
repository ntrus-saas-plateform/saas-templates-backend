import { Injectable, Inject } from '@nestjs/common';
import type {
  SalesSignatureAdapterPort,
  SignatureConfirmationInput,
  SignatureConfirmationResult,
  SignatureRequestInput,
  SignatureRequestResult,
} from '../../domain/sales/signature-adapter.port.js';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import { UnavailableSalesSignatureAdapter } from './unavailable-signature.adapter.js';
import { DocuSignSalesSignatureAdapter } from './docusign-signature.adapter.js';
import { HelloSignSalesSignatureAdapter } from './hellosign-signature.adapter.js';

/**
 * Routes e-sign by SALES_SIGNATURE_ADAPTER (or auto from credentials).
 * Default UNAVAILABLE — never invents confirmation.
 */
@Injectable()
export class ResolvingSalesSignatureAdapter implements SalesSignatureAdapterPort {
  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly unavailable: UnavailableSalesSignatureAdapter,
    private readonly docusign: DocuSignSalesSignatureAdapter,
    private readonly hellosign: HelloSignSalesSignatureAdapter,
  ) {}

  private resolveMode(): 'unavailable' | 'docusign' | 'hellosign' {
    if (this.config.SALES_SIGNATURE_ADAPTER === 'auto') {
      if (this.config.DOCUSIGN_ACCESS_TOKEN && this.config.DOCUSIGN_ACCOUNT_ID) {
        return 'docusign';
      }
      if (this.config.HELLOSIGN_API_KEY) return 'hellosign';
      return 'unavailable';
    }
    return this.config.SALES_SIGNATURE_ADAPTER;
  }

  private adapterFor(
    mode: 'unavailable' | 'docusign' | 'hellosign',
  ): SalesSignatureAdapterPort {
    switch (mode) {
      case 'docusign':
        return this.docusign;
      case 'hellosign':
        return this.hellosign;
      case 'unavailable':
      default:
        return this.unavailable;
    }
  }

  async requestSignature(input: SignatureRequestInput): Promise<SignatureRequestResult> {
    return this.adapterFor(this.resolveMode()).requestSignature(input);
  }

  async confirmSignature(
    input: SignatureConfirmationInput,
  ): Promise<SignatureConfirmationResult> {
    if (input.provider === 'docusign') {
      return this.docusign.confirmSignature(input);
    }
    if (input.provider === 'hellosign') {
      return this.hellosign.confirmSignature(input);
    }
    return this.adapterFor(this.resolveMode()).confirmSignature(input);
  }
}

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
import { LoggerService } from '../../../../shared/logging/logger.service.js';

const HELLOSIGN_API = 'https://api.hellosign.com/v3';

/**
 * Live Dropbox Sign (HelloSign) adapter.
 * REQUESTED only on 2xx create; CONFIRMED only when is_complete === true.
 * Never invents EXECUTED.
 */
@Injectable()
export class HelloSignSalesSignatureAdapter implements SalesSignatureAdapterPort {
  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly logger: LoggerService,
  ) {}

  private authHeader(): string | null {
    const key = this.config.HELLOSIGN_API_KEY;
    if (!key) return null;
    return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
  }

  async requestSignature(input: SignatureRequestInput): Promise<SignatureRequestResult> {
    const auth = this.authHeader();
    if (!auth) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'HELLOSIGN_API_KEY_MISSING',
        failureMessage: 'HELLOSIGN_API_KEY is not configured',
      };
    }
    if (!input.signers.length) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'HELLOSIGN_SIGNERS_MISSING',
        failureMessage: 'At least one signer email is required',
      };
    }

    const form = new URLSearchParams();
    form.set('test_mode', this.config.HELLOSIGN_TEST_MODE ? '1' : '0');
    form.set('title', input.contractNumber);
    form.set('subject', `Please sign ${input.contractNumber}`);
    form.set('message', `Contract ${input.contractId}`);
    form.set('metadata[contractId]', input.contractId);
    form.set('metadata[correlationId]', input.correlationId);
    if (this.config.HELLOSIGN_CLIENT_ID) {
      form.set('client_id', this.config.HELLOSIGN_CLIENT_ID);
    }
    input.signers.forEach((s, i) => {
      form.set(`signers[${i}][email_address]`, s.email);
      form.set(`signers[${i}][name]`, s.name?.trim() || s.email);
    });
    if (input.documentRef) {
      form.set('file_url[0]', input.documentRef);
    } else {
      // Dropbox Sign requires a file; without URL we cannot invent a signed PDF.
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'HELLOSIGN_DOCUMENT_REF_REQUIRED',
        failureMessage:
          'HelloSign requires documentRef (file URL); cannot request signature without a document',
      };
    }

    try {
      const res = await fetch(`${HELLOSIGN_API}/signature_request/send`, {
        method: 'POST',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });
      const bodyText = await res.text().catch(() => '');
      if (!res.ok) {
        this.logger.warn('HelloSign signature request rejected', {
          status: res.status,
          contractId: input.contractId,
        });
        return {
          outcome: 'UNAVAILABLE',
          failureCode: `HELLOSIGN_HTTP_${res.status}`,
          failureMessage: `HelloSign ${res.status}: ${bodyText.slice(0, 400)}`,
        };
      }

      let signatureRequestId = '';
      try {
        const json = JSON.parse(bodyText) as {
          signature_request?: { signature_request_id?: string };
        };
        signatureRequestId = json.signature_request?.signature_request_id ?? '';
      } catch {
        /* ignore */
      }
      if (!signatureRequestId) {
        return {
          outcome: 'UNAVAILABLE',
          failureCode: 'HELLOSIGN_REQUEST_ID_MISSING',
          failureMessage: 'HelloSign response missing signature_request_id',
        };
      }

      return {
        outcome: 'REQUESTED',
        provider: 'hellosign',
        externalId: signatureRequestId,
      };
    } catch (error) {
      this.logger.warn('HelloSign transport error', {
        error: error instanceof Error ? error.message : String(error),
        contractId: input.contractId,
      });
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'HELLOSIGN_TRANSPORT_ERROR',
        failureMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async confirmSignature(
    input: SignatureConfirmationInput,
  ): Promise<SignatureConfirmationResult> {
    if (input.provider !== 'hellosign') {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'HELLOSIGN_PROVIDER_MISMATCH',
        failureMessage: `HelloSign adapter cannot confirm provider ${input.provider}`,
      };
    }
    const auth = this.authHeader();
    if (!auth) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'HELLOSIGN_API_KEY_MISSING',
        failureMessage: 'HELLOSIGN_API_KEY is not configured',
      };
    }

    try {
      const res = await fetch(
        `${HELLOSIGN_API}/signature_request/${encodeURIComponent(input.externalId)}`,
        { method: 'GET', headers: { Authorization: auth, Accept: 'application/json' } },
      );
      const bodyText = await res.text().catch(() => '');
      if (!res.ok) {
        return {
          outcome: 'NOT_CONFIRMED',
          failureCode: `HELLOSIGN_HTTP_${res.status}`,
          failureMessage: `HelloSign ${res.status}: ${bodyText.slice(0, 400)}`,
        };
      }

      let isComplete = false;
      try {
        const json = JSON.parse(bodyText) as {
          signature_request?: { is_complete?: boolean };
        };
        isComplete = Boolean(json.signature_request?.is_complete);
      } catch {
        /* ignore */
      }

      if (isComplete) {
        return { outcome: 'CONFIRMED', confirmedAt: new Date().toISOString() };
      }

      return {
        outcome: 'NOT_CONFIRMED',
        failureCode: 'HELLOSIGN_NOT_COMPLETE',
        failureMessage: 'HelloSign signature request is not complete',
      };
    } catch (error) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'HELLOSIGN_TRANSPORT_ERROR',
        failureMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

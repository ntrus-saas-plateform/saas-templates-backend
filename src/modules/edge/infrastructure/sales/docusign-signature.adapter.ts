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

/**
 * Live DocuSign eSignature REST adapter.
 * REQUESTED only on 2xx create; CONFIRMED only when envelope status is completed.
 * Never invents EXECUTED.
 */
@Injectable()
export class DocuSignSalesSignatureAdapter implements SalesSignatureAdapterPort {
  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly logger: LoggerService,
  ) {}

  async requestSignature(input: SignatureRequestInput): Promise<SignatureRequestResult> {
    const token = this.config.DOCUSIGN_ACCESS_TOKEN;
    const accountId = this.config.DOCUSIGN_ACCOUNT_ID;
    if (!token || !accountId) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'DOCUSIGN_CREDENTIALS_MISSING',
        failureMessage: 'DOCUSIGN_ACCESS_TOKEN and DOCUSIGN_ACCOUNT_ID are required',
      };
    }
    if (!input.signers.length) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'DOCUSIGN_SIGNERS_MISSING',
        failureMessage: 'At least one signer email is required',
      };
    }

    const base = this.config.DOCUSIGN_BASE_URL.replace(/\/$/, '');
    const url = `${base}/v2.1/accounts/${accountId}/envelopes`;
    const signers = input.signers.map((s, i) => ({
      email: s.email,
      name: s.name?.trim() || s.email,
      recipientId: String(i + 1),
      routingOrder: '1',
      roleName: s.role ?? 'Signer',
    }));

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-DocuSign-Idempotency-Key': input.correlationId.slice(0, 36),
        },
        body: JSON.stringify({
          emailSubject: `Please sign ${input.contractNumber}`,
          status: 'sent',
          recipients: { signers },
          customFields: {
            textCustomFields: [
              { name: 'contractId', value: input.contractId, show: 'false' },
              { name: 'correlationId', value: input.correlationId, show: 'false' },
            ],
          },
          ...(input.documentRef
            ? {
                documents: [
                  {
                    documentId: '1',
                    name: `${input.contractNumber}.pdf`,
                    documentBase64: undefined,
                    remoteUrl: input.documentRef,
                  },
                ],
              }
            : {
                documents: [
                  {
                    documentId: '1',
                    name: `${input.contractNumber}.txt`,
                    documentBase64: Buffer.from(
                      `Contract ${input.contractNumber} (${input.contractId})`,
                      'utf8',
                    ).toString('base64'),
                    fileExtension: 'txt',
                  },
                ],
              }),
        }),
      });

      const bodyText = await res.text().catch(() => '');
      if (!res.ok) {
        this.logger.warn('DocuSign envelope create rejected', {
          status: res.status,
          contractId: input.contractId,
        });
        return {
          outcome: 'UNAVAILABLE',
          failureCode: `DOCUSIGN_HTTP_${res.status}`,
          failureMessage: `DocuSign ${res.status}: ${bodyText.slice(0, 400)}`,
        };
      }

      let envelopeId = '';
      try {
        const json = JSON.parse(bodyText) as { envelopeId?: string };
        envelopeId = json.envelopeId ?? '';
      } catch {
        /* ignore */
      }
      if (!envelopeId) {
        return {
          outcome: 'UNAVAILABLE',
          failureCode: 'DOCUSIGN_ENVELOPE_ID_MISSING',
          failureMessage: 'DocuSign response missing envelopeId',
        };
      }

      return { outcome: 'REQUESTED', provider: 'docusign', externalId: envelopeId };
    } catch (error) {
      this.logger.warn('DocuSign transport error', {
        error: error instanceof Error ? error.message : String(error),
        contractId: input.contractId,
      });
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'DOCUSIGN_TRANSPORT_ERROR',
        failureMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async confirmSignature(
    input: SignatureConfirmationInput,
  ): Promise<SignatureConfirmationResult> {
    if (input.provider !== 'docusign') {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'DOCUSIGN_PROVIDER_MISMATCH',
        failureMessage: `DocuSign adapter cannot confirm provider ${input.provider}`,
      };
    }
    const token = this.config.DOCUSIGN_ACCESS_TOKEN;
    const accountId = this.config.DOCUSIGN_ACCOUNT_ID;
    if (!token || !accountId) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'DOCUSIGN_CREDENTIALS_MISSING',
        failureMessage: 'DOCUSIGN_ACCESS_TOKEN and DOCUSIGN_ACCOUNT_ID are required',
      };
    }

    const base = this.config.DOCUSIGN_BASE_URL.replace(/\/$/, '');
    const url = `${base}/v2.1/accounts/${accountId}/envelopes/${encodeURIComponent(input.externalId)}`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const bodyText = await res.text().catch(() => '');
      if (!res.ok) {
        return {
          outcome: 'NOT_CONFIRMED',
          failureCode: `DOCUSIGN_HTTP_${res.status}`,
          failureMessage: `DocuSign ${res.status}: ${bodyText.slice(0, 400)}`,
        };
      }

      let status = '';
      let completedAt: string | undefined;
      try {
        const json = JSON.parse(bodyText) as {
          status?: string;
          completedDateTime?: string;
          statusChangedDateTime?: string;
        };
        status = (json.status ?? '').toLowerCase();
        completedAt = json.completedDateTime ?? json.statusChangedDateTime;
      } catch {
        /* ignore */
      }

      if (status === 'completed') {
        return {
          outcome: 'CONFIRMED',
          confirmedAt: completedAt ?? new Date().toISOString(),
        };
      }

      return {
        outcome: 'NOT_CONFIRMED',
        failureCode: 'DOCUSIGN_NOT_COMPLETED',
        failureMessage: `DocuSign envelope status is ${status || 'unknown'}`,
      };
    } catch (error) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'DOCUSIGN_TRANSPORT_ERROR',
        failureMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

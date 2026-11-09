import { describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import { ProcessResendMarketingWebhookUseCase } from './resend-webhook.use-case.js';

function sign(secretB64: string, id: string, timestamp: string, payload: string): string {
  const key = Buffer.from(secretB64, 'base64');
  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${payload}`)
    .digest('base64');
  return `v1,${expected}`;
}

describe('ProcessResendMarketingWebhookUseCase', () => {
  const secretB64 = Buffer.from('webhook-secret-bytes!!').toString('base64');
  const webhookSecret = `whsec_${secretB64}`;

  it('rejects when webhook secret missing', async () => {
    const uc = new ProcessResendMarketingWebhookUseCase(
      {} as never,
      { execute: vi.fn() } as never,
      undefined,
    );
    await expect(
      uc.execute({
        rawBody: '{}',
        headers: { id: 'a', timestamp: '1', signature: 'v1,x' },
      }),
    ).rejects.toThrow(DomainError);
  });

  it('rejects invalid signature', async () => {
    const uc = new ProcessResendMarketingWebhookUseCase(
      {} as never,
      { execute: vi.fn() } as never,
      webhookSecret,
    );
    await expect(
      uc.execute({
        rawBody: '{"type":"email.delivered"}',
        headers: { id: 'msg_1', timestamp: String(Math.floor(Date.now() / 1000)), signature: 'v1,bad' },
      }),
    ).rejects.toThrow(/signature invalid/i);
  });

  it('ingests signed delivered event via email_id correlation', async () => {
    const payload = JSON.stringify({
      type: 'email.delivered',
      data: { email_id: 'email_abc' },
    });
    const id = 'msg_ok';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const ingest = vi.fn(async () => ({ receiptId: 'r1', duplicate: false }));
    const marketing = {
      getDeliveryAttempt: vi.fn(),
      findDeliveryByProviderMessageId: vi.fn(async () => ({
        id: 'attempt-1',
        status: 'SUBMITTED',
      })),
    };
    const uc = new ProcessResendMarketingWebhookUseCase(
      marketing as never,
      { execute: ingest } as never,
      webhookSecret,
    );

    const result = await uc.execute({
      rawBody: payload,
      headers: {
        id,
        timestamp,
        signature: sign(secretB64, id, timestamp, payload),
      },
    });

    expect(result).toEqual({ receiptId: 'r1', duplicate: false });
    expect(ingest).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryAttemptId: 'attempt-1',
        receiptStatus: 'DELIVERED',
        signatureValid: true,
        providerEventId: id,
      }),
    );
  });
});

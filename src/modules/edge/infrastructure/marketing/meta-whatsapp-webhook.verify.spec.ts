import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  extractWhatsAppStatusReceipts,
  verifyMetaWhatsAppSignature,
} from './meta-whatsapp-webhook.verify.js';

describe('verifyMetaWhatsAppSignature', () => {
  it('accepts valid X-Hub-Signature-256', () => {
    const rawBody = '{"object":"whatsapp_business_account"}';
    const appSecret = 'app-secret';
    const hex = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    expect(
      verifyMetaWhatsAppSignature({
        rawBody,
        appSecret,
        signatureHeader: `sha256=${hex}`,
      }),
    ).toBe(true);
  });

  it('rejects bad signatures', () => {
    expect(
      verifyMetaWhatsAppSignature({
        rawBody: '{}',
        appSecret: 'x',
        signatureHeader: 'sha256=deadbeef',
      }),
    ).toBe(false);
  });
});

describe('extractWhatsAppStatusReceipts', () => {
  it('maps delivered/read/failed', () => {
    const receipts = extractWhatsAppStatusReceipts({
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  { id: 'wamid.1', status: 'delivered' },
                  { id: 'wamid.1', status: 'read' },
                  { id: 'wamid.2', status: 'failed' },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(receipts.map((r) => r.receiptStatus)).toEqual([
      'DELIVERED',
      'OPENED',
      'FAILED',
    ]);
  });
});

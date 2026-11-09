import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  extractResendDeliveryCorrelation,
  mapResendEventToReceiptStatus,
  verifyResendSvixSignature,
} from './resend-svix.verify.js';

function sign(secretB64: string, id: string, timestamp: string, payload: string): string {
  const key = Buffer.from(secretB64, 'base64');
  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${payload}`)
    .digest('base64');
  return `v1,${expected}`;
}

describe('verifyResendSvixSignature', () => {
  const secretB64 = Buffer.from('test-secret-key-bytes!!').toString('base64');
  const webhookSecret = `whsec_${secretB64}`;
  const payload = JSON.stringify({
    type: 'email.delivered',
    data: {
      email_id: 'email_abc',
      tags: { delivery_attempt_id: '11111111-1111-4111-8111-111111111111' },
    },
  });
  const id = 'msg_test_1';
  const timestamp = String(Math.floor(Date.now() / 1000));

  it('accepts a valid Svix signature', () => {
    expect(
      verifyResendSvixSignature({
        payload,
        webhookSecret,
        headers: {
          id,
          timestamp,
          signature: sign(secretB64, id, timestamp, payload),
        },
      }),
    ).toBe(true);
  });

  it('rejects tampered payload', () => {
    expect(
      verifyResendSvixSignature({
        payload: payload + ' ',
        webhookSecret,
        headers: {
          id,
          timestamp,
          signature: sign(secretB64, id, timestamp, payload),
        },
      }),
    ).toBe(false);
  });

  it('rejects stale timestamps', () => {
    const oldTs = String(Math.floor(Date.now() / 1000) - 10_000);
    expect(
      verifyResendSvixSignature({
        payload,
        webhookSecret,
        headers: {
          id,
          timestamp: oldTs,
          signature: sign(secretB64, id, oldTs, payload),
        },
      }),
    ).toBe(false);
  });
});

describe('mapResendEventToReceiptStatus', () => {
  it('maps delivered/bounced/failed honestly', () => {
    expect(mapResendEventToReceiptStatus('email.delivered')).toBe('DELIVERED');
    expect(mapResendEventToReceiptStatus('email.bounced')).toBe('BOUNCED');
    expect(mapResendEventToReceiptStatus('email.failed')).toBe('FAILED');
    expect(mapResendEventToReceiptStatus('email.opened')).toBe('OPENED');
    expect(mapResendEventToReceiptStatus('email.unknown_event')).toBe('UNKNOWN');
  });
});

describe('extractResendDeliveryCorrelation', () => {
  it('reads email_id and delivery_attempt_id tag', () => {
    expect(
      extractResendDeliveryCorrelation({
        type: 'email.delivered',
        data: {
          email_id: 'email_1',
          tags: { delivery_attempt_id: 'd1' },
        },
      }),
    ).toEqual({
      providerMessageId: 'email_1',
      deliveryAttemptId: 'd1',
      eventType: 'email.delivered',
    });
  });
});

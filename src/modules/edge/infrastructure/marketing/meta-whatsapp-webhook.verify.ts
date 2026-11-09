import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyMetaWhatsAppSignature(input: {
  rawBody: string | Buffer;
  signatureHeader: string | undefined;
  appSecret: string;
}): boolean {
  const header = input.signatureHeader?.trim() ?? '';
  if (!header.startsWith('sha256=') || !input.appSecret) return false;
  const expectedHex = createHmac('sha256', input.appSecret)
    .update(typeof input.rawBody === 'string' ? input.rawBody : input.rawBody)
    .digest('hex');
  const expected = Buffer.from(`sha256=${expectedHex}`);
  const got = Buffer.from(header);
  if (expected.length !== got.length) return false;
  return timingSafeEqual(expected, got);
}

export type WhatsAppStatusReceipt = {
  providerMessageId: string;
  providerEventId: string;
  receiptStatus: 'DELIVERED' | 'FAILED' | 'BOUNCED' | 'OPENED' | 'CLICKED' | 'UNKNOWN';
};

/** Extract outbound message status updates from a Meta Cloud API webhook payload. */
export function extractWhatsAppStatusReceipts(payload: unknown): WhatsAppStatusReceipt[] {
  if (!payload || typeof payload !== 'object') return [];
  const out: WhatsAppStatusReceipt[] = [];
  const entry = (payload as { entry?: unknown[] }).entry;
  if (!Array.isArray(entry)) return out;

  for (const e of entry) {
    if (!e || typeof e !== 'object') continue;
    const changes = (e as { changes?: unknown[] }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      if (!change || typeof change !== 'object') continue;
      const value = (change as { value?: { statuses?: unknown[] } }).value;
      const statuses = value?.statuses;
      if (!Array.isArray(statuses)) continue;
      for (const st of statuses) {
        if (!st || typeof st !== 'object') continue;
        const s = st as { id?: string; status?: string; errors?: unknown[] };
        if (!s.id || !s.status) continue;
        const receiptStatus = mapWhatsAppStatus(s.status);
        out.push({
          providerMessageId: s.id,
          providerEventId: `${s.id}:${s.status}`,
          receiptStatus,
        });
      }
    }
  }
  return out;
}

function mapWhatsAppStatus(
  status: string,
): 'DELIVERED' | 'FAILED' | 'BOUNCED' | 'OPENED' | 'CLICKED' | 'UNKNOWN' {
  switch (status) {
    case 'delivered':
      return 'DELIVERED';
    case 'read':
      return 'OPENED';
    case 'failed':
      return 'FAILED';
    case 'sent':
      return 'UNKNOWN'; // accepted by Meta; keep SUBMITTED until delivered
    default:
      return 'UNKNOWN';
  }
}

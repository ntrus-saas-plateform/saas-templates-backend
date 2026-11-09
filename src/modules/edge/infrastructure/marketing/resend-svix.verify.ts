import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TOLERANCE_SECONDS = 300;

export type ResendWebhookHeaders = {
  readonly id: string;
  readonly timestamp: string;
  readonly signature: string;
};

/**
 * Manual Svix signature verification (Resend webhooks).
 * @see https://resend.com/docs/webhooks/verify-webhooks-requests
 */
export function verifyResendSvixSignature(input: {
  payload: string;
  headers: ResendWebhookHeaders;
  webhookSecret: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): boolean {
  const secret = input.webhookSecret.trim();
  if (!secret || !input.payload || !input.headers.id || !input.headers.timestamp || !input.headers.signature) {
    return false;
  }

  const ts = Number(input.headers.timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (Math.abs(now - ts) > tolerance) return false;

  const keyB64 = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(keyB64, 'base64');
  } catch {
    return false;
  }
  if (key.length === 0) return false;

  const signedContent = `${input.headers.id}.${input.headers.timestamp}.${input.payload}`;
  const expected = createHmac('sha256', key).update(signedContent).digest('base64');

  for (const part of input.headers.signature.split(' ')) {
    const [, sig] = part.split(',', 2);
    if (!sig) continue;
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

export type MarketingReceiptStatus =
  | 'DELIVERED'
  | 'FAILED'
  | 'BOUNCED'
  | 'OPENED'
  | 'CLICKED'
  | 'UNKNOWN';

/** Map Resend event types to marketing receipt statuses. */
export function mapResendEventToReceiptStatus(eventType: string): MarketingReceiptStatus {
  switch (eventType) {
    case 'email.delivered':
      return 'DELIVERED';
    case 'email.bounced':
      return 'BOUNCED';
    case 'email.complained':
    case 'email.failed':
    case 'email.suppressed':
      return 'FAILED';
    case 'email.opened':
      return 'OPENED';
    case 'email.clicked':
      return 'CLICKED';
    default:
      return 'UNKNOWN';
  }
}

export function extractResendDeliveryCorrelation(payload: {
  type?: string;
  data?: {
    email_id?: string;
    tags?: Record<string, string> | Array<{ name: string; value: string }>;
  };
}): {
  providerMessageId: string | null;
  deliveryAttemptId: string | null;
  eventType: string;
} {
  const eventType = typeof payload.type === 'string' ? payload.type : '';
  const data = payload.data ?? {};
  const providerMessageId =
    typeof data.email_id === 'string' && data.email_id.length > 0 ? data.email_id : null;

  let deliveryAttemptId: string | null = null;
  const tags = data.tags;
  if (tags && !Array.isArray(tags) && typeof tags.delivery_attempt_id === 'string') {
    deliveryAttemptId = tags.delivery_attempt_id;
  } else if (Array.isArray(tags)) {
    const hit = tags.find((t) => t.name === 'delivery_attempt_id');
    if (hit?.value) deliveryAttemptId = hit.value;
  }

  return { providerMessageId, deliveryAttemptId, eventType };
}

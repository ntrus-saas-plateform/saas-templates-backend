/**
 * Explicit revenue recognition methods for P6 reporting.
 * Never silently equate billed revenue with recognized revenue.
 */

export type RevenueRecognitionMethod =
  | 'CASH_BASED_NET'
  | 'BILLING_BASED'
  | 'DEFERRED_MANUAL';

export type RevenueRecognitionInput = {
  method: RevenueRecognitionMethod;
  billedTotal: string;
  collectedTotal: string;
  refundedTotal: string;
  currency: string;
};

export type RevenueRecognitionResult = {
  recognizedRevenue: string | null;
  method: RevenueRecognitionMethod;
  disclaimer: string;
  components: {
    billedTotal: string;
    collectedTotal: string;
    refundedTotal: string;
    currency: string;
  };
};

export function computeRecognizedRevenue(
  input: RevenueRecognitionInput,
): RevenueRecognitionResult {
  const components = {
    billedTotal: input.billedTotal,
    collectedTotal: input.collectedTotal,
    refundedTotal: input.refundedTotal,
    currency: input.currency,
  };

  if (input.method === 'DEFERRED_MANUAL') {
    return {
      recognizedRevenue: null,
      method: input.method,
      disclaimer:
        'Recognized revenue deferred — DEFERRED_MANUAL policy; post recognition entries before reporting.',
      components,
    };
  }

  if (input.method === 'BILLING_BASED') {
    return {
      recognizedRevenue: input.billedTotal,
      method: input.method,
      disclaimer:
        'Recognized revenue uses BILLING_BASED policy (issued totals). Confirm with finance before external reporting.',
      components,
    };
  }

  // CASH_BASED_NET — decimal string subtraction via integer cents approximation (2dp)
  const net = subtractMoneyStrings(input.collectedTotal, input.refundedTotal);
  return {
    recognizedRevenue: net,
    method: 'CASH_BASED_NET',
    disclaimer:
      'Recognized revenue = succeeded payments − succeeded refunds (CASH_BASED_NET). Not ASC-606 deferred revenue.',
    components,
  };
}

function subtractMoneyStrings(a: string, b: string): string {
  const toCents = (s: string): bigint => {
    const neg = s.trim().startsWith('-');
    const raw = neg ? s.trim().slice(1) : s.trim();
    const [w, f = ''] = raw.split('.');
    const frac = (f + '00').slice(0, 2);
    const cents = BigInt(w || '0') * 100n + BigInt(frac);
    return neg ? -cents : cents;
  };
  const fromCents = (c: bigint): string => {
    const neg = c < 0n;
    const abs = neg ? -c : c;
    const whole = abs / 100n;
    const frac = (abs % 100n).toString().padStart(2, '0');
    return `${neg ? '-' : ''}${whole}.${frac}`;
  };
  return fromCents(toCents(a) - toCents(b));
}

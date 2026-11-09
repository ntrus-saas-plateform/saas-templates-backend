import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

/** Decimal money helpers — never use IEEE floats for amounts. */

const SCALE = 6n;
const FACTOR = 10n ** SCALE;

export type MoneyDecimal = {
  readonly currency: string;
  /** Fixed-scale integer (amount * 10^6) */
  readonly units: bigint;
};

export function assertCurrency(currency: string): string {
  const c = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Currency must be ISO 4217 (3 letters)', [
      { currency },
    ]);
  }
  return c;
}

export function parseMoneyAmount(amount: string | number, currency: string): MoneyDecimal {
  const cur = assertCurrency(currency);
  const raw = typeof amount === 'number' ? amount.toFixed(6) : amount.trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid money amount', [{ amount }]);
  }
  const negative = raw.startsWith('-');
  const [wholePart, fracPart = ''] = (negative ? raw.slice(1) : raw).split('.');
  const frac = (fracPart + '000000').slice(0, 6);
  const units = BigInt(wholePart) * FACTOR + BigInt(frac);
  return { currency: cur, units: negative ? -units : units };
}

export function formatMoneyAmount(money: MoneyDecimal): string {
  const neg = money.units < 0n;
  const abs = neg ? -money.units : money.units;
  const whole = abs / FACTOR;
  const frac = (abs % FACTOR).toString().padStart(6, '0');
  // Trim trailing zeros but keep at least 2 decimal places for display consistency
  const trimmed = frac.replace(/0+$/, '').padEnd(2, '0');
  return `${neg ? '-' : ''}${whole.toString()}.${trimmed}`;
}

export function addMoney(a: MoneyDecimal, b: MoneyDecimal): MoneyDecimal {
  if (a.currency !== b.currency) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Currency mismatch in money addition', [
      { a: a.currency, b: b.currency },
    ]);
  }
  return { currency: a.currency, units: a.units + b.units };
}

export function multiplyMoney(money: MoneyDecimal, quantity: number): MoneyDecimal {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Quantity must be a non-negative integer', [
      { quantity },
    ]);
  }
  return { currency: money.currency, units: money.units * BigInt(quantity) };
}

export function applyPercentageDiscount(
  money: MoneyDecimal,
  percent: string,
): { discounted: MoneyDecimal; discount: MoneyDecimal } {
  if (!/^\d+(\.\d+)?$/.test(percent)) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid discount percent', [{ percent }]);
  }
  const [w, f = ''] = percent.split('.');
  const pctScaled = BigInt(w) * 10000n + BigInt((f + '0000').slice(0, 4)); // percent * 10^4
  if (pctScaled > 1000000n) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Discount percent cannot exceed 100', [
      { percent },
    ]);
  }
  const discountUnits = (money.units * pctScaled) / 1000000n;
  return {
    discounted: { currency: money.currency, units: money.units - discountUnits },
    discount: { currency: money.currency, units: discountUnits },
  };
}

export type PricingTier = {
  readonly upTo: number | null; // null = open-ended
  readonly unitAmount: string;
};

export type PricingComponentInput = {
  readonly baseAmount: string;
  readonly currency: string;
  readonly quantity?: number;
  readonly modelType: string;
  /** Required for TIERED / VOLUME — ordered ascending by upTo. */
  readonly tiers?: readonly PricingTier[];
};

/**
 * Tiered: each unit band priced at its own rate (progressive).
 * Volume: entire quantity priced at the matching band rate.
 */
export function calculateTieredOrVolumePrice(input: {
  currency: string;
  quantity: number;
  tiers: readonly PricingTier[];
  mode: 'TIERED' | 'VOLUME';
}): { currency: string; amount: string; components: { code: string; amount: string }[] } {
  const cur = assertCurrency(input.currency);
  if (!Number.isInteger(input.quantity) || input.quantity < 0) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Quantity must be a non-negative integer', [
      { quantity: input.quantity },
    ]);
  }
  if (!input.tiers.length) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Tiers required for tiered/volume pricing');
  }

  const components: { code: string; amount: string }[] = [];
  let total = parseMoneyAmount('0', cur);

  if (input.mode === 'VOLUME') {
    let matched: PricingTier | null = null;
    for (const tier of input.tiers) {
      if (tier.upTo == null || input.quantity <= tier.upTo) {
        matched = tier;
        break;
      }
    }
    if (!matched) matched = input.tiers[input.tiers.length - 1];
    total = multiplyMoney(parseMoneyAmount(matched.unitAmount, cur), input.quantity);
    components.push({ code: 'volume', amount: formatMoneyAmount(total) });
  } else {
    let remaining = input.quantity;
    let prevBound = 0;
    let tierIndex = 0;
    for (const tier of input.tiers) {
      if (remaining <= 0) break;
      const bound = tier.upTo == null ? Number.POSITIVE_INFINITY : tier.upTo;
      const width = Math.max(0, Math.min(remaining, bound - prevBound));
      if (width > 0) {
        const part = multiplyMoney(parseMoneyAmount(tier.unitAmount, cur), width);
        total = addMoney(total, part);
        components.push({
          code: `tier_${tierIndex}`,
          amount: formatMoneyAmount(part),
        });
        remaining -= width;
      }
      prevBound = tier.upTo == null ? prevBound + width : tier.upTo;
      tierIndex += 1;
    }
  }

  return { currency: cur, amount: formatMoneyAmount(total), components };
}

export function calculateCommercialPrice(input: PricingComponentInput): {
  currency: string;
  amount: string;
  components: readonly { code: string; amount: string }[];
  policyVersion: number;
} {
  const base = parseMoneyAmount(input.baseAmount, input.currency);
  const qty = input.quantity ?? 1;

  if (input.modelType === 'TIERED' || input.modelType === 'VOLUME') {
    const result = calculateTieredOrVolumePrice({
      currency: input.currency,
      quantity: qty,
      tiers: input.tiers ?? [],
      mode: input.modelType,
    });
    return { ...result, policyVersion: 1 };
  }

  let total = base;
  if (
    input.modelType === 'PER_USER' ||
    input.modelType === 'PER_LOCATION' ||
    input.modelType === 'PER_DEVICE' ||
    input.modelType === 'PER_BRANCH' ||
    input.modelType === 'PER_TRANSACTION' ||
    input.modelType === 'USAGE_BASED'
  ) {
    total = multiplyMoney(base, qty);
  } else if (
    input.modelType === 'FLAT_FEE' ||
    input.modelType === 'ONE_TIME' ||
    input.modelType === 'RECURRING'
  ) {
    total = base;
  } else if (input.modelType === 'HYBRID') {
    total = addMoney(base, multiplyMoney(base, Math.max(qty - 1, 0)));
  } else if (input.modelType === 'CUSTOM_ENTERPRISE') {
    total = base;
  }

  return {
    currency: total.currency,
    amount: formatMoneyAmount(total),
    components: [{ code: 'base', amount: formatMoneyAmount(total) }],
    policyVersion: 1,
  };
}

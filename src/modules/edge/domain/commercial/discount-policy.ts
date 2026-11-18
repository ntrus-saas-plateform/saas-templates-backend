/**
 * RGOM-E2 — Discount policy + approval matrix beachhead.
 * Never invents discount % as MEASURED revenue impact.
 */

export type DiscountApprovalTier = 'AE' | 'MANAGER' | 'DIRECTOR' | 'CFO';

export type DiscountPolicyRule = {
  readonly maxPercentExclusive: number;
  readonly approver: DiscountApprovalTier;
  readonly auditRequired: boolean;
};

/** Percent bands: discount < maxPercentExclusive requires listed approver. */
export const DISCOUNT_APPROVAL_MATRIX: readonly DiscountPolicyRule[] = [
  { maxPercentExclusive: 5, approver: 'AE', auditRequired: true },
  { maxPercentExclusive: 15, approver: 'MANAGER', auditRequired: true },
  { maxPercentExclusive: 25, approver: 'DIRECTOR', auditRequired: true },
  { maxPercentExclusive: 100, approver: 'CFO', auditRequired: true },
] as const;

export type DiscountGateResult = {
  readonly allowed: boolean;
  readonly requiredApprover: DiscountApprovalTier | null;
  readonly auditRequired: boolean;
  readonly reasons: string[];
};

export function evaluateDiscountApproval(input: {
  discountPercent: number | null | undefined;
  actorTier: DiscountApprovalTier;
}): DiscountGateResult {
  const reasons: string[] = [];
  if (input.discountPercent == null || !Number.isFinite(input.discountPercent)) {
    reasons.push('discountPercent missing — UNAVAILABLE (not invented 0).');
    return {
      allowed: false,
      requiredApprover: null,
      auditRequired: true,
      reasons,
    };
  }
  if (input.discountPercent < 0 || input.discountPercent > 100) {
    reasons.push('discountPercent out of range 0–100');
    return {
      allowed: false,
      requiredApprover: null,
      auditRequired: true,
      reasons,
    };
  }
  if (input.discountPercent === 0) {
    reasons.push('No discount — AE may proceed without escalation.');
    return {
      allowed: true,
      requiredApprover: 'AE',
      auditRequired: false,
      reasons,
    };
  }

  const rule =
    DISCOUNT_APPROVAL_MATRIX.find((r) => input.discountPercent! < r.maxPercentExclusive) ??
    DISCOUNT_APPROVAL_MATRIX[DISCOUNT_APPROVAL_MATRIX.length - 1];

  const rank: Record<DiscountApprovalTier, number> = {
    AE: 1,
    MANAGER: 2,
    DIRECTOR: 3,
    CFO: 4,
  };
  const allowed = rank[input.actorTier] >= rank[rule.approver];
  reasons.push(
    allowed
      ? `Actor ${input.actorTier} meets ${rule.approver} for ${input.discountPercent}%.`
      : `Actor ${input.actorTier} below required ${rule.approver} for ${input.discountPercent}%.`,
  );
  return {
    allowed,
    requiredApprover: rule.approver,
    auditRequired: rule.auditRequired,
    reasons,
  };
}

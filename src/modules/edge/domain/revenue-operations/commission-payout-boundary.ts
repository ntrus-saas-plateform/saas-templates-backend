import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

/**
 * RGOM-E10 / E11 — Partner commission calc ≠ payout.
 * Calculation / approval creates an immutable liability snapshot.
 * Payout is a separate treasury workflow — never auto-paid from calculate/approve.
 */

export type CommissionLifecycleStage =
  | 'CALCULATED'
  | 'APPROVED'
  | 'PAYOUT_SCHEDULED'
  | 'PAID'
  | 'VOID';

export type CommissionPayoutGateResult = {
  readonly mayInitiatePayout: boolean;
  readonly stage: CommissionLifecycleStage;
  readonly reasons: string[];
};

/**
 * Approve ≠ pay. Only APPROVED calculations may enter payout scheduling —
 * and even then payout is a distinct actor/permission path.
 */
export function assertCommissionCalcIsNotPayout(stage: CommissionLifecycleStage): void {
  if (stage === 'PAID' || stage === 'PAYOUT_SCHEDULED') {
    throw new DomainError(
      ErrorCode.FORBIDDEN,
      'Commission calculate/approve path must not mark payout; use dedicated payout workflow',
      [{ code: 'COMMISSION_CALC_IS_NOT_PAYOUT', stage }],
    );
  }
}

export function evaluateCommissionPayoutGate(input: {
  stage: CommissionLifecycleStage;
  payoutPermissionGranted: boolean;
}): CommissionPayoutGateResult {
  const reasons: string[] = [];
  if (input.stage !== 'APPROVED') {
    reasons.push(`Stage ${input.stage} — payout requires APPROVED calculation first.`);
  }
  if (!input.payoutPermissionGranted) {
    reasons.push('platform:commission:payout (or treasury) permission required — calc/approve insufficient.');
  }
  const mayInitiatePayout =
    input.stage === 'APPROVED' && input.payoutPermissionGranted === true;
  if (mayInitiatePayout) {
    reasons.push('Payout may be scheduled via separate workflow — still not auto-paid.');
  }
  return { mayInitiatePayout, stage: input.stage, reasons };
}

import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  ControlExchangeStatus,
  ExchangeReconciliationStatus,
} from './product-control.types.js';

const EXCHANGE_TRANSITIONS: Record<
  ControlExchangeStatus,
  readonly ControlExchangeStatus[]
> = {
  [ControlExchangeStatus.CREATED]: [
    ControlExchangeStatus.QUEUED,
    ControlExchangeStatus.CANCELLED,
  ],
  [ControlExchangeStatus.QUEUED]: [
    ControlExchangeStatus.SENDING,
    ControlExchangeStatus.CANCELLED,
  ],
  [ControlExchangeStatus.SENDING]: [
    ControlExchangeStatus.SENT,
    // Synchronous HTTP response may complete in the same dispatch (no separate ACK).
    ControlExchangeStatus.SUCCEEDED,
    ControlExchangeStatus.FAILED,
    ControlExchangeStatus.UNKNOWN_OUTCOME,
    ControlExchangeStatus.CANCELLED,
  ],
  [ControlExchangeStatus.SENT]: [
    ControlExchangeStatus.ACKNOWLEDGED,
    ControlExchangeStatus.SUCCEEDED,
    ControlExchangeStatus.FAILED,
    ControlExchangeStatus.UNKNOWN_OUTCOME,
    ControlExchangeStatus.RETRY_PENDING,
  ],
  [ControlExchangeStatus.ACKNOWLEDGED]: [
    ControlExchangeStatus.SUCCEEDED,
    ControlExchangeStatus.FAILED,
    ControlExchangeStatus.UNKNOWN_OUTCOME,
  ],
  [ControlExchangeStatus.SUCCEEDED]: [],
  [ControlExchangeStatus.FAILED]: [
    ControlExchangeStatus.RETRY_PENDING,
    ControlExchangeStatus.RECONCILIATION_REQUIRED,
  ],
  [ControlExchangeStatus.RETRY_PENDING]: [
    ControlExchangeStatus.QUEUED,
    ControlExchangeStatus.SENDING,
    ControlExchangeStatus.CANCELLED,
  ],
  [ControlExchangeStatus.UNKNOWN_OUTCOME]: [
    ControlExchangeStatus.RECONCILIATION_REQUIRED,
    ControlExchangeStatus.SUCCEEDED,
    ControlExchangeStatus.FAILED,
  ],
  [ControlExchangeStatus.RECONCILIATION_REQUIRED]: [
    ControlExchangeStatus.RECONCILED,
    ControlExchangeStatus.SUCCEEDED,
    ControlExchangeStatus.FAILED,
  ],
  [ControlExchangeStatus.RECONCILED]: [],
  [ControlExchangeStatus.CANCELLED]: [],
};

export function canTransitionExchange(
  from: ControlExchangeStatus,
  to: ControlExchangeStatus,
): boolean {
  if (from === to) return true;
  return EXCHANGE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertExchangeTransition(
  from: ControlExchangeStatus,
  to: ControlExchangeStatus,
): void {
  if (from === to) return;
  if (!canTransitionExchange(from, to)) {
    throw new DomainError(
      ErrorCode.INVALID_STATE_TRANSITION,
      `Invalid ControlExchange transition ${from} → ${to}`,
      [{ from, to }],
    );
  }
}

/**
 * Timeout after the request was transmitted must become UNKNOWN_OUTCOME —
 * never assume the Product Control did not receive it.
 */
export function resolveTimeoutOutcome(alreadySent: boolean): ControlExchangeStatus {
  return alreadySent
    ? ControlExchangeStatus.UNKNOWN_OUTCOME
    : ControlExchangeStatus.FAILED;
}

export function requiresReconciliation(status: ControlExchangeStatus): boolean {
  return (
    status === ControlExchangeStatus.UNKNOWN_OUTCOME ||
    status === ControlExchangeStatus.RECONCILIATION_REQUIRED
  );
}

export function nextReconciliationStatus(
  exchangeStatus: ControlExchangeStatus,
): ExchangeReconciliationStatus {
  if (
    exchangeStatus === ControlExchangeStatus.UNKNOWN_OUTCOME ||
    exchangeStatus === ControlExchangeStatus.RECONCILIATION_REQUIRED
  ) {
    return ExchangeReconciliationStatus.REQUIRED;
  }
  if (exchangeStatus === ControlExchangeStatus.RECONCILED) {
    return ExchangeReconciliationStatus.RECONCILED;
  }
  return ExchangeReconciliationStatus.NONE;
}

export function assertRetryFromUnknownOutcomeBlocked(
  status: ControlExchangeStatus,
  wouldMutate: boolean,
): void {
  if (
    wouldMutate &&
    (status === ControlExchangeStatus.UNKNOWN_OUTCOME ||
      status === ControlExchangeStatus.RECONCILIATION_REQUIRED)
  ) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      'Cannot retry a potentially mutative exchange with UNKNOWN_OUTCOME before reconciliation',
      [{ status }],
    );
  }
}

export function allowedExchangeTransitions(
  from: ControlExchangeStatus,
): readonly ControlExchangeStatus[] {
  return EXCHANGE_TRANSITIONS[from] ?? [];
}

export function isTerminalExchangeStatus(status: ControlExchangeStatus): boolean {
  return (
    status === ControlExchangeStatus.SUCCEEDED ||
    status === ControlExchangeStatus.RECONCILED ||
    status === ControlExchangeStatus.CANCELLED
  );
}

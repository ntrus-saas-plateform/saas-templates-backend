import { describe, expect, it } from 'vitest';
import {
  assertExchangeTransition,
  assertRetryFromUnknownOutcomeBlocked,
  canTransitionExchange,
  isTerminalExchangeStatus,
  nextReconciliationStatus,
  requiresReconciliation,
  resolveTimeoutOutcome,
} from './exchange-state-machine.js';
import {
  ControlExchangeStatus,
  ExchangeReconciliationStatus,
} from './product-control.types.js';

describe('exchange state machine', () => {
  it('follows CREATED → QUEUED → SENDING → SENT → SUCCEEDED', () => {
    expect(
      canTransitionExchange(ControlExchangeStatus.CREATED, ControlExchangeStatus.QUEUED),
    ).toBe(true);
    expect(
      canTransitionExchange(ControlExchangeStatus.QUEUED, ControlExchangeStatus.SENDING),
    ).toBe(true);
    expect(
      canTransitionExchange(ControlExchangeStatus.SENDING, ControlExchangeStatus.SENT),
    ).toBe(true);
    expect(
      canTransitionExchange(ControlExchangeStatus.SENT, ControlExchangeStatus.SUCCEEDED),
    ).toBe(true);
  });

  it('maps post-send timeout to UNKNOWN_OUTCOME', () => {
    expect(resolveTimeoutOutcome(true)).toBe(ControlExchangeStatus.UNKNOWN_OUTCOME);
    expect(resolveTimeoutOutcome(false)).toBe(ControlExchangeStatus.FAILED);
  });

  it('requires reconciliation for unknown outcomes', () => {
    expect(requiresReconciliation(ControlExchangeStatus.UNKNOWN_OUTCOME)).toBe(true);
    expect(nextReconciliationStatus(ControlExchangeStatus.UNKNOWN_OUTCOME)).toBe(
      ExchangeReconciliationStatus.REQUIRED,
    );
  });

  it('blocks mutative retry before reconciliation', () => {
    expect(() =>
      assertRetryFromUnknownOutcomeBlocked(ControlExchangeStatus.UNKNOWN_OUTCOME, true),
    ).toThrow();
    expect(() =>
      assertRetryFromUnknownOutcomeBlocked(ControlExchangeStatus.UNKNOWN_OUTCOME, false),
    ).not.toThrow();
  });

  it('rejects illegal jumps', () => {
    expect(() =>
      assertExchangeTransition(
        ControlExchangeStatus.CREATED,
        ControlExchangeStatus.SUCCEEDED,
      ),
    ).toThrow();
  });

  it('treats SUCCEEDED / RECONCILED / CANCELLED as terminal', () => {
    expect(isTerminalExchangeStatus(ControlExchangeStatus.SUCCEEDED)).toBe(true);
    expect(isTerminalExchangeStatus(ControlExchangeStatus.RECONCILED)).toBe(true);
    expect(isTerminalExchangeStatus(ControlExchangeStatus.CANCELLED)).toBe(true);
    expect(isTerminalExchangeStatus(ControlExchangeStatus.SENT)).toBe(false);
  });

  it('allows UNKNOWN_OUTCOME → RECONCILIATION_REQUIRED → RECONCILED', () => {
    expect(
      canTransitionExchange(
        ControlExchangeStatus.UNKNOWN_OUTCOME,
        ControlExchangeStatus.RECONCILIATION_REQUIRED,
      ),
    ).toBe(true);
    expect(
      canTransitionExchange(
        ControlExchangeStatus.RECONCILIATION_REQUIRED,
        ControlExchangeStatus.RECONCILED,
      ),
    ).toBe(true);
  });
});

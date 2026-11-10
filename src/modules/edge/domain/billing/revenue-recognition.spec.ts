import { describe, expect, it } from 'vitest';
import { computeRecognizedRevenue } from './revenue-recognition.js';

describe('computeRecognizedRevenue', () => {
  it('CASH_BASED_NET subtracts refunds from collections', () => {
    const r = computeRecognizedRevenue({
      method: 'CASH_BASED_NET',
      billedTotal: '1000.00',
      collectedTotal: '800.00',
      refundedTotal: '50.00',
      currency: 'USD',
    });
    expect(r.recognizedRevenue).toBe('750.00');
    expect(r.method).toBe('CASH_BASED_NET');
  });

  it('BILLING_BASED uses billed totals with disclaimer', () => {
    const r = computeRecognizedRevenue({
      method: 'BILLING_BASED',
      billedTotal: '1000.00',
      collectedTotal: '200.00',
      refundedTotal: '0.00',
      currency: 'USD',
    });
    expect(r.recognizedRevenue).toBe('1000.00');
    expect(r.disclaimer).toMatch(/BILLING_BASED/i);
  });

  it('DEFERRED_MANUAL returns null recognized revenue', () => {
    const r = computeRecognizedRevenue({
      method: 'DEFERRED_MANUAL',
      billedTotal: '1000.00',
      collectedTotal: '1000.00',
      refundedTotal: '0.00',
      currency: 'USD',
    });
    expect(r.recognizedRevenue).toBeNull();
  });

  it('never silently equals billed to recognized under cash policy', () => {
    const r = computeRecognizedRevenue({
      method: 'CASH_BASED_NET',
      billedTotal: '1000.00',
      collectedTotal: '400.00',
      refundedTotal: '0.00',
      currency: 'USD',
    });
    expect(r.recognizedRevenue).not.toBe(r.components.billedTotal);
    expect(r.recognizedRevenue).toBe('400.00');
  });
});

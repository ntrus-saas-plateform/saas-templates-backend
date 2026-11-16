import { describe, expect, it } from 'vitest';
import {
  computeCashRevenue,
  isCollectedPaymentEligible,
  isInvoicedEligible,
  isOpenReceivable,
} from './cash-revenue-calculator.js';
import { isCollectedEligible } from './mrr-calculator.js';

describe('cash revenue eligibility', () => {
  it('invoiced includes ISSUED/PAID and excludes DRAFT/VOIDED', () => {
    expect(isInvoicedEligible('ISSUED')).toBe(true);
    expect(isInvoicedEligible('PAID')).toBe(true);
    expect(isInvoicedEligible('DRAFT')).toBe(false);
    expect(isInvoicedEligible('VOIDED')).toBe(false);
  });

  it('collected payment accepts SUCCEEDED and PAID only', () => {
    expect(isCollectedPaymentEligible('SUCCEEDED')).toBe(true);
    expect(isCollectedPaymentEligible('PAID')).toBe(true);
    expect(isCollectedPaymentEligible('PROCESSING')).toBe(false);
    expect(isCollectedPaymentEligible('FAILED')).toBe(false);
    expect(isCollectedEligible('UNPAID')).toBe(false);
  });

  it('open receivables exclude fully PAID', () => {
    expect(isOpenReceivable('ISSUED')).toBe(true);
    expect(isOpenReceivable('PAID')).toBe(false);
  });
});

describe('computeCashRevenue', () => {
  const periodStart = new Date('2026-01-01T00:00:00.000Z');
  const periodEnd = new Date('2026-02-01T00:00:00.000Z');

  it('sums issued invoices as INVOICED and succeeded payments as COLLECTED', () => {
    const result = computeCashRevenue({
      periodStart,
      periodEnd,
      currency: 'USD',
      invoices: [
        {
          id: 'inv-1',
          status: 'ISSUED',
          currency: 'USD',
          total: '100.00',
          amountDue: '100.00',
          issueAt: '2026-01-10T00:00:00.000Z',
        },
        {
          id: 'inv-2',
          status: 'PAID',
          currency: 'USD',
          total: '50.00',
          amountDue: '0',
          issueAt: '2026-01-15T00:00:00.000Z',
        },
        {
          id: 'inv-draft',
          status: 'DRAFT',
          currency: 'USD',
          total: '999',
          issueAt: '2026-01-12T00:00:00.000Z',
        },
      ],
      payments: [
        {
          id: 'pi-1',
          status: 'SUCCEEDED',
          currency: 'USD',
          amount: '50.00',
          createdAt: '2026-01-16T00:00:00.000Z',
        },
        {
          id: 'pi-pending',
          status: 'PROCESSING',
          currency: 'USD',
          amount: '100.00',
          createdAt: '2026-01-16T00:00:00.000Z',
        },
      ],
    });

    expect(result.invoiced).toEqual({ amount: 150, dataQuality: 'MEASURED' });
    expect(result.collected).toEqual({ amount: 50, dataQuality: 'MEASURED' });
    expect(result.receivables).toEqual({ amount: 100, dataQuality: 'MEASURED' });
    expect(result.invoicedInvoiceIds).toEqual(['inv-1', 'inv-2']);
    expect(result.collectedPaymentIds).toEqual(['pi-1']);
    expect(result.openReceivableInvoiceIds).toEqual(['inv-1']);
  });

  it('empty feeds → UNAVAILABLE (never silent MEASURED zero)', () => {
    const result = computeCashRevenue({
      periodStart,
      periodEnd,
      invoices: [],
      payments: [],
    });
    expect(result.invoiced.dataQuality).toBe('UNAVAILABLE');
    expect(result.invoiced.amount).toBeNull();
    expect(result.collected.dataQuality).toBe('UNAVAILABLE');
    expect(result.collected.amount).toBeNull();
    expect(result.receivables.dataQuality).toBe('UNAVAILABLE');
  });

  it('never treats unpaid invoice as collected', () => {
    const result = computeCashRevenue({
      periodStart,
      periodEnd,
      currency: 'USD',
      invoices: [
        {
          id: 'inv-open',
          status: 'ISSUED',
          currency: 'USD',
          total: '200',
          amountDue: '200',
          issueAt: '2026-01-05T00:00:00.000Z',
        },
      ],
      payments: [],
    });
    expect(result.invoiced.amount).toBe(200);
    expect(result.collected.dataQuality).toBe('UNAVAILABLE');
    expect(result.notes.some((n) => /never count as COLLECTED/i.test(n))).toBe(true);
  });
});

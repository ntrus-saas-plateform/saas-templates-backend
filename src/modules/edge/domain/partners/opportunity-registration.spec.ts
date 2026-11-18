import { describe, expect, it } from 'vitest';
import {
  assertPartnerOppTransition,
  assertRegisterPartnerOpportunity,
  computeConflictExpiresAt,
  isWithinConflictWindow,
} from './opportunity-registration.js';

describe('partner opportunity registration', () => {
  it('requires partnerCode and accountName', () => {
    expect(() =>
      assertRegisterPartnerOpportunity({ partnerCode: '', accountName: 'Acme' }),
    ).toThrow(/partnerCode/i);
  });

  it('defaults conflict window to 30 days', () => {
    const n = assertRegisterPartnerOpportunity({
      partnerCode: 'PARTNER_CI',
      accountName: 'Pharmacie A',
    });
    expect(n.conflictWindowDays).toBe(30);
    const start = new Date('2026-01-01T00:00:00Z');
    const end = computeConflictExpiresAt(start, 30);
    expect(end.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  it('tracks conflict window only for REGISTERED/ACCEPTED', () => {
    const expires = new Date('2026-02-01T00:00:00Z');
    expect(
      isWithinConflictWindow(
        { status: 'REGISTERED', conflictExpiresAt: expires },
        new Date('2026-01-15T00:00:00Z'),
      ),
    ).toBe(true);
    expect(
      isWithinConflictWindow(
        { status: 'REJECTED', conflictExpiresAt: expires },
        new Date('2026-01-15T00:00:00Z'),
      ),
    ).toBe(false);
  });

  it('enforces lifecycle transitions', () => {
    expect(() => assertPartnerOppTransition('REGISTERED', 'ACCEPTED')).not.toThrow();
    expect(() => assertPartnerOppTransition('REJECTED', 'ACCEPTED')).toThrow(/not allowed/i);
  });
});

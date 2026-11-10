import {
  mergeMonotonicAuthorizationState,
  shouldApplyRevocationVersion,
} from './monotonic-revocation.js';

describe('monotonic revocation policy', () => {
  it('never resurrects REVOKED after replay of ACTIVE authorization', () => {
    const merged = mergeMonotonicAuthorizationState(
      {
        authorizationStatus: 'REVOKED',
        revocationStatus: 'REVOKED',
        revocationVersion: 3,
        verificationStatus: 'REVOKED',
        revokedAt: new Date('2026-01-01T00:00:00Z'),
        revocationReasonCode: 'COMMERCIAL_CANCEL',
        revocationReference: 'r-1',
      },
      {
        authorizationStatus: 'ACTIVE',
        revocationStatus: 'NOT_REVOKED',
        revocationVersion: 0,
        verificationStatus: 'VERIFIED',
        revokedAt: null,
        revocationReasonCode: null,
        revocationReference: null,
      },
    );
    expect(merged.authorizationStatus).toBe('REVOKED');
    expect(merged.revocationStatus).toBe('REVOKED');
    expect(merged.verificationStatus).toBe('REVOKED');
    expect(merged.revocationVersion).toBe(3);
    expect(merged.revocationReasonCode).toBe('COMMERCIAL_CANCEL');
  });

  it('keeps higher revocation version under concurrent candidates', () => {
    const a = mergeMonotonicAuthorizationState(
      {
        authorizationStatus: 'ACTIVE',
        revocationStatus: 'NOT_REVOKED',
        revocationVersion: 1,
        verificationStatus: 'VERIFIED',
        revokedAt: null,
        revocationReasonCode: null,
        revocationReference: null,
      },
      {
        authorizationStatus: 'REVOKED',
        revocationStatus: 'REVOKED',
        revocationVersion: 5,
        verificationStatus: 'REVOKED',
        revokedAt: new Date(),
        revocationReasonCode: 'A',
        revocationReference: null,
      },
    );
    const b = mergeMonotonicAuthorizationState(a, {
      authorizationStatus: 'REVOKED',
      revocationStatus: 'REVOKED',
      revocationVersion: 4,
      verificationStatus: 'REVOKED',
      revokedAt: new Date(),
      revocationReasonCode: 'B',
      revocationReference: null,
    });
    expect(b.revocationVersion).toBe(5);
    expect(b.revocationStatus).toBe('REVOKED');
    expect(shouldApplyRevocationVersion(5, 'REVOKED', 4)).toBe(false);
    expect(shouldApplyRevocationVersion(5, 'REVOKED', 5)).toBe(false);
    expect(shouldApplyRevocationVersion(5, 'REVOKED', 6)).toBe(true);
  });

  it('rejects stale revocation versions', () => {
    expect(shouldApplyRevocationVersion(3, 'REVOKED', 2)).toBe(false);
    expect(shouldApplyRevocationVersion(null, null, 1)).toBe(true);
  });
});

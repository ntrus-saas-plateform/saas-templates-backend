import { describe, expect, it } from 'vitest';
import {
  applyActiveWaivers,
  assertWaiverUsable,
  canApproveRemediation,
  canAutoRemediate,
  canQuarantineFinding,
  canRequestRemediate,
  classifyObservations,
  isWaiverValid,
} from './reconciliation-policy.js';
import {
  FindingStatus,
  ObservationClass,
  ReconciliationErrorCode,
  RemediationStatus,
  type ReconciliationWaiverRecord,
} from './reconciliation.types.js';

describe('classifyObservations', () => {
  it('marks UNKNOWN when providerUnreachable — never MISSING/deleted', () => {
    const drafts = classifyObservations({
      desired: [{ resourceType: 'DB', resourceRef: 'db-1', state: { ok: true } }],
      observed: [],
      providerUnreachable: true,
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.observationClass).toBe(ObservationClass.UNKNOWN);
    expect(drafts[0]!.observationClass).not.toBe(ObservationClass.MISSING);
    expect(drafts[0]!.autoRemediateEligible).toBe(false);
    expect(drafts[0]!.details.neverTreatAsDeleted).toBe(true);
  });

  it('classifies MISSING / DRIFT / UNEXPECTED when reachable', () => {
    const drafts = classifyObservations({
      desired: [
        { resourceType: 'DB', resourceRef: 'db-1', state: { a: 1 } },
        { resourceType: 'DB', resourceRef: 'db-2', state: { a: 1 } },
      ],
      observed: [
        { resourceType: 'DB', resourceRef: 'db-2', state: { a: 2 } },
        { resourceType: 'DB', resourceRef: 'db-x', state: { a: 9 } },
      ],
      providerUnreachable: false,
    });
    const byRef = Object.fromEntries(drafts.map((d) => [d.resourceRef, d]));
    expect(byRef['db-1']!.observationClass).toBe(ObservationClass.MISSING);
    expect(byRef['db-2']!.observationClass).toBe(ObservationClass.DRIFT);
    expect(byRef['db-x']!.observationClass).toBe(ObservationClass.UNEXPECTED);
    expect(byRef['db-x']!.autoRemediateEligible).toBe(false);
  });
});

describe('isWaiverValid / assertWaiverUsable', () => {
  const base: ReconciliationWaiverRecord = {
    id: 'w1',
    findingId: null,
    tenantId: null,
    productId: null,
    waiverCode: 'W-1',
    reason: 'test',
    waiverStatus: 'ACTIVE',
    expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    createdBy: 't',
    revokedBy: null,
    revokedAt: null,
    metadata: {},
    createdAt: new Date(),
  };

  it('accepts ACTIVE non-expired waiver', () => {
    expect(isWaiverValid(base, new Date('2026-11-16'))).toBe(true);
    expect(assertWaiverUsable(base, new Date('2026-11-16')).allowed).toBe(true);
  });

  it('rejects expired waivers even if status ACTIVE', () => {
    const expired = { ...base, expiresAt: new Date('2020-01-01T00:00:00.000Z') };
    expect(isWaiverValid(expired, new Date('2026-11-16'))).toBe(false);
    const d = assertWaiverUsable(expired, new Date('2026-11-16'));
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(ReconciliationErrorCode.WAIVER_EXPIRED);
  });
});

describe('canAutoRemediate', () => {
  const base = {
    finding: {
      autoRemediateEligible: true,
      observationClass: ObservationClass.DRIFT,
      findingStatus: FindingStatus.OPEN,
    },
    policy: { autoRemediate: true, requireApproval: false },
    remediation: { reversible: true },
  };

  it('allows when eligible + policy + reversible', () => {
    expect(canAutoRemediate(base)).toEqual({ allowed: true });
  });

  it('denies UNKNOWN observations', () => {
    const d = canAutoRemediate({
      ...base,
      finding: { ...base.finding, observationClass: ObservationClass.UNKNOWN },
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(ReconciliationErrorCode.UNKNOWN_STATE);
  });

  it('denies unsafe auto-remediate when not reversible', () => {
    const d = canAutoRemediate({
      ...base,
      remediation: { reversible: false },
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(ReconciliationErrorCode.UNSAFE_AUTO_REMEDIATE);
  });

  it('denies when policy.autoRemediate false', () => {
    const d = canAutoRemediate({
      ...base,
      policy: { autoRemediate: false, requireApproval: true },
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(ReconciliationErrorCode.APPROVAL_REQUIRED);
  });

  it('denies UNEXPECTED (no blind deletes)', () => {
    const d = canAutoRemediate({
      ...base,
      finding: {
        ...base.finding,
        observationClass: ObservationClass.UNEXPECTED,
        autoRemediateEligible: true,
      },
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(ReconciliationErrorCode.UNSAFE_AUTO_REMEDIATE);
  });
});

describe('canRequestRemediate / canApproveRemediation / canQuarantineFinding', () => {
  it('blocks remediate on UNKNOWN', () => {
    const d = canRequestRemediate({
      findingStatus: FindingStatus.OPEN,
      observationClass: ObservationClass.UNKNOWN,
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(ReconciliationErrorCode.UNKNOWN_STATE);
  });

  it('requires P7.1 revalidation for approve', () => {
    const d = canApproveRemediation({
      remediationStatus: RemediationStatus.WAITING_APPROVAL,
      authorizationRevalidated: false,
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(ReconciliationErrorCode.AUTHORIZATION_FAILED);
  });

  it('allows quarantine for OPEN', () => {
    expect(canQuarantineFinding(FindingStatus.OPEN)).toEqual({ allowed: true });
  });
});

describe('applyActiveWaivers', () => {
  it('ignores expired waivers', () => {
    const drafts = classifyObservations({
      desired: [{ resourceType: 'DB', resourceRef: 'db-1', state: { a: 1 } }],
      observed: [{ resourceType: 'DB', resourceRef: 'db-1', state: { a: 2 } }],
    });
    const expired: ReconciliationWaiverRecord = {
      id: 'w',
      findingId: null,
      tenantId: null,
      productId: null,
      waiverCode: drafts[0]!.findingCode,
      reason: 'old',
      waiverStatus: 'ACTIVE',
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      createdBy: 't',
      revokedBy: null,
      revokedAt: null,
      metadata: { findingCode: drafts[0]!.findingCode },
      createdAt: new Date(),
    };
    const result = applyActiveWaivers(drafts, [expired], new Date('2026-11-16'));
    expect(result.waived).toHaveLength(0);
    expect(result.remaining).toHaveLength(1);
  });
});

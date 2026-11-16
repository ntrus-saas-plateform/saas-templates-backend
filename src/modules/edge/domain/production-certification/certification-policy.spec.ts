import { describe, expect, it } from 'vitest';
import {
  canAssemble,
  canAttachEvidence,
  canCertify,
  canRevoke,
  defaultEvidenceKeySpecs,
  evaluateCertificationGates,
  isRequiredEvidenceSatisfied,
  applyRevokeClearance,
} from './certification-policy.js';
import {
  CertificationErrorCode,
  CertificationEvidenceItemStatus,
  CertificationPackageStatus,
  DEFAULT_REQUIRED_EVIDENCE_KEYS,
} from './certification.types.js';

describe('defaultEvidenceKeySpecs', () => {
  it('includes Shared SaaS required keys and optional p714_agents as not required', () => {
    const specs = defaultEvidenceKeySpecs();
    const byKey = Object.fromEntries(specs.map((s) => [s.evidenceKey, s]));
    for (const key of DEFAULT_REQUIRED_EVIDENCE_KEYS) {
      expect(byKey[key]?.required).toBe(true);
    }
    expect(byKey.p714_agents?.required).toBe(false);
  });
});

describe('evaluateCertificationGates / canCertify', () => {
  const readyItems = DEFAULT_REQUIRED_EVIDENCE_KEYS.map((evidenceKey) => ({
    evidenceKey,
    required: true,
    itemStatus: CertificationEvidenceItemStatus.VERIFIED,
  }));

  it('blocks CERTIFY when any required evidence is MISSING', () => {
    const items = [
      ...readyItems.slice(0, -1),
      {
        evidenceKey: 'p713_reconciliation',
        required: true,
        itemStatus: CertificationEvidenceItemStatus.MISSING,
      },
    ];
    const gates = evaluateCertificationGates(items);
    expect(gates.ready).toBe(false);
    expect(gates.blocking[0]?.status).toBe(CertificationEvidenceItemStatus.MISSING);

    const d = canCertify({
      packageStatus: CertificationPackageStatus.READY,
      evidenceItems: items,
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(CertificationErrorCode.EVIDENCE_MISSING);
  });

  it('blocks CERTIFY when any required evidence is FAILED', () => {
    const items = [
      ...readyItems.slice(0, -1),
      {
        evidenceKey: 'p76_infra',
        required: true,
        itemStatus: CertificationEvidenceItemStatus.FAILED,
      },
    ];
    const d = canCertify({
      packageStatus: CertificationPackageStatus.READY,
      evidenceItems: items,
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(CertificationErrorCode.EVIDENCE_FAILED);
  });

  it('allows CERTIFY when all required evidence are ATTACHED/VERIFIED/WAIVED', () => {
    const items = [
      ...readyItems.slice(0, -2),
      {
        evidenceKey: 'p712_onboarding',
        required: true,
        itemStatus: CertificationEvidenceItemStatus.ATTACHED,
      },
      {
        evidenceKey: 'p713_reconciliation',
        required: true,
        itemStatus: CertificationEvidenceItemStatus.WAIVED,
      },
      {
        evidenceKey: 'p714_agents',
        required: false,
        itemStatus: CertificationEvidenceItemStatus.MISSING,
      },
    ];
    expect(evaluateCertificationGates(items).ready).toBe(true);
    expect(
      canCertify({
        packageStatus: CertificationPackageStatus.READY,
        evidenceItems: items,
      }),
    ).toEqual({ allowed: true });
  });

  it('denies CERTIFY when package is not READY', () => {
    const d = canCertify({
      packageStatus: CertificationPackageStatus.DRAFT,
      evidenceItems: readyItems,
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(CertificationErrorCode.NOT_READY);
  });
});

describe('isRequiredEvidenceSatisfied', () => {
  it('treats MISSING/FAILED as unsatisfied for required items', () => {
    expect(
      isRequiredEvidenceSatisfied({
        required: true,
        itemStatus: CertificationEvidenceItemStatus.MISSING,
      }),
    ).toBe(false);
    expect(
      isRequiredEvidenceSatisfied({
        required: true,
        itemStatus: CertificationEvidenceItemStatus.FAILED,
      }),
    ).toBe(false);
    expect(
      isRequiredEvidenceSatisfied({
        required: true,
        itemStatus: CertificationEvidenceItemStatus.VERIFIED,
      }),
    ).toBe(true);
    expect(
      isRequiredEvidenceSatisfied({
        required: false,
        itemStatus: CertificationEvidenceItemStatus.MISSING,
      }),
    ).toBe(true);
  });
});

describe('canAssemble / canRevoke / canAttachEvidence / applyRevokeClearance', () => {
  it('allows assemble from DRAFT and blocks CERTIFIED', () => {
    expect(canAssemble(CertificationPackageStatus.DRAFT)).toEqual({ allowed: true });
    const d = canAssemble(CertificationPackageStatus.CERTIFIED);
    expect(d.allowed).toBe(false);
  });

  it('allows revoke only when CERTIFIED and clears certifiedAt', () => {
    expect(canRevoke(CertificationPackageStatus.READY).allowed).toBe(false);
    expect(canRevoke(CertificationPackageStatus.CERTIFIED)).toEqual({ allowed: true });
    const cleared = applyRevokeClearance(
      {
        packageStatus: CertificationPackageStatus.CERTIFIED,
        certifiedAt: new Date('2026-11-01T00:00:00.000Z'),
      },
      'operator revoke',
      new Date('2026-11-16T00:00:00.000Z'),
    );
    expect(cleared.packageStatus).toBe(CertificationPackageStatus.REVOKED);
    expect(cleared.certifiedAt).toBeNull();
    expect(cleared.revokedAt).toEqual(new Date('2026-11-16T00:00:00.000Z'));
  });

  it('blocks attach while CERTIFIED', () => {
    const d = canAttachEvidence({ packageStatus: CertificationPackageStatus.CERTIFIED });
    expect(d.allowed).toBe(false);
  });
});

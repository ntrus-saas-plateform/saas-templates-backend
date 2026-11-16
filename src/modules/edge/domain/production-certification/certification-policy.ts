import {
  CertificationErrorCode,
  CertificationEvidenceItemStatus,
  CertificationPackageStatus,
  DEFAULT_REQUIRED_EVIDENCE_KEYS,
  OPTIONAL_EVIDENCE_KEYS,
  type CertificationEvidenceItemRecord,
  type CertificationPackageRecord,
  type DefaultRequiredEvidenceKey,
} from './certification.types.js';

export type CertificationDecision =
  | { allowed: true }
  | { allowed: false; code: CertificationErrorCode; reason: string };

export type EvidenceKeySpec = {
  evidenceKey: string;
  phaseCode: string;
  required: boolean;
};

export type GateEvaluation = {
  ready: boolean;
  blocking: Array<{ evidenceKey: string; status: string; reason: string }>;
  summary: Record<string, unknown>;
};

/** Shared SaaS default required keys; p714_agents optional. */
export function defaultEvidenceKeySpecs(opts?: {
  includeOptionalAgents?: boolean;
}): EvidenceKeySpec[] {
  const required: EvidenceKeySpec[] = DEFAULT_REQUIRED_EVIDENCE_KEYS.map((key) => ({
    evidenceKey: key,
    phaseCode: phaseCodeForKey(key),
    required: true,
  }));
  if (opts?.includeOptionalAgents) {
    for (const key of OPTIONAL_EVIDENCE_KEYS) {
      required.push({
        evidenceKey: key,
        phaseCode: phaseCodeForKey(key),
        required: false,
      });
    }
  } else {
    // Always register optional slot as not-required so viewers can see it.
    for (const key of OPTIONAL_EVIDENCE_KEYS) {
      required.push({
        evidenceKey: key,
        phaseCode: phaseCodeForKey(key),
        required: false,
      });
    }
  }
  return required;
}

export function phaseCodeForKey(key: string): string {
  const map: Record<string, string> = {
    p71_auth: 'P7.1',
    p74_workflows: 'P7.4',
    p76_infra: 'P7.6',
    p77_keycloak: 'P7.7',
    p78_configuration: 'P7.8',
    p79_experience: 'P7.9',
    p710_activation: 'P7.10',
    p711_lifecycle: 'P7.11',
    p712_onboarding: 'P7.12',
    p713_reconciliation: 'P7.13',
    p714_agents: 'P7.14',
  };
  return map[key] ?? key.toUpperCase();
}

export function isRequiredEvidenceSatisfied(
  item: Pick<CertificationEvidenceItemRecord, 'required' | 'itemStatus'>,
): boolean {
  if (!item.required) return true;
  const s = String(item.itemStatus);
  return (
    s === CertificationEvidenceItemStatus.ATTACHED ||
    s === CertificationEvidenceItemStatus.VERIFIED ||
    s === CertificationEvidenceItemStatus.WAIVED
  );
}

/**
 * CRITICAL: cannot CERTIFY if any required evidence is MISSING or FAILED.
 */
export function evaluateCertificationGates(
  items: Array<
    Pick<CertificationEvidenceItemRecord, 'evidenceKey' | 'required' | 'itemStatus'>
  >,
): GateEvaluation {
  const blocking: GateEvaluation['blocking'] = [];
  for (const item of items) {
    if (!item.required) continue;
    const status = String(item.itemStatus);
    if (status === CertificationEvidenceItemStatus.MISSING) {
      blocking.push({
        evidenceKey: item.evidenceKey,
        status,
        reason: `Required evidence ${item.evidenceKey} is MISSING`,
      });
    } else if (status === CertificationEvidenceItemStatus.FAILED) {
      blocking.push({
        evidenceKey: item.evidenceKey,
        status,
        reason: `Required evidence ${item.evidenceKey} is FAILED`,
      });
    }
  }
  return {
    ready: blocking.length === 0,
    blocking,
    summary: {
      requiredCount: items.filter((i) => i.required).length,
      blockingCount: blocking.length,
      satisfiedCount: items.filter((i) => i.required && isRequiredEvidenceSatisfied(i)).length,
      optionalKeys: OPTIONAL_EVIDENCE_KEYS,
      requiredKeys: DEFAULT_REQUIRED_EVIDENCE_KEYS as readonly DefaultRequiredEvidenceKey[],
    },
  };
}

export function canCreatePackage(code: string): CertificationDecision {
  if (!code.trim()) {
    return {
      allowed: false,
      code: CertificationErrorCode.VALIDATION,
      reason: 'Package code is required',
    };
  }
  return { allowed: true };
}

export function canAssemble(packageStatus: string): CertificationDecision {
  const ok = [
    CertificationPackageStatus.DRAFT,
    CertificationPackageStatus.READY,
    CertificationPackageStatus.FAILED,
    CertificationPackageStatus.REVOKED,
  ].includes(packageStatus as CertificationPackageStatus);
  if (ok) return { allowed: true };
  if (packageStatus === CertificationPackageStatus.ASSEMBLING) {
    return {
      allowed: false,
      code: CertificationErrorCode.CONFLICT,
      reason: 'Package already ASSEMBLING',
    };
  }
  if (packageStatus === CertificationPackageStatus.CERTIFIED) {
    return {
      allowed: false,
      code: CertificationErrorCode.CONFLICT,
      reason: 'Cannot assemble a CERTIFIED package — revoke first',
    };
  }
  return {
    allowed: false,
    code: CertificationErrorCode.VALIDATION,
    reason: `Assemble not allowed for packageStatus=${packageStatus}`,
  };
}

/**
 * Fail-closed: any required MISSING/FAILED ⇒ deny CERTIFY.
 */
export function canCertify(input: {
  packageStatus: string;
  evidenceItems: Array<
    Pick<CertificationEvidenceItemRecord, 'evidenceKey' | 'required' | 'itemStatus'>
  >;
}): CertificationDecision {
  if (
    input.packageStatus !== CertificationPackageStatus.READY &&
    input.packageStatus !== CertificationPackageStatus.FAILED
  ) {
    return {
      allowed: false,
      code: CertificationErrorCode.NOT_READY,
      reason: `Certify requires READY (or retry from FAILED); current=${input.packageStatus}`,
    };
  }
  const gates = evaluateCertificationGates(input.evidenceItems);
  if (!gates.ready) {
    const first = gates.blocking[0]!;
    const code =
      first.status === CertificationEvidenceItemStatus.FAILED
        ? CertificationErrorCode.EVIDENCE_FAILED
        : CertificationErrorCode.EVIDENCE_MISSING;
    return {
      allowed: false,
      code,
      reason: `Cannot CERTIFY: ${gates.blocking.map((b) => b.reason).join('; ')}`,
    };
  }
  return { allowed: true };
}

/** Revoke clears CERTIFIED → REVOKED. */
export function canRevoke(packageStatus: string): CertificationDecision {
  if (packageStatus !== CertificationPackageStatus.CERTIFIED) {
    return {
      allowed: false,
      code: CertificationErrorCode.NOT_CERTIFIED,
      reason: `Revoke requires CERTIFIED; current=${packageStatus}`,
    };
  }
  return { allowed: true };
}

export function canAttachEvidence(input: {
  packageStatus: string;
}): CertificationDecision {
  if (
    input.packageStatus === CertificationPackageStatus.CERTIFIED ||
    input.packageStatus === CertificationPackageStatus.ASSEMBLING
  ) {
    return {
      allowed: false,
      code: CertificationErrorCode.CONFLICT,
      reason: `Cannot attach evidence while packageStatus=${input.packageStatus}`,
    };
  }
  return { allowed: true };
}

export function applyRevokeClearance(
  pkg: Pick<CertificationPackageRecord, 'packageStatus' | 'certifiedAt'>,
  reason: string | null,
  now: Date = new Date(),
): Partial<CertificationPackageRecord> {
  return {
    packageStatus: CertificationPackageStatus.REVOKED,
    certifiedAt: null,
    revokedAt: now,
    revocationReason: reason,
    gateResults: {
      revoked: true,
      previousStatus: pkg.packageStatus,
      previousCertifiedAt: pkg.certifiedAt?.toISOString?.() ?? pkg.certifiedAt ?? null,
      clearedAt: now.toISOString(),
    },
  };
}

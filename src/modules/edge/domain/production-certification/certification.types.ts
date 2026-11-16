/** P7.15 — Production Certification & Evidence Pack domain vocabulary. */

export enum CertificationPackageStatus {
  DRAFT = 'DRAFT',
  ASSEMBLING = 'ASSEMBLING',
  READY = 'READY',
  CERTIFIED = 'CERTIFIED',
  REVOKED = 'REVOKED',
  FAILED = 'FAILED',
}

export enum CertificationEvidenceItemStatus {
  MISSING = 'MISSING',
  ATTACHED = 'ATTACHED',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
  WAIVED = 'WAIVED',
}

export enum CertificationRunOperation {
  ASSEMBLE = 'ASSEMBLE',
  CERTIFY = 'CERTIFY',
  REVOKE = 'REVOKE',
  VERIFY = 'VERIFY',
}

export enum CertificationRunOutcome {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL',
  SKIPPED = 'SKIPPED',
  WAITING_APPROVAL = 'WAITING_APPROVAL',
}

export enum CertificationErrorCode {
  VALIDATION = 'VALIDATION',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  EVIDENCE_MISSING = 'EVIDENCE_MISSING',
  EVIDENCE_FAILED = 'EVIDENCE_FAILED',
  GATE_FAILED = 'GATE_FAILED',
  NOT_READY = 'NOT_READY',
  NOT_CERTIFIED = 'NOT_CERTIFIED',
  CONFLICT = 'CONFLICT',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
}

/**
 * Default required evidence keys for Shared SaaS assemble.
 * p714_agents is optional (not required for Shared SaaS).
 */
export const DEFAULT_REQUIRED_EVIDENCE_KEYS = [
  'p71_auth',
  'p74_workflows',
  'p76_infra',
  'p77_keycloak',
  'p78_configuration',
  'p79_experience',
  'p710_activation',
  'p711_lifecycle',
  'p712_onboarding',
  'p713_reconciliation',
] as const;

export const OPTIONAL_EVIDENCE_KEYS = ['p714_agents'] as const;

export type DefaultRequiredEvidenceKey = (typeof DEFAULT_REQUIRED_EVIDENCE_KEYS)[number];

export type CertificationPackageRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  productId: string | null;
  deploymentProfileCode: string | null;
  packageStatus: CertificationPackageStatus | string;
  scope: Record<string, unknown>;
  gateResults: Record<string, unknown>;
  evidenceManifest: Array<Record<string, unknown>>;
  certifiedAt: Date | null;
  revokedAt: Date | null;
  revocationReason: string | null;
  workflowId: string | null;
  provisioningRequestId: string | null;
  authorizationRowId: string | null;
  authorizationVersion: number | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type CertificationEvidenceItemRecord = {
  id: string;
  packageId: string;
  evidenceKey: string;
  phaseCode: string;
  required: boolean;
  itemStatus: CertificationEvidenceItemStatus | string;
  sourceRef: string | null;
  checksum: string | null;
  details: Record<string, unknown>;
  attachedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CertificationRunRecord = {
  id: string;
  packageId: string;
  operation: CertificationRunOperation | string;
  workflowId: string | null;
  outcome: CertificationRunOutcome | string;
  errorCode: string | null;
  errorMessage: string | null;
  observedState: Record<string, unknown>;
  evidence: Record<string, unknown>;
  startedAt: Date;
  finishedAt: Date | null;
  performedBy: string | null;
  correlationId: string | null;
  createdAt: Date;
};

export type CertificationEvidenceRecord = {
  id: string;
  packageId: string | null;
  workflowId: string | null;
  stepKey: string | null;
  operation: string;
  outcome: string;
  evidence: Record<string, unknown>;
  errorCode: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  performedBy: string | null;
  createdAt: Date;
};

export const CERTIFICATION_HANDLER_KEYS = [
  'certification.revalidate_auth',
  'certification.assemble_manifest',
  'certification.collect_evidence',
  'certification.evaluate_gates',
  'certification.apply_certify',
  'certification.apply_revoke',
  'certification.verify',
] as const;

export type CertificationHandlerKey = (typeof CERTIFICATION_HANDLER_KEYS)[number];

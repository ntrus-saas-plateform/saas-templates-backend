/** P7.13 — Reconciliation & Operational Governance domain vocabulary. */

export enum ReconciliationRunStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL',
  CANCELLED = 'CANCELLED',
  WAITING_APPROVAL = 'WAITING_APPROVAL',
}

export enum ObservationClass {
  DRIFT = 'DRIFT',
  MISSING = 'MISSING',
  UNEXPECTED = 'UNEXPECTED',
  UNKNOWN = 'UNKNOWN',
  CONFLICT = 'CONFLICT',
}

export enum FindingStatus {
  OPEN = 'OPEN',
  REMEDIATING = 'REMEDIATING',
  REMEDIATED = 'REMEDIATED',
  QUARANTINED = 'QUARANTINED',
  WAIVED = 'WAIVED',
  FALSE_POSITIVE = 'FALSE_POSITIVE',
  EXPIRED = 'EXPIRED',
}

export enum RemediationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  WAITING_APPROVAL = 'WAITING_APPROVAL',
}

export enum ReconciliationErrorCode {
  VALIDATION = 'VALIDATION',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  PROVIDER_UNREACHABLE = 'PROVIDER_UNREACHABLE',
  UNKNOWN_STATE = 'UNKNOWN_STATE',
  UNSAFE_AUTO_REMEDIATE = 'UNSAFE_AUTO_REMEDIATE',
  WAIVER_EXPIRED = 'WAIVER_EXPIRED',
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
  CONFLICT = 'CONFLICT',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
}

export type ReconciliationPolicyRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  scope: string;
  autoRemediate: boolean;
  requireApproval: boolean;
  policyStatus: string;
  rules: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type ReconciliationRunRecord = {
  id: string;
  tenantId: string | null;
  productId: string | null;
  providerCode: string | null;
  policyId: string | null;
  triggerKind: string;
  runStatus: ReconciliationRunStatus | string;
  provisioningRequestId: string | null;
  authorizationRowId: string | null;
  authorizationVersion: number | null;
  workflowId: string | null;
  desiredSnapshot: Record<string, unknown>;
  observedSnapshot: Record<string, unknown>;
  summary: Record<string, unknown>;
  driftCount: number;
  startedAt: Date;
  finishedAt: Date | null;
  performedBy: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type ReconciliationFindingRecord = {
  id: string;
  runId: string;
  tenantId: string | null;
  productId: string | null;
  findingCode: string;
  resourceType: string;
  resourceRef: string | null;
  severity: string;
  findingStatus: FindingStatus | string;
  observationClass: ObservationClass | string;
  desiredState: Record<string, unknown>;
  observedState: Record<string, unknown>;
  lastKnownState: Record<string, unknown>;
  autoRemediateEligible: boolean;
  message: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type ReconciliationRemediationRecord = {
  id: string;
  findingId: string;
  runId: string;
  tenantId: string | null;
  remediationStatus: RemediationStatus | string;
  plan: Record<string, unknown>;
  workflowId: string | null;
  reversible: boolean;
  approvedBy: string | null;
  approvedAt: Date | null;
  executedAt: Date | null;
  evidence: Record<string, unknown>;
  errorCode: string | null;
  errorMessage: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ReconciliationWaiverRecord = {
  id: string;
  findingId: string | null;
  tenantId: string | null;
  productId: string | null;
  waiverCode: string;
  reason: string;
  waiverStatus: string;
  expiresAt: Date;
  createdBy: string;
  revokedBy: string | null;
  revokedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type ReconciliationEvidenceRecord = {
  id: string;
  runId: string | null;
  findingId: string | null;
  remediationId: string | null;
  tenantId: string | null;
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

export const RECONCILIATION_HANDLER_KEYS = [
  'reconciliation.revalidate_auth',
  'reconciliation.collect_desired',
  'reconciliation.collect_observed',
  'reconciliation.classify_findings',
  'reconciliation.apply_waivers',
  'reconciliation.plan_remediation',
  'reconciliation.execute_remediation',
  'reconciliation.quarantine',
  'reconciliation.verify',
] as const;

export type ReconciliationHandlerKey = (typeof RECONCILIATION_HANDLER_KEYS)[number];

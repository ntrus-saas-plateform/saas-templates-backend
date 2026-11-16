/** P7.11 — Tenant Technical Lifecycle domain vocabulary. */

export enum LifecycleStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDING = 'SUSPENDING',
  SUSPENDED = 'SUSPENDED',
  RESUMING = 'RESUMING',
  MIGRATING = 'MIGRATING',
  ARCHIVING = 'ARCHIVING',
  ARCHIVED = 'ARCHIVED',
  RESTORING = 'RESTORING',
  DEPROVISIONING = 'DEPROVISIONING',
  DEPROVISIONED = 'DEPROVISIONED',
  DATA_PURGED = 'DATA_PURGED',
  FAILED = 'FAILED',
}

export enum LifecycleErrorCode {
  VALIDATION = 'VALIDATION',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  ACTIVATION_NOT_ACTIVE = 'ACTIVATION_NOT_ACTIVE',
  LIFECYCLE_FORBIDDEN = 'LIFECYCLE_FORBIDDEN',
  DELETION_PROTECTED = 'DELETION_PROTECTED',
  EXPORT_EVIDENCE_REQUIRED = 'EXPORT_EVIDENCE_REQUIRED',
  FLAGS_REQUIRED = 'FLAGS_REQUIRED',
  CONFLICT = 'CONFLICT',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
}

export type TenantLifecycleRecord = {
  id: string;
  tenantId: string;
  productId: string;
  subscriptionId: string | null;
  accountId: string | null;
  provisioningRequestId: string;
  authorizationRowId: string;
  authorizationVersion: number;
  activationRecordId: string;
  lifecycleStatus: LifecycleStatus | string;
  workflowId: string | null;
  deletionProtection: boolean;
  retentionPolicyRef: string | null;
  exportEvidenceRef: string | null;
  lastSuspendedAt: Date | null;
  lastResumedAt: Date | null;
  deprovisionedAt: Date | null;
  failureCode: string | null;
  failureMessage: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type LifecycleRunRecord = {
  id: string;
  lifecycleRecordId: string;
  tenantId: string;
  productId: string;
  operation: string;
  workflowId: string | null;
  outcome: string;
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

export type LifecycleEvidenceRecord = {
  id: string;
  lifecycleRecordId: string | null;
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

export const LIFECYCLE_HANDLER_KEYS = [
  'lifecycle.revalidate_auth',
  'lifecycle.require_activation_active',
  'lifecycle.require_suspended',
  'lifecycle.require_flags',
  'lifecycle.require_export_evidence',
  'lifecycle.mark_suspending',
  'lifecycle.mark_suspended',
  'lifecycle.mark_resuming',
  'lifecycle.mark_active',
  'lifecycle.mark_deprovisioning',
  'lifecycle.mark_deprovisioned',
  'lifecycle.coord_experience_deactivate',
  'lifecycle.coord_experience_resume',
  'lifecycle.coord_infra_quiesce',
  'lifecycle.coord_infra_resume',
  'lifecycle.coord_product_control_suspend',
  'lifecycle.coord_product_control_resume',
  'lifecycle.verify',
] as const;

export type LifecycleHandlerKey = (typeof LIFECYCLE_HANDLER_KEYS)[number];

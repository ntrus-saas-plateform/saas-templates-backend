/** P7.10 — Technical Readiness & Activation Gate domain vocabulary. */

export enum ReadinessEvaluationStatus {
  PENDING = 'PENDING',
  EVALUATING = 'EVALUATING',
  READY = 'READY',
  NOT_READY = 'NOT_READY',
  BLOCKED = 'BLOCKED',
  FAILED = 'FAILED',
  SUPERSEDED = 'SUPERSEDED',
  EXPIRED = 'EXPIRED',
}

export enum ReadinessCheckPhase {
  P71_AUTH = 'P71_AUTH',
  P75_PRODUCT_CONTROL = 'P75_PRODUCT_CONTROL',
  P76_INFRA = 'P76_INFRA',
  P77_KEYCLOAK = 'P77_KEYCLOAK',
  P78_CONFIGURATION = 'P78_CONFIGURATION',
  P78_ENTITLEMENTS = 'P78_ENTITLEMENTS',
  P79_EXPERIENCE = 'P79_EXPERIENCE',
  AGGREGATE = 'AGGREGATE',
  OTHER = 'OTHER',
}

export enum ReadinessCheckStatus {
  PENDING = 'PENDING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  BLOCKED = 'BLOCKED',
  ERROR = 'ERROR',
}

export enum ActivationRecordStatus {
  PENDING = 'PENDING',
  EVALUATING = 'EVALUATING',
  READY_FOR_ACTIVATION = 'READY_FOR_ACTIVATION',
  ACTIVATING = 'ACTIVATING',
  ACTIVE = 'ACTIVE',
  FAILED = 'FAILED',
  BLOCKED = 'BLOCKED',
  SUPERSEDED = 'SUPERSEDED',
}

export enum ActivationErrorCode {
  VALIDATION = 'VALIDATION',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  TRUST_MATERIAL_MISSING = 'TRUST_MATERIAL_MISSING',
  READINESS_NOT_READY = 'READINESS_NOT_READY',
  EVIDENCE_MISSING = 'EVIDENCE_MISSING',
  CHECK_FAILED = 'CHECK_FAILED',
  P5_SIGNAL_FAILED = 'P5_SIGNAL_FAILED',
  CONFLICT = 'CONFLICT',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  ACTIVATION_FORBIDDEN = 'ACTIVATION_FORBIDDEN',
}

export const READINESS_CHECK_CODES = [
  'auth.p71_revalidated',
  'infra.resources_ready',
  'keycloak.topology_verified',
  'configuration.deployed',
  'entitlements.deployed',
  'experience.ready',
  'product_control.reachable',
  'aggregate.ready',
] as const;

export type ReadinessCheckCode = (typeof READINESS_CHECK_CODES)[number];

export type TenantReadinessEvaluationRecord = {
  id: string;
  tenantId: string;
  productId: string;
  subscriptionId: string | null;
  accountId: string | null;
  provisioningRequestId: string;
  authorizationRowId: string | null;
  authorizationVersion: number | null;
  evaluationStatus: ReadinessEvaluationStatus | string;
  workflowId: string | null;
  overallScore: number | null;
  blockingCodes: string[];
  summary: Record<string, unknown>;
  evaluatedAt: Date | null;
  expiresAt: Date | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type ReadinessCheckRecord = {
  id: string;
  evaluationId: string;
  tenantId: string;
  checkCode: string;
  checkPhase: ReadinessCheckPhase | string;
  checkStatus: ReadinessCheckStatus | string;
  required: boolean;
  message: string | null;
  evidenceRef: string | null;
  details: Record<string, unknown>;
  checkedAt: Date | null;
  createdAt: Date;
};

export type ActivationRecordRecord = {
  id: string;
  tenantId: string;
  productId: string;
  subscriptionId: string | null;
  accountId: string | null;
  provisioningRequestId: string;
  authorizationRowId: string;
  authorizationVersion: number;
  readinessEvaluationId: string | null;
  activationStatus: ActivationRecordStatus | string;
  workflowId: string | null;
  activatedAt: Date | null;
  p5SignalEmittedAt: Date | null;
  p5SignalEventId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type ActivationRunRecord = {
  id: string;
  activationRecordId: string;
  evaluationId: string | null;
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

export type ActivationEvidenceRecord = {
  id: string;
  activationRecordId: string | null;
  evaluationId: string | null;
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

export const READINESS_HANDLER_KEYS = [
  'readiness.validate_auth',
  'readiness.check_infra',
  'readiness.check_keycloak',
  'readiness.check_configuration',
  'readiness.check_entitlements',
  'readiness.check_experience',
  'readiness.check_product_control',
  'readiness.aggregate',
] as const;

export const ACTIVATION_HANDLER_KEYS = [
  'activation.revalidate_auth',
  'activation.require_ready_evidence',
  'activation.mark_active',
  'activation.emit_provisioning_completed',
  'activation.verify',
] as const;

export const ACTIVATION_ALL_HANDLER_KEYS = [
  ...READINESS_HANDLER_KEYS,
  ...ACTIVATION_HANDLER_KEYS,
] as const;

export type ReadinessHandlerKey = (typeof READINESS_HANDLER_KEYS)[number];
export type ActivationHandlerKey = (typeof ACTIVATION_HANDLER_KEYS)[number];
export type ActivationAllHandlerKey = (typeof ACTIVATION_ALL_HANDLER_KEYS)[number];

/** P7.12 — Onboarding Operations domain vocabulary. */

export enum OnboardingTemplateStatus {
  DRAFT = 'DRAFT',
  VALIDATED = 'VALIDATED',
  PUBLISHED = 'PUBLISHED',
  DEPRECATED = 'DEPRECATED',
  RETIRED = 'RETIRED',
}

export enum OnboardingJourneyStatus {
  PENDING = 'PENDING',
  STARTING = 'STARTING',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_APPROVAL = 'WAITING_APPROVAL',
  BLOCKED = 'BLOCKED',
  FAILED = 'FAILED',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
  SUPERSEDED = 'SUPERSEDED',
}

export enum OnboardingStepKind {
  SYSTEM = 'SYSTEM',
  HUMAN = 'HUMAN',
  COORDINATION = 'COORDINATION',
  VERIFY = 'VERIFY',
  HANDOVER = 'HANDOVER',
}

export enum OnboardingStepStatus {
  PENDING = 'PENDING',
  READY = 'READY',
  RUNNING = 'RUNNING',
  WAITING_APPROVAL = 'WAITING_APPROVAL',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  BLOCKED = 'BLOCKED',
}

export enum OnboardingTaskStatus {
  OPEN = 'OPEN',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum OnboardingErrorCode {
  VALIDATION = 'VALIDATION',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  ACTIVATION_NOT_ACTIVE = 'ACTIVATION_NOT_ACTIVE',
  TEMPLATE_NOT_PUBLISHED = 'TEMPLATE_NOT_PUBLISHED',
  JOURNEY_FORBIDDEN = 'JOURNEY_FORBIDDEN',
  STEP_NOT_READY = 'STEP_NOT_READY',
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
  HUMAN_APPROVAL_CANNOT_BYPASS_AUTH = 'HUMAN_APPROVAL_CANNOT_BYPASS_AUTH',
  CONFLICT = 'CONFLICT',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
}

/** Default ordered step plan when template has empty step_plan. */
export const DEFAULT_ONBOARDING_STEP_PLAN = [
  { key: 'verify_activation', kind: OnboardingStepKind.VERIFY, required: true },
  { key: 'verify_infra', kind: OnboardingStepKind.COORDINATION, required: true },
  { key: 'verify_identity_topology', kind: OnboardingStepKind.COORDINATION, required: true },
  { key: 'verify_configuration', kind: OnboardingStepKind.COORDINATION, required: true },
  { key: 'verify_experience', kind: OnboardingStepKind.COORDINATION, required: true },
  { key: 'ops_checklist', kind: OnboardingStepKind.HUMAN, required: true },
  { key: 'handover_package', kind: OnboardingStepKind.HANDOVER, required: true },
  { key: 'close_verify', kind: OnboardingStepKind.VERIFY, required: true },
] as const;

export type OnboardingTemplateRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  productId: string | null;
  deploymentProfileCode: string | null;
  templateStatus: OnboardingTemplateStatus | string;
  stepPlan: Array<Record<string, unknown>>;
  slaPolicy: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type OnboardingJourneyRecord = {
  id: string;
  tenantId: string;
  productId: string;
  subscriptionId: string | null;
  accountId: string | null;
  templateId: string | null;
  activationRecordId: string;
  provisioningRequestId: string;
  authorizationRowId: string;
  authorizationVersion: number;
  journeyStatus: OnboardingJourneyStatus | string;
  currentStepKey: string | null;
  workflowId: string | null;
  startedAt: Date | null;
  closedAt: Date | null;
  handoverEvidenceRef: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type OnboardingStepRecord = {
  id: string;
  journeyId: string;
  tenantId: string;
  stepKey: string;
  stepOrder: number;
  stepKind: OnboardingStepKind | string;
  stepStatus: OnboardingStepStatus | string;
  required: boolean;
  dependsOn: string[];
  message: string | null;
  evidenceRef: string | null;
  details: Record<string, unknown>;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OnboardingTaskRecord = {
  id: string;
  journeyId: string;
  stepId: string | null;
  tenantId: string;
  taskCode: string;
  taskStatus: OnboardingTaskStatus | string;
  title: string;
  description: string | null;
  assigneeRef: string | null;
  decisionReason: string | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type OnboardingRunRecord = {
  id: string;
  journeyId: string;
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

export type OnboardingEvidenceRecord = {
  id: string;
  journeyId: string | null;
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

export const ONBOARDING_HANDLER_KEYS = [
  'onboarding.revalidate_auth',
  'onboarding.require_activation_active',
  'onboarding.materialize_steps',
  'onboarding.mark_started',
  'onboarding.advance_step',
  'onboarding.open_human_task',
  'onboarding.apply_task_decision',
  'onboarding.coord_verify',
  'onboarding.handover',
  'onboarding.mark_closed',
  'onboarding.verify',
] as const;

export type OnboardingHandlerKey = (typeof ONBOARDING_HANDLER_KEYS)[number];

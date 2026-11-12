/** P7.4 Durable Workflow domain types. */

import { INFRASTRUCTURE_HANDLER_KEYS as P76_HANDLER_KEYS } from '../infrastructure-provisioning/infrastructure.types.js';
import { KEYCLOAK_HANDLER_KEYS } from '../keycloak-topology/keycloak.types.js';

export enum WorkflowDefinitionStatus {
  DRAFT = 'DRAFT',
  VALIDATED = 'VALIDATED',
  PUBLISHED = 'PUBLISHED',
  DEPRECATED = 'DEPRECATED',
  RETIRED = 'RETIRED',
}

export enum WorkflowInstanceState {
  CREATED = 'CREATED',
  READY = 'READY',
  RUNNING = 'RUNNING',
  WAITING = 'WAITING',
  WAITING_APPROVAL = 'WAITING_APPROVAL',
  COMPENSATING = 'COMPENSATING',
  COMPENSATION_FAILED = 'COMPENSATION_FAILED',
  RETRY_PENDING = 'RETRY_PENDING',
  PAUSED = 'PAUSED',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCEL_REQUESTED = 'CANCEL_REQUESTED',
  CANCELLED = 'CANCELLED',
  TIMED_OUT = 'TIMED_OUT',
  REQUIRES_INTERVENTION = 'REQUIRES_INTERVENTION',
}

export enum WorkflowStepStatus {
  PENDING = 'PENDING',
  READY = 'READY',
  CLAIMED = 'CLAIMED',
  RUNNING = 'RUNNING',
  WAITING = 'WAITING',
  WAITING_APPROVAL = 'WAITING_APPROVAL',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  RETRY_PENDING = 'RETRY_PENDING',
  COMPENSATION_PENDING = 'COMPENSATION_PENDING',
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
  SKIPPED = 'SKIPPED',
  CANCELLED = 'CANCELLED',
  TIMED_OUT = 'TIMED_OUT',
}

export enum WorkflowErrorClass {
  TRANSIENT = 'TRANSIENT',
  PERMANENT = 'PERMANENT',
  CONFLICT = 'CONFLICT',
  DEPENDENCY_UNAVAILABLE = 'DEPENDENCY_UNAVAILABLE',
  AUTHORIZATION_REVOKED = 'AUTHORIZATION_REVOKED',
  VALIDATION = 'VALIDATION',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

/** Alias used by some call sites / docs — same vocabulary as WorkflowErrorClass. */
export const WorkflowFailureClass = WorkflowErrorClass;
export type WorkflowFailureClass = WorkflowErrorClass;

export enum SagaFailurePolicy {
  CONTINUE = 'CONTINUE',
  RETRY = 'RETRY',
  COMPENSATE = 'COMPENSATE',
  PAUSE_FOR_REVIEW = 'PAUSE_FOR_REVIEW',
  FAIL_WITHOUT_COMPENSATION = 'FAIL_WITHOUT_COMPENSATION',
}

export enum HumanTaskType {
  APPROVAL = 'APPROVAL',
  REVIEW = 'REVIEW',
  MANUAL_ACTION = 'MANUAL_ACTION',
  EXCEPTION_RESOLUTION = 'EXCEPTION_RESOLUTION',
  COMPENSATION_INTERVENTION = 'COMPENSATION_INTERVENTION',
}

export enum HumanTaskStatus {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum CompensationStatus {
  PENDING = 'PENDING',
  READY = 'READY',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  CANCELLED = 'CANCELLED',
}

export enum DeadLetterStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

export enum WorkerRegistryStatus {
  ACTIVE = 'ACTIVE',
  DRAINING = 'DRAINING',
  OFFLINE = 'OFFLINE',
  REVOKED = 'REVOKED',
}

export enum WorkflowHistoryResourceType {
  WORKFLOW_DEFINITION = 'WORKFLOW_DEFINITION',
  WORKFLOW_INSTANCE = 'WORKFLOW_INSTANCE',
  WORKFLOW_STEP = 'WORKFLOW_STEP',
  WORKFLOW_TASK = 'WORKFLOW_TASK',
  WORKFLOW_COMPENSATION = 'WORKFLOW_COMPENSATION',
  WORKFLOW_WORKER = 'WORKFLOW_WORKER',
}

export type ExpressionOperator = 'eq' | 'neq' | 'exists' | 'in';

export interface ConstrainedExpression {
  op: ExpressionOperator;
  path: string;
  value?: unknown;
}

export interface RetryPolicyDefaults {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitterRatio: number;
}

export interface WorkflowStepDefinition {
  key: string;
  type: string;
  handlerKey: string;
  dependsOn?: string[];
  maxAttempts?: number;
  timeoutMs?: number;
  compensationHandlerKey?: string | null;
  skipIf?: ConstrainedExpression | null;
  runIf?: ConstrainedExpression | null;
  failurePolicy?: SagaFailurePolicy;
  requiresApproval?: boolean;
}

export interface WorkflowDefinitionSnapshot {
  steps: WorkflowStepDefinition[];
  graph?: { edges?: Array<{ from: string; to: string }> };
  retryDefaults?: Partial<RetryPolicyDefaults>;
  timeoutDefaultsMs?: number;
  compensationPolicy?: SagaFailurePolicy;
  approvalRequirements?: Record<string, unknown>;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  deadlineMs?: number | null;
}

export interface WorkflowDefinitionRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  domain: string;
  definitionStatus: WorkflowDefinitionStatus;
  securityClassification: string | null;
  createdBy: string | null;
  approvedBy: string | null;
  publishedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowDefinitionVersionRecord {
  id: string;
  definitionId: string;
  versionNumber: number;
  snapshot: WorkflowDefinitionSnapshot;
  status: WorkflowDefinitionStatus;
  publishedAt: Date | null;
  createdAt: Date;
}

export interface WorkflowInstanceRecord {
  id: string;
  definitionId: string;
  definitionVersion: number;
  definitionSnapshot: WorkflowDefinitionSnapshot;
  workflowType: string;
  businessReference: string | null;
  provisioningRequestId: string | null;
  placementDecisionId: string | null;
  authorizationRowId: string | null;
  authorizationId: string | null;
  authorizationVersion: number | null;
  accountId: string | null;
  productId: string | null;
  subscriptionId: string | null;
  correlationId: string;
  causationId: string | null;
  idempotencyKey: string;
  inputSnapshot: Record<string, unknown>;
  state: WorkflowInstanceState;
  currentStepKey: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  deadlineAt: Date | null;
  cancellationReason: string | null;
  failureDetails: Record<string, unknown>;
  initiatingActor: string | null;
  executionContext: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowStepRecord {
  id: string;
  workflowId: string;
  stepKey: string;
  stepType: string;
  handlerKey: string;
  dependsOn: string[];
  inputSnapshot: Record<string, unknown>;
  outputSnapshot: Record<string, unknown>;
  status: WorkflowStepStatus;
  attemptCount: number;
  maxAttempts: number;
  idempotencyKey: string;
  ownerWorkerId: string | null;
  leaseExpiresAt: Date | null;
  fencingToken: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  timeoutAt: Date | null;
  errorClass: WorkflowErrorClass | string | null;
  nextRetryAt: Date | null;
  compensationHandlerKey: string | null;
  executionOrder: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowAttemptRecord {
  id: string;
  stepId: string;
  attemptNumber: number;
  workerId: string;
  fencingToken: number;
  startedAt: Date;
  endedAt: Date | null;
  result: string | null;
  errorClass: string | null;
  retryClassification: string | null;
  durationMs: number | null;
  correlationId: string | null;
  diagnostics: Record<string, unknown>;
  createdAt: Date;
}

export interface WorkflowCheckpointRecord {
  id: string;
  workflowId: string;
  stepId: string | null;
  sequence: number;
  definitionVersion: number;
  stateSnapshot: Record<string, unknown>;
  outputRef: string | null;
  integrityHash: string | null;
  createdAt: Date;
}

export interface WorkflowCompensationRecord {
  id: string;
  stepId: string;
  workflowId: string;
  handlerKey: string;
  input: Record<string, unknown>;
  status: CompensationStatus;
  attempts: number;
  timeoutAt: Date | null;
  result: Record<string, unknown>;
  failureDetails: Record<string, unknown>;
  executionOrder: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowHumanTaskRecord {
  id: string;
  workflowId: string;
  stepId: string | null;
  taskType: HumanTaskType;
  requiredPermission: string;
  assignee: string | null;
  dueAt: Date | null;
  contextSnapshot: Record<string, unknown>;
  instructions: string | null;
  decision: string | null;
  decisionReason: string | null;
  actorId: string | null;
  status: HumanTaskStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowHistoryEntry {
  id: string;
  resourceType: WorkflowHistoryResourceType;
  resourceId: string;
  workflowId: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  action: string;
  reason: string | null;
  actorId: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

export interface WorkflowDeadLetterRecord {
  id: string;
  workflowId: string;
  stepId: string | null;
  reason: string;
  payload: Record<string, unknown>;
  status: DeadLetterStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}

export interface WorkflowWorkerRecord {
  id: string;
  workerId: string;
  identity: string;
  workerVersion: string;
  status: WorkerRegistryStatus;
  lastHeartbeatAt: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Legacy aliases + P7.7+ keys — stay OPERATION_NOT_IMPLEMENTED.
 * Real P7.6 keys live in INFRASTRUCTURE_HANDLER_KEYS.
 */
export const FUTURE_PROVISIONING_HANDLER_KEYS = [
  'unavailable:p75',
  'unavailable:p76',
  'unavailable:p77',
  'p7.5.product_control.provision',
  'p7.5.product_control.activate',
  'p7.6.infra.provision',
  'p7.6.database.provision',
  'p7.6.dns.provision',
  'p7.7.keycloak.realm.create',
  'p7.7.keycloak.org.create',
] as const;

export type FutureProvisioningHandlerKey =
  (typeof FUTURE_PROVISIONING_HANDLER_KEYS)[number];

/** Re-export foundation keys so workflow definition validation stays aware. */
export {
  PRODUCT_CONTROL_FOUNDATION_HANDLER_KEYS,
} from '../product-control/product-control.types.js';

export { INFRASTRUCTURE_HANDLER_KEYS } from '../infrastructure-provisioning/infrastructure.types.js';

export const KNOWN_HANDLER_KEYS = [
  'noop:approve',
  'noop:checkpoint',
  'product_control.handshake',
  'product_control.discover_contract',
  'product_control.discover_capabilities',
  'product_control.verify_connectivity',
  'product_control.verify_health',
  'product_control.verify_conformance',
  ...P76_HANDLER_KEYS,
  ...FUTURE_PROVISIONING_HANDLER_KEYS,
  // P7.7 — real Keycloak topology provisioning handlers (registry-backed live
  // executor; validateDefinition must accept them when publishing definitions).
  ...KEYCLOAK_HANDLER_KEYS,
] as const;

export type KnownHandlerKey = (typeof KNOWN_HANDLER_KEYS)[number];

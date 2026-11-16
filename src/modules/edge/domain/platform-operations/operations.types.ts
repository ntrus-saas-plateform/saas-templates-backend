/** P9.2–P9.11 operations core domain types — honest observation only. */

export type AlertSeverity = 'SEV0' | 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';

export type AlertStatus =
  | 'RECEIVED'
  | 'NORMALIZED'
  | 'CORRELATED'
  | 'ACTIVE'
  | 'ACKNOWLEDGED'
  | 'SUPPRESSED'
  | 'RESOLVED'
  | 'EXPIRED'
  | 'CANCELLED';

export type IncidentStatus =
  | 'DETECTED'
  | 'TRIAGED'
  | 'ACKNOWLEDGED'
  | 'INVESTIGATING'
  | 'MITIGATING'
  | 'MONITORING'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED';

export type ProblemStatus =
  | 'IDENTIFIED'
  | 'INVESTIGATING'
  | 'ROOT_CAUSE_HYPOTHESIS'
  | 'ROOT_CAUSE_CONFIRMED'
  | 'KNOWN_ERROR'
  | 'RESOLVING'
  | 'RESOLVED'
  | 'CLOSED';

export type ChangeStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'ASSESSED'
  | 'APPROVED'
  | 'REJECTED'
  | 'SCHEDULED'
  | 'EXECUTING'
  | 'VALIDATING'
  | 'COMPLETED'
  | 'FAILED'
  | 'ROLLED_BACK'
  | 'CANCELLED';

export type MaintenanceStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type ServiceRequestStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CANCELLED';

export type OperationalTaskStatus = 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';

export type RecoveryStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTING'
  | 'VERIFIED'
  | 'FAILED'
  | 'CANCELLED';

export type StatusPublicationStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'RETRACTED';

export type AutomationExecutionStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'DENIED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

export type MonitoringSourceStatus =
  | 'NOT_CONFIGURED'
  | 'CONFIGURED'
  | 'CONNECTED'
  | 'DEGRADED'
  | 'UNAVAILABLE'
  | 'UNKNOWN';

export type OperationalAlert = {
  id: string;
  fingerprint: string;
  title: string;
  severity: AlertSeverity | string;
  status: AlertStatus | string;
  serviceId: string | null;
  sourceSystem: string;
  environment: string | null;
  region: string | null;
  labels: Record<string, unknown>;
  annotations: Record<string, unknown>;
  incidentId: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  suppressionReason: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  occurrenceCount: number;
  correlationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type Incident = {
  id: string;
  incidentNumber: string;
  title: string;
  description: string | null;
  category: string;
  severity: AlertSeverity | string;
  priority: string;
  status: IncidentStatus | string;
  isMajor: boolean;
  serviceId: string | null;
  environment: string | null;
  region: string | null;
  detectionSource: string | null;
  detectedAt: Date;
  acknowledgedAt: Date | null;
  mitigatedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  reporterId: string | null;
  commanderId: string | null;
  assignedTeam: string | null;
  assignedTo: string | null;
  resolutionSummary: string | null;
  rootCauseRef: string | null;
  evidence: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type IncidentTimelineEntry = {
  id: string;
  incidentId: string;
  eventType: string;
  body: string;
  actorId: string | null;
  createdAt: Date;
};

export type Problem = {
  id: string;
  problemNumber: string;
  title: string;
  description: string | null;
  status: ProblemStatus | string;
  priority: string;
  ownerId: string | null;
  serviceId: string | null;
  rootCauseSummary: string | null;
  rootCauseConfirmed: boolean;
  rootCauseReviewerId: string | null;
  workaround: string | null;
  dueAt: Date | null;
  evidence: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type ChangeRequest = {
  id: string;
  changeNumber: string;
  title: string;
  description: string | null;
  changeType: string;
  status: ChangeStatus | string;
  requesterId: string;
  ownerId: string | null;
  responsibleTeam: string | null;
  serviceId: string | null;
  environment: string | null;
  riskLevel: string;
  implementationPlan: string | null;
  validationPlan: string | null;
  rollbackPlan: string | null;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  actualStartAt: Date | null;
  actualEndAt: Date | null;
  approverId: string | null;
  approvedAt: Date | null;
  rejectedReason: string | null;
  outcome: string | null;
  evidence: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type MaintenanceWindow = {
  id: string;
  title: string;
  maintenanceType: string;
  status: MaintenanceStatus | string;
  serviceId: string | null;
  environment: string | null;
  region: string | null;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  responsibleTeam: string | null;
  reason: string;
  riskLevel: string;
  communicationPlan: string | null;
  approvedBy: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ServiceRequest = {
  id: string;
  requestNumber: string;
  category: string;
  title: string;
  description: string;
  priority: string;
  status: ServiceRequestStatus | string;
  requesterId: string;
  assignedTo: string | null;
  assignedTeam: string | null;
  serviceId: string | null;
  environment: string | null;
  dueAt: Date | null;
  resolution: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type OperationalTask = {
  id: string;
  title: string;
  status: OperationalTaskStatus | string;
  priority: string;
  assignedTo: string | null;
  assignedTeam: string | null;
  dueAt: Date | null;
  relatedIncidentId: string | null;
  relatedChangeId: string | null;
  relatedServiceId: string | null;
  runbookRef: string | null;
  evidence: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type OnCallTeam = {
  id: string;
  code: string;
  displayName: string;
  timezone: string;
  createdAt: Date;
};

export type OnCallRotation = {
  id: string;
  teamId: string;
  startsAt: Date;
  endsAt: Date;
  primaryResponderId: string;
  secondaryResponderId: string | null;
  createdAt: Date;
};

export type SloDefinition = {
  id: string;
  serviceId: string;
  name: string;
  sliType: string;
  targetValue: number;
  windowDays: number;
  dataSourceRef: string | null;
  status: string;
  createdAt: Date;
};

export type SloMeasurement = {
  id: string;
  sloId: string;
  measuredValue: number;
  errorBudgetRemaining: number | null;
  windowStart: Date;
  windowEnd: Date;
  sourceSystem: string;
  observedAt: Date;
};

export type CapacityMeasurement = {
  id: string;
  serviceId: string | null;
  metricName: string;
  metricValue: number;
  unit: string | null;
  thresholdWarning: number | null;
  thresholdCritical: number | null;
  sourceSystem: string;
  observedAt: Date;
  createdAt: Date;
};

export type RecoveryEvidenceKind =
  | 'PROVIDER_TICKET'
  | 'BACKUP_JOB_ID'
  | 'DR_EXERCISE_REF'
  | 'MANUAL_OVERRIDE';

export type RecoveryOperation = {
  id: string;
  operationType: string;
  status: RecoveryStatus | string;
  serviceId: string | null;
  requesterId: string;
  approverId: string | null;
  externalEvidenceRef: string | null;
  evidenceKind: RecoveryEvidenceKind | string | null;
  evidenceJustification: string | null;
  outcome: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NotificationDeliveryStatus =
  | 'QUEUED'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'FAILED'
  | 'DELIVERED'
  | 'ACKNOWLEDGED'
  | 'EXPIRED';

export type NotificationDelivery = {
  id: string;
  eventType: string;
  channel: string;
  destination: string;
  status: NotificationDeliveryStatus | string;
  providerRef: string | null;
  relatedIncidentId: string | null;
  relatedRotationId: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ReleaseStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'PROMOTING'
  | 'DEPLOYED'
  | 'FAILED'
  | 'ROLLED_BACK'
  | 'CANCELLED';

export type ReleaseRecord = {
  id: string;
  releaseNumber: string;
  version: string;
  buildRef: string | null;
  artifactDigest: string | null;
  externalEvidenceRef: string | null;
  serviceId: string | null;
  environment: string | null;
  status: ReleaseStatus | string;
  changeId: string | null;
  healthGateStatus: string;
  deployedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MonitoringProbeOutcome = 'UP' | 'DOWN' | 'DEGRADED' | 'UNKNOWN' | 'ERROR';

export type MonitoringProbeResult = {
  id: string;
  sourceId: string;
  probeType: string;
  observedAt: Date;
  outcome: MonitoringProbeOutcome | string;
  latencyMs: number | null;
  evidence: Record<string, unknown>;
  createdAt: Date;
};

export type Runbook = {
  id: string;
  code: string;
  title: string;
  serviceId: string | null;
  ownerId: string | null;
  currentVersion: number;
  createdAt: Date;
};

export type RunbookVersion = {
  id: string;
  runbookId: string;
  version: number;
  body: string;
  steps: unknown[];
  createdBy: string;
  createdAt: Date;
};

export type StatusComponent = {
  id: string;
  code: string;
  displayName: string;
  serviceId: string | null;
  publicStatus: string;
  updatedAt: Date;
};

export type StatusPublication = {
  id: string;
  componentId: string;
  publicStatus: string;
  message: string;
  status: StatusPublicationStatus | string;
  authorId: string;
  approverId: string | null;
  publishedAt: Date | null;
  createdAt: Date;
};

export type OperationalRisk = {
  id: string;
  title: string;
  category: string;
  serviceId: string | null;
  probability: string;
  impact: string;
  status: string;
  ownerId: string | null;
  mitigationPlan: string | null;
  dueAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type OperationalException = {
  id: string;
  title: string;
  scope: string;
  justification: string;
  status: string;
  ownerId: string;
  approverId: string | null;
  expiresAt: Date;
  compensatingControls: string | null;
  createdAt: Date;
};

export type AutomationDefinition = {
  id: string;
  code: string;
  title: string;
  triggerType: string;
  definition: Record<string, unknown>;
  destructive: boolean;
  requiresApproval: boolean;
  status: string;
  createdAt: Date;
};

export type AutomationExecution = {
  id: string;
  automationId: string;
  status: AutomationExecutionStatus | string;
  requestedBy: string;
  approvedBy: string | null;
  idempotencyKey: string;
  result: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type ServiceHealthSnapshot = {
  id: string;
  serviceId: string;
  overallStatus: string;
  sourceSystem: string;
  indicators: Record<string, unknown>;
  observedAt: Date;
  staleAfter: Date | null;
  createdAt: Date;
};

export type MonitoringSource = {
  id: string;
  code: string;
  displayName: string;
  providerType: string;
  endpointRef: string | null;
  status: MonitoringSourceStatus | string;
  lastObservedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type OperationsOverviewAggregate = {
  availability: 'PARTIAL' | 'AVAILABLE' | 'UNAVAILABLE';
  catalog: { totalServices: number };
  alerts: { activeCount: number; totalCount: number };
  incidents: { openCount: number; majorCount: number; totalCount: number };
  changes: { openCount: number; totalCount: number };
  maintenance: { scheduledCount: number; totalCount: number };
  monitoringIntegrations: Array<{
    code: string;
    providerType: string;
    status: string;
    availability: 'AVAILABLE' | 'UNAVAILABLE' | 'DEGRADED' | 'NOT_CONFIGURED';
  }>;
  computedAt: string;
  note?: string;
};

export type ListFilter = {
  status?: string;
  serviceId?: string;
  limit?: number;
  offset?: number;
};

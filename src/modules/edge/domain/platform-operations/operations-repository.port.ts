import type {
  AutomationDefinition,
  AutomationExecution,
  CapacityMeasurement,
  ChangeRequest,
  Incident,
  IncidentTimelineEntry,
  ListFilter,
  MaintenanceWindow,
  MonitoringSource,
  OnCallRotation,
  OnCallTeam,
  OperationalAlert,
  OperationalException,
  OperationalRisk,
  OperationalTask,
  OperationsOverviewAggregate,
  Problem,
  RecoveryOperation,
  Runbook,
  RunbookVersion,
  ServiceHealthSnapshot,
  ServiceRequest,
  SloDefinition,
  SloMeasurement,
  StatusComponent,
  StatusPublication,
} from './operations.types.js';

export const SERVICE_OPERATIONS_REPOSITORY_PORT = Symbol('SERVICE_OPERATIONS_REPOSITORY_PORT');

export interface ServiceOperationsRepositoryPort {
  recordHealthSnapshot(
    input: Omit<ServiceHealthSnapshot, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ServiceHealthSnapshot>;

  listHealthSnapshots(
    serviceId: string,
    limit?: number,
  ): Promise<ServiceHealthSnapshot[]>;

  ingestAlert(
    input: {
      fingerprint: string;
      title: string;
      severity?: string;
      status?: string;
      serviceId?: string | null;
      sourceSystem: string;
      environment?: string | null;
      region?: string | null;
      labels?: Record<string, unknown>;
      annotations?: Record<string, unknown>;
      correlationId?: string | null;
    },
    client?: unknown,
  ): Promise<{ alert: OperationalAlert; deduplicated: boolean }>;

  listAlerts(filter?: ListFilter): Promise<{ items: OperationalAlert[]; total: number }>;

  transitionAlert(
    id: string,
    toStatus: string,
    patch: {
      acknowledgedBy?: string | null;
      suppressionReason?: string | null;
      expectedVersion?: number;
    },
    client?: unknown,
  ): Promise<OperationalAlert>;

  getAlert(id: string): Promise<OperationalAlert | null>;

  createIncident(
    input: Omit<
      Incident,
      | 'id'
      | 'incidentNumber'
      | 'createdAt'
      | 'updatedAt'
      | 'version'
      | 'detectedAt'
      | 'acknowledgedAt'
      | 'mitigatedAt'
      | 'resolvedAt'
      | 'closedAt'
      | 'updatedBy'
    > & {
      id?: string;
      incidentNumber?: string;
      detectedAt?: Date;
      version?: number;
    },
    client?: unknown,
  ): Promise<Incident>;

  getIncident(id: string): Promise<Incident | null>;

  listIncidents(filter?: ListFilter & { isMajor?: boolean }): Promise<{
    items: Incident[];
    total: number;
  }>;

  transitionIncident(
    id: string,
    toStatus: string,
    patch: Partial<Incident> & { expectedVersion?: number },
    actorId: string,
    client?: unknown,
  ): Promise<Incident>;

  addIncidentTimeline(
    input: Omit<IncidentTimelineEntry, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<IncidentTimelineEntry>;

  createProblem(
    input: Omit<
      Problem,
      | 'id'
      | 'problemNumber'
      | 'createdAt'
      | 'updatedAt'
      | 'version'
      | 'rootCauseConfirmed'
    > & {
      id?: string;
      problemNumber?: string;
      rootCauseConfirmed?: boolean;
      version?: number;
    },
    client?: unknown,
  ): Promise<Problem>;

  getProblem(id: string): Promise<Problem | null>;
  listProblems(filter?: ListFilter): Promise<{ items: Problem[]; total: number }>;

  linkProblemIncident(
    problemId: string,
    incidentId: string,
    client?: unknown,
  ): Promise<void>;

  confirmRootCause(
    problemId: string,
    input: {
      rootCauseSummary: string;
      reviewerId: string;
      evidence?: Record<string, unknown>;
    },
    client?: unknown,
  ): Promise<Problem>;

  createChange(
    input: Omit<
      ChangeRequest,
      | 'id'
      | 'changeNumber'
      | 'createdAt'
      | 'updatedAt'
      | 'version'
      | 'approverId'
      | 'approvedAt'
      | 'rejectedReason'
      | 'outcome'
      | 'actualStartAt'
      | 'actualEndAt'
    > & {
      id?: string;
      changeNumber?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<ChangeRequest>;

  getChange(id: string): Promise<ChangeRequest | null>;

  transitionChange(
    id: string,
    toStatus: string,
    patch: Partial<ChangeRequest> & { expectedVersion?: number },
    client?: unknown,
  ): Promise<ChangeRequest>;

  approveChange(
    id: string,
    approverId: string,
    approved: boolean,
    rejectedReason?: string | null,
    client?: unknown,
  ): Promise<ChangeRequest>;

  listChanges(filter?: ListFilter): Promise<{ items: ChangeRequest[]; total: number }>;

  createMaintenance(
    input: Omit<MaintenanceWindow, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<MaintenanceWindow>;

  listMaintenance(filter?: ListFilter): Promise<{
    items: MaintenanceWindow[];
    total: number;
  }>;

  detectMaintenanceConflict(
    serviceId: string | null,
    startsAt: Date,
    endsAt: Date,
    excludeId?: string,
  ): Promise<MaintenanceWindow[]>;

  createServiceRequest(
    input: Omit<
      ServiceRequest,
      'id' | 'requestNumber' | 'createdAt' | 'updatedAt' | 'version' | 'resolution'
    > & {
      id?: string;
      requestNumber?: string;
      resolution?: string | null;
      version?: number;
    },
    client?: unknown,
  ): Promise<ServiceRequest>;

  listServiceRequests(filter?: ListFilter): Promise<{
    items: ServiceRequest[];
    total: number;
  }>;

  createTask(
    input: Omit<OperationalTask, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<OperationalTask>;

  listTasks(filter?: ListFilter): Promise<{ items: OperationalTask[]; total: number }>;

  createOnCallTeam(
    input: Omit<OnCallTeam, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<OnCallTeam>;

  createOnCallRotation(
    input: Omit<OnCallRotation, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<OnCallRotation>;

  listOnCallRotations(teamId?: string): Promise<OnCallRotation[]>;

  createSlo(
    input: Omit<SloDefinition, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<SloDefinition>;

  recordSloMeasurement(
    input: Omit<SloMeasurement, 'id' | 'observedAt'> & {
      id?: string;
      observedAt?: Date;
    },
    client?: unknown,
  ): Promise<SloMeasurement>;

  listSlos(serviceId?: string): Promise<SloDefinition[]>;

  recordCapacity(
    input: Omit<CapacityMeasurement, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<CapacityMeasurement>;

  listCapacity(serviceId?: string, limit?: number): Promise<CapacityMeasurement[]>;

  createRecovery(
    input: Omit<RecoveryOperation, 'id' | 'createdAt' | 'updatedAt' | 'approverId' | 'outcome'> & {
      id?: string;
      approverId?: string | null;
      outcome?: string | null;
    },
    client?: unknown,
  ): Promise<RecoveryOperation>;

  getRecovery(id: string): Promise<RecoveryOperation | null>;
  listRecovery(filter?: ListFilter): Promise<{ items: RecoveryOperation[]; total: number }>;

  transitionRecovery(
    id: string,
    toStatus: string,
    patch: Partial<RecoveryOperation>,
    client?: unknown,
  ): Promise<RecoveryOperation>;

  createRunbook(
    input: {
      code: string;
      title: string;
      serviceId?: string | null;
      ownerId?: string | null;
      body: string;
      steps?: unknown[];
      createdBy: string;
    },
    client?: unknown,
  ): Promise<{ runbook: Runbook; version: RunbookVersion }>;

  listRunbooks(serviceId?: string): Promise<Runbook[]>;

  upsertStatusComponent(
    input: {
      code: string;
      displayName: string;
      serviceId?: string | null;
      publicStatus?: string;
    },
    client?: unknown,
  ): Promise<StatusComponent>;

  requestStatusPublication(
    input: {
      componentId: string;
      publicStatus: string;
      message: string;
      authorId: string;
    },
    client?: unknown,
  ): Promise<StatusPublication>;

  getStatusPublication(id: string): Promise<StatusPublication | null>;

  approveStatusPublication(
    id: string,
    approverId: string,
    approved: boolean,
    client?: unknown,
  ): Promise<StatusPublication>;

  listStatusComponents(filter?: ListFilter): Promise<{
    items: StatusComponent[];
    total: number;
  }>;
  listRisks(filter?: ListFilter): Promise<{ items: OperationalRisk[]; total: number }>;
  listExceptions(filter?: ListFilter): Promise<{ items: OperationalException[]; total: number }>;

  createRisk(
    input: Omit<OperationalRisk, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<OperationalRisk>;

  createException(
    input: Omit<OperationalException, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<OperationalException>;

  listExpiredExceptions(asOf?: Date): Promise<OperationalException[]>;

  flagExpiredExceptions(asOf?: Date, client?: unknown): Promise<number>;

  createAutomation(
    input: Omit<AutomationDefinition, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<AutomationDefinition>;

  getAutomation(id: string): Promise<AutomationDefinition | null>;

  requestAutomationExecution(
    input: {
      automationId: string;
      requestedBy: string;
      idempotencyKey: string;
    },
    client?: unknown,
  ): Promise<AutomationExecution>;

  getAutomationExecutionByKey(idempotencyKey: string): Promise<AutomationExecution | null>;

  getAutomationExecution(id: string): Promise<AutomationExecution | null>;

  approveAutomationExecution(
    id: string,
    approverId: string,
    approved: boolean,
    client?: unknown,
  ): Promise<AutomationExecution>;

  executeAutomation(
    id: string,
    result: Record<string, unknown>,
    client?: unknown,
  ): Promise<AutomationExecution>;

  listMonitoringSources(): Promise<MonitoringSource[]>;

  getOperationsAnalytics(): Promise<OperationsOverviewAggregate>;
}

import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import {
  assertAlertTransition,
  assertAutomationExecutionAllowed,
  assertChangeTransition,
  assertIncidentTransition,
  assertRestoreSuccessRequiresEvidence,
  assertRootCauseConfirmation,
  assertSeparationOfDuties,
  assertTrustedHealthSource,
} from '../../domain/platform-operations/operations-policy.js';
import type { ServiceOperationsRepositoryPort } from '../../domain/platform-operations/operations-repository.port.js';
import {
  buildOperationsOutboxEvent,
  EDGE_P9_OUTBOX_TENANT,
  OperationsEventTypes,
} from '../../domain/platform-operations/operations.events.js';
import type { OperationsOverviewAggregate } from '../../domain/platform-operations/operations.types.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireAudit(
  audit: AuditEventRepositoryPort,
  input: {
    eventType: string;
    actorId: string;
    subjectType: string;
    subjectId: string;
    details: Record<string, unknown>;
  },
  client: unknown,
): Promise<void> {
  const details: Record<string, unknown> = { ...input.details };
  const actorId = UUID_PATTERN.test(input.actorId) ? input.actorId : null;
  if (actorId === null && input.actorId) details.actorRef = input.actorId;
  const subjectId = UUID_PATTERN.test(input.subjectId) ? input.subjectId : null;
  if (subjectId === null && input.subjectId) details.subjectRef = input.subjectId;
  try {
    await audit.create({ ...input, actorId, subjectId, details }, client);
  } catch (err) {
    throw new DomainError(
      ErrorCode.DEPENDENCY_UNAVAILABLE,
      'Durable audit required for operations mutation',
      [{ eventType: input.eventType }],
      err instanceof Error ? err : undefined,
    );
  }
}

export class RecordServiceHealthSnapshotUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    serviceId: string;
    overallStatus: string;
    sourceSystem: string;
    indicators?: Record<string, unknown>;
    observedAt?: Date;
    staleAfter?: Date | null;
    correlationId?: string | null;
  }) {
    assertTrustedHealthSource(input.overallStatus, input.sourceSystem);
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const snap = await this.repo.recordHealthSnapshot(
        {
          serviceId: input.serviceId,
          overallStatus: input.overallStatus,
          sourceSystem: input.sourceSystem.trim(),
          indicators: input.indicators ?? {},
          observedAt: input.observedAt ?? new Date(),
          staleAfter: input.staleAfter ?? null,
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.HEALTH_SNAPSHOT_RECORDED,
          aggregateId: snap.id,
          correlationId,
          actorId: input.actorId,
          payload: {
            serviceId: snap.serviceId,
            overallStatus: snap.overallStatus,
            sourceSystem: snap.sourceSystem,
          },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.HEALTH_SNAPSHOT_RECORDED,
          actorId: input.actorId,
          subjectType: 'SERVICE_HEALTH',
          subjectId: snap.id,
          details: { serviceId: snap.serviceId, overallStatus: snap.overallStatus },
        },
        client,
      );
      return snap;
    });
  }
}

export class IngestOperationalAlertUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
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
  }) {
    if (!input.fingerprint?.trim() || !input.title?.trim() || !input.sourceSystem?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'fingerprint, title, sourceSystem required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const result = await this.repo.ingestAlert(
        {
          fingerprint: input.fingerprint.trim(),
          title: input.title.trim(),
          severity: input.severity,
          status: input.status,
          serviceId: input.serviceId,
          sourceSystem: input.sourceSystem.trim(),
          environment: input.environment,
          region: input.region,
          labels: input.labels,
          annotations: input.annotations,
          correlationId,
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.ALERT_INGESTED,
          aggregateId: result.alert.id,
          correlationId,
          actorId: input.actorId,
          payload: {
            fingerprint: result.alert.fingerprint,
            deduplicated: result.deduplicated,
            occurrenceCount: result.alert.occurrenceCount,
          },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.ALERT_INGESTED,
          actorId: input.actorId,
          subjectType: 'OPERATIONAL_ALERT',
          subjectId: result.alert.id,
          details: { deduplicated: result.deduplicated },
        },
        client,
      );
      return result;
    });
  }
}

export class AcknowledgeAlertUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; alertId: string; correlationId?: string | null }) {
    let alert = await this.repo.getAlert(input.alertId);
    if (!alert) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Alert not found');
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      // Promote toward ACTIVE when needed so ACKNOWLEDGED is reachable from ingest.
      const promotePath: Record<string, string> = {
        RECEIVED: 'NORMALIZED',
        NORMALIZED: 'ACTIVE',
        CORRELATED: 'ACTIVE',
      };
      while (promotePath[String(alert!.status)]) {
        const next = promotePath[String(alert!.status)]!;
        assertAlertTransition(String(alert!.status), next);
        alert = await this.repo.transitionAlert(input.alertId, next, {}, client);
      }
      assertAlertTransition(String(alert!.status), 'ACKNOWLEDGED');
      const updated = await this.repo.transitionAlert(
        input.alertId,
        'ACKNOWLEDGED',
        { acknowledgedBy: input.actorId, expectedVersion: alert!.version },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.ALERT_TRANSITIONED,
          aggregateId: updated.id,
          correlationId,
          actorId: input.actorId,
          payload: { from: alert.status, to: 'ACKNOWLEDGED' },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.ALERT_TRANSITIONED,
          actorId: input.actorId,
          subjectType: 'OPERATIONAL_ALERT',
          subjectId: updated.id,
          details: { to: 'ACKNOWLEDGED' },
        },
        client,
      );
      return updated;
    });
  }
}

export class ResolveAlertUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; alertId: string; correlationId?: string | null }) {
    let alert = await this.repo.getAlert(input.alertId);
    if (!alert) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Alert not found');
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const promotePath: Record<string, string> = {
        RECEIVED: 'NORMALIZED',
        NORMALIZED: 'ACTIVE',
        CORRELATED: 'ACTIVE',
      };
      while (promotePath[String(alert!.status)]) {
        const next = promotePath[String(alert!.status)]!;
        assertAlertTransition(String(alert!.status), next);
        alert = await this.repo.transitionAlert(input.alertId, next, {}, client);
      }
      assertAlertTransition(String(alert!.status), 'RESOLVED');
      const updated = await this.repo.transitionAlert(
        input.alertId,
        'RESOLVED',
        { expectedVersion: alert!.version },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.ALERT_TRANSITIONED,
          aggregateId: updated.id,
          correlationId,
          actorId: input.actorId,
          payload: { from: alert.status, to: 'RESOLVED' },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.ALERT_TRANSITIONED,
          actorId: input.actorId,
          subjectType: 'OPERATIONAL_ALERT',
          subjectId: updated.id,
          details: { to: 'RESOLVED' },
        },
        client,
      );
      return updated;
    });
  }
}

export class CreateIncidentUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    title: string;
    description?: string | null;
    category?: string;
    severity?: string;
    priority?: string;
    isMajor?: boolean;
    serviceId?: string | null;
    environment?: string | null;
    region?: string | null;
    detectionSource?: string | null;
    correlationId?: string | null;
  }) {
    if (!input.title?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'title is required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const incident = await this.repo.createIncident(
        {
          title: input.title.trim(),
          description: input.description ?? null,
          category: input.category?.trim() || 'AVAILABILITY',
          severity: input.severity?.trim() || 'SEV3',
          priority: input.priority?.trim() || 'P3',
          status: 'DETECTED',
          isMajor: input.isMajor ?? false,
          serviceId: input.serviceId ?? null,
          environment: input.environment ?? null,
          region: input.region ?? null,
          detectionSource: input.detectionSource ?? null,
          reporterId: input.actorId,
          commanderId: null,
          assignedTeam: null,
          assignedTo: null,
          resolutionSummary: null,
          rootCauseRef: null,
          evidence: {},
          metadata: {},
          createdBy: input.actorId,
        },
        client,
      );
      await this.repo.addIncidentTimeline(
        {
          incidentId: incident.id,
          eventType: 'CREATED',
          body: `Incident ${incident.incidentNumber} created`,
          actorId: input.actorId,
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.INCIDENT_CREATED,
          aggregateId: incident.id,
          correlationId,
          actorId: input.actorId,
          payload: { incidentNumber: incident.incidentNumber },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.INCIDENT_CREATED,
          actorId: input.actorId,
          subjectType: 'INCIDENT',
          subjectId: incident.id,
          details: { incidentNumber: incident.incidentNumber },
        },
        client,
      );
      return incident;
    });
  }
}

export class TransitionIncidentUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    incidentId: string;
    toStatus: string;
    resolutionSummary?: string | null;
    correlationId?: string | null;
  }) {
    const incident = await this.repo.getIncident(input.incidentId);
    if (!incident) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Incident not found');
    assertIncidentTransition(String(incident.status), input.toStatus);
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const updated = await this.repo.transitionIncident(
        input.incidentId,
        input.toStatus,
        {
          resolutionSummary: input.resolutionSummary,
          expectedVersion: incident.version,
        },
        input.actorId,
        client,
      );
      await this.repo.addIncidentTimeline(
        {
          incidentId: updated.id,
          eventType: 'STATUS_CHANGE',
          body: `${incident.status} → ${input.toStatus}`,
          actorId: input.actorId,
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.INCIDENT_TRANSITIONED,
          aggregateId: updated.id,
          correlationId,
          actorId: input.actorId,
          payload: { from: incident.status, to: input.toStatus },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.INCIDENT_TRANSITIONED,
          actorId: input.actorId,
          subjectType: 'INCIDENT',
          subjectId: updated.id,
          details: { to: input.toStatus },
        },
        client,
      );
      return updated;
    });
  }
}

export class DeclareMajorIncidentUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    incidentId: string;
    commanderId?: string | null;
    correlationId?: string | null;
  }) {
    const incident = await this.repo.getIncident(input.incidentId);
    if (!incident) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Incident not found');
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const updated = await this.repo.transitionIncident(
        input.incidentId,
        String(incident.status),
        {
          isMajor: true,
          commanderId: input.commanderId ?? input.actorId,
          expectedVersion: incident.version,
        },
        input.actorId,
        client,
      );
      await this.repo.addIncidentTimeline(
        {
          incidentId: updated.id,
          eventType: 'MAJOR_DECLARED',
          body: 'Major incident declared',
          actorId: input.actorId,
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.INCIDENT_MAJOR_DECLARED,
          aggregateId: updated.id,
          correlationId,
          actorId: input.actorId,
          payload: { isMajor: true },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.INCIDENT_MAJOR_DECLARED,
          actorId: input.actorId,
          subjectType: 'INCIDENT',
          subjectId: updated.id,
          details: {},
        },
        client,
      );
      return updated;
    });
  }
}

export class CreateProblemUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    title: string;
    description?: string | null;
    priority?: string;
    serviceId?: string | null;
    correlationId?: string | null;
  }) {
    if (!input.title?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'title is required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const problem = await this.repo.createProblem(
        {
          title: input.title.trim(),
          description: input.description ?? null,
          status: 'IDENTIFIED',
          priority: input.priority?.trim() || 'P3',
          ownerId: input.actorId,
          serviceId: input.serviceId ?? null,
          rootCauseSummary: null,
          rootCauseReviewerId: null,
          workaround: null,
          dueAt: null,
          evidence: {},
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.PROBLEM_CREATED,
          aggregateId: problem.id,
          correlationId,
          actorId: input.actorId,
          payload: { problemNumber: problem.problemNumber },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.PROBLEM_CREATED,
          actorId: input.actorId,
          subjectType: 'PROBLEM',
          subjectId: problem.id,
          details: { problemNumber: problem.problemNumber },
        },
        client,
      );
      return problem;
    });
  }
}

export class ConfirmProblemRootCauseUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    problemId: string;
    rootCauseSummary: string;
    evidence?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    assertRootCauseConfirmation(true, input.actorId);
    if (!input.rootCauseSummary?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'rootCauseSummary required');
    }
    const problem = await this.repo.getProblem(input.problemId);
    if (!problem) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Problem not found');
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const updated = await this.repo.confirmRootCause(
        input.problemId,
        {
          rootCauseSummary: input.rootCauseSummary.trim(),
          reviewerId: input.actorId,
          evidence: input.evidence,
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.PROBLEM_ROOT_CAUSE_CONFIRMED,
          aggregateId: updated.id,
          correlationId,
          actorId: input.actorId,
          payload: {},
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.PROBLEM_ROOT_CAUSE_CONFIRMED,
          actorId: input.actorId,
          subjectType: 'PROBLEM',
          subjectId: updated.id,
          details: {},
        },
        client,
      );
      return updated;
    });
  }
}

export class LinkProblemIncidentUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    problemId: string;
    incidentId: string;
    correlationId?: string | null;
  }) {
    const [problem, incident] = await Promise.all([
      this.repo.getProblem(input.problemId),
      this.repo.getIncident(input.incidentId),
    ]);
    if (!problem) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Problem not found');
    if (!incident) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Incident not found');
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      await this.repo.linkProblemIncident(input.problemId, input.incidentId, client);
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.PROBLEM_INCIDENT_LINKED,
          aggregateId: input.problemId,
          correlationId,
          actorId: input.actorId,
          payload: { incidentId: input.incidentId },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.PROBLEM_INCIDENT_LINKED,
          actorId: input.actorId,
          subjectType: 'PROBLEM',
          subjectId: input.problemId,
          details: { incidentId: input.incidentId },
        },
        client,
      );
      return { ok: true };
    });
  }
}

export class CreateChangeUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    title: string;
    description?: string | null;
    changeType?: string;
    serviceId?: string | null;
    environment?: string | null;
    riskLevel?: string;
    implementationPlan?: string | null;
    validationPlan?: string | null;
    rollbackPlan?: string | null;
    plannedStartAt?: Date | null;
    plannedEndAt?: Date | null;
    correlationId?: string | null;
  }) {
    if (!input.title?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'title is required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const change = await this.repo.createChange(
        {
          title: input.title.trim(),
          description: input.description ?? null,
          changeType: input.changeType?.trim() || 'NORMAL',
          status: 'DRAFT',
          requesterId: input.actorId,
          ownerId: input.actorId,
          responsibleTeam: null,
          serviceId: input.serviceId ?? null,
          environment: input.environment ?? null,
          riskLevel: input.riskLevel?.trim() || 'MEDIUM',
          implementationPlan: input.implementationPlan ?? null,
          validationPlan: input.validationPlan ?? null,
          rollbackPlan: input.rollbackPlan ?? null,
          plannedStartAt: input.plannedStartAt ?? null,
          plannedEndAt: input.plannedEndAt ?? null,
          evidence: {},
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.CHANGE_CREATED,
          aggregateId: change.id,
          correlationId,
          actorId: input.actorId,
          payload: { changeNumber: change.changeNumber },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.CHANGE_CREATED,
          actorId: input.actorId,
          subjectType: 'CHANGE',
          subjectId: change.id,
          details: { changeNumber: change.changeNumber },
        },
        client,
      );
      return change;
    });
  }
}

export class SubmitChangeUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; changeId: string; correlationId?: string | null }) {
    const change = await this.repo.getChange(input.changeId);
    if (!change) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Change not found');
    assertChangeTransition(String(change.status), 'SUBMITTED');
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const updated = await this.repo.transitionChange(
        input.changeId,
        'SUBMITTED',
        { expectedVersion: change.version },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.CHANGE_TRANSITIONED,
          aggregateId: updated.id,
          correlationId,
          actorId: input.actorId,
          payload: { to: 'SUBMITTED' },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.CHANGE_TRANSITIONED,
          actorId: input.actorId,
          subjectType: 'CHANGE',
          subjectId: updated.id,
          details: { to: 'SUBMITTED' },
        },
        client,
      );
      return updated;
    });
  }
}

export class ApproveChangeUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; changeId: string; correlationId?: string | null }) {
    const change = await this.repo.getChange(input.changeId);
    if (!change) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Change not found');
    assertSeparationOfDuties(change.requesterId, input.actorId);
    if (!['SUBMITTED', 'ASSESSED'].includes(String(change.status))) {
      throw new DomainError(ErrorCode.CONFLICT, 'Change not in approvable state');
    }
    if (String(change.status) === 'SUBMITTED') {
      assertChangeTransition('SUBMITTED', 'ASSESSED');
    }
    assertChangeTransition(
      String(change.status) === 'SUBMITTED' ? 'ASSESSED' : String(change.status),
      'APPROVED',
    );
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      if (String(change.status) === 'SUBMITTED') {
        await this.repo.transitionChange(input.changeId, 'ASSESSED', {}, client);
      }
      const updated = await this.repo.approveChange(input.changeId, input.actorId, true, null, client);
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.CHANGE_APPROVED,
          aggregateId: updated.id,
          correlationId,
          actorId: input.actorId,
          payload: {},
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.CHANGE_APPROVED,
          actorId: input.actorId,
          subjectType: 'CHANGE',
          subjectId: updated.id,
          details: {},
        },
        client,
      );
      return updated;
    });
  }
}

export class RejectChangeUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    changeId: string;
    reason?: string | null;
    correlationId?: string | null;
  }) {
    const change = await this.repo.getChange(input.changeId);
    if (!change) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Change not found');
    assertSeparationOfDuties(change.requesterId, input.actorId);
    assertChangeTransition(String(change.status), 'REJECTED');
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const updated = await this.repo.approveChange(
        input.changeId,
        input.actorId,
        false,
        input.reason ?? 'Rejected',
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.CHANGE_REJECTED,
          aggregateId: updated.id,
          correlationId,
          actorId: input.actorId,
          payload: { reason: input.reason },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.CHANGE_REJECTED,
          actorId: input.actorId,
          subjectType: 'CHANGE',
          subjectId: updated.id,
          details: { reason: input.reason },
        },
        client,
      );
      return updated;
    });
  }
}

export class ScheduleMaintenanceUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    title: string;
    reason: string;
    startsAt: Date;
    endsAt: Date;
    serviceId?: string | null;
    maintenanceType?: string;
    environment?: string | null;
    region?: string | null;
    timezone?: string;
    riskLevel?: string;
    correlationId?: string | null;
  }) {
    if (!(input.startsAt instanceof Date) || !(input.endsAt instanceof Date) || input.endsAt <= input.startsAt) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid maintenance window');
    }
    const conflicts = await this.repo.detectMaintenanceConflict(
      input.serviceId ?? null,
      input.startsAt,
      input.endsAt,
    );
    if (conflicts.length > 0) {
      throw new DomainError(ErrorCode.CONFLICT, 'Maintenance window overlaps existing window for service', [
        { code: 'MAINTENANCE_CONFLICT', conflictIds: conflicts.map((c) => c.id) },
      ]);
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const window = await this.repo.createMaintenance(
        {
          title: input.title.trim(),
          maintenanceType: input.maintenanceType?.trim() || 'PLANNED',
          status: 'SCHEDULED',
          serviceId: input.serviceId ?? null,
          environment: input.environment ?? null,
          region: input.region ?? null,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          timezone: input.timezone?.trim() || 'UTC',
          responsibleTeam: null,
          reason: input.reason.trim(),
          riskLevel: input.riskLevel?.trim() || 'MEDIUM',
          communicationPlan: null,
          approvedBy: null,
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.MAINTENANCE_SCHEDULED,
          aggregateId: window.id,
          correlationId,
          actorId: input.actorId,
          payload: { serviceId: window.serviceId },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.MAINTENANCE_SCHEDULED,
          actorId: input.actorId,
          subjectType: 'MAINTENANCE',
          subjectId: window.id,
          details: {},
        },
        client,
      );
      return window;
    });
  }
}

export class CreateServiceRequestUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    category: string;
    title: string;
    description: string;
    priority?: string;
    serviceId?: string | null;
    correlationId?: string | null;
  }) {
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const req = await this.repo.createServiceRequest(
        {
          category: input.category.trim(),
          title: input.title.trim(),
          description: input.description.trim(),
          priority: input.priority?.trim() || 'P3',
          status: 'OPEN',
          requesterId: input.actorId,
          assignedTo: null,
          assignedTeam: null,
          serviceId: input.serviceId ?? null,
          environment: null,
          dueAt: null,
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.SERVICE_REQUEST_CREATED,
          aggregateId: req.id,
          correlationId,
          actorId: input.actorId,
          payload: { requestNumber: req.requestNumber },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.SERVICE_REQUEST_CREATED,
          actorId: input.actorId,
          subjectType: 'SERVICE_REQUEST',
          subjectId: req.id,
          details: { requestNumber: req.requestNumber },
        },
        client,
      );
      return req;
    });
  }
}

export class CreateOperationalTaskUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    title: string;
    priority?: string;
    assignedTo?: string | null;
    relatedIncidentId?: string | null;
    relatedChangeId?: string | null;
    relatedServiceId?: string | null;
    correlationId?: string | null;
  }) {
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const task = await this.repo.createTask(
        {
          title: input.title.trim(),
          status: 'OPEN',
          priority: input.priority?.trim() || 'P3',
          assignedTo: input.assignedTo ?? null,
          assignedTeam: null,
          dueAt: null,
          relatedIncidentId: input.relatedIncidentId ?? null,
          relatedChangeId: input.relatedChangeId ?? null,
          relatedServiceId: input.relatedServiceId ?? null,
          runbookRef: null,
          evidence: {},
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.TASK_CREATED,
          aggregateId: task.id,
          correlationId,
          actorId: input.actorId,
          payload: {},
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.TASK_CREATED,
          actorId: input.actorId,
          subjectType: 'OPERATIONAL_TASK',
          subjectId: task.id,
          details: {},
        },
        client,
      );
      return task;
    });
  }
}

export class CreateOnCallRotationUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    teamId?: string;
    teamCode?: string;
    teamDisplayName?: string;
    startsAt: Date;
    endsAt: Date;
    primaryResponderId: string;
    secondaryResponderId?: string | null;
    correlationId?: string | null;
  }) {
    if (input.endsAt <= input.startsAt) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid on-call window');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      let teamId = input.teamId;
      if (!teamId) {
        if (!input.teamCode || !input.teamDisplayName) {
          throw new DomainError(ErrorCode.VALIDATION_ERROR, 'teamId or teamCode+displayName required');
        }
        const team = await this.repo.createOnCallTeam(
          {
            code: input.teamCode.trim(),
            displayName: input.teamDisplayName.trim(),
            timezone: 'UTC',
          },
          client,
        );
        teamId = team.id;
      }
      const rotation = await this.repo.createOnCallRotation(
        {
          teamId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          primaryResponderId: input.primaryResponderId,
          secondaryResponderId: input.secondaryResponderId ?? null,
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.ONCALL_ROTATION_CREATED,
          aggregateId: rotation.id,
          correlationId,
          actorId: input.actorId,
          payload: { teamId },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.ONCALL_ROTATION_CREATED,
          actorId: input.actorId,
          subjectType: 'ONCALL_ROTATION',
          subjectId: rotation.id,
          details: { teamId },
        },
        client,
      );
      return rotation;
    });
  }
}

export class CreateSloUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    serviceId: string;
    name: string;
    sliType: string;
    targetValue: number;
    windowDays?: number;
    dataSourceRef?: string | null;
    correlationId?: string | null;
  }) {
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const slo = await this.repo.createSlo(
        {
          serviceId: input.serviceId,
          name: input.name.trim(),
          sliType: input.sliType.trim(),
          targetValue: input.targetValue,
          windowDays: input.windowDays ?? 30,
          dataSourceRef: input.dataSourceRef ?? null,
          status: 'ACTIVE',
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.SLO_CREATED,
          aggregateId: slo.id,
          correlationId,
          actorId: input.actorId,
          payload: { name: slo.name },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.SLO_CREATED,
          actorId: input.actorId,
          subjectType: 'SLO',
          subjectId: slo.id,
          details: {},
        },
        client,
      );
      return slo;
    });
  }
}

export class RecordSloMeasurementUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    sloId: string;
    measuredValue: number;
    errorBudgetRemaining?: number | null;
    windowStart: Date;
    windowEnd: Date;
    sourceSystem: string;
    correlationId?: string | null;
  }) {
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const m = await this.repo.recordSloMeasurement(
        {
          sloId: input.sloId,
          measuredValue: input.measuredValue,
          errorBudgetRemaining: input.errorBudgetRemaining ?? null,
          windowStart: input.windowStart,
          windowEnd: input.windowEnd,
          sourceSystem: input.sourceSystem.trim(),
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.SLO_MEASUREMENT_RECORDED,
          aggregateId: m.id,
          correlationId,
          actorId: input.actorId,
          payload: { sloId: m.sloId, measuredValue: m.measuredValue },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.SLO_MEASUREMENT_RECORDED,
          actorId: input.actorId,
          subjectType: 'SLO_MEASUREMENT',
          subjectId: m.id,
          details: {},
        },
        client,
      );
      return m;
    });
  }
}

export class RecordCapacityMeasurementUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    metricName: string;
    metricValue: number;
    sourceSystem: string;
    serviceId?: string | null;
    unit?: string | null;
    thresholdWarning?: number | null;
    thresholdCritical?: number | null;
    observedAt?: Date;
    correlationId?: string | null;
  }) {
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const m = await this.repo.recordCapacity(
        {
          serviceId: input.serviceId ?? null,
          metricName: input.metricName.trim(),
          metricValue: input.metricValue,
          unit: input.unit ?? null,
          thresholdWarning: input.thresholdWarning ?? null,
          thresholdCritical: input.thresholdCritical ?? null,
          sourceSystem: input.sourceSystem.trim(),
          observedAt: input.observedAt ?? new Date(),
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.CAPACITY_RECORDED,
          aggregateId: m.id,
          correlationId,
          actorId: input.actorId,
          payload: { metricName: m.metricName },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.CAPACITY_RECORDED,
          actorId: input.actorId,
          subjectType: 'CAPACITY',
          subjectId: m.id,
          details: {},
        },
        client,
      );
      return m;
    });
  }
}

export class RequestRecoveryUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    operationType: string;
    serviceId?: string | null;
    correlationId?: string | null;
  }) {
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const op = await this.repo.createRecovery(
        {
          operationType: input.operationType.trim(),
          status: 'REQUESTED',
          serviceId: input.serviceId ?? null,
          requesterId: input.actorId,
          externalEvidenceRef: null,
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.RECOVERY_REQUESTED,
          aggregateId: op.id,
          correlationId,
          actorId: input.actorId,
          payload: { operationType: op.operationType },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.RECOVERY_REQUESTED,
          actorId: input.actorId,
          subjectType: 'RECOVERY',
          subjectId: op.id,
          details: {},
        },
        client,
      );
      return op;
    });
  }
}

export class VerifyRecoveryUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    recoveryId: string;
    externalEvidenceRef: string;
    outcome?: string | null;
    correlationId?: string | null;
  }) {
    assertRestoreSuccessRequiresEvidence('VERIFIED', input.externalEvidenceRef);
    const existing = await this.repo.getRecovery(input.recoveryId);
    if (!existing) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Recovery not found');
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const updated = await this.repo.transitionRecovery(
        input.recoveryId,
        'VERIFIED',
        {
          externalEvidenceRef: input.externalEvidenceRef.trim(),
          outcome: input.outcome ?? null,
          approverId: input.actorId,
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.RECOVERY_TRANSITIONED,
          aggregateId: updated.id,
          correlationId,
          actorId: input.actorId,
          payload: { to: 'VERIFIED' },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.RECOVERY_TRANSITIONED,
          actorId: input.actorId,
          subjectType: 'RECOVERY',
          subjectId: updated.id,
          details: { to: 'VERIFIED' },
        },
        client,
      );
      return updated;
    });
  }
}

export class PublishStatusUpdateUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    componentCode: string;
    componentDisplayName: string;
    publicStatus: string;
    message: string;
    serviceId?: string | null;
    correlationId?: string | null;
  }) {
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const component = await this.repo.upsertStatusComponent(
        {
          code: input.componentCode.trim(),
          displayName: input.componentDisplayName.trim(),
          serviceId: input.serviceId ?? null,
        },
        client,
      );
      const pub = await this.repo.requestStatusPublication(
        {
          componentId: component.id,
          publicStatus: input.publicStatus,
          message: input.message.trim(),
          authorId: input.actorId,
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.STATUS_PUBLICATION_REQUESTED,
          aggregateId: pub.id,
          correlationId,
          actorId: input.actorId,
          payload: { componentId: component.id },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.STATUS_PUBLICATION_REQUESTED,
          actorId: input.actorId,
          subjectType: 'STATUS_PUBLICATION',
          subjectId: pub.id,
          details: {},
        },
        client,
      );
      return pub;
    });
  }
}

export class ApproveStatusPublicationUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    publicationId: string;
    approved?: boolean;
    correlationId?: string | null;
  }) {
    const pub = await this.repo.getStatusPublication(input.publicationId);
    if (!pub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Publication not found');
    assertSeparationOfDuties(pub.authorId, input.actorId);
    const correlationId = input.correlationId?.trim() || randomUUID();
    const approved = input.approved !== false;
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const updated = await this.repo.approveStatusPublication(
        input.publicationId,
        input.actorId,
        approved,
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.STATUS_PUBLICATION_APPROVED,
          aggregateId: updated.id,
          correlationId,
          actorId: input.actorId,
          payload: { approved, status: updated.status },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.STATUS_PUBLICATION_APPROVED,
          actorId: input.actorId,
          subjectType: 'STATUS_PUBLICATION',
          subjectId: updated.id,
          details: { approved },
        },
        client,
      );
      return updated;
    });
  }
}

export class CreateOperationalExceptionUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    title: string;
    scope: string;
    justification: string;
    expiresAt: Date;
    compensatingControls?: string | null;
    correlationId?: string | null;
  }) {
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const ex = await this.repo.createException(
        {
          title: input.title.trim(),
          scope: input.scope.trim(),
          justification: input.justification.trim(),
          status: 'ACTIVE',
          ownerId: input.actorId,
          approverId: null,
          expiresAt: input.expiresAt,
          compensatingControls: input.compensatingControls ?? null,
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.EXCEPTION_CREATED,
          aggregateId: ex.id,
          correlationId,
          actorId: input.actorId,
          payload: {},
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.EXCEPTION_CREATED,
          actorId: input.actorId,
          subjectType: 'OPERATIONAL_EXCEPTION',
          subjectId: ex.id,
          details: {},
        },
        client,
      );
      return ex;
    });
  }
}

export class FlagExpiredExceptionsUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; asOf?: Date; correlationId?: string | null }) {
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const flagged = await this.repo.flagExpiredExceptions(input.asOf, client);
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.EXCEPTION_EXPIRED_FLAGGED,
          aggregateId: correlationId,
          correlationId,
          actorId: input.actorId,
          payload: { flagged },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.EXCEPTION_EXPIRED_FLAGGED,
          actorId: input.actorId,
          subjectType: 'OPERATIONAL_EXCEPTION',
          subjectId: correlationId,
          details: { flagged },
        },
        client,
      );
      return { flagged };
    });
  }
}

export class RequestAutomationExecutionUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    automationId: string;
    idempotencyKey: string;
    correlationId?: string | null;
  }) {
    const automation = await this.repo.getAutomation(input.automationId);
    if (!automation) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Automation not found');
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const exec = await this.repo.requestAutomationExecution(
        {
          automationId: input.automationId,
          requestedBy: input.actorId,
          idempotencyKey: input.idempotencyKey.trim(),
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.AUTOMATION_EXECUTION_REQUESTED,
          aggregateId: exec.id,
          correlationId,
          actorId: input.actorId,
          payload: { idempotencyKey: exec.idempotencyKey },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.AUTOMATION_EXECUTION_REQUESTED,
          actorId: input.actorId,
          subjectType: 'AUTOMATION_EXECUTION',
          subjectId: exec.id,
          details: {},
        },
        client,
      );
      return exec;
    });
  }
}

export class ApproveAutomationExecutionUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    executionId: string;
    approved?: boolean;
    correlationId?: string | null;
  }) {
    const exec = await this.repo.getAutomationExecution(input.executionId);
    if (!exec) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Execution not found');
    assertSeparationOfDuties(exec.requestedBy, input.actorId);
    const correlationId = input.correlationId?.trim() || randomUUID();
    const approved = input.approved !== false;
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const updated = await this.repo.approveAutomationExecution(
        input.executionId,
        input.actorId,
        approved,
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.AUTOMATION_EXECUTION_APPROVED,
          aggregateId: updated.id,
          correlationId,
          actorId: input.actorId,
          payload: { approved },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.AUTOMATION_EXECUTION_APPROVED,
          actorId: input.actorId,
          subjectType: 'AUTOMATION_EXECUTION',
          subjectId: updated.id,
          details: { approved },
        },
        client,
      );
      return updated;
    });
  }
}

export class ExecuteAutomationUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    executionId: string;
    result?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    const exec = await this.repo.getAutomationExecution(input.executionId);
    if (!exec) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Execution not found');
    if (String(exec.status) === 'SUCCEEDED') {
      return exec;
    }
    const automation = await this.repo.getAutomation(exec.automationId);
    if (!automation) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Automation not found');
    assertAutomationExecutionAllowed({
      destructive: automation.destructive,
      requiresApproval: automation.requiresApproval,
      approvedBy: exec.approvedBy,
      status: String(exec.status),
    });
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const updated = await this.repo.executeAutomation(
        input.executionId,
        {
          ...(input.result ?? {}),
          executedAt: new Date().toISOString(),
          executedBy: input.actorId,
          note: 'Recorded execution — provider adapters not wired; no silent success claimed',
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.AUTOMATION_EXECUTED,
          aggregateId: updated.id,
          correlationId,
          actorId: input.actorId,
          payload: { idempotencyKey: updated.idempotencyKey },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.AUTOMATION_EXECUTED,
          actorId: input.actorId,
          subjectType: 'AUTOMATION_EXECUTION',
          subjectId: updated.id,
          details: {},
        },
        client,
      );
      return updated;
    });
  }
}

export class CreateRunbookUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    title: string;
    body: string;
    serviceId?: string | null;
    steps?: unknown[];
    correlationId?: string | null;
  }) {
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const created = await this.repo.createRunbook(
        {
          code: input.code.trim(),
          title: input.title.trim(),
          body: input.body,
          serviceId: input.serviceId ?? null,
          ownerId: input.actorId,
          steps: input.steps,
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.RUNBOOK_CREATED,
          aggregateId: created.runbook.id,
          correlationId,
          actorId: input.actorId,
          payload: { code: created.runbook.code },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.RUNBOOK_CREATED,
          actorId: input.actorId,
          subjectType: 'RUNBOOK',
          subjectId: created.runbook.id,
          details: {},
        },
        client,
      );
      return created;
    });
  }
}

export class CreateOperationalRiskUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    title: string;
    category: string;
    serviceId?: string | null;
    probability?: string;
    impact?: string;
    mitigationPlan?: string | null;
    correlationId?: string | null;
  }) {
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const risk = await this.repo.createRisk(
        {
          title: input.title.trim(),
          category: input.category.trim(),
          serviceId: input.serviceId ?? null,
          probability: input.probability?.trim() || 'MEDIUM',
          impact: input.impact?.trim() || 'MEDIUM',
          status: 'OPEN',
          ownerId: input.actorId,
          mitigationPlan: input.mitigationPlan ?? null,
          dueAt: null,
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.RISK_CREATED,
          aggregateId: risk.id,
          correlationId,
          actorId: input.actorId,
          payload: {},
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.RISK_CREATED,
          actorId: input.actorId,
          subjectType: 'OPERATIONAL_RISK',
          subjectId: risk.id,
          details: {},
        },
        client,
      );
      return risk;
    });
  }
}

export class CreateAutomationUseCase {
  constructor(
    private readonly repo: ServiceOperationsRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    title: string;
    triggerType: string;
    definition?: Record<string, unknown>;
    destructive?: boolean;
    requiresApproval?: boolean;
    correlationId?: string | null;
  }) {
    const destructive = input.destructive === true;
    const requiresApproval = input.requiresApproval ?? true;
    const correlationId = input.correlationId?.trim() || randomUUID();
    return this.outbox.runWithOutbox(EDGE_P9_OUTBOX_TENANT, async (client, enqueue) => {
      const auto = await this.repo.createAutomation(
        {
          code: input.code.trim(),
          title: input.title.trim(),
          triggerType: input.triggerType.trim(),
          definition: input.definition ?? {},
          destructive,
          requiresApproval: destructive ? true : requiresApproval,
          status: 'ACTIVE',
        },
        client,
      );
      await enqueue(
        buildOperationsOutboxEvent({
          eventType: OperationsEventTypes.AUTOMATION_CREATED,
          aggregateId: auto.id,
          correlationId,
          actorId: input.actorId,
          payload: { destructive: auto.destructive },
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: OperationsEventTypes.AUTOMATION_CREATED,
          actorId: input.actorId,
          subjectType: 'AUTOMATION',
          subjectId: auto.id,
          details: {},
        },
        client,
      );
      return auto;
    });
  }
}

export class GetOperationsOverviewUseCase {
  constructor(private readonly repo: ServiceOperationsRepositoryPort) {}

  async execute(): Promise<OperationsOverviewAggregate> {
    const agg = await this.repo.getOperationsAnalytics();
    const integrations = agg.monitoringIntegrations.map((i) => {
      if (i.status === 'NOT_CONFIGURED' || i.availability === 'NOT_CONFIGURED') {
        return { ...i, availability: 'UNAVAILABLE' as const, status: i.status || 'NOT_CONFIGURED' };
      }
      return i;
    });
    return {
      ...agg,
      monitoringIntegrations: integrations,
      availability: 'PARTIAL',
    };
  }
}

export class ListAlertsUseCase {
  constructor(private readonly repo: ServiceOperationsRepositoryPort) {}
  execute(filter?: { status?: string; serviceId?: string; limit?: number; offset?: number }) {
    return this.repo.listAlerts(filter);
  }
}

export class ListIncidentsUseCase {
  constructor(private readonly repo: ServiceOperationsRepositoryPort) {}
  execute(filter?: {
    status?: string;
    serviceId?: string;
    isMajor?: boolean;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listIncidents(filter);
  }
}

export class GetIncidentUseCase {
  constructor(private readonly repo: ServiceOperationsRepositoryPort) {}
  async execute(id: string) {
    const incident = await this.repo.getIncident(id);
    if (!incident) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Incident not found');
    return incident;
  }
}

export class ListChangesUseCase {
  constructor(private readonly repo: ServiceOperationsRepositoryPort) {}
  execute(filter?: { status?: string; serviceId?: string; limit?: number; offset?: number }) {
    return this.repo.listChanges(filter);
  }
}

export class ListMaintenanceUseCase {
  constructor(private readonly repo: ServiceOperationsRepositoryPort) {}
  execute(filter?: { status?: string; serviceId?: string; limit?: number; offset?: number }) {
    return this.repo.listMaintenance(filter);
  }
}

export class ListServiceRequestsUseCase {
  constructor(private readonly repo: ServiceOperationsRepositoryPort) {}
  execute(filter?: { status?: string; limit?: number; offset?: number }) {
    return this.repo.listServiceRequests(filter);
  }
}

export class ListTasksUseCase {
  constructor(private readonly repo: ServiceOperationsRepositoryPort) {}
  execute(filter?: { status?: string; limit?: number; offset?: number }) {
    return this.repo.listTasks(filter);
  }
}

export class ListOnCallRotationsUseCase {
  constructor(private readonly repo: ServiceOperationsRepositoryPort) {}
  execute(teamId?: string) {
    return this.repo.listOnCallRotations(teamId);
  }
}

export class ListSlosUseCase {
  constructor(private readonly repo: ServiceOperationsRepositoryPort) {}
  execute(serviceId?: string) {
    return this.repo.listSlos(serviceId);
  }
}

export class ListCapacityUseCase {
  constructor(private readonly repo: ServiceOperationsRepositoryPort) {}
  execute(serviceId?: string) {
    return this.repo.listCapacity(serviceId);
  }
}

export class ListRunbooksUseCase {
  constructor(private readonly repo: ServiceOperationsRepositoryPort) {}
  execute(serviceId?: string) {
    return this.repo.listRunbooks(serviceId);
  }
}

export class ListProblemsUseCase {
  constructor(private readonly repo: ServiceOperationsRepositoryPort) {}
  execute(filter?: { status?: string; serviceId?: string; limit?: number; offset?: number }) {
    return this.repo.listProblems(filter);
  }
}

export class ListRecoveryUseCase {
  constructor(private readonly repo: ServiceOperationsRepositoryPort) {}
  execute(filter?: { status?: string; serviceId?: string; limit?: number; offset?: number }) {
    return this.repo.listRecovery(filter);
  }
}

export class ListStatusComponentsUseCase {
  constructor(private readonly repo: ServiceOperationsRepositoryPort) {}
  execute(filter?: { limit?: number; offset?: number }) {
    return this.repo.listStatusComponents(filter);
  }
}

export class ListRisksUseCase {
  constructor(private readonly repo: ServiceOperationsRepositoryPort) {}
  execute(filter?: { status?: string; serviceId?: string; limit?: number; offset?: number }) {
    return this.repo.listRisks(filter);
  }
}

export class ListOperationalExceptionsUseCase {
  constructor(private readonly repo: ServiceOperationsRepositoryPort) {}
  execute(filter?: { status?: string; limit?: number; offset?: number }) {
    return this.repo.listExceptions(filter);
  }
}

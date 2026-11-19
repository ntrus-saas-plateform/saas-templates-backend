import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type { ServiceOperationsRepositoryPort } from '../../domain/platform-operations/operations-repository.port.js';
import type {
  AutomationDefinition,
  AutomationExecution,
  CapacityMeasurement,
  ChangeRequest,
  Incident,
  IncidentTimelineEntry,
  ListFilter,
  MaintenanceWindow,
  MonitoringProbeResult,
  MonitoringSource,
  NotificationDelivery,
  OnCallRotation,
  OnCallTeam,
  OperationalAlert,
  OperationalException,
  OperationalRisk,
  OperationalTask,
  OperationsOverviewAggregate,
  Problem,
  RecoveryOperation,
  ReleaseRecord,
  Runbook,
  RunbookVersion,
  ServiceHealthSnapshot,
  ServiceRequest,
  SloDefinition,
  SloMeasurement,
  StatusComponent,
  StatusPublication,
} from '../../domain/platform-operations/operations.types.js';

type Row = Record<string, unknown>;

function str(v: unknown): string {
  return v == null ? '' : String(v);
}
function strOrNull(v: unknown): string | null {
  return v == null ? null : String(v);
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function bool(v: unknown): boolean {
  return v === true || v === 't' || v === 'true';
}
function asDate(v: unknown): Date {
  return v instanceof Date ? v : new Date(String(v));
}
function asDateOrNull(v: unknown): Date | null {
  return v == null ? null : asDate(v);
}
function asJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === 'object') return v as T;
  try {
    return JSON.parse(String(v)) as T;
  } catch {
    return fallback;
  }
}

function numbered(prefix: string): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const suffix = randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${y}${m}${day}-${suffix}`;
}

@Injectable()
export class PgOperationsRepository implements ServiceOperationsRepositoryPort {
  constructor(private readonly db: ControlPlaneDatabaseService) {}

  private async q<T extends Row = Row>(
    sql: string,
    params: unknown[] = [],
    client?: unknown,
  ): Promise<T[]> {
    if (client) {
      const result = await (client as PoolClient).query(sql, params);
      return result.rows as T[];
    }
    const pool = this.db.getPool();
    const result = await pool.query(sql, params);
    return result.rows as T[];
  }

  private mapAlert(row: Row): OperationalAlert {
    return {
      id: str(row.id),
      fingerprint: str(row.fingerprint),
      title: str(row.title),
      severity: str(row.severity),
      status: str(row.status),
      serviceId: strOrNull(row.service_id),
      sourceSystem: str(row.source_system),
      environment: strOrNull(row.environment),
      region: strOrNull(row.region),
      labels: asJson(row.labels, {}),
      annotations: asJson(row.annotations, {}),
      incidentId: strOrNull(row.incident_id),
      acknowledgedBy: strOrNull(row.acknowledged_by),
      acknowledgedAt: asDateOrNull(row.acknowledged_at),
      resolvedAt: asDateOrNull(row.resolved_at),
      suppressionReason: strOrNull(row.suppression_reason),
      firstSeenAt: asDate(row.first_seen_at),
      lastSeenAt: asDate(row.last_seen_at),
      occurrenceCount: num(row.occurrence_count),
      correlationId: strOrNull(row.correlation_id),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapIncident(row: Row): Incident {
    return {
      id: str(row.id),
      incidentNumber: str(row.incident_number),
      title: str(row.title),
      description: strOrNull(row.description),
      category: str(row.category),
      severity: str(row.severity),
      priority: str(row.priority),
      status: str(row.status),
      isMajor: bool(row.is_major),
      serviceId: strOrNull(row.service_id),
      environment: strOrNull(row.environment),
      region: strOrNull(row.region),
      detectionSource: strOrNull(row.detection_source),
      detectedAt: asDate(row.detected_at),
      acknowledgedAt: asDateOrNull(row.acknowledged_at),
      mitigatedAt: asDateOrNull(row.mitigated_at),
      resolvedAt: asDateOrNull(row.resolved_at),
      closedAt: asDateOrNull(row.closed_at),
      reporterId: strOrNull(row.reporter_id),
      commanderId: strOrNull(row.commander_id),
      assignedTeam: strOrNull(row.assigned_team),
      assignedTo: strOrNull(row.assigned_to),
      resolutionSummary: strOrNull(row.resolution_summary),
      rootCauseRef: strOrNull(row.root_cause_ref),
      evidence: asJson(row.evidence, {}),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapProblem(row: Row): Problem {
    return {
      id: str(row.id),
      problemNumber: str(row.problem_number),
      title: str(row.title),
      description: strOrNull(row.description),
      status: str(row.status),
      priority: str(row.priority),
      ownerId: strOrNull(row.owner_id),
      serviceId: strOrNull(row.service_id),
      rootCauseSummary: strOrNull(row.root_cause_summary),
      rootCauseConfirmed: bool(row.root_cause_confirmed),
      rootCauseReviewerId: strOrNull(row.root_cause_reviewer_id),
      workaround: strOrNull(row.workaround),
      dueAt: asDateOrNull(row.due_at),
      evidence: asJson(row.evidence, {}),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapChange(row: Row): ChangeRequest {
    return {
      id: str(row.id),
      changeNumber: str(row.change_number),
      title: str(row.title),
      description: strOrNull(row.description),
      changeType: str(row.change_type),
      status: str(row.status),
      requesterId: str(row.requester_id),
      ownerId: strOrNull(row.owner_id),
      responsibleTeam: strOrNull(row.responsible_team),
      serviceId: strOrNull(row.service_id),
      environment: strOrNull(row.environment),
      riskLevel: str(row.risk_level),
      implementationPlan: strOrNull(row.implementation_plan),
      validationPlan: strOrNull(row.validation_plan),
      rollbackPlan: strOrNull(row.rollback_plan),
      plannedStartAt: asDateOrNull(row.planned_start_at),
      plannedEndAt: asDateOrNull(row.planned_end_at),
      actualStartAt: asDateOrNull(row.actual_start_at),
      actualEndAt: asDateOrNull(row.actual_end_at),
      approverId: strOrNull(row.approver_id),
      approvedAt: asDateOrNull(row.approved_at),
      rejectedReason: strOrNull(row.rejected_reason),
      outcome: strOrNull(row.outcome),
      evidence: asJson(row.evidence, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapMaintenance(row: Row): MaintenanceWindow {
    return {
      id: str(row.id),
      title: str(row.title),
      maintenanceType: str(row.maintenance_type),
      status: str(row.status),
      serviceId: strOrNull(row.service_id),
      environment: strOrNull(row.environment),
      region: strOrNull(row.region),
      startsAt: asDate(row.starts_at),
      endsAt: asDate(row.ends_at),
      timezone: str(row.timezone),
      responsibleTeam: strOrNull(row.responsible_team),
      reason: str(row.reason),
      riskLevel: str(row.risk_level),
      communicationPlan: strOrNull(row.communication_plan),
      approvedBy: strOrNull(row.approved_by),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapRequest(row: Row): ServiceRequest {
    return {
      id: str(row.id),
      requestNumber: str(row.request_number),
      category: str(row.category),
      title: str(row.title),
      description: str(row.description),
      priority: str(row.priority),
      status: str(row.status),
      requesterId: str(row.requester_id),
      assignedTo: strOrNull(row.assigned_to),
      assignedTeam: strOrNull(row.assigned_team),
      serviceId: strOrNull(row.service_id),
      environment: strOrNull(row.environment),
      dueAt: asDateOrNull(row.due_at),
      resolution: strOrNull(row.resolution),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapTask(row: Row): OperationalTask {
    return {
      id: str(row.id),
      title: str(row.title),
      status: str(row.status),
      priority: str(row.priority),
      assignedTo: strOrNull(row.assigned_to),
      assignedTeam: strOrNull(row.assigned_team),
      dueAt: asDateOrNull(row.due_at),
      relatedIncidentId: strOrNull(row.related_incident_id),
      relatedChangeId: strOrNull(row.related_change_id),
      relatedServiceId: strOrNull(row.related_service_id),
      runbookRef: strOrNull(row.runbook_ref),
      evidence: asJson(row.evidence, {}),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapRecovery(row: Row): RecoveryOperation {
    return {
      id: str(row.id),
      operationType: str(row.operation_type),
      status: str(row.status),
      serviceId: strOrNull(row.service_id),
      requesterId: str(row.requester_id),
      approverId: strOrNull(row.approver_id),
      externalEvidenceRef: strOrNull(row.external_evidence_ref),
      evidenceKind: strOrNull(row.evidence_kind),
      evidenceJustification: strOrNull(row.evidence_justification),
      outcome: strOrNull(row.outcome),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapNotification(row: Row): NotificationDelivery {
    return {
      id: str(row.id),
      eventType: str(row.event_type),
      channel: str(row.channel),
      destination: str(row.destination),
      status: str(row.status),
      providerRef: strOrNull(row.provider_ref),
      relatedIncidentId: strOrNull(row.related_incident_id),
      relatedRotationId: strOrNull(row.related_rotation_id),
      attempts: num(row.attempts),
      lastError: strOrNull(row.last_error),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapRelease(row: Row): ReleaseRecord {
    return {
      id: str(row.id),
      releaseNumber: str(row.release_number),
      version: str(row.version),
      buildRef: strOrNull(row.build_ref),
      artifactDigest: strOrNull(row.artifact_digest),
      externalEvidenceRef: strOrNull(row.external_evidence_ref),
      serviceId: strOrNull(row.service_id),
      environment: strOrNull(row.environment),
      status: str(row.status),
      changeId: strOrNull(row.change_id),
      healthGateStatus: str(row.health_gate_status),
      deployedAt: asDateOrNull(row.deployed_at),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapProbe(row: Row): MonitoringProbeResult {
    return {
      id: str(row.id),
      sourceId: str(row.source_id),
      probeType: str(row.probe_type),
      observedAt: asDate(row.observed_at),
      outcome: str(row.outcome),
      latencyMs: numOrNull(row.latency_ms),
      evidence: asJson(row.evidence, {}),
      createdAt: asDate(row.created_at),
    };
  }

  private mapMonitoringSource(row: Row): MonitoringSource {
    return {
      id: str(row.id),
      code: str(row.code),
      displayName: str(row.display_name),
      providerType: str(row.provider_type),
      endpointRef: strOrNull(row.endpoint_ref),
      status: str(row.status),
      lastObservedAt: asDateOrNull(row.last_observed_at),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapAutomation(row: Row): AutomationDefinition {
    return {
      id: str(row.id),
      code: str(row.code),
      title: str(row.title),
      triggerType: str(row.trigger_type),
      definition: asJson(row.definition, {}),
      destructive: bool(row.destructive),
      requiresApproval: bool(row.requires_approval),
      status: str(row.status),
      createdAt: asDate(row.created_at),
    };
  }

  private mapExecution(row: Row): AutomationExecution {
    return {
      id: str(row.id),
      automationId: str(row.automation_id),
      status: str(row.status),
      requestedBy: str(row.requested_by),
      approvedBy: strOrNull(row.approved_by),
      idempotencyKey: str(row.idempotency_key),
      result: asJson(row.result, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapHealth(row: Row): ServiceHealthSnapshot {
    return {
      id: str(row.id),
      serviceId: str(row.service_id),
      overallStatus: str(row.overall_status),
      sourceSystem: str(row.source_system),
      indicators: asJson(row.indicators, {}),
      observedAt: asDate(row.observed_at),
      staleAfter: asDateOrNull(row.stale_after),
      createdAt: asDate(row.created_at),
    };
  }

  async recordHealthSnapshot(
    input: Omit<ServiceHealthSnapshot, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ServiceHealthSnapshot> {
    const rows = await this.q(
      `INSERT INTO edge_p9_service_health_snapshots (
         id, service_id, overall_status, source_system, indicators, observed_at, stale_after
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, COALESCE($5::jsonb, '{}'::jsonb), $6, $7
       ) RETURNING *`,
      [
        input.id ?? null,
        input.serviceId,
        input.overallStatus,
        input.sourceSystem,
        JSON.stringify(input.indicators ?? {}),
        input.observedAt,
        input.staleAfter,
      ],
      client,
    );
    return this.mapHealth(rows[0]!);
  }

  async listHealthSnapshots(serviceId: string, limit = 50): Promise<ServiceHealthSnapshot[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p9_service_health_snapshots
       WHERE service_id = $1 ORDER BY observed_at DESC LIMIT $2`,
      [serviceId, limit],
    );
    return rows.map((r) => this.mapHealth(r));
  }

  async ingestAlert(
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
  ): Promise<{ alert: OperationalAlert; deduplicated: boolean }> {
    const existing = await this.q(
      `SELECT * FROM edge_p9_alerts WHERE fingerprint = $1`,
      [input.fingerprint],
      client,
    );
    if (existing[0]) {
      const rows = await this.q(
        `UPDATE edge_p9_alerts SET
           occurrence_count = occurrence_count + 1,
           last_seen_at = NOW(),
           title = $2,
           severity = COALESCE($3, severity),
           source_system = $4,
           labels = COALESCE($5::jsonb, labels),
           annotations = COALESCE($6::jsonb, annotations),
           updated_at = NOW(),
           version = version + 1
         WHERE fingerprint = $1
         RETURNING *`,
        [
          input.fingerprint,
          input.title,
          input.severity ?? null,
          input.sourceSystem,
          JSON.stringify(input.labels ?? {}),
          JSON.stringify(input.annotations ?? {}),
        ],
        client,
      );
      return { alert: this.mapAlert(rows[0]!), deduplicated: true };
    }

    const rows = await this.q(
      `INSERT INTO edge_p9_alerts (
         fingerprint, title, severity, status, service_id, source_system,
         environment, region, labels, annotations, correlation_id
       ) VALUES (
         $1, $2, COALESCE($3, 'SEV3'), COALESCE($4, 'RECEIVED'), $5, $6,
         $7, $8, COALESCE($9::jsonb, '{}'::jsonb), COALESCE($10::jsonb, '{}'::jsonb), $11::uuid
       ) RETURNING *`,
      [
        input.fingerprint,
        input.title,
        input.severity ?? null,
        input.status ?? null,
        input.serviceId ?? null,
        input.sourceSystem,
        input.environment ?? null,
        input.region ?? null,
        JSON.stringify(input.labels ?? {}),
        JSON.stringify(input.annotations ?? {}),
        input.correlationId ?? null,
      ],
      client,
    );
    return { alert: this.mapAlert(rows[0]!), deduplicated: false };
  }

  async getAlert(id: string): Promise<OperationalAlert | null> {
    const rows = await this.q(`SELECT * FROM edge_p9_alerts WHERE id = $1`, [id]);
    return rows[0] ? this.mapAlert(rows[0]) : null;
  }

  async listAlerts(filter?: ListFilter): Promise<{ items: OperationalAlert[]; total: number }> {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.serviceId) {
      params.push(filter.serviceId);
      where.push(`service_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(`SELECT COUNT(*)::int AS c FROM edge_p9_alerts ${clause}`, params);
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p9_alerts ${clause} ORDER BY last_seen_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapAlert(r)), total: num(countRows[0]?.c) };
  }

  async transitionAlert(
    id: string,
    toStatus: string,
    patch: {
      acknowledgedBy?: string | null;
      suppressionReason?: string | null;
      expectedVersion?: number;
    },
    client?: unknown,
  ): Promise<OperationalAlert> {
    const params: unknown[] = [id, toStatus, patch.acknowledgedBy ?? null, patch.suppressionReason ?? null];
    let versionClause = '';
    if (patch.expectedVersion != null) {
      params.push(patch.expectedVersion);
      versionClause = ` AND version = $${params.length}`;
    }
    const rows = await this.q(
      `UPDATE edge_p9_alerts SET
         status = $2,
         acknowledged_by = CASE WHEN $2 = 'ACKNOWLEDGED' THEN COALESCE($3, acknowledged_by) ELSE acknowledged_by END,
         acknowledged_at = CASE WHEN $2 = 'ACKNOWLEDGED' THEN NOW() ELSE acknowledged_at END,
         resolved_at = CASE WHEN $2 = 'RESOLVED' THEN NOW() ELSE resolved_at END,
         suppression_reason = COALESCE($4, suppression_reason),
         updated_at = NOW(),
         version = version + 1
       WHERE id = $1${versionClause}
       RETURNING *`,
      params,
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.CONFLICT, 'Alert transition conflict or not found');
    }
    return this.mapAlert(rows[0]);
  }

  async createIncident(
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
  ): Promise<Incident> {
    const incidentNumber = input.incidentNumber ?? numbered('INC');
    const rows = await this.q(
      `INSERT INTO edge_p9_incidents (
         id, incident_number, title, description, category, severity, priority, status,
         is_major, service_id, environment, region, detection_source, detected_at,
         reporter_id, commander_id, assigned_team, assigned_to, resolution_summary,
         root_cause_ref, evidence, metadata, created_by, version
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, COALESCE($8, 'DETECTED'),
         COALESCE($9, FALSE), $10, $11, $12, $13, COALESCE($14, NOW()),
         $15, $16, $17, $18, $19, $20,
         COALESCE($21::jsonb, '{}'::jsonb), COALESCE($22::jsonb, '{}'::jsonb), $23, COALESCE($24, 1)
       ) RETURNING *`,
      [
        input.id ?? null,
        incidentNumber,
        input.title,
        input.description,
        input.category,
        input.severity,
        input.priority,
        input.status,
        input.isMajor,
        input.serviceId,
        input.environment,
        input.region,
        input.detectionSource,
        input.detectedAt ?? null,
        input.reporterId,
        input.commanderId,
        input.assignedTeam,
        input.assignedTo,
        input.resolutionSummary,
        input.rootCauseRef,
        JSON.stringify(input.evidence ?? {}),
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
        input.version ?? 1,
      ],
      client,
    );
    return this.mapIncident(rows[0]!);
  }

  async getIncident(id: string): Promise<Incident | null> {
    const rows = await this.q(`SELECT * FROM edge_p9_incidents WHERE id = $1`, [id]);
    return rows[0] ? this.mapIncident(rows[0]) : null;
  }

  async listIncidents(
    filter?: ListFilter & { isMajor?: boolean },
  ): Promise<{ items: Incident[]; total: number }> {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.serviceId) {
      params.push(filter.serviceId);
      where.push(`service_id = $${params.length}`);
    }
    if (filter?.isMajor != null) {
      params.push(filter.isMajor);
      where.push(`is_major = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p9_incidents ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p9_incidents ${clause} ORDER BY detected_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapIncident(r)), total: num(countRows[0]?.c) };
  }

  async transitionIncident(
    id: string,
    toStatus: string,
    patch: Partial<Incident> & { expectedVersion?: number },
    actorId: string,
    client?: unknown,
  ): Promise<Incident> {
    const params: unknown[] = [
      id,
      toStatus,
      actorId,
      patch.isMajor ?? null,
      patch.resolutionSummary ?? null,
      patch.commanderId ?? null,
      patch.assignedTo ?? null,
      JSON.stringify(patch.evidence ?? null),
    ];
    let versionClause = '';
    if (patch.expectedVersion != null) {
      params.push(patch.expectedVersion);
      versionClause = ` AND version = $${params.length}`;
    }
    const rows = await this.q(
      `UPDATE edge_p9_incidents SET
         status = $2,
         updated_by = $3,
         is_major = COALESCE($4, is_major),
         resolution_summary = COALESCE($5, resolution_summary),
         commander_id = COALESCE($6, commander_id),
         assigned_to = COALESCE($7, assigned_to),
         evidence = CASE WHEN $8::text IS NULL OR $8::text = 'null' THEN evidence ELSE $8::jsonb END,
         acknowledged_at = CASE WHEN $2 = 'ACKNOWLEDGED' THEN COALESCE(acknowledged_at, NOW()) ELSE acknowledged_at END,
         mitigated_at = CASE WHEN $2 = 'MITIGATING' THEN COALESCE(mitigated_at, NOW()) ELSE mitigated_at END,
         resolved_at = CASE WHEN $2 = 'RESOLVED' THEN COALESCE(resolved_at, NOW()) ELSE resolved_at END,
         closed_at = CASE WHEN $2 = 'CLOSED' THEN COALESCE(closed_at, NOW()) ELSE closed_at END,
         updated_at = NOW(),
         version = version + 1
       WHERE id = $1${versionClause}
       RETURNING *`,
      params,
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.CONFLICT, 'Incident transition conflict or not found');
    }
    return this.mapIncident(rows[0]);
  }

  async addIncidentTimeline(
    input: Omit<IncidentTimelineEntry, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<IncidentTimelineEntry> {
    const rows = await this.q(
      `INSERT INTO edge_p9_incident_timeline (id, incident_id, event_type, body, actor_id)
       VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5)
       RETURNING *`,
      [input.id ?? null, input.incidentId, input.eventType, input.body, input.actorId],
      client,
    );
    const row = rows[0]!;
    return {
      id: str(row.id),
      incidentId: str(row.incident_id),
      eventType: str(row.event_type),
      body: str(row.body),
      actorId: strOrNull(row.actor_id),
      createdAt: asDate(row.created_at),
    };
  }

  async createProblem(
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
  ): Promise<Problem> {
    const problemNumber = input.problemNumber ?? numbered('PRB');
    const rows = await this.q(
      `INSERT INTO edge_p9_problems (
         id, problem_number, title, description, status, priority, owner_id, service_id,
         root_cause_summary, root_cause_confirmed, root_cause_reviewer_id, workaround,
         due_at, evidence, created_by, version
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, COALESCE($5, 'IDENTIFIED'), $6, $7, $8,
         $9, COALESCE($10, FALSE), $11, $12, $13,
         COALESCE($14::jsonb, '{}'::jsonb), $15, COALESCE($16, 1)
       ) RETURNING *`,
      [
        input.id ?? null,
        problemNumber,
        input.title,
        input.description,
        input.status,
        input.priority,
        input.ownerId,
        input.serviceId,
        input.rootCauseSummary,
        input.rootCauseConfirmed ?? false,
        input.rootCauseReviewerId,
        input.workaround,
        input.dueAt,
        JSON.stringify(input.evidence ?? {}),
        input.createdBy,
        input.version ?? 1,
      ],
      client,
    );
    return this.mapProblem(rows[0]!);
  }

  async getProblem(id: string): Promise<Problem | null> {
    const rows = await this.q(`SELECT * FROM edge_p9_problems WHERE id = $1`, [id]);
    return rows[0] ? this.mapProblem(rows[0]) : null;
  }

  async listProblems(filter?: ListFilter): Promise<{ items: Problem[]; total: number }> {
    const limit = Math.min(Math.max(filter?.limit ?? 50, 1), 200);
    const offset = Math.max(filter?.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.serviceId) {
      params.push(filter.serviceId);
      where.push(`service_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p9_problems ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p9_problems ${clause} ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapProblem(r)), total: num(countRows[0]?.c) };
  }

  async linkProblemIncident(
    problemId: string,
    incidentId: string,
    client?: unknown,
  ): Promise<void> {
    await this.q(
      `INSERT INTO edge_p9_problem_incident_links (problem_id, incident_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [problemId, incidentId],
      client,
    );
  }

  async confirmRootCause(
    problemId: string,
    input: {
      rootCauseSummary: string;
      reviewerId: string;
      evidence?: Record<string, unknown>;
    },
    client?: unknown,
  ): Promise<Problem> {
    const rows = await this.q(
      `UPDATE edge_p9_problems SET
         root_cause_summary = $2,
         root_cause_confirmed = TRUE,
         root_cause_reviewer_id = $3,
         status = 'ROOT_CAUSE_CONFIRMED',
         evidence = CASE WHEN $4::text IS NULL THEN evidence ELSE COALESCE(evidence, '{}'::jsonb) || $4::jsonb END,
         updated_at = NOW(),
         version = version + 1
       WHERE id = $1
       RETURNING *`,
      [
        problemId,
        input.rootCauseSummary,
        input.reviewerId,
        input.evidence ? JSON.stringify(input.evidence) : null,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Problem not found');
    }
    return this.mapProblem(rows[0]);
  }

  async createChange(
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
  ): Promise<ChangeRequest> {
    const changeNumber = input.changeNumber ?? numbered('CHG');
    const rows = await this.q(
      `INSERT INTO edge_p9_changes (
         id, change_number, title, description, change_type, status, requester_id, owner_id,
         responsible_team, service_id, environment, risk_level, implementation_plan,
         validation_plan, rollback_plan, planned_start_at, planned_end_at, evidence, version
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, COALESCE($5, 'NORMAL'), COALESCE($6, 'DRAFT'),
         $7, $8, $9, $10, $11, COALESCE($12, 'MEDIUM'), $13, $14, $15, $16, $17,
         COALESCE($18::jsonb, '{}'::jsonb), COALESCE($19, 1)
       ) RETURNING *`,
      [
        input.id ?? null,
        changeNumber,
        input.title,
        input.description,
        input.changeType,
        input.status,
        input.requesterId,
        input.ownerId,
        input.responsibleTeam,
        input.serviceId,
        input.environment,
        input.riskLevel,
        input.implementationPlan,
        input.validationPlan,
        input.rollbackPlan,
        input.plannedStartAt,
        input.plannedEndAt,
        JSON.stringify(input.evidence ?? {}),
        input.version ?? 1,
      ],
      client,
    );
    return this.mapChange(rows[0]!);
  }

  async getChange(id: string): Promise<ChangeRequest | null> {
    const rows = await this.q(`SELECT * FROM edge_p9_changes WHERE id = $1`, [id]);
    return rows[0] ? this.mapChange(rows[0]) : null;
  }

  async transitionChange(
    id: string,
    toStatus: string,
    patch: Partial<ChangeRequest> & { expectedVersion?: number },
    client?: unknown,
  ): Promise<ChangeRequest> {
    const params: unknown[] = [id, toStatus, patch.outcome ?? null];
    let versionClause = '';
    if (patch.expectedVersion != null) {
      params.push(patch.expectedVersion);
      versionClause = ` AND version = $${params.length}`;
    }
    const rows = await this.q(
      `UPDATE edge_p9_changes SET
         status = $2,
         outcome = COALESCE($3, outcome),
         actual_start_at = CASE WHEN $2 = 'EXECUTING' THEN COALESCE(actual_start_at, NOW()) ELSE actual_start_at END,
         actual_end_at = CASE WHEN $2 IN ('COMPLETED','FAILED','ROLLED_BACK') THEN COALESCE(actual_end_at, NOW()) ELSE actual_end_at END,
         updated_at = NOW(),
         version = version + 1
       WHERE id = $1${versionClause}
       RETURNING *`,
      params,
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.CONFLICT, 'Change transition conflict or not found');
    }
    return this.mapChange(rows[0]);
  }

  async approveChange(
    id: string,
    approverId: string,
    approved: boolean,
    rejectedReason?: string | null,
    client?: unknown,
  ): Promise<ChangeRequest> {
    const status = approved ? 'APPROVED' : 'REJECTED';
    const rows = await this.q(
      `UPDATE edge_p9_changes SET
         status = $2,
         approver_id = $3,
         approved_at = CASE WHEN $2 = 'APPROVED' THEN NOW() ELSE NULL END,
         rejected_reason = $4,
         updated_at = NOW(),
         version = version + 1
       WHERE id = $1
       RETURNING *`,
      [id, status, approverId, rejectedReason ?? null],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Change not found');
    }
    return this.mapChange(rows[0]);
  }

  async listChanges(filter?: ListFilter): Promise<{ items: ChangeRequest[]; total: number }> {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.serviceId) {
      params.push(filter.serviceId);
      where.push(`service_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(`SELECT COUNT(*)::int AS c FROM edge_p9_changes ${clause}`, params);
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p9_changes ${clause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapChange(r)), total: num(countRows[0]?.c) };
  }

  async createMaintenance(
    input: Omit<MaintenanceWindow, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<MaintenanceWindow> {
    const rows = await this.q(
      `INSERT INTO edge_p9_maintenance_windows (
         id, title, maintenance_type, status, service_id, environment, region,
         starts_at, ends_at, timezone, responsible_team, reason, risk_level,
         communication_plan, approved_by, created_by
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, COALESCE($3, 'PLANNED'), COALESCE($4, 'SCHEDULED'),
         $5, $6, $7, $8, $9, COALESCE($10, 'UTC'), $11, $12, COALESCE($13, 'MEDIUM'),
         $14, $15, $16
       ) RETURNING *`,
      [
        input.id ?? null,
        input.title,
        input.maintenanceType,
        input.status,
        input.serviceId,
        input.environment,
        input.region,
        input.startsAt,
        input.endsAt,
        input.timezone,
        input.responsibleTeam,
        input.reason,
        input.riskLevel,
        input.communicationPlan,
        input.approvedBy,
        input.createdBy,
      ],
      client,
    );
    return this.mapMaintenance(rows[0]!);
  }

  async listMaintenance(
    filter?: ListFilter,
  ): Promise<{ items: MaintenanceWindow[]; total: number }> {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.serviceId) {
      params.push(filter.serviceId);
      where.push(`service_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p9_maintenance_windows ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p9_maintenance_windows ${clause}
       ORDER BY starts_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapMaintenance(r)), total: num(countRows[0]?.c) };
  }

  async detectMaintenanceConflict(
    serviceId: string | null,
    startsAt: Date,
    endsAt: Date,
    excludeId?: string,
  ): Promise<MaintenanceWindow[]> {
    if (!serviceId) return [];
    const rows = await this.q(
      `SELECT * FROM edge_p9_maintenance_windows
       WHERE service_id = $1
         AND status IN ('DRAFT','SCHEDULED','ACTIVE')
         AND starts_at < $3 AND ends_at > $2
         AND ($4::uuid IS NULL OR id <> $4::uuid)`,
      [serviceId, startsAt, endsAt, excludeId ?? null],
    );
    return rows.map((r) => this.mapMaintenance(r));
  }

  async createServiceRequest(
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
  ): Promise<ServiceRequest> {
    const requestNumber = input.requestNumber ?? numbered('REQ');
    const rows = await this.q(
      `INSERT INTO edge_p9_service_requests (
         id, request_number, category, title, description, priority, status,
         requester_id, assigned_to, assigned_team, service_id, environment, due_at,
         resolution, version
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, COALESCE($6, 'P3'),
         COALESCE($7, 'OPEN'), $8, $9, $10, $11, $12, $13, $14, COALESCE($15, 1)
       ) RETURNING *`,
      [
        input.id ?? null,
        requestNumber,
        input.category,
        input.title,
        input.description,
        input.priority,
        input.status,
        input.requesterId,
        input.assignedTo,
        input.assignedTeam,
        input.serviceId,
        input.environment,
        input.dueAt,
        input.resolution ?? null,
        input.version ?? 1,
      ],
      client,
    );
    return this.mapRequest(rows[0]!);
  }

  async listServiceRequests(
    filter?: ListFilter,
  ): Promise<{ items: ServiceRequest[]; total: number }> {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p9_service_requests ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p9_service_requests ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapRequest(r)), total: num(countRows[0]?.c) };
  }

  async createTask(
    input: Omit<OperationalTask, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<OperationalTask> {
    const rows = await this.q(
      `INSERT INTO edge_p9_operational_tasks (
         id, title, status, priority, assigned_to, assigned_team, due_at,
         related_incident_id, related_change_id, related_service_id, runbook_ref,
         evidence, created_by
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, COALESCE($3, 'OPEN'), COALESCE($4, 'P3'),
         $5, $6, $7, $8, $9, $10, $11, COALESCE($12::jsonb, '{}'::jsonb), $13
       ) RETURNING *`,
      [
        input.id ?? null,
        input.title,
        input.status,
        input.priority,
        input.assignedTo,
        input.assignedTeam,
        input.dueAt,
        input.relatedIncidentId,
        input.relatedChangeId,
        input.relatedServiceId,
        input.runbookRef,
        JSON.stringify(input.evidence ?? {}),
        input.createdBy,
      ],
      client,
    );
    return this.mapTask(rows[0]!);
  }

  async listTasks(filter?: ListFilter): Promise<{ items: OperationalTask[]; total: number }> {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p9_operational_tasks ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p9_operational_tasks ${clause}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapTask(r)), total: num(countRows[0]?.c) };
  }

  async createOnCallTeam(
    input: Omit<OnCallTeam, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<OnCallTeam> {
    const rows = await this.q(
      `INSERT INTO edge_p9_oncall_teams (id, code, display_name, timezone)
       VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, COALESCE($4, 'UTC'))
       RETURNING *`,
      [input.id ?? null, input.code, input.displayName, input.timezone],
      client,
    );
    const row = rows[0]!;
    return {
      id: str(row.id),
      code: str(row.code),
      displayName: str(row.display_name),
      timezone: str(row.timezone),
      createdAt: asDate(row.created_at),
    };
  }

  async createOnCallRotation(
    input: Omit<OnCallRotation, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<OnCallRotation> {
    const rows = await this.q(
      `INSERT INTO edge_p9_oncall_rotations (
         id, team_id, starts_at, ends_at, primary_responder_id, secondary_responder_id
       ) VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.id ?? null,
        input.teamId,
        input.startsAt,
        input.endsAt,
        input.primaryResponderId,
        input.secondaryResponderId,
      ],
      client,
    );
    const row = rows[0]!;
    return {
      id: str(row.id),
      teamId: str(row.team_id),
      startsAt: asDate(row.starts_at),
      endsAt: asDate(row.ends_at),
      primaryResponderId: str(row.primary_responder_id),
      secondaryResponderId: strOrNull(row.secondary_responder_id),
      createdAt: asDate(row.created_at),
    };
  }

  async listOnCallRotations(teamId?: string): Promise<OnCallRotation[]> {
    const rows = teamId
      ? await this.q(
          `SELECT * FROM edge_p9_oncall_rotations WHERE team_id = $1 ORDER BY starts_at DESC`,
          [teamId],
        )
      : await this.q(`SELECT * FROM edge_p9_oncall_rotations ORDER BY starts_at DESC LIMIT 100`);
    return rows.map((row) => ({
      id: str(row.id),
      teamId: str(row.team_id),
      startsAt: asDate(row.starts_at),
      endsAt: asDate(row.ends_at),
      primaryResponderId: str(row.primary_responder_id),
      secondaryResponderId: strOrNull(row.secondary_responder_id),
      createdAt: asDate(row.created_at),
    }));
  }

  async createSlo(
    input: Omit<SloDefinition, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<SloDefinition> {
    const rows = await this.q(
      `INSERT INTO edge_p9_slo_definitions (
         id, service_id, name, sli_type, target_value, window_days, data_source_ref, status
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, COALESCE($6, 30), $7, COALESCE($8, 'ACTIVE')
       ) RETURNING *`,
      [
        input.id ?? null,
        input.serviceId,
        input.name,
        input.sliType,
        input.targetValue,
        input.windowDays,
        input.dataSourceRef,
        input.status,
      ],
      client,
    );
    const row = rows[0]!;
    return {
      id: str(row.id),
      serviceId: str(row.service_id),
      name: str(row.name),
      sliType: str(row.sli_type),
      targetValue: num(row.target_value),
      windowDays: num(row.window_days),
      dataSourceRef: strOrNull(row.data_source_ref),
      status: str(row.status),
      createdAt: asDate(row.created_at),
    };
  }

  async recordSloMeasurement(
    input: Omit<SloMeasurement, 'id' | 'observedAt'> & { id?: string; observedAt?: Date },
    client?: unknown,
  ): Promise<SloMeasurement> {
    const rows = await this.q(
      `INSERT INTO edge_p9_slo_measurements (
         id, slo_id, measured_value, error_budget_remaining, window_start, window_end,
         source_system, observed_at
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, COALESCE($8, NOW())
       ) RETURNING *`,
      [
        input.id ?? null,
        input.sloId,
        input.measuredValue,
        input.errorBudgetRemaining,
        input.windowStart,
        input.windowEnd,
        input.sourceSystem,
        input.observedAt ?? null,
      ],
      client,
    );
    const row = rows[0]!;
    return {
      id: str(row.id),
      sloId: str(row.slo_id),
      measuredValue: num(row.measured_value),
      errorBudgetRemaining: numOrNull(row.error_budget_remaining),
      windowStart: asDate(row.window_start),
      windowEnd: asDate(row.window_end),
      sourceSystem: str(row.source_system),
      observedAt: asDate(row.observed_at),
    };
  }

  async listSlos(serviceId?: string): Promise<SloDefinition[]> {
    const rows = serviceId
      ? await this.q(`SELECT * FROM edge_p9_slo_definitions WHERE service_id = $1`, [serviceId])
      : await this.q(`SELECT * FROM edge_p9_slo_definitions ORDER BY created_at DESC LIMIT 200`);
    return rows.map((row) => ({
      id: str(row.id),
      serviceId: str(row.service_id),
      name: str(row.name),
      sliType: str(row.sli_type),
      targetValue: num(row.target_value),
      windowDays: num(row.window_days),
      dataSourceRef: strOrNull(row.data_source_ref),
      status: str(row.status),
      createdAt: asDate(row.created_at),
    }));
  }

  async recordCapacity(
    input: Omit<CapacityMeasurement, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<CapacityMeasurement> {
    const rows = await this.q(
      `INSERT INTO edge_p9_capacity_measurements (
         id, service_id, metric_name, metric_value, unit, threshold_warning,
         threshold_critical, source_system, observed_at
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9
       ) RETURNING *`,
      [
        input.id ?? null,
        input.serviceId,
        input.metricName,
        input.metricValue,
        input.unit,
        input.thresholdWarning,
        input.thresholdCritical,
        input.sourceSystem,
        input.observedAt,
      ],
      client,
    );
    const row = rows[0]!;
    return {
      id: str(row.id),
      serviceId: strOrNull(row.service_id),
      metricName: str(row.metric_name),
      metricValue: num(row.metric_value),
      unit: strOrNull(row.unit),
      thresholdWarning: numOrNull(row.threshold_warning),
      thresholdCritical: numOrNull(row.threshold_critical),
      sourceSystem: str(row.source_system),
      observedAt: asDate(row.observed_at),
      createdAt: asDate(row.created_at),
    };
  }

  async listCapacity(serviceId?: string, limit = 50): Promise<CapacityMeasurement[]> {
    const rows = serviceId
      ? await this.q(
          `SELECT * FROM edge_p9_capacity_measurements WHERE service_id = $1
           ORDER BY observed_at DESC LIMIT $2`,
          [serviceId, limit],
        )
      : await this.q(
          `SELECT * FROM edge_p9_capacity_measurements ORDER BY observed_at DESC LIMIT $1`,
          [limit],
        );
    return rows.map((row) => ({
      id: str(row.id),
      serviceId: strOrNull(row.service_id),
      metricName: str(row.metric_name),
      metricValue: num(row.metric_value),
      unit: strOrNull(row.unit),
      thresholdWarning: numOrNull(row.threshold_warning),
      thresholdCritical: numOrNull(row.threshold_critical),
      sourceSystem: str(row.source_system),
      observedAt: asDate(row.observed_at),
      createdAt: asDate(row.created_at),
    }));
  }

  async createRecovery(
    input: Omit<
      RecoveryOperation,
      'id' | 'createdAt' | 'updatedAt' | 'approverId' | 'outcome'
    > & {
      id?: string;
      approverId?: string | null;
      outcome?: string | null;
    },
    client?: unknown,
  ): Promise<RecoveryOperation> {
    const rows = await this.q(
      `INSERT INTO edge_p9_recovery_operations (
         id, operation_type, status, service_id, requester_id, approver_id,
         external_evidence_ref, evidence_kind, evidence_justification, outcome
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, COALESCE($3, 'REQUESTED'), $4, $5, $6, $7, $8, $9, $10
       ) RETURNING *`,
      [
        input.id ?? null,
        input.operationType,
        input.status,
        input.serviceId,
        input.requesterId,
        input.approverId ?? null,
        input.externalEvidenceRef,
        input.evidenceKind ?? null,
        input.evidenceJustification ?? null,
        input.outcome ?? null,
      ],
      client,
    );
    return this.mapRecovery(rows[0]!);
  }

  async getRecovery(id: string): Promise<RecoveryOperation | null> {
    const rows = await this.q(`SELECT * FROM edge_p9_recovery_operations WHERE id = $1`, [id]);
    return rows[0] ? this.mapRecovery(rows[0]) : null;
  }

  async listRecovery(
    filter?: ListFilter,
  ): Promise<{ items: RecoveryOperation[]; total: number }> {
    const limit = Math.min(Math.max(filter?.limit ?? 50, 1), 200);
    const offset = Math.max(filter?.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.serviceId) {
      params.push(filter.serviceId);
      where.push(`service_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p9_recovery_operations ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p9_recovery_operations ${clause} ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapRecovery(r)), total: num(countRows[0]?.c) };
  }

  async transitionRecovery(
    id: string,
    toStatus: string,
    patch: Partial<RecoveryOperation>,
    client?: unknown,
  ): Promise<RecoveryOperation> {
    const rows = await this.q(
      `UPDATE edge_p9_recovery_operations SET
         status = $2,
         approver_id = COALESCE($3, approver_id),
         external_evidence_ref = COALESCE($4, external_evidence_ref),
         evidence_kind = COALESCE($5, evidence_kind),
         evidence_justification = COALESCE($6, evidence_justification),
         outcome = COALESCE($7, outcome),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        toStatus,
        patch.approverId ?? null,
        patch.externalEvidenceRef ?? null,
        patch.evidenceKind ?? null,
        patch.evidenceJustification ?? null,
        patch.outcome ?? null,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Recovery operation not found');
    }
    return this.mapRecovery(rows[0]);
  }

  async createRunbook(
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
  ): Promise<{ runbook: Runbook; version: RunbookVersion }> {
    const rbRows = await this.q(
      `INSERT INTO edge_p9_runbooks (code, title, service_id, owner_id, current_version)
       VALUES ($1, $2, $3, $4, 1)
       RETURNING *`,
      [input.code, input.title, input.serviceId ?? null, input.ownerId ?? null],
      client,
    );
    const rb = rbRows[0]!;
    const verRows = await this.q(
      `INSERT INTO edge_p9_runbook_versions (runbook_id, version, body, steps, created_by)
       VALUES ($1, 1, $2, COALESCE($3::jsonb, '[]'::jsonb), $4)
       RETURNING *`,
      [str(rb.id), input.body, JSON.stringify(input.steps ?? []), input.createdBy],
      client,
    );
    const ver = verRows[0]!;
    return {
      runbook: {
        id: str(rb.id),
        code: str(rb.code),
        title: str(rb.title),
        serviceId: strOrNull(rb.service_id),
        ownerId: strOrNull(rb.owner_id),
        currentVersion: num(rb.current_version),
        createdAt: asDate(rb.created_at),
      },
      version: {
        id: str(ver.id),
        runbookId: str(ver.runbook_id),
        version: num(ver.version),
        body: str(ver.body),
        steps: asJson(ver.steps, []),
        createdBy: str(ver.created_by),
        createdAt: asDate(ver.created_at),
      },
    };
  }

  async listRunbooks(serviceId?: string): Promise<Runbook[]> {
    const rows = serviceId
      ? await this.q(`SELECT * FROM edge_p9_runbooks WHERE service_id = $1`, [serviceId])
      : await this.q(`SELECT * FROM edge_p9_runbooks ORDER BY created_at DESC LIMIT 200`);
    return rows.map((row) => ({
      id: str(row.id),
      code: str(row.code),
      title: str(row.title),
      serviceId: strOrNull(row.service_id),
      ownerId: strOrNull(row.owner_id),
      currentVersion: num(row.current_version),
      createdAt: asDate(row.created_at),
    }));
  }

  async upsertStatusComponent(
    input: {
      code: string;
      displayName: string;
      serviceId?: string | null;
      publicStatus?: string;
    },
    client?: unknown,
  ): Promise<StatusComponent> {
    const rows = await this.q(
      `INSERT INTO edge_p9_status_components (code, display_name, service_id, public_status)
       VALUES ($1, $2, $3, COALESCE($4, 'UNKNOWN'))
       ON CONFLICT (code) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         service_id = COALESCE(EXCLUDED.service_id, edge_p9_status_components.service_id),
         public_status = COALESCE(EXCLUDED.public_status, edge_p9_status_components.public_status),
         updated_at = NOW()
       RETURNING *`,
      [input.code, input.displayName, input.serviceId ?? null, input.publicStatus ?? null],
      client,
    );
    const row = rows[0]!;
    return {
      id: str(row.id),
      code: str(row.code),
      displayName: str(row.display_name),
      serviceId: strOrNull(row.service_id),
      publicStatus: str(row.public_status),
      updatedAt: asDate(row.updated_at),
    };
  }

  async requestStatusPublication(
    input: {
      componentId: string;
      publicStatus: string;
      message: string;
      authorId: string;
    },
    client?: unknown,
  ): Promise<StatusPublication> {
    const rows = await this.q(
      `INSERT INTO edge_p9_status_publications (
         component_id, public_status, message, status, author_id
       ) VALUES ($1, $2, $3, 'PENDING_APPROVAL', $4)
       RETURNING *`,
      [input.componentId, input.publicStatus, input.message, input.authorId],
      client,
    );
    return this.mapPublication(rows[0]!);
  }

  private mapPublication(row: Row): StatusPublication {
    return {
      id: str(row.id),
      componentId: str(row.component_id),
      publicStatus: str(row.public_status),
      message: str(row.message),
      status: str(row.status),
      authorId: str(row.author_id),
      approverId: strOrNull(row.approver_id),
      publishedAt: asDateOrNull(row.published_at),
      createdAt: asDate(row.created_at),
    };
  }

  async getStatusPublication(id: string): Promise<StatusPublication | null> {
    const rows = await this.q(`SELECT * FROM edge_p9_status_publications WHERE id = $1`, [id]);
    return rows[0] ? this.mapPublication(rows[0]) : null;
  }

  async approveStatusPublication(
    id: string,
    approverId: string,
    approved: boolean,
    client?: unknown,
  ): Promise<StatusPublication> {
    const status = approved ? 'PUBLISHED' : 'REJECTED';
    const rows = await this.q(
      `UPDATE edge_p9_status_publications SET
         status = $2,
         approver_id = $3,
         published_at = CASE WHEN $2 = 'PUBLISHED' THEN NOW() ELSE NULL END
       WHERE id = $1
       RETURNING *`,
      [id, status, approverId],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Status publication not found');
    }
    const pub = this.mapPublication(rows[0]);
    if (approved) {
      await this.q(
        `UPDATE edge_p9_status_components SET public_status = $2, updated_at = NOW()
         WHERE id = $1`,
        [pub.componentId, pub.publicStatus],
        client,
      );
    }
    return pub;
  }

  async listStatusComponents(
    filter?: ListFilter,
  ): Promise<{ items: StatusComponent[]; total: number }> {
    const limit = Math.min(Math.max(filter?.limit ?? 50, 1), 200);
    const offset = Math.max(filter?.offset ?? 0, 0);
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p9_status_components`,
    );
    const rows = await this.q(
      `SELECT * FROM edge_p9_status_components ORDER BY display_name ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return {
      items: rows.map((row) => ({
        id: str(row.id),
        code: str(row.code),
        displayName: str(row.display_name),
        serviceId: strOrNull(row.service_id),
        publicStatus: str(row.public_status),
        updatedAt: asDate(row.updated_at),
      })),
      total: num(countRows[0]?.c),
    };
  }

  async listRisks(
    filter?: ListFilter,
  ): Promise<{ items: OperationalRisk[]; total: number }> {
    const limit = Math.min(Math.max(filter?.limit ?? 50, 1), 200);
    const offset = Math.max(filter?.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.serviceId) {
      params.push(filter.serviceId);
      where.push(`service_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p9_operational_risks ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p9_operational_risks ${clause} ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      items: rows.map((row) => ({
        id: str(row.id),
        title: str(row.title),
        category: str(row.category),
        serviceId: strOrNull(row.service_id),
        probability: str(row.probability),
        impact: str(row.impact),
        status: str(row.status),
        ownerId: strOrNull(row.owner_id),
        mitigationPlan: strOrNull(row.mitigation_plan),
        dueAt: asDateOrNull(row.due_at),
        createdBy: str(row.created_by),
        createdAt: asDate(row.created_at),
        updatedAt: asDate(row.updated_at),
      })),
      total: num(countRows[0]?.c),
    };
  }

  async listExceptions(
    filter?: ListFilter,
  ): Promise<{ items: OperationalException[]; total: number }> {
    const limit = Math.min(Math.max(filter?.limit ?? 50, 1), 200);
    const offset = Math.max(filter?.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p9_operational_exceptions ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p9_operational_exceptions ${clause} ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      items: rows.map((row) => ({
        id: str(row.id),
        title: str(row.title),
        scope: str(row.scope),
        justification: str(row.justification),
        status: str(row.status),
        ownerId: str(row.owner_id),
        approverId: strOrNull(row.approver_id),
        expiresAt: asDate(row.expires_at),
        compensatingControls: strOrNull(row.compensating_controls),
        createdAt: asDate(row.created_at),
      })),
      total: num(countRows[0]?.c),
    };
  }

  async createRisk(
    input: Omit<OperationalRisk, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<OperationalRisk> {
    const rows = await this.q(
      `INSERT INTO edge_p9_operational_risks (
         id, title, category, service_id, probability, impact, status, owner_id,
         mitigation_plan, due_at, created_by
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, COALESCE($5, 'MEDIUM'),
         COALESCE($6, 'MEDIUM'), COALESCE($7, 'OPEN'), $8, $9, $10, $11
       ) RETURNING *`,
      [
        input.id ?? null,
        input.title,
        input.category,
        input.serviceId,
        input.probability,
        input.impact,
        input.status,
        input.ownerId,
        input.mitigationPlan,
        input.dueAt,
        input.createdBy,
      ],
      client,
    );
    const row = rows[0]!;
    return {
      id: str(row.id),
      title: str(row.title),
      category: str(row.category),
      serviceId: strOrNull(row.service_id),
      probability: str(row.probability),
      impact: str(row.impact),
      status: str(row.status),
      ownerId: strOrNull(row.owner_id),
      mitigationPlan: strOrNull(row.mitigation_plan),
      dueAt: asDateOrNull(row.due_at),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  async createException(
    input: Omit<OperationalException, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<OperationalException> {
    const rows = await this.q(
      `INSERT INTO edge_p9_operational_exceptions (
         id, title, scope, justification, status, owner_id, approver_id,
         expires_at, compensating_controls
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, COALESCE($5, 'ACTIVE'),
         $6, $7, $8, $9
       ) RETURNING *`,
      [
        input.id ?? null,
        input.title,
        input.scope,
        input.justification,
        input.status,
        input.ownerId,
        input.approverId,
        input.expiresAt,
        input.compensatingControls,
      ],
      client,
    );
    const row = rows[0]!;
    return {
      id: str(row.id),
      title: str(row.title),
      scope: str(row.scope),
      justification: str(row.justification),
      status: str(row.status),
      ownerId: str(row.owner_id),
      approverId: strOrNull(row.approver_id),
      expiresAt: asDate(row.expires_at),
      compensatingControls: strOrNull(row.compensating_controls),
      createdAt: asDate(row.created_at),
    };
  }

  async listExpiredExceptions(asOf?: Date): Promise<OperationalException[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p9_operational_exceptions
       WHERE status = 'ACTIVE' AND expires_at < COALESCE($1, NOW())
       ORDER BY expires_at ASC`,
      [asOf ?? null],
    );
    return rows.map((row) => ({
      id: str(row.id),
      title: str(row.title),
      scope: str(row.scope),
      justification: str(row.justification),
      status: str(row.status),
      ownerId: str(row.owner_id),
      approverId: strOrNull(row.approver_id),
      expiresAt: asDate(row.expires_at),
      compensatingControls: strOrNull(row.compensating_controls),
      createdAt: asDate(row.created_at),
    }));
  }

  async flagExpiredExceptions(asOf?: Date, client?: unknown): Promise<number> {
    const rows = await this.q(
      `UPDATE edge_p9_operational_exceptions SET status = 'EXPIRED'
       WHERE status = 'ACTIVE' AND expires_at < COALESCE($1, NOW())
       RETURNING id`,
      [asOf ?? null],
      client,
    );
    return rows.length;
  }

  async createAutomation(
    input: Omit<AutomationDefinition, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<AutomationDefinition> {
    const rows = await this.q(
      `INSERT INTO edge_p9_automations (
         id, code, title, trigger_type, definition, destructive, requires_approval, status
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4,
         COALESCE($5::jsonb, '{}'::jsonb), COALESCE($6, FALSE), COALESCE($7, TRUE), COALESCE($8, 'ACTIVE')
       ) RETURNING *`,
      [
        input.id ?? null,
        input.code,
        input.title,
        input.triggerType,
        JSON.stringify(input.definition ?? {}),
        input.destructive,
        input.requiresApproval,
        input.status,
      ],
      client,
    );
    return this.mapAutomation(rows[0]!);
  }

  async listAutomations(
    filter?: ListFilter,
  ): Promise<{ items: AutomationDefinition[]; total: number }> {
    const limit = Math.min(Math.max(filter?.limit ?? 50, 1), 200);
    const offset = Math.max(filter?.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p9_automations ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p9_automations ${clause} ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapAutomation(r)), total: num(countRows[0]?.c) };
  }

  async getAutomation(id: string): Promise<AutomationDefinition | null> {
    const rows = await this.q(`SELECT * FROM edge_p9_automations WHERE id = $1`, [id]);
    return rows[0] ? this.mapAutomation(rows[0]) : null;
  }

  async requestAutomationExecution(
    input: {
      automationId: string;
      requestedBy: string;
      idempotencyKey: string;
    },
    client?: unknown,
  ): Promise<AutomationExecution> {
    const existing = await this.getAutomationExecutionByKey(input.idempotencyKey);
    if (existing) return existing;
    const rows = await this.q(
      `INSERT INTO edge_p9_automation_executions (
         automation_id, status, requested_by, idempotency_key
       ) VALUES ($1, 'REQUESTED', $2, $3)
       ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
       RETURNING *`,
      [input.automationId, input.requestedBy, input.idempotencyKey],
      client,
    );
    return this.mapExecution(rows[0]!);
  }

  async getAutomationExecutionByKey(idempotencyKey: string): Promise<AutomationExecution | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p9_automation_executions WHERE idempotency_key = $1`,
      [idempotencyKey],
    );
    return rows[0] ? this.mapExecution(rows[0]) : null;
  }

  async getAutomationExecution(id: string): Promise<AutomationExecution | null> {
    const rows = await this.q(`SELECT * FROM edge_p9_automation_executions WHERE id = $1`, [id]);
    return rows[0] ? this.mapExecution(rows[0]) : null;
  }

  async approveAutomationExecution(
    id: string,
    approverId: string,
    approved: boolean,
    client?: unknown,
  ): Promise<AutomationExecution> {
    const status = approved ? 'APPROVED' : 'DENIED';
    const rows = await this.q(
      `UPDATE edge_p9_automation_executions SET
         status = $2, approved_by = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status, approverId],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Automation execution not found');
    }
    return this.mapExecution(rows[0]);
  }

  async executeAutomation(
    id: string,
    result: Record<string, unknown>,
    client?: unknown,
  ): Promise<AutomationExecution> {
    const rows = await this.q(
      `UPDATE edge_p9_automation_executions SET
         status = 'SUCCEEDED',
         result = COALESCE($2::jsonb, '{}'::jsonb),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, JSON.stringify(result ?? {})],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Automation execution not found');
    }
    return this.mapExecution(rows[0]);
  }

  async listMonitoringSources(): Promise<MonitoringSource[]> {
    const rows = await this.q(`SELECT * FROM edge_p9_monitoring_sources ORDER BY code`);
    return rows.map((row) => this.mapMonitoringSource(row));
  }

  async getMonitoringSource(id: string): Promise<MonitoringSource | null> {
    const rows = await this.q(`SELECT * FROM edge_p9_monitoring_sources WHERE id = $1`, [id]);
    return rows[0] ? this.mapMonitoringSource(rows[0]) : null;
  }

  async connectMonitoringSource(
    input: {
      code: string;
      displayName: string;
      providerType: string;
      endpointRef?: string | null;
      metadata?: Record<string, unknown>;
    },
    client?: unknown,
  ): Promise<MonitoringSource> {
    const rows = await this.q(
      `INSERT INTO edge_p9_monitoring_sources (
         code, display_name, provider_type, endpoint_ref, status, metadata
       ) VALUES ($1, $2, $3, $4, 'CONFIGURED', COALESCE($5::jsonb, '{}'::jsonb))
       ON CONFLICT (code) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         provider_type = EXCLUDED.provider_type,
         endpoint_ref = EXCLUDED.endpoint_ref,
         status = 'CONFIGURED',
         metadata = EXCLUDED.metadata,
         updated_at = NOW()
       RETURNING *`,
      [
        input.code,
        input.displayName,
        input.providerType,
        input.endpointRef ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
      client,
    );
    return this.mapMonitoringSource(rows[0]!);
  }

  async updateMonitoringSourceStatus(
    id: string,
    status: string,
    patch?: { lastObservedAt?: Date | null; metadata?: Record<string, unknown> },
    client?: unknown,
  ): Promise<MonitoringSource> {
    const rows = await this.q(
      `UPDATE edge_p9_monitoring_sources SET
         status = $2,
         last_observed_at = COALESCE($3, last_observed_at),
         metadata = COALESCE($4::jsonb, metadata),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        status,
        patch?.lastObservedAt ?? null,
        patch?.metadata ? JSON.stringify(patch.metadata) : null,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Monitoring source not found');
    }
    return this.mapMonitoringSource(rows[0]);
  }

  async recordMonitoringProbeResult(
    input: Omit<MonitoringProbeResult, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<MonitoringProbeResult> {
    const rows = await this.q(
      `INSERT INTO edge_p9_monitoring_probe_results (
         id, source_id, probe_type, observed_at, outcome, latency_ms, evidence
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, COALESCE($7::jsonb, '{}'::jsonb)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.sourceId,
        input.probeType,
        input.observedAt,
        input.outcome,
        input.latencyMs,
        JSON.stringify(input.evidence ?? {}),
      ],
      client,
    );
    return this.mapProbe(rows[0]!);
  }

  async listMonitoringProbeResults(
    sourceId?: string,
    limit = 50,
  ): Promise<MonitoringProbeResult[]> {
    const rows = sourceId
      ? await this.q(
          `SELECT * FROM edge_p9_monitoring_probe_results WHERE source_id = $1
           ORDER BY observed_at DESC LIMIT $2`,
          [sourceId, limit],
        )
      : await this.q(
          `SELECT * FROM edge_p9_monitoring_probe_results ORDER BY observed_at DESC LIMIT $1`,
          [limit],
        );
    return rows.map((r) => this.mapProbe(r));
  }

  async recordNotificationDelivery(
    input: Omit<
      NotificationDelivery,
      'id' | 'createdAt' | 'updatedAt' | 'attempts' | 'lastError'
    > & {
      id?: string;
      attempts?: number;
      lastError?: string | null;
    },
    client?: unknown,
  ): Promise<NotificationDelivery> {
    const rows = await this.q(
      `INSERT INTO edge_p9_notification_deliveries (
         id, event_type, channel, destination, status, provider_ref,
         related_incident_id, related_rotation_id, attempts, last_error
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, COALESCE($5, 'QUEUED'), $6,
         $7, $8, COALESCE($9, 0), $10
       ) RETURNING *`,
      [
        input.id ?? null,
        input.eventType,
        input.channel,
        input.destination,
        input.status,
        input.providerRef,
        input.relatedIncidentId,
        input.relatedRotationId,
        input.attempts ?? 0,
        input.lastError ?? null,
      ],
      client,
    );
    return this.mapNotification(rows[0]!);
  }

  async getNotificationDelivery(id: string): Promise<NotificationDelivery | null> {
    const rows = await this.q(`SELECT * FROM edge_p9_notification_deliveries WHERE id = $1`, [id]);
    return rows[0] ? this.mapNotification(rows[0]) : null;
  }

  async updateNotificationDeliveryStatus(
    id: string,
    toStatus: string,
    patch?: {
      providerRef?: string | null;
      lastError?: string | null;
      attempts?: number;
    },
    client?: unknown,
  ): Promise<NotificationDelivery> {
    const rows = await this.q(
      `UPDATE edge_p9_notification_deliveries SET
         status = $2,
         provider_ref = COALESCE($3, provider_ref),
         last_error = COALESCE($4, last_error),
         attempts = COALESCE($5, attempts),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        toStatus,
        patch?.providerRef ?? null,
        patch?.lastError ?? null,
        patch?.attempts ?? null,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Notification delivery not found');
    }
    return this.mapNotification(rows[0]);
  }

  async listNotificationDeliveries(
    filter?: ListFilter,
  ): Promise<{ items: NotificationDelivery[]; total: number }> {
    const limit = Math.min(Math.max(filter?.limit ?? 50, 1), 200);
    const offset = Math.max(filter?.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p9_notification_deliveries ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p9_notification_deliveries ${clause} ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapNotification(r)), total: num(countRows[0]?.c) };
  }

  async createRelease(
    input: Omit<
      ReleaseRecord,
      'id' | 'releaseNumber' | 'createdAt' | 'updatedAt' | 'deployedAt'
    > & {
      id?: string;
      releaseNumber?: string;
      deployedAt?: Date | null;
    },
    client?: unknown,
  ): Promise<ReleaseRecord> {
    const releaseNumber = input.releaseNumber?.trim() || numbered('REL');
    const rows = await this.q(
      `INSERT INTO edge_p9_releases (
         id, release_number, version, build_ref, artifact_digest, external_evidence_ref,
         service_id, environment, status, change_id, health_gate_status, deployed_at, created_by
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
         $7, $8, COALESCE($9, 'DRAFT'), $10, COALESCE($11, 'UNKNOWN'), $12, $13
       ) RETURNING *`,
      [
        input.id ?? null,
        releaseNumber,
        input.version,
        input.buildRef,
        input.artifactDigest,
        input.externalEvidenceRef,
        input.serviceId,
        input.environment,
        input.status,
        input.changeId,
        input.healthGateStatus,
        input.deployedAt ?? null,
        input.createdBy,
      ],
      client,
    );
    return this.mapRelease(rows[0]!);
  }

  async getRelease(id: string): Promise<ReleaseRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p9_releases WHERE id = $1`, [id]);
    return rows[0] ? this.mapRelease(rows[0]) : null;
  }

  async transitionRelease(
    id: string,
    toStatus: string,
    patch?: Partial<ReleaseRecord>,
    client?: unknown,
  ): Promise<ReleaseRecord> {
    const rows = await this.q(
      `UPDATE edge_p9_releases SET
         status = $2,
         artifact_digest = COALESCE($3, artifact_digest),
         external_evidence_ref = COALESCE($4, external_evidence_ref),
         build_ref = COALESCE($5, build_ref),
         health_gate_status = COALESCE($6, health_gate_status),
         deployed_at = COALESCE($7, deployed_at),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        toStatus,
        patch?.artifactDigest ?? null,
        patch?.externalEvidenceRef ?? null,
        patch?.buildRef ?? null,
        patch?.healthGateStatus ?? null,
        patch?.deployedAt ?? null,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Release not found');
    }
    return this.mapRelease(rows[0]);
  }

  async listReleases(
    filter?: ListFilter,
  ): Promise<{ items: ReleaseRecord[]; total: number }> {
    const limit = Math.min(Math.max(filter?.limit ?? 50, 1), 200);
    const offset = Math.max(filter?.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.serviceId) {
      params.push(filter.serviceId);
      where.push(`service_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p9_releases ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p9_releases ${clause} ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapRelease(r)), total: num(countRows[0]?.c) };
  }

  async getOperationsAnalytics(opts?: { verticalId?: string }): Promise<OperationsOverviewAggregate> {
    const verticalId = opts?.verticalId ?? null;
    const scopeSql = `($1::uuid IS NULL OR service_id IN
       (SELECT id FROM edge_p9_services WHERE vertical_id = $1))`;
    const [services, alerts, incidents, changes, maintenance, sources] = await Promise.all([
      this.q(
        `SELECT COUNT(*)::int AS c FROM edge_p9_services
         WHERE ($1::uuid IS NULL OR vertical_id = $1)`,
        [verticalId],
      ),
      this.q(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status IN ('RECEIVED','NORMALIZED','CORRELATED','ACTIVE','ACKNOWLEDGED'))::int AS active
         FROM edge_p9_alerts
         WHERE ${scopeSql}`,
        [verticalId],
      ),
      this.q(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status NOT IN ('CLOSED','RESOLVED'))::int AS open,
           COUNT(*) FILTER (WHERE is_major AND status NOT IN ('CLOSED','RESOLVED'))::int AS major
         FROM edge_p9_incidents
         WHERE ${scopeSql}`,
        [verticalId],
      ),
      this.q(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED','FAILED','ROLLED_BACK','REJECTED','CANCELLED'))::int AS open
         FROM edge_p9_changes
         WHERE ${scopeSql}`,
        [verticalId],
      ),
      this.q(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status IN ('SCHEDULED','ACTIVE'))::int AS scheduled
         FROM edge_p9_maintenance_windows
         WHERE ${scopeSql}`,
        [verticalId],
      ),
      this.listMonitoringSources(),
    ]);

    const monitoringIntegrations = sources.map((s) => {
      const st = String(s.status);
      let availability: 'AVAILABLE' | 'UNAVAILABLE' | 'DEGRADED' | 'NOT_CONFIGURED' =
        'UNAVAILABLE';
      if (st === 'NOT_CONFIGURED') availability = 'NOT_CONFIGURED';
      // CONFIGURED ≠ live connectivity — only CONNECTED (after UP probe) is AVAILABLE.
      else if (st === 'CONNECTED') availability = 'AVAILABLE';
      else if (st === 'CONFIGURED') availability = 'NOT_CONFIGURED';
      else if (st === 'DEGRADED') availability = 'DEGRADED';
      else availability = 'UNAVAILABLE';
      return {
        code: s.code,
        providerType: s.providerType,
        status: st,
        availability,
      };
    });

    if (monitoringIntegrations.length === 0) {
      monitoringIntegrations.push({
        code: 'default',
        providerType: 'UNKNOWN',
        status: 'NOT_CONFIGURED',
        availability: 'NOT_CONFIGURED',
      });
    }

    return {
      availability: 'PARTIAL',
      catalog: { totalServices: num(services[0]?.c) },
      alerts: {
        activeCount: num(alerts[0]?.active),
        totalCount: num(alerts[0]?.total),
      },
      incidents: {
        openCount: num(incidents[0]?.open),
        majorCount: num(incidents[0]?.major),
        totalCount: num(incidents[0]?.total),
      },
      changes: {
        openCount: num(changes[0]?.open),
        totalCount: num(changes[0]?.total),
      },
      maintenance: {
        scheduledCount: num(maintenance[0]?.scheduled),
        totalCount: num(maintenance[0]?.total),
      },
      monitoringIntegrations,
      computedAt: new Date().toISOString(),
      note:
        'Counts are durable DB aggregates. Provider integrations UNAVAILABLE until monitoring sources are configured.',
    };
  }
}

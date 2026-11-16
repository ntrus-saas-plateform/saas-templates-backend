import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import { EDGE_P9_OUTBOX_TENANT as SERVICE_CATALOG_OUTBOX_TENANT } from './service-catalog.events.js';

/** Reuse P9 outbox tenant from service-catalog (same control-plane stream). */
export const EDGE_P9_OUTBOX_TENANT = SERVICE_CATALOG_OUTBOX_TENANT;

export const OperationsEventTypes = {
  HEALTH_SNAPSHOT_RECORDED: 'edge.p9.health.snapshot.recorded',
  ALERT_INGESTED: 'edge.p9.alert.ingested',
  ALERT_TRANSITIONED: 'edge.p9.alert.transitioned',
  INCIDENT_CREATED: 'edge.p9.incident.created',
  INCIDENT_TRANSITIONED: 'edge.p9.incident.transitioned',
  INCIDENT_MAJOR_DECLARED: 'edge.p9.incident.major.declared',
  PROBLEM_CREATED: 'edge.p9.problem.created',
  PROBLEM_ROOT_CAUSE_CONFIRMED: 'edge.p9.problem.root_cause.confirmed',
  PROBLEM_INCIDENT_LINKED: 'edge.p9.problem.incident.linked',
  CHANGE_CREATED: 'edge.p9.change.created',
  CHANGE_TRANSITIONED: 'edge.p9.change.transitioned',
  CHANGE_APPROVED: 'edge.p9.change.approved',
  CHANGE_REJECTED: 'edge.p9.change.rejected',
  MAINTENANCE_SCHEDULED: 'edge.p9.maintenance.scheduled',
  SERVICE_REQUEST_CREATED: 'edge.p9.request.created',
  TASK_CREATED: 'edge.p9.task.created',
  ONCALL_ROTATION_CREATED: 'edge.p9.oncall.rotation.created',
  SLO_CREATED: 'edge.p9.slo.created',
  SLO_MEASUREMENT_RECORDED: 'edge.p9.slo.measurement.recorded',
  CAPACITY_RECORDED: 'edge.p9.capacity.recorded',
  RECOVERY_REQUESTED: 'edge.p9.recovery.requested',
  RECOVERY_TRANSITIONED: 'edge.p9.recovery.transitioned',
  RUNBOOK_CREATED: 'edge.p9.runbook.created',
  STATUS_PUBLICATION_REQUESTED: 'edge.p9.status.publication.requested',
  STATUS_PUBLICATION_APPROVED: 'edge.p9.status.publication.approved',
  RISK_CREATED: 'edge.p9.risk.created',
  EXCEPTION_CREATED: 'edge.p9.exception.created',
  EXCEPTION_EXPIRED_FLAGGED: 'edge.p9.exception.expired.flagged',
  AUTOMATION_CREATED: 'edge.p9.automation.created',
  AUTOMATION_EXECUTION_REQUESTED: 'edge.p9.automation.execution.requested',
  AUTOMATION_EXECUTION_APPROVED: 'edge.p9.automation.execution.approved',
  AUTOMATION_EXECUTED: 'edge.p9.automation.executed',
  NOTIFICATION_DELIVERY_RECORDED: 'edge.p9.notification.delivery.recorded',
  NOTIFICATION_DELIVERY_TRANSITIONED: 'edge.p9.notification.delivery.transitioned',
  RELEASE_CREATED: 'edge.p9.release.created',
  RELEASE_TRANSITIONED: 'edge.p9.release.transitioned',
  MONITORING_SOURCE_CONFIGURED: 'edge.p9.monitoring.source.configured',
  MONITORING_PROBE_RECORDED: 'edge.p9.monitoring.probe.recorded',
} as const;

export function buildOperationsOutboxEvent(input: {
  eventType: string;
  aggregateId: string;
  aggregateType?: string;
  payload: Record<string, unknown>;
  correlationId?: string | null;
  actorId?: string | null;
}): IntegrationEvent<Record<string, unknown>> {
  const actorId = input.actorId?.trim() || 'edge-p9-operations';
  const correlationId = input.correlationId?.trim() || randomUUID();
  return {
    eventId: randomUUID(),
    eventType: input.eventType,
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: EDGE_P9_OUTBOX_TENANT,
    organizationId: null,
    correlationId,
    causationId: null,
    traceId: null,
    actor: { type: 'service', id: actorId },
    source: 'okapi.edge.p9',
    aggregateType: input.aggregateType ?? 'edge_p9_operations',
    aggregateId: input.aggregateId,
    payload: input.payload,
  };
}

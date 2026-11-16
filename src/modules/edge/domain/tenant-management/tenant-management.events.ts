import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import { EDGE_P7_OUTBOX_TENANT } from '../provisioning/provisioning.events.js';

export const EDGE_P8_OUTBOX_TENANT = EDGE_P7_OUTBOX_TENANT;

export const TenantManagementEventTypes = {
  REGISTERED: 'edge.p8.tenant.registered',
  METADATA_UPDATED: 'edge.p8.tenant.metadata.updated',
  CLASSIFICATION_CHANGED: 'edge.p8.tenant.classification.changed',
  OWNER_ASSIGNED: 'edge.p8.tenant.owner.assigned',
  LIFECYCLE_REQUESTED: 'edge.p8.tenant.lifecycle.requested',
  LIFECYCLE_APPROVED: 'edge.p8.tenant.lifecycle.approved',
  LIFECYCLE_REJECTED: 'edge.p8.tenant.lifecycle.rejected',
  EXCEPTION_REQUESTED: 'edge.p8.tenant.exception.requested',
  EXCEPTION_APPROVED: 'edge.p8.tenant.exception.approved',
  EXCEPTION_REVOKED: 'edge.p8.tenant.exception.revoked',
  MIGRATION_REQUESTED: 'edge.p8.tenant.migration.requested',
  RECOVERY_REQUESTED: 'edge.p8.tenant.recovery.requested',
  TERMINATION_REQUESTED: 'edge.p8.tenant.termination.requested',
  RECONCILIATION_COMPLETED: 'edge.p8.tenant.reconciliation.completed',
  GOVERNANCE_REVIEW_REQUIRED: 'edge.p8.tenant.governance.review.required',
  MIGRATION_APPROVED: 'edge.p8.tenant.migration.approved',
  MIGRATION_REJECTED: 'edge.p8.tenant.migration.rejected',
  RECOVERY_APPROVED: 'edge.p8.tenant.recovery.approved',
  RECOVERY_REJECTED: 'edge.p8.tenant.recovery.rejected',
  TERMINATION_APPROVED: 'edge.p8.tenant.termination.approved',
  TERMINATION_REJECTED: 'edge.p8.tenant.termination.rejected',
  EXCEPTION_EXPIRED: 'edge.p8.tenant.exception.expired',
  BULK_COMPLETED: 'edge.p8.tenant.bulk.completed',
  HEALTH_RECORDED: 'edge.p8.tenant.health.recorded',
  RISK_EVALUATED: 'edge.p8.tenant.risk.evaluated',
  EXPORT_REQUESTED: 'edge.p8.tenant.export.requested',
  LEGAL_HOLD_CHANGED: 'edge.p8.tenant.legal_hold.changed',
  LEGAL_HOLD_CHANGE_REQUESTED: 'edge.p8.tenant.legal_hold.change.requested',
  LEGAL_HOLD_CHANGE_APPROVED: 'edge.p8.tenant.legal_hold.change.approved',
  LEGAL_HOLD_CHANGE_REJECTED: 'edge.p8.tenant.legal_hold.change.rejected',
  GOVERNANCE_STATUS_CHANGED: 'edge.p8.tenant.governance.status.changed',
} as const;

export function buildTenantManagementOutboxEvent(input: {
  eventType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  correlationId?: string | null;
  actorId?: string | null;
}): IntegrationEvent<Record<string, unknown>> {
  const actorId = input.actorId?.trim() || 'edge-p8-tenant-management';
  const correlationId = input.correlationId?.trim() || randomUUID();
  return {
    eventId: randomUUID(),
    eventType: input.eventType,
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: EDGE_P8_OUTBOX_TENANT,
    organizationId: null,
    correlationId,
    causationId: null,
    traceId: null,
    actor: { type: 'service', id: actorId },
    source: 'okapi.edge.p8',
    aggregateType: 'edge_p8_tenant',
    aggregateId: input.aggregateId,
    payload: input.payload,
  };
}

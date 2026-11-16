import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import { EDGE_P11_OUTBOX_TENANT } from './revenue.types.js';

export { EDGE_P11_OUTBOX_TENANT };

export const RevenueEventTypes = {
  METRIC_DEFINITION_REGISTERED: 'edge.p11.metric.definition.registered',
  METRIC_DEFINITION_PUBLISHED: 'edge.p11.metric.definition.published',
  METRIC_SNAPSHOT_RECORDED: 'edge.p11.metric.snapshot.recorded',
  FORECAST_CREATED: 'edge.p11.forecast.created',
  FORECAST_SCENARIO_CREATED: 'edge.p11.forecast.scenario.created',
  FORECAST_PUBLISHED: 'edge.p11.forecast.published',
  LEAKAGE_CASE_CREATED: 'edge.p11.leakage.case.created',
  LEAKAGE_CASE_TRANSITIONED: 'edge.p11.leakage.case.transitioned',
  COMMISSION_PLAN_CREATED: 'edge.p11.commission.plan.created',
  COMMISSION_CALCULATED: 'edge.p11.commission.calculated',
  COMMISSION_APPROVED: 'edge.p11.commission.approved',
  BUSINESS_AUDIT_APPENDED: 'edge.p11.business.audit.appended',
  MRR_MOVEMENT_COMPUTED: 'edge.p11.mrr.movement.computed',
  RETENTION_SNAPSHOT_RECORDED: 'edge.p11.retention.snapshot.recorded',
  PRODUCT_PROFITABILITY_SNAPSHOT_RECORDED: 'edge.p11.product_profitability.snapshot.recorded',
  ASSURANCE_SCAN_COMPLETED: 'edge.p11.assurance.scan.completed',
  UNIT_ECONOMICS_SNAPSHOT_RECORDED: 'edge.p11.unit_economics.snapshot.recorded',
  BUSINESS_ALERT_POLICY_CREATED: 'edge.p11.business.alert_policy.created',
  BUSINESS_ALERT_EVALUATED: 'edge.p11.business.alert.evaluated',
  BUSINESS_ALERT_ACKNOWLEDGED: 'edge.p11.business.alert.acknowledged',
  BUSINESS_DECISION_RECORDED: 'edge.p11.business.decision.recorded',
  BUSINESS_REPORT_GENERATED: 'edge.p11.business.report.generated',
  REVENUE_TARGET_CREATED: 'edge.p11.revenue.target.created',
} as const;

export function buildRevenueOutboxEvent(input: {
  eventType: string;
  aggregateId: string;
  aggregateType?: string;
  payload: Record<string, unknown>;
  correlationId?: string | null;
  actorId?: string | null;
}): IntegrationEvent<Record<string, unknown>> {
  const actorId = input.actorId?.trim() || 'edge-p11-revenue';
  const correlationId = input.correlationId?.trim() || randomUUID();
  return {
    eventId: randomUUID(),
    eventType: input.eventType,
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: EDGE_P11_OUTBOX_TENANT,
    organizationId: null,
    correlationId,
    causationId: null,
    traceId: null,
    actor: { type: 'service', id: actorId },
    source: 'okapi.edge.p11',
    aggregateType: input.aggregateType ?? 'edge_p11_revenue_operations',
    aggregateId: input.aggregateId,
    payload: input.payload,
  };
}

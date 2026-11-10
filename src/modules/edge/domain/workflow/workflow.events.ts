import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import { EDGE_P7_OUTBOX_TENANT } from '../provisioning/provisioning.events.js';

function workflowEvent<T>(params: {
  eventType: string;
  actorId: string;
  correlationId: string;
  aggregateType: string;
  aggregateId: string;
  payload: T;
}): IntegrationEvent<T> {
  return {
    eventId: randomUUID(),
    eventType: params.eventType,
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: EDGE_P7_OUTBOX_TENANT,
    organizationId: null,
    correlationId: params.correlationId,
    causationId: null,
    traceId: null,
    actor: { type: 'service', id: params.actorId },
    source: 'okapi.edge.p7',
    aggregateType: params.aggregateType,
    aggregateId: params.aggregateId,
    payload: params.payload,
  };
}

type Base = {
  actorId: string;
  correlationId: string;
  workflowId: string;
  definitionId: string;
  definitionVersion: number;
};

export function createWorkflowCreatedEvent(
  p: Base & { idempotencyKey: string },
) {
  return workflowEvent({
    eventType: 'edge.p7.workflow.created.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'WORKFLOW_INSTANCE',
    aggregateId: p.workflowId,
    payload: {
      workflowId: p.workflowId,
      definitionId: p.definitionId,
      definitionVersion: p.definitionVersion,
      idempotencyKey: p.idempotencyKey,
    },
  });
}

export function createWorkflowStartedEvent(p: Base) {
  return workflowEvent({
    eventType: 'edge.p7.workflow.started.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'WORKFLOW_INSTANCE',
    aggregateId: p.workflowId,
    payload: {
      workflowId: p.workflowId,
      definitionId: p.definitionId,
      definitionVersion: p.definitionVersion,
    },
  });
}

export function createWorkflowStepClaimedEvent(
  p: Base & { stepId: string; fencingToken: number; workerId: string },
) {
  return workflowEvent({
    eventType: 'edge.p7.workflow.step.claimed.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'WORKFLOW_STEP',
    aggregateId: p.stepId,
    payload: {
      workflowId: p.workflowId,
      stepId: p.stepId,
      fencingToken: p.fencingToken,
      workerId: p.workerId,
      definitionId: p.definitionId,
      definitionVersion: p.definitionVersion,
    },
  });
}

export function createWorkflowStepStartedEvent(p: Base & { stepId: string }) {
  return workflowEvent({
    eventType: 'edge.p7.workflow.step.started.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'WORKFLOW_STEP',
    aggregateId: p.stepId,
    payload: { workflowId: p.workflowId, stepId: p.stepId },
  });
}

export function createWorkflowStepSucceededEvent(p: Base & { stepId: string }) {
  return workflowEvent({
    eventType: 'edge.p7.workflow.step.succeeded.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'WORKFLOW_STEP',
    aggregateId: p.stepId,
    payload: { workflowId: p.workflowId, stepId: p.stepId },
  });
}

export function createWorkflowStepFailedEvent(
  p: Base & { stepId: string; errorClass: string },
) {
  return workflowEvent({
    eventType: 'edge.p7.workflow.step.failed.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'WORKFLOW_STEP',
    aggregateId: p.stepId,
    payload: {
      workflowId: p.workflowId,
      stepId: p.stepId,
      errorClass: p.errorClass,
    },
  });
}

export function createWorkflowRetryScheduledEvent(
  p: Base & { stepId: string; nextRetryAt: string },
) {
  return workflowEvent({
    eventType: 'edge.p7.workflow.retry.scheduled.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'WORKFLOW_STEP',
    aggregateId: p.stepId,
    payload: {
      workflowId: p.workflowId,
      stepId: p.stepId,
      nextRetryAt: p.nextRetryAt,
    },
  });
}

export function createWorkflowWaitingApprovalEvent(p: Base & { stepId: string; taskId: string }) {
  return workflowEvent({
    eventType: 'edge.p7.workflow.waiting_approval.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'WORKFLOW_TASK',
    aggregateId: p.taskId,
    payload: { workflowId: p.workflowId, stepId: p.stepId, taskId: p.taskId },
  });
}

export function createWorkflowApprovedEvent(p: Base & { taskId: string }) {
  return workflowEvent({
    eventType: 'edge.p7.workflow.approved.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'WORKFLOW_TASK',
    aggregateId: p.taskId,
    payload: { workflowId: p.workflowId, taskId: p.taskId },
  });
}

export function createWorkflowCompensationStartedEvent(p: Base) {
  return workflowEvent({
    eventType: 'edge.p7.workflow.compensation.started.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'WORKFLOW_INSTANCE',
    aggregateId: p.workflowId,
    payload: { workflowId: p.workflowId },
  });
}

export function createWorkflowCompensationSucceededEvent(p: Base & { stepId: string }) {
  return workflowEvent({
    eventType: 'edge.p7.workflow.compensation.succeeded.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'WORKFLOW_STEP',
    aggregateId: p.stepId,
    payload: { workflowId: p.workflowId, stepId: p.stepId },
  });
}

export function createWorkflowCompensationFailedEvent(p: Base & { stepId: string }) {
  return workflowEvent({
    eventType: 'edge.p7.workflow.compensation.failed.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'WORKFLOW_STEP',
    aggregateId: p.stepId,
    payload: { workflowId: p.workflowId, stepId: p.stepId },
  });
}

export function createWorkflowCompletedEvent(p: Base) {
  return workflowEvent({
    eventType: 'edge.p7.workflow.completed.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'WORKFLOW_INSTANCE',
    aggregateId: p.workflowId,
    payload: { workflowId: p.workflowId },
  });
}

export function createWorkflowFailedEvent(p: Base & { reason?: string }) {
  return workflowEvent({
    eventType: 'edge.p7.workflow.failed.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'WORKFLOW_INSTANCE',
    aggregateId: p.workflowId,
    payload: { workflowId: p.workflowId, reason: p.reason ?? null },
  });
}

export function createWorkflowCancelledEvent(p: Base & { reason?: string | null }) {
  return workflowEvent({
    eventType: 'edge.p7.workflow.cancelled.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'WORKFLOW_INSTANCE',
    aggregateId: p.workflowId,
    payload: { workflowId: p.workflowId, reason: p.reason ?? null },
  });
}

export function createWorkflowRequiresInterventionEvent(p: Base & { reason: string }) {
  return workflowEvent({
    eventType: 'edge.p7.workflow.requires_intervention.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'WORKFLOW_INSTANCE',
    aggregateId: p.workflowId,
    payload: { workflowId: p.workflowId, reason: p.reason },
  });
}

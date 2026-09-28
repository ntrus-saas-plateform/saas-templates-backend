import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import type { ExecutionContext } from '../../application/common/execution-context.js';

export type SecurityPolicyUpdatedPayload = {
  readonly actorId: string;
  readonly keys: readonly string[];
};

export function createSecurityPolicyUpdatedEvent(
  ctx: ExecutionContext,
  keys: readonly string[],
): IntegrationEvent<SecurityPolicyUpdatedPayload> {
  return {
    eventId: randomUUID(),
    eventType: 'security.policy.updated.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: ctx.tenantId,
    organizationId: ctx.organizationId,
    correlationId: ctx.correlationId,
    causationId: null,
    traceId: ctx.traceId,
    actor: { type: 'user', id: ctx.subjectId },
    source: 'platform-core',
    payload: {
      actorId: ctx.subjectId,
      keys: [...keys],
    },
  };
}

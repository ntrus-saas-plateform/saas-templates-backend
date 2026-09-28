import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';

export interface TenantProvisioningStartedPayload {
  readonly tenantId: string;
  readonly slug: string;
  readonly idempotencyKey: string | null;
}

export interface TenantProvisioningFailedPayload {
  readonly tenantId: string;
  readonly slug: string;
  readonly failureStep: string;
  readonly failureReason: string;
  readonly retryCount: number;
}

export interface TenantProvisioningCompletedPayload {
  readonly tenantId: string;
  readonly slug: string;
  readonly defaultOrganizationId: string | null;
}

export function createTenantProvisioningStartedEvent(params: {
  tenantId: string;
  slug: string;
  idempotencyKey: string | null;
  correlationId?: string;
}): IntegrationEvent<TenantProvisioningStartedPayload> {
  return {
    eventId: randomUUID(),
    eventType: 'tenant.provisioning.started.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: params.tenantId,
    organizationId: null,
    correlationId: params.correlationId ?? randomUUID(),
    causationId: null,
    traceId: null,
    actor: { type: 'system', id: 'platform-provisioner' },
    source: 'platform',
    payload: {
      tenantId: params.tenantId,
      slug: params.slug,
      idempotencyKey: params.idempotencyKey,
    },
  };
}

export function createTenantProvisioningFailedEvent(params: {
  tenantId: string;
  slug: string;
  failureStep: string;
  failureReason: string;
  retryCount: number;
  correlationId?: string;
}): IntegrationEvent<TenantProvisioningFailedPayload> {
  return {
    eventId: randomUUID(),
    eventType: 'tenant.provisioning.failed.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: params.tenantId,
    organizationId: null,
    correlationId: params.correlationId ?? randomUUID(),
    causationId: null,
    traceId: null,
    actor: { type: 'system', id: 'platform-provisioner' },
    source: 'platform',
    payload: {
      tenantId: params.tenantId,
      slug: params.slug,
      failureStep: params.failureStep,
      failureReason: params.failureReason,
      retryCount: params.retryCount,
    },
  };
}

export function createTenantProvisioningCompletedEvent(params: {
  tenantId: string;
  slug: string;
  defaultOrganizationId: string | null;
  correlationId?: string;
}): IntegrationEvent<TenantProvisioningCompletedPayload> {
  return {
    eventId: randomUUID(),
    eventType: 'tenant.provisioning.completed.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    tenantId: params.tenantId,
    organizationId: null,
    correlationId: params.correlationId ?? randomUUID(),
    causationId: null,
    traceId: null,
    actor: { type: 'system', id: 'platform-provisioner' },
    source: 'platform',
    payload: {
      tenantId: params.tenantId,
      slug: params.slug,
      defaultOrganizationId: params.defaultOrganizationId,
    },
  };
}

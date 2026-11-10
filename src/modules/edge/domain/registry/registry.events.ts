import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import { EDGE_P7_OUTBOX_TENANT } from '../provisioning/provisioning.events.js';

function registryEvent<T>(params: {
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

export function createProductRegisteredEvent(p: {
  actorId: string;
  correlationId: string;
  productRegistryId: string;
  productId: string;
}) {
  return registryEvent({
    eventType: 'p7.registry.product.registered.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'PRODUCT_REGISTRY',
    aggregateId: p.productRegistryId,
    payload: { productRegistryId: p.productRegistryId, productId: p.productId },
  });
}

export function createProductUpdatedEvent(p: {
  actorId: string;
  correlationId: string;
  productRegistryId: string;
}) {
  return registryEvent({
    eventType: 'p7.registry.product.updated.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'PRODUCT_REGISTRY',
    aggregateId: p.productRegistryId,
    payload: { productRegistryId: p.productRegistryId },
  });
}

export function createProductCertifiedEvent(p: {
  actorId: string;
  correlationId: string;
  productRegistryId: string;
}) {
  return registryEvent({
    eventType: 'p7.registry.product.certified.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'PRODUCT_REGISTRY',
    aggregateId: p.productRegistryId,
    payload: { productRegistryId: p.productRegistryId },
  });
}

export function createProductDeprecatedEvent(p: {
  actorId: string;
  correlationId: string;
  productRegistryId: string;
  reason: string;
}) {
  return registryEvent({
    eventType: 'p7.registry.product.deprecated.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'PRODUCT_REGISTRY',
    aggregateId: p.productRegistryId,
    payload: { productRegistryId: p.productRegistryId, reason: p.reason },
  });
}

export function createPlatformRegisteredEvent(p: {
  actorId: string;
  correlationId: string;
  platformId: string;
  code: string;
}) {
  return registryEvent({
    eventType: 'p7.registry.platform.registered.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'PRODUCT_PLATFORM',
    aggregateId: p.platformId,
    payload: { platformId: p.platformId, code: p.code },
  });
}

export function createEnvironmentRegisteredEvent(p: {
  actorId: string;
  correlationId: string;
  environmentId: string;
  platformId: string;
}) {
  return registryEvent({
    eventType: 'p7.registry.environment.registered.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'RUNTIME_ENVIRONMENT',
    aggregateId: p.environmentId,
    payload: { environmentId: p.environmentId, platformId: p.platformId },
  });
}

export function createDeploymentProfileUpdatedEvent(p: {
  actorId: string;
  correlationId: string;
  profileId: string;
  code: string;
}) {
  return registryEvent({
    eventType: 'p7.registry.deployment_profile.updated.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'DEPLOYMENT_PROFILE',
    aggregateId: p.profileId,
    payload: { profileId: p.profileId, code: p.code },
  });
}

export function createControlContractPublishedEvent(p: {
  actorId: string;
  correlationId: string;
  contractId: string;
  contractVersion: string;
}) {
  return registryEvent({
    eventType: 'p7.registry.control_contract.published.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'PRODUCT_CONTROL_CONTRACT',
    aggregateId: p.contractId,
    payload: { contractId: p.contractId, contractVersion: p.contractVersion },
  });
}

export function createCompatibilityEvaluatedEvent(p: {
  actorId: string;
  correlationId: string;
  evaluationId: string;
  result: string;
}) {
  return registryEvent({
    eventType: 'p7.registry.compatibility.evaluated.v1',
    actorId: p.actorId,
    correlationId: p.correlationId,
    aggregateType: 'COMPATIBILITY_EVALUATION',
    aggregateId: p.evaluationId,
    payload: { evaluationId: p.evaluationId, result: p.result },
  });
}

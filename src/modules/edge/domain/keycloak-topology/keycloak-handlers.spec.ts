import { describe, expect, it } from 'vitest';
import { registerKeycloakHandlers, KeycloakProvisioningHandler } from './keycloak-handlers.js';
import { KEYCLOAK_HANDLER_KEYS, KeycloakErrorCode } from './keycloak.types.js';
import { createDefaultWorkflowHandlerRegistry } from '../workflow/workflow-handler.port.js';
import type { WorkflowHandlerInput } from '../workflow/workflow-handler.port.js';

function input(overrides: Partial<WorkflowHandlerInput> = {}): WorkflowHandlerInput {
  return {
    workflowId: 'wf-1',
    stepId: 'step-1',
    stepKey: 'topology_provision',
    handlerKey: 'keycloak.provision_realm',
    fencingToken: 7,
    attemptNumber: 1,
    inputSnapshot: { topologyId: 'top-1' },
    workflowInput: { topologyId: 'top-1' },
    correlationId: 'corr-1',
    workerId: 'worker-1',
    ...overrides,
  };
}

describe('KeycloakProvisioningHandler (P7.7)', () => {
  it('registers all nine mandate handler keys', () => {
    const registry = createDefaultWorkflowHandlerRegistry();
    for (const key of KEYCLOAK_HANDLER_KEYS) {
      expect(registry.has(key)).toBe(true);
    }
  });

  it('FAILS with DEPENDENCY_UNAVAILABLE when no live executor (never simulates success)', async () => {
    const handler = new KeycloakProvisioningHandler('keycloak.provision_realm');
    const outcome = await handler.execute(input());
    expect(outcome.status).toBe('FAILED');
    if (outcome.status === 'FAILED') {
      expect(outcome.errorClass).toBe(KeycloakErrorCode.DEPENDENCY_UNAVAILABLE);
      expect(outcome.retryable).toBe(true);
    }
  });

  it('requires a fencing token (stale/absent token rejected before any work)', async () => {
    const handler = new KeycloakProvisioningHandler('keycloak.provision_realm', async () => ({
      status: 'SUCCEEDED',
    }));
    const outcome = await handler.execute(input({ fencingToken: undefined as unknown as number }));
    expect(outcome.status).toBe('FAILED');
    if (outcome.status === 'FAILED') {
      expect(outcome.errorClass).toBe(KeycloakErrorCode.VALIDATION);
    }
  });

  it('delegates to the live executor with the correct handler key', async () => {
    const seen: string[] = [];
    const handler = new KeycloakProvisioningHandler('keycloak.validate_plan', async (_i, key) => {
      seen.push(key);
      return { status: 'SUCCEEDED', outputSnapshot: { ok: true } };
    });
    const outcome = await handler.execute(input({ handlerKey: 'keycloak.validate_plan' }));
    expect(outcome.status).toBe('SUCCEEDED');
    expect(seen).toEqual(['keycloak.validate_plan']);
  });

  it('translates executor exceptions into retryable FAILED outcomes', async () => {
    const handler = new KeycloakProvisioningHandler('keycloak.discover_capabilities', async () => {
      throw new Error('Keycloak connection timeout');
    });
    const outcome = await handler.execute(input());
    expect(outcome.status).toBe('FAILED');
    if (outcome.status === 'FAILED') {
      expect(outcome.message).toContain('timeout');
      expect(outcome.retryable).toBe(true);
    }
  });

  it('compensation outside keycloak.deprovision_topology requires approval (no silent delete)', async () => {
    const handler = new KeycloakProvisioningHandler('keycloak.provision_realm', async () => ({
      status: 'SUCCEEDED',
    }));
    const outcome = await handler.compensate(input());
    expect(outcome.status).toBe('WAITING_APPROVAL');
    if (outcome.status === 'WAITING_APPROVAL') {
      expect(outcome.requiredPermission).toBe('platform:keycloak:deprovision');
    }
  });

  it('compensation without live executor fails closed', async () => {
    const handler = new KeycloakProvisioningHandler('keycloak.deprovision_topology');
    const outcome = await handler.compensate(input());
    expect(outcome.status).toBe('FAILED');
  });

  it('registerKeycloakHandlers wires a live executor across all keys', async () => {
    const registry = createDefaultWorkflowHandlerRegistry();
    registerKeycloakHandlers(registry, KEYCLOAK_HANDLER_KEYS, async () => ({
      status: 'SUCCEEDED',
    }));
    for (const key of KEYCLOAK_HANDLER_KEYS) {
      const handler = registry.get(key);
      expect(handler).not.toBeNull();
      const outcome = await handler!.execute(input({ handlerKey: key }));
      expect(outcome.status).toBe('SUCCEEDED');
    }
  });
});

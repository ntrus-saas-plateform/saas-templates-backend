import { describe, expect, it, vi } from 'vitest';
import {
  EdgeKeycloakController,
} from './keycloak.controller.js';
import {
  KEYCLOAK_WORKFLOW_DEFINITIONS,
  LaunchTopologyWorkflowUseCase,
} from '../../application/keycloak-topology/keycloak.use-cases.js';
import { WorkflowDefinitionStatus } from '../../domain/workflow/workflow.types.js';

/**
 * P7.7 remediation §3 — reconciliation must launch its OWN registered P7.4
 * definition (`validate_plan` → `reconcile_topology`), never the provisioning
 * definition, and never encode handler execution in a snapshot string.
 */

const TOPOLOGY_ID = 'topo-rec-1';

function topology() {
  return {
    id: TOPOLOGY_ID,
    tenantId: '11111111-1111-4111-8111-111111111111',
    productId: '22222222-2222-4222-8222-222222222222',
    authorizationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    authorizationVersion: 1,
    deletionProtection: true,
    status: 'READY',
    version: 1,
  };
}

function authPort() {
  return {
    getWorkflowReadyRequest: vi.fn(async () => null),
    isAuthorizationStillValid: vi.fn(async () => true),
    revalidateBoundAuthorization: vi.fn(async () => ({
      requestId: 'rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr',
      requestNumber: 'PR-1',
      requestStatus: 'ACCEPTED' as const,
      authorizationRowId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      authorizationId: 'auth-1',
      authorizationVersion: 1,
      accountId: 'acc',
      productId: '22222222-2222-4222-8222-222222222222',
      subscriptionId: 'sub',
      productTenantId: '11111111-1111-4111-8111-111111111111',
      correlationId: 'corr',
      expiresAt: new Date(Date.now() + 600_000),
      revocationStatus: 'NOT_REVOKED',
      verificationStatus: 'VERIFIED',
      decision: 'ALLOW',
    })),
  };
}

function launchUseCase(options?: { onDefinitionCode?: (code: string) => void }) {
  const createdInstances: Array<Record<string, unknown>> = [];
  const publishedDefinition = {
    id: 'def-reconcile',
    code: 'p77.keycloak.topology.reconcile',
    name: 'reconcile',
    description: '',
    definitionStatus: WorkflowDefinitionStatus.PUBLISHED,
    version: 1,
    definitionVersion: 1,
    draftSnapshot: KEYCLOAK_WORKFLOW_DEFINITIONS.reconcile.snapshot,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const wfRepo = {
    getInstanceByIdempotencyKey: vi.fn(async () => null),
    getDefinitionByCode: vi.fn(async (code: string) =>
      code === 'p77.keycloak.topology.reconcile'
        ? (publishedDefinition as never)
        : ({
            ...publishedDefinition,
            id: `def-${code}`,
            code,
          } as never),
    ),
    getDefinition: vi.fn(async () => publishedDefinition as never),
    getLatestDefinitionVersion: vi.fn(async () => ({
      versionNumber: 1,
      status: WorkflowDefinitionStatus.PUBLISHED,
      snapshot: KEYCLOAK_WORKFLOW_DEFINITIONS.reconcile.snapshot,
    })),
    createDefinition: vi.fn(),
    appendHistory: vi.fn(async () => undefined),
  };

  const keycloakRepo = {
    getTopology: vi.fn(async () => topology()),
    appendHistory: vi.fn(async () => undefined),
  };

  const outbox = {
    runWithOutbox: vi.fn(async (_tenant: string, fn: (c: unknown, e: unknown) => unknown) =>
      fn(null, vi.fn()),
    ),
  };

  const useCase = new LaunchTopologyWorkflowUseCase(
    keycloakRepo as never,
    wfRepo as never,
    authPort() as never,
    outbox as never,
    {} as never,
    {
      execute: vi.fn(async (input: Record<string, unknown>) => {
        createdInstances.push(input);
        options?.onDefinitionCode?.(String(input.definitionId));
        return { id: 'wf-1', state: 'CREATED' };
      }),
    } as never,
    { execute: vi.fn(async () => ({ id: 'wf-1', state: 'RUNNING' })) } as never,
  );

  return { useCase, createdInstances, wfRepo, keycloakRepo };
}

describe('P7.7 P1 — registered workflow definitions', () => {
  it('the reconcile definition is exactly validate_plan → reconcile_topology', () => {
    const steps = KEYCLOAK_WORKFLOW_DEFINITIONS.reconcile.snapshot.steps;
    expect(steps).toHaveLength(2);
    expect(steps[0].handlerKey).toBe('keycloak.validate_plan');
    expect(steps[1].handlerKey).toBe('keycloak.reconcile_topology');
    expect(steps[1].dependsOn).toEqual(['validate_plan']);
    // No provisioning handler may exist in the reconciliation definition.
    const handlerKeys = steps.map((s) => s.handlerKey);
    expect(handlerKeys).not.toContain('keycloak.provision_realm');
    expect(handlerKeys).not.toContain('keycloak.provision_organization');
    expect(handlerKeys).not.toContain('keycloak.create_technical_client');
  });

  it('each registered definition carries only its own handlers', () => {
    const all = Object.entries(KEYCLOAK_WORKFLOW_DEFINITIONS);
    for (const [kind, def] of all) {
      expect(def.code).toContain(kind === 'provision' ? 'topology.provision' : kind);
    }
    const provisionKeys = KEYCLOAK_WORKFLOW_DEFINITIONS.provision.snapshot.steps.map(
      (s) => s.handlerKey,
    );
    expect(provisionKeys).toContain('keycloak.provision_realm');
    expect(provisionKeys).not.toContain('keycloak.reconcile_topology');
  });
});

describe('P7.7 P1 — controller → workflow routing', () => {
  function controller(launch: { execute: (input: never) => unknown }) {
    return new EdgeKeycloakController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      launch as never,
    );
  }

  it('reconciliation requests launch p77.keycloak.topology.reconcile', async () => {
    const execute = vi.fn(async (_input: Record<string, unknown>) => ({
      workflow: { id: 'wf-1' },
      topology: topology(),
    }));
    const c = controller({ execute: execute as never });
    await c.requestReconciliation(
      TOPOLOGY_ID,
      { correlationId: 'corr', idempotencyKey: 'idem-rec' } as never,
      { user: { sub: 'actor-1' } } as never,
    );
    expect(execute).toHaveBeenCalledTimes(1);
    const arg = execute.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg.definitionCode).toBe('p77.keycloak.topology.reconcile');
    expect(arg.workflowType).toBe('keycloak.topology.reconcile');
    // No malformed/unused handler string in the snapshot.
    expect(arg.snapshot).toEqual({ topologyId: TOPOLOGY_ID, operation: 'reconcile' });
    expect(JSON.stringify(arg.snapshot)).not.toContain('keycloak.reconcile_topology,');
  });

  it('reconciliation requires the persisted topology + provisioning authorization context', async () => {
    const execute = vi.fn(async (_input: Record<string, unknown>) => ({
      workflow: { id: 'wf-1' },
      topology: topology(),
    }));
    const c = controller({ execute: execute as never });
    await c.requestReconciliation(
      TOPOLOGY_ID,
      { provisioningRequestId: 'rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr' } as never,
      { user: { sub: 'actor-1' } } as never,
    );
    const arg = execute.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg.topologyId).toBe(TOPOLOGY_ID);
    expect(arg.provisioningRequestId).toBe('rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr');
  });

  it('rejects a definitionCode that does not match the workflow type', async () => {
    const { useCase } = launchUseCase();
    await expect(
      useCase.execute({
        actorId: 'actor',
        correlationId: 'corr',
        idempotencyKey: 'idem-mismatch',
        definitionCode: 'p77.keycloak.topology.provision', // wrong on purpose
        workflowType: 'keycloak.topology.reconcile',
        topologyId: TOPOLOGY_ID,
        provisioningRequestId: 'rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr',
        snapshot: { topologyId: TOPOLOGY_ID, operation: 'reconcile' },
      }),
    ).rejects.toThrow(/does not match workflowType/);
  });

  it('launches an instance bound to the registered reconcile definition', async () => {
    const { useCase, createdInstances } = launchUseCase();
    const result = await useCase.execute({
      actorId: 'actor',
      correlationId: 'corr',
      idempotencyKey: 'idem-rec-1',
      definitionCode: 'p77.keycloak.topology.reconcile',
      workflowType: 'keycloak.topology.reconcile',
      topologyId: TOPOLOGY_ID,
      provisioningRequestId: 'rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr',
      snapshot: { topologyId: TOPOLOGY_ID, operation: 'reconcile' },
    });
    expect(result.workflow).toBeTruthy();
    expect(createdInstances).toHaveLength(1);
    expect(createdInstances[0].definitionId).toBe('def-reconcile');
    expect(createdInstances[0].workflowType).toBe('keycloak.topology.reconcile');
    const snapshot = createdInstances[0].inputSnapshot as Record<string, unknown>;
    expect(snapshot.operation).toBe('reconcile');
    expect(Object.keys(snapshot).every((k) => !k.startsWith('runReconcile'))).toBe(true);
  });
});

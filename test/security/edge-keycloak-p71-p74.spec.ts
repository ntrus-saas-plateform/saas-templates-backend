import { describe, expect, it, vi } from 'vitest';
import {
  KeycloakErrorCode,
  KeycloakTopologyStatus,
} from '../../src/modules/edge/domain/keycloak-topology/keycloak.types.js';
import type { WorkflowLeasePort } from '../../src/modules/edge/domain/workflow/workflow-lease.port.js';
import { WorkflowStepStatus } from '../../src/modules/edge/domain/workflow/workflow.types.js';
import {
  harness,
  handlerInput,
  authView,
  realmRecord,
  AUTH_ROW,
  REQUEST_ID,
  TENANT,
  PRODUCT,
  OTHER_TENANT,
  OTHER_PRODUCT,
  WORKER,
  WORKFLOW_ID,
} from './edge-keycloak-p71-p74.harness.js';

/**
 * P7.7 remediation §1 — P7.1 authorization must be independently revalidated
 * against the canonical service before every sensitive Keycloak mutation (P0).
 * Every DENIED case asserts ZERO provider mutation calls.
 */
describe('P7.7 P0 — P7.1 authorization independently revalidated before Keycloak mutations', () => {
  it('grants access only when the canonical service confirms a valid authorization', async () => {
    const h = harness();
    const outcome = await h.executor(handlerInput(), 'keycloak.provision_realm');
    expect(outcome.status).toBe('SUCCEEDED');
    expect(h.mutationCalls()).toBe(1);
    expect(h.authorization.revalidateBoundAuthorization).toHaveBeenCalledWith({
      authorizationRowId: AUTH_ROW,
      authorizationVersion: 1,
      provisioningRequestId: REQUEST_ID,
    });
    const decision = h.evidence.find((e) => e.operation.endsWith(':authorization_check'));
    expect(decision).toBeTruthy();
    expect(decision!.evidence.p71AuthorizationDecision).toBe('ALLOW');
    expect(JSON.stringify(decision!.evidence)).not.toContain('sec_admin');
  });

  it('denies when authorizationValid is false (boolean)', async () => {
    const h = harness();
    const input = handlerInput({
      workflowInput: { ...handlerInput().workflowInput, authorizationValid: false },
    });
    const outcome = await h.executor(input, 'keycloak.provision_realm');
    expect(outcome.status).toBe('FAILED');
    expect(h.mutationCalls()).toBe(0);
  });

  it('denies when authorizationValid is the STRING "false"', async () => {
    const h = harness();
    const input = handlerInput({
      workflowInput: { ...handlerInput().workflowInput, authorizationValid: 'false' },
    });
    const outcome = await h.executor(input, 'keycloak.provision_realm');
    expect(outcome.status).toBe('FAILED');
    expect(h.mutationCalls()).toBe(0);
  });

  it('does NOT grant access from authorizationValid:true alone (snapshot is never proof)', async () => {
    const h = harness({ auth: { mode: 'null' } });
    const input = handlerInput({
      workflowInput: { ...handlerInput().workflowInput, authorizationValid: true },
    });
    const outcome = await h.executor(input, 'keycloak.provision_realm');
    expect(outcome.status).toBe('FAILED');
    expect(h.mutationCalls()).toBe(0);
  });

  it('grants access with MISSING authorization flags when the canonical service confirms', async () => {
    const h = harness();
    const input = handlerInput({
      workflowInput: {
        topologyId: 'topo-1',
        tenantId: TENANT,
        productId: PRODUCT,
        actorId: 'actor',
      },
    });
    const outcome = await h.executor(input, 'keycloak.provision_realm');
    expect(outcome.status).toBe('SUCCEEDED');
    expect(h.mutationCalls()).toBe(1);
  });

  it('denies with missing flags AND no canonical authorization reference (absent is not valid)', async () => {
    const h = harness({ authorizationId: null, authorizationVersion: null });
    const input = handlerInput({
      workflowInput: {
        topologyId: 'topo-1',
        tenantId: TENANT,
        productId: PRODUCT,
        actorId: 'actor',
      },
    });
    const outcome = await h.executor(input, 'keycloak.provision_realm');
    expect(outcome.status).toBe('FAILED');
    if (outcome.status === 'FAILED') {
      expect(outcome.message).toContain('AUTHORIZATION_REFERENCE_MISSING');
    }
    expect(h.mutationCalls()).toBe(0);
  });

  it('denies on authorizationRevoked (boolean and string forms)', async () => {
    for (const revoked of [true, 'true']) {
      const h = harness();
      const input = handlerInput({
        workflowInput: { ...handlerInput().workflowInput, authorizationRevoked: revoked },
      });
      const outcome = await h.executor(input, 'keycloak.provision_realm');
      expect(outcome.status).toBe('FAILED');
      expect(h.mutationCalls()).toBe(0);
    }
  });

  it('denies on authorizationExpired (boolean and string forms)', async () => {
    for (const expired of [true, 'true']) {
      const h = harness();
      const input = handlerInput({
        workflowInput: { ...handlerInput().workflowInput, authorizationExpired: expired },
      });
      const outcome = await h.executor(input, 'keycloak.provision_realm');
      expect(outcome.status).toBe('FAILED');
      expect(h.mutationCalls()).toBe(0);
    }
  });

  it('denies a REVOKED authorization (canonical service returns null)', async () => {
    const h = harness({ auth: { mode: 'null' } });
    const outcome = await h.executor(handlerInput(), 'keycloak.provision_realm');
    expect(outcome.status).toBe('FAILED');
    if (outcome.status === 'FAILED') {
      expect(outcome.errorClass).toBe(KeycloakErrorCode.AUTHORIZATION_FAILED);
    }
    expect(h.mutationCalls()).toBe(0);
    const denied = h.evidence.find((e) => e.operation.endsWith(':authorization_check'));
    expect(denied?.evidence.p71AuthorizationDecision).toBe('DENY');
  });

  it('denies an EXPIRED authorization (canonical service returns null, never a flag)', async () => {
    const h = harness({ auth: { mode: 'null' } });
    const outcome = await h.executor(handlerInput(), 'keycloak.provision_organization');
    expect(outcome.status).toBe('FAILED');
    expect(h.mutationCalls()).toBe(0);
  });

  it('denies a WRONG TENANT (authorization bound to another tenant)', async () => {
    const h = harness({
      auth: { mode: 'valid', view: authView({ productTenantId: OTHER_TENANT }) },
    });
    const outcome = await h.executor(handlerInput(), 'keycloak.provision_realm');
    expect(outcome.status).toBe('FAILED');
    if (outcome.status === 'FAILED') {
      expect(outcome.message).toContain('AUTHORIZATION_TENANT_MISMATCH');
    }
    expect(h.mutationCalls()).toBe(0);
  });

  it('denies a WRONG PRODUCT (authorization bound to another product)', async () => {
    const h = harness({
      auth: { mode: 'valid', view: authView({ productId: OTHER_PRODUCT }) },
    });
    const outcome = await h.executor(handlerInput(), 'keycloak.provision_realm');
    expect(outcome.status).toBe('FAILED');
    if (outcome.status === 'FAILED') {
      expect(outcome.message).toContain('AUTHORIZATION_PRODUCT_MISMATCH');
    }
    expect(h.mutationCalls()).toBe(0);
  });

  it('denies a WRONG PROVISIONING REQUEST', async () => {
    const h = harness({
      auth: { mode: 'valid', view: authView({ requestId: 'another-request' }) },
    });
    const outcome = await h.executor(handlerInput(), 'keycloak.provision_realm');
    expect(outcome.status).toBe('FAILED');
    if (outcome.status === 'FAILED') {
      expect(outcome.message).toContain('AUTHORIZATION_REQUEST_MISMATCH');
    }
    expect(h.mutationCalls()).toBe(0);
  });

  it('denies a STALE AUTHORIZATION VERSION', async () => {
    const h = harness({
      authorizationVersion: 2,
      auth: { mode: 'valid', view: authView({ authorizationVersion: 1 }) },
    });
    const outcome = await h.executor(
      handlerInput({
        executionContext: { authorizationRowId: AUTH_ROW, authorizationVersion: 2 },
      }),
      'keycloak.provision_realm',
    );
    expect(outcome.status).toBe('FAILED');
    if (outcome.status === 'FAILED') {
      expect(outcome.message).toContain('AUTHORIZATION_VERSION_MISMATCH');
    }
    expect(h.mutationCalls()).toBe(0);
  });

  it('denies when the workflow context disagrees with the persisted topology identity', async () => {
    const h = harness({ authorizationId: AUTH_ROW });
    const outcome = await h.executor(
      handlerInput({
        executionContext: { authorizationRowId: 'another-row', authorizationVersion: 1 },
      }),
      'keycloak.provision_realm',
    );
    expect(outcome.status).toBe('FAILED');
    if (outcome.status === 'FAILED') {
      expect(outcome.message).toContain('AUTHORIZATION_REFERENCE_MISMATCH');
    }
    expect(h.mutationCalls()).toBe(0);
  });

  it('denies when the P7.1 service is UNAVAILABLE (throws)', async () => {
    const h = harness({ auth: { mode: 'reject', message: 'connection refused' } });
    const outcome = await h.executor(handlerInput(), 'keycloak.provision_realm');
    expect(outcome.status).toBe('FAILED');
    if (outcome.status === 'FAILED') {
      expect(outcome.message).toContain('AUTHORIZATION_SERVICE_UNAVAILABLE');
    }
    expect(h.mutationCalls()).toBe(0);
  });

  it('denies when the P7.1 service TIMES OUT (fail-closed, never assumes valid)', async () => {
    vi.useFakeTimers();
    try {
      const h = harness({ auth: { mode: 'hang' } });
      const pending = h.executor(handlerInput(), 'keycloak.provision_realm');
      for (let i = 0; i < 60; i += 1) {
        await vi.advanceTimersByTimeAsync(200);
        if (h.mutationCalls() > 0) break;
      }
      const outcome = await pending;
      expect(outcome.status).toBe('FAILED');
      if (outcome.status === 'FAILED') {
        expect(outcome.message).toContain('AUTHORIZATION_SERVICE_UNAVAILABLE');
      }
      expect(h.mutationCalls()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects REVOCATION BETWEEN TWO WORKFLOW STEPS (second step fails closed)', async () => {
    const h = harness();
    const first = await h.executor(handlerInput(), 'keycloak.validate_plan');
    expect(first.status).toBe('SUCCEEDED');
    expect(h.mutationCalls()).toBe(0);

    h.authorization.revalidateBoundAuthorization.mockResolvedValue(null);

    const second = await h.executor(handlerInput(), 'keycloak.provision_realm');
    expect(second.status).toBe('FAILED');
    if (second.status === 'FAILED') {
      expect(second.errorClass).toBe(KeycloakErrorCode.AUTHORIZATION_FAILED);
    }
    expect(h.mutationCalls()).toBe(0);
    expect(
      h.evidence.filter((e) => e.operation.endsWith(':authorization_check')),
    ).toHaveLength(2);
  });

  it('validate_plan itself fails closed without a canonical authorization', async () => {
    const h = harness({ authorizationId: null, authorizationVersion: null });
    const outcome = await h.executor(handlerInput(), 'keycloak.validate_plan');
    expect(outcome.status).toBe('FAILED');
    if (outcome.status === 'FAILED') {
      expect(outcome.errorClass).toBe(KeycloakErrorCode.AUTHORIZATION_FAILED);
    }
    expect(h.mutationCalls()).toBe(0);
  });
});

/**
 * P7.7 remediation §2 — P7.4 fencing must compare the supplied token with the
 * AUTHORITATIVE lease state (never with itself) before every mutation (P0).
 */
describe('P7.7 P0 — P7.4 authoritative fencing (stale-worker protection)', () => {
  it('rejects Worker A after losing its lease to Worker B (token 1 → token 2)', async () => {
    const h = harness({ step: { fencingToken: 2, ownerWorkerId: 'worker-b' } });

    const stale = await h.executor(
      handlerInput({ workerId: WORKER, fencingToken: 1 }),
      'keycloak.provision_realm',
    );
    expect(stale.status).toBe('FAILED');
    if (stale.status === 'FAILED') expect(stale.errorClass).toBe(KeycloakErrorCode.CONFLICT);
    expect(h.mutationCalls()).toBe(0);
    expect(h.topologyWrites).toHaveLength(0);

    const fresh = await h.executor(
      handlerInput({ workerId: 'worker-b', fencingToken: 2 }),
      'keycloak.provision_realm',
    );
    expect(fresh.status).toBe('SUCCEEDED');
    expect(h.mutationCalls()).toBe(1);

    expect(h.evidence.filter((e) => e.outcome === 'SUCCEEDED').length).toBeGreaterThan(0);
    const denials = h.evidence.filter((e) => e.operation.endsWith(':fencing_denied'));
    expect(denials).toHaveLength(1);
    expect(denials[0].evidence.fencingDenialReason).toBe('STALE_TOKEN');
    // The raw token is redacted from evidence (key contains "token"), while the
    // audit sequence remains available for forensics.
    expect(denials[0].evidence.suppliedFencingToken).toBe('**********');
    expect(denials[0].evidence.presentedFencingSequence).toBe(1);
  });

  it('rejects a worker that does not own the lease even with the right token', async () => {
    const h = harness({ step: { ownerWorkerId: 'worker-b', fencingToken: 1 } });
    const outcome = await h.executor(
      handlerInput({ workerId: WORKER, fencingToken: 1 }),
      'keycloak.provision_realm',
    );
    expect(outcome.status).toBe('FAILED');
    if (outcome.status === 'FAILED') expect(outcome.message).toContain('WRONG_WORKER');
    expect(h.mutationCalls()).toBe(0);
  });

  it('rejects an EXPIRED lease', async () => {
    const h = harness({ step: { leaseExpiresAt: new Date(Date.now() - 1_000) } });
    const outcome = await h.executor(handlerInput(), 'keycloak.provision_realm');
    expect(outcome.status).toBe('FAILED');
    if (outcome.status === 'FAILED') expect(outcome.message).toContain('LEASE_EXPIRED');
    expect(h.mutationCalls()).toBe(0);
  });

  it('rejects missing and malformed fencing tokens', async () => {
    for (const token of [0, -1, 2.5, Number.NaN, undefined as unknown as number]) {
      const h = harness();
      const outcome = await h.executor(
        handlerInput({ fencingToken: token }),
        'keycloak.provision_realm',
      );
      expect(outcome.status).toBe('FAILED');
      expect(h.mutationCalls()).toBe(0);
    }
  });

  it('rejects a token that is AHEAD of the authoritative state', async () => {
    const h = harness({ step: { fencingToken: 1 } });
    const outcome = await h.executor(
      handlerInput({ fencingToken: 9 }),
      'keycloak.provision_realm',
    );
    expect(outcome.status).toBe('FAILED');
    if (outcome.status === 'FAILED') expect(outcome.message).toContain('TOKEN_AHEAD');
    expect(h.mutationCalls()).toBe(0);
  });

  it('re-validates the lease immediately before the external mutation (lost in-flight)', async () => {
    let calls = 0;
    const lease: WorkflowLeasePort = {
      validateLease: vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          return {
            valid: true as const,
            fencingToken: 1,
            ownerWorkerId: WORKER,
            leaseExpiresAt: new Date(Date.now() + 60_000),
            status: WorkflowStepStatus.RUNNING,
          };
        }
        return {
          valid: false as const,
          reason: 'LEASE_EXPIRED' as const,
          detail: 'reclaimed mid-flight',
        };
      }),
    };
    const h = harness({ lease });
    const outcome = await h.executor(handlerInput(), 'keycloak.provision_realm');
    expect(outcome.status).toBe('FAILED');
    if (outcome.status === 'FAILED') expect(outcome.message).toContain('LEASE_EXPIRED');
    expect(h.mutationCalls()).toBe(0);
    expect(lease.validateLease).toHaveBeenCalledTimes(2);
  });

  it('recovers safely after an ambiguous network result (no blind duplicate create)', async () => {
    const h = harness();
    h.provider.createRealm.mockRejectedValueOnce(new Error('socket hang up'));

    const first = await h.executor(handlerInput(), 'keycloak.provision_realm');
    expect(first.status).toBe('FAILED');
    expect(h.provider.createRealm).toHaveBeenCalledTimes(1);

    h.provider.createRealm.mockResolvedValueOnce({
      exists: true,
      realmName: 'okapi-t-test',
      externalId: 'ext-realm',
      fingerprint: 'fp-1',
    });
    const second = await h.executor(handlerInput(), 'keycloak.provision_realm');
    expect(second.status).toBe('SUCCEEDED');
    expect(h.provider.createRealm).toHaveBeenCalledTimes(2);
    expect(h.evidence.filter((e) => e.outcome === 'FAILED').length).toBeGreaterThan(0);
    expect(h.evidence.some((e) => e.outcome === 'SUCCEEDED')).toBe(true);
  });

  it('rejects compensation from a stale worker too', async () => {
    const h = harness({
      step: { fencingToken: 4, status: WorkflowStepStatus.COMPENSATING },
    });
    const outcome = await h.executor(
      handlerInput({ handlerKey: 'keycloak.deprovision_topology' }),
      'keycloak.deprovision_topology',
    );
    expect(outcome.status).toBe('FAILED');
    if (outcome.status === 'FAILED') expect(outcome.errorClass).toBe(KeycloakErrorCode.CONFLICT);
    expect(h.mutationCalls()).toBe(0);
    expect(h.topologyWrites).toHaveLength(0);
  });
});

/**
 * P7.7 remediation §3 — reconciliation must never create realms, organizations
 * or technical clients; it detects drift on ALLOWED settings and remediates.
 */
describe('P7.7 P1 — reconciliation never provisions resources', () => {
  it('runs only observation + reconciliation logic (zero creation calls)', async () => {
    const h = harness();
    const input = handlerInput({ handlerKey: 'keycloak.reconcile_topology' });

    const validate = await h.executor(input, 'keycloak.validate_plan');
    expect(validate.status).toBe('SUCCEEDED');

    const reconcile = await h.executor(input, 'keycloak.reconcile_topology');
    expect(reconcile.status).toBe('SUCCEEDED');

    expect(h.provider.createRealm).not.toHaveBeenCalled();
    expect(h.provider.createOrganization).not.toHaveBeenCalled();
    expect(h.provider.createTechnicalClient).not.toHaveBeenCalled();
    expect(h.provider.updateRealmSettings).not.toHaveBeenCalled();
    expect(h.provider.realmExists).toHaveBeenCalled();
    expect(h.repo.createReconciliationRun).toHaveBeenCalled();
  });

  it('detects external drift on an allowed setting and remediates it', async () => {
    const h = harness();
    const input = handlerInput({ handlerKey: 'keycloak.reconcile_topology' });
    h.repo.getRealmByTopology.mockResolvedValue(realmRecord());
    h.provider.realmExists
      .mockResolvedValueOnce({
        exists: true,
        realmName: 'okapi-t-test',
        externalId: 'ext-realm',
        fingerprint: 'fp-1',
        settings: {
          sslRequired: 'none',
          ssoSessionIdleTimeout: 1800,
          ssoSessionMaxLifespan: 36000,
          accessTokenLifespan: 300,
          revokeRefreshToken: true,
          passwordPolicy: null,
          refreshTokenMaxReuse: 0,
        },
      })
      .mockResolvedValueOnce({
        exists: true,
        realmName: 'okapi-t-test',
        externalId: 'ext-realm',
        fingerprint: 'fp-2',
        settings: {
          sslRequired: 'external',
          ssoSessionIdleTimeout: 1800,
          ssoSessionMaxLifespan: 36000,
          accessTokenLifespan: 300,
          revokeRefreshToken: true,
          passwordPolicy: null,
          refreshTokenMaxReuse: 0,
        },
      });

    const outcome = await h.executor(input, 'keycloak.reconcile_topology');
    expect(outcome.status).toBe('SUCCEEDED');
    if (outcome.status === 'SUCCEEDED') {
      expect(outcome.outputSnapshot?.driftDetected).toBe(true);
      expect(outcome.outputSnapshot?.remediated).toBe(true);
    }
    expect(h.provider.updateRealmSettings).toHaveBeenCalledTimes(1);
    expect(h.provider.createRealm).not.toHaveBeenCalled();
    expect(h.provider.createOrganization).not.toHaveBeenCalled();
    expect(h.provider.createTechnicalClient).not.toHaveBeenCalled();
    const run = h.repo.createReconciliationRun.mock.calls[0][0] as {
      driftDetected: boolean;
      driftDetails: unknown[];
    };
    expect(run.driftDetected).toBe(true);
    expect(JSON.stringify(run.driftDetails)).toContain('REALM_SETTINGS_DRIFT');
  });

  it('quarantines (never recreates) when the realm disappeared outside Edge', async () => {
    const h = harness();
    h.provider.realmExists.mockResolvedValue({
      exists: false,
      realmName: 'okapi-t-test',
      externalId: null,
      fingerprint: null,
      settings: {},
    });
    const outcome = await h.executor(
      handlerInput({ handlerKey: 'keycloak.reconcile_topology' }),
      'keycloak.reconcile_topology',
    );
    expect(outcome.status).toBe('FAILED');
    if (outcome.status === 'FAILED') {
      expect(outcome.errorClass).toBe(KeycloakErrorCode.DRIFT_DETECTED);
    }
    expect(h.provider.createRealm).not.toHaveBeenCalled();
    expect(h.topologyWrites.some((w) => w.status === KeycloakTopologyStatus.QUARANTINED)).toBe(
      true,
    );
  });

  it('keeps topology/workflow ids bound (reconciliation runs against the persisted topology)', async () => {
    const h = harness();
    await h.executor(
      handlerInput({ handlerKey: 'keycloak.reconcile_topology' }),
      'keycloak.reconcile_topology',
    );
    const run = h.repo.createReconciliationRun.mock.calls[0][0] as {
      topologyId: string;
      tenantId: string;
      workflowId: string | null;
      trigger: string;
    };
    expect(run.topologyId).toBe('topo-1');
    expect(run.tenantId).toBe(TENANT);
    expect(run.workflowId).toBe(WORKFLOW_ID);
    expect(run.trigger).toBe('WORKFLOW');
  });
});

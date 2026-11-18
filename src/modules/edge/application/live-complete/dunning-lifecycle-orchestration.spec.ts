/**
 * RGOM-E7.6 — paid delinquency path: open collection → PAST_DUE (grace) →
 * escalate → SUSPEND (+ BB) → resolve → ACTIVE (+ BB resume).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  evaluateDunningLifecycle,
  parseDunningPolicyRules,
  PAYMENT_DELINQUENCY_REASON,
} from '../../domain/billing/dunning-policy.js';
import { syncBbTenantLifecycle } from '../subscription/subscription-bb-lifecycle.js';
import type { ControlV1BusinessBackendClient } from '../../infrastructure/product-control/control-v1-business-backend.client.js';

describe('dunning lifecycle orchestration', () => {
  const rules = parseDunningPolicyRules({
    graceDays: 7,
    maxRetries: 3,
    restrictDuringGrace: true,
    suspendAfterGrace: true,
    suspendOnEscalate: true,
    reactivateOnResolve: true,
    restrictionMode: 'PAST_DUE',
  });

  it('grace → escalate suspend → resolve reactivate with BB sync', async () => {
    const overdueSince = new Date('2026-11-15T00:00:00Z');
    const inGrace = evaluateDunningLifecycle({
      caseStatus: 'OPEN',
      overdueSince,
      asOf: new Date('2026-11-17T00:00:00Z'),
      rules,
    });
    expect(inGrace.action).toBe('MARK_PAST_DUE');

    const escalated = evaluateDunningLifecycle({
      caseStatus: 'ESCALATED',
      overdueSince,
      asOf: new Date('2026-11-17T00:00:00Z'),
      rules,
    });
    expect(escalated.action).toBe('SUSPEND');
    expect(PAYMENT_DELINQUENCY_REASON).toBe('PAYMENT_DELINQUENCY');

    const suspendTenant = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: { status: 'suspended' },
      text: '',
    }));
    const resumeTenant = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: { status: 'active' },
      text: '',
    }));
    const bb = {
      isConfigured: () => true,
      suspendTenant,
      resumeTenant,
    } as unknown as ControlV1BusinessBackendClient;

    const suspended = await syncBbTenantLifecycle({
      bbClient: bb,
      action: 'suspend',
      tenantId: 'tenant-pharmacy-1',
      reason: PAYMENT_DELINQUENCY_REASON,
      correlationId: 'corr-dunning-suspend-1',
    });
    expect(suspended.synced).toBe(true);
    expect(suspendTenant).toHaveBeenCalledOnce();

    const resolved = evaluateDunningLifecycle({
      caseStatus: 'RESOLVED',
      overdueSince,
      rules,
    });
    expect(resolved.action).toBe('REACTIVATE');

    const resumed = await syncBbTenantLifecycle({
      bbClient: bb,
      action: 'resume',
      tenantId: 'tenant-pharmacy-1',
      reason: 'reactivation',
      correlationId: 'corr-dunning-resume-1',
    });
    expect(resumed.synced).toBe(true);
    expect(resumeTenant).toHaveBeenCalledOnce();
  });

  it('fail-closed when BB not configured (no fabricated sync)', async () => {
    const bb = {
      isConfigured: () => false,
    } as unknown as ControlV1BusinessBackendClient;
    const result = await syncBbTenantLifecycle({
      bbClient: bb,
      action: 'suspend',
      tenantId: 't-1',
      reason: 'PAYMENT_DELINQUENCY',
      correlationId: 'corr-x',
    });
    expect(result.synced).toBe(false);
    expect(result.skipped).toMatch(/not configured/);
  });
});

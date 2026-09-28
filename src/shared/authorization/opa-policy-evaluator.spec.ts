import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpaPolicyEvaluator } from './opa-policy-evaluator.js';
import type { InProcessPolicyEvaluator } from './in-process-policy-evaluator.js';

describe('OpaPolicyEvaluator', () => {
  let fallback: InProcessPolicyEvaluator;
  let evaluator: OpaPolicyEvaluator;

  beforeEach(() => {
    fallback = {
      evaluate: vi.fn().mockResolvedValue({ allowed: true, source: 'rbac' }),
    } as unknown as InProcessPolicyEvaluator;

    evaluator = new OpaPolicyEvaluator(
      {
        OPA_URL: 'http://localhost:8181',
        OPA_POLICY_PATH: 'platform/authz/allow',
        OPA_TIMEOUT_MS: 1000,
      } as never,
      fallback,
    );
  });

  it('uses OPA allow result when available', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: { allow: true } }),
      }),
    );

    const decision = await evaluator.evaluate({
      tenantId: 'tenant-1',
      subjectId: 'user-1',
      organizationId: null,
      action: 'read',
      resource: { type: 'users' },
      permissions: ['users:read'],
    });

    expect(decision.allowed).toBe(true);
    expect(decision.source).toBe('opa');
    vi.unstubAllGlobals();
  });

  it('falls back to in-process evaluator on OPA error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const decision = await evaluator.evaluate({
      tenantId: 'tenant-1',
      subjectId: 'user-1',
      organizationId: null,
      action: 'read',
      resource: { type: 'users' },
      permissions: ['users:read'],
    });

    expect(decision.allowed).toBe(true);
    expect(fallback.evaluate).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

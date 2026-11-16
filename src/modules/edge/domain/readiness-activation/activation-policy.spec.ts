import { describe, expect, it } from 'vitest';
import {
  aggregateReadinessChecks,
  mapCheckCodeToPhase,
} from './activation-policy.js';
import {
  ActivationRecordStatus,
  ReadinessCheckStatus,
  ReadinessEvaluationStatus,
} from './activation.types.js';

describe('aggregateReadinessChecks', () => {
  it('returns READY only when all required checks PASSED', () => {
    const result = aggregateReadinessChecks([
      { checkCode: 'auth.p71_revalidated', checkStatus: ReadinessCheckStatus.PASSED, required: true },
      { checkCode: 'infra.resources_ready', checkStatus: ReadinessCheckStatus.PASSED, required: true },
      { checkCode: 'optional.note', checkStatus: ReadinessCheckStatus.FAILED, required: false },
    ]);
    expect(result.ready).toBe(true);
    expect(result.evaluationStatus).toBe(ReadinessEvaluationStatus.READY);
    expect(result.activationStatus).toBe(ActivationRecordStatus.READY_FOR_ACTIVATION);
    expect(result.blockingCodes).toEqual([]);
    expect(result.overallScore).toBe(100);
  });

  it('returns NOT_READY when any required check fails or is pending', () => {
    const result = aggregateReadinessChecks([
      { checkCode: 'auth.p71_revalidated', checkStatus: ReadinessCheckStatus.PASSED, required: true },
      { checkCode: 'infra.resources_ready', checkStatus: ReadinessCheckStatus.FAILED, required: true },
      { checkCode: 'experience.ready', checkStatus: ReadinessCheckStatus.PENDING, required: true },
    ]);
    expect(result.ready).toBe(false);
    expect(result.evaluationStatus).toBe(ReadinessEvaluationStatus.NOT_READY);
    expect(result.activationStatus).toBeNull();
    expect(result.blockingCodes).toEqual(['infra.resources_ready', 'experience.ready']);
  });

  it('treats SKIPPED required checks as blocking (fail-closed)', () => {
    const result = aggregateReadinessChecks([
      { checkCode: 'product_control.reachable', checkStatus: ReadinessCheckStatus.SKIPPED, required: true },
    ]);
    expect(result.ready).toBe(false);
    expect(result.blockingCodes).toContain('product_control.reachable');
  });
});

describe('mapCheckCodeToPhase', () => {
  it('maps known codes to phases', () => {
    expect(mapCheckCodeToPhase('auth.p71_revalidated')).toBe('P71_AUTH');
    expect(mapCheckCodeToPhase('experience.ready')).toBe('P79_EXPERIENCE');
    expect(mapCheckCodeToPhase('aggregate.ready')).toBe('AGGREGATE');
    expect(mapCheckCodeToPhase('unknown.x')).toBe('OTHER');
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  ApproveCommissionUseCase,
  CalculateCommissionUseCase,
  RecordProductProfitabilitySnapshotUseCase,
  RecordRetentionSnapshotUseCase,
  RunAssuranceScanUseCase,
} from './revenue.use-cases.js';

function mockRepo(overrides: Record<string, unknown> = {}) {
  return {
    getCommissionPlan: vi.fn(),
    listCommissionRules: vi.fn(),
    getCommissionCalculationByKey: vi.fn().mockResolvedValue(null),
    getCommissionCalculation: vi.fn(),
    createCommissionCalculation: vi.fn(),
    approveCommissionCalculation: vi.fn(),
    getRevenueCohort: vi.fn(),
    createRetentionSnapshot: vi.fn(),
    createProductProfitabilitySnapshot: vi.fn(),
    createLeakageCase: vi.fn(),
    appendBusinessAudit: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    ...overrides,
  } as any;
}

describe('CalculateCommissionUseCase', () => {
  it('supports percentage and fixed rules; snapshot immutable key', async () => {
    const repo = mockRepo({
      getCommissionPlan: vi.fn().mockResolvedValue({ id: 'plan-1', code: 'P1' }),
      listCommissionRules: vi.fn().mockResolvedValue([
        {
          id: 'r1',
          code: 'PCT',
          ruleType: 'PERCENT_OF_MRR',
          rate: 0.1,
          status: 'ACTIVE',
          definition: {},
        },
        {
          id: 'r2',
          code: 'FIX',
          ruleType: 'FLAT',
          rate: 50,
          status: 'ACTIVE',
          definition: {},
        },
      ]),
      createCommissionCalculation: vi.fn().mockImplementation(async (input) => ({
        id: 'calc-1',
        ...input,
        status: 'CALCULATED',
        immutable: true,
        calculatedBy: input.calculatedBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      })),
    });

    const uc = new CalculateCommissionUseCase(repo);
    const calc = await uc.execute({
      actorId: 'actor-a',
      planId: 'plan-1',
      calculationKey: 'k-1',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      basisAmount: 1000,
      currency: 'USD',
      dataQuality: 'MEASURED',
      sourceProvenance: { test: true },
    });

    expect(calc.totalAmount).toBe(150); // 100 + 50
    expect(calc.immutable).toBe(true);
    expect(repo.createCommissionCalculation).toHaveBeenCalledOnce();
  });

  it('rejects duplicate calculationKey (immutable)', async () => {
    const repo = mockRepo({
      getCommissionCalculationByKey: vi.fn().mockResolvedValue({ id: 'existing' }),
    });
    const uc = new CalculateCommissionUseCase(repo);
    await expect(
      uc.execute({
        actorId: 'a',
        planId: 'p',
        calculationKey: 'dup',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        basisAmount: 1,
        currency: 'USD',
        dataQuality: 'MEASURED',
        sourceProvenance: {},
      }),
    ).rejects.toMatchObject({ code: expect.anything() });
  });
});

describe('ApproveCommissionUseCase', () => {
  it('enforces SoD and approves CALCULATED snapshot', async () => {
    const repo = mockRepo({
      getCommissionCalculation: vi.fn().mockResolvedValue({
        id: 'calc-1',
        status: 'CALCULATED',
        calculatedBy: 'actor-calc',
        calculationKey: 'k-1',
        immutable: true,
      }),
      approveCommissionCalculation: vi.fn().mockResolvedValue({
        calculation: {
          id: 'calc-1',
          status: 'APPROVED',
          calculationKey: 'k-1',
          immutable: true,
        },
        approval: { id: 'appr-1', decision: 'APPROVED' },
      }),
    });
    const uc = new ApproveCommissionUseCase(repo);
    const result = await uc.execute({ actorId: 'actor-approver', calculationId: 'calc-1' });
    expect(result.calculation.status).toBe('APPROVED');
  });

  it('rejects self-approval', async () => {
    const repo = mockRepo({
      getCommissionCalculation: vi.fn().mockResolvedValue({
        id: 'calc-1',
        status: 'CALCULATED',
        calculatedBy: 'same-actor',
        calculationKey: 'k-1',
        immutable: true,
      }),
    });
    const uc = new ApproveCommissionUseCase(repo);
    await expect(
      uc.execute({ actorId: 'same-actor', calculationId: 'calc-1' }),
    ).rejects.toBeTruthy();
  });
});

describe('RecordRetentionSnapshotUseCase', () => {
  it('persists GRR and NRR snapshots from calculator', async () => {
    const repo = mockRepo({
      getRevenueCohort: vi.fn().mockResolvedValue({ id: 'cohort-1' }),
      createRetentionSnapshot: vi
        .fn()
        .mockImplementation(async (input) => ({ id: `snap-${input.metricCode}`, ...input })),
    });
    const uc = new RecordRetentionSnapshotUseCase(repo);
    const result = await uc.execute({
      actorId: 'a',
      cohortId: 'cohort-1',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      startingMrr: 100,
      contraction: 10,
      churned: 10,
      expansion: 20,
      reactivation: 5,
    });
    expect(result.computed.grr.grrPct).toBe(0.8);
    expect(result.computed.nrr.nrrPct).toBe(1.05);
    expect(repo.createRetentionSnapshot).toHaveBeenCalledTimes(2);
  });
});

describe('RecordProductProfitabilitySnapshotUseCase', () => {
  it('requires MEASURED revenue and nulls margin when costs UNAVAILABLE', async () => {
    const repo = mockRepo({
      createProductProfitabilitySnapshot: vi.fn().mockImplementation(async (input) => ({
        id: 'pp-1',
        ...input,
        createdAt: new Date(),
        version: 1,
      })),
    });
    const uc = new RecordProductProfitabilitySnapshotUseCase(repo);
    const snap = await uc.execute({
      actorId: 'a',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      revenueAmount: 500,
      costDataQuality: 'UNAVAILABLE',
      costAmount: null,
      currency: 'USD',
      sourceProvenance: { source: 'test' },
    });
    expect(snap.marginAmount).toBeNull();
    expect(snap.costAmount).toBeNull();
    expect(snap.revenueAmount).toBe(500);
  });

  it('computes contribution margin when costs ESTIMATED', async () => {
    const repo = mockRepo({
      createProductProfitabilitySnapshot: vi.fn().mockImplementation(async (input) => ({
        id: 'pp-2',
        ...input,
        createdAt: new Date(),
        version: 1,
      })),
    });
    const uc = new RecordProductProfitabilitySnapshotUseCase(repo);
    const snap = await uc.execute({
      actorId: 'a',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      revenueAmount: 500,
      costAmount: 200,
      costDataQuality: 'ESTIMATED',
      currency: 'USD',
      sourceProvenance: {},
    });
    expect(snap.marginAmount).toBe(300);
    expect(snap.dataQuality).toBe('ESTIMATED');
  });
});

describe('RunAssuranceScanUseCase', () => {
  it('creates leakage cases from supplied findings only', async () => {
    const repo = mockRepo({
      createLeakageCase: vi.fn().mockImplementation(async (input) => ({
        id: 'lk-1',
        caseNumber: 'LK-1',
        status: 'DETECTED',
        ...input,
      })),
    });
    const uc = new RunAssuranceScanUseCase(repo);
    const result = await uc.execute({
      actorId: 'a',
      findings: [
        {
          title: 'Gap',
          description: null,
          detectionSource: 'assurance.test',
          subscriptionRefId: 'sub-1',
          invoiceRefId: null,
          detectedAmount: null,
          currency: null,
          dataQuality: 'ESTIMATED',
          confidence: 0.7,
          sourceProvenance: {},
        },
      ],
    });
    expect(result.created).toHaveLength(1);
    expect(repo.createLeakageCase).toHaveBeenCalledOnce();
  });

  it('does not invent findings when array empty', async () => {
    const repo = mockRepo();
    const uc = new RunAssuranceScanUseCase(repo);
    const result = await uc.execute({ actorId: 'a', findings: [] });
    expect(result.created).toHaveLength(0);
    expect(result.scanned).toBe(0);
  });
});

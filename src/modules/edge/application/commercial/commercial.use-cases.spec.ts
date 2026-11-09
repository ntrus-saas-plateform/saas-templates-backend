import { describe, expect, it, vi } from 'vitest';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { CreateValuePropositionUseCase } from './commercial.use-cases.js';

describe('CreateValuePropositionUseCase', () => {
  it('rejects quantitative claims without evidence', async () => {
    const commercial = {
      createValueProposition: vi.fn(),
    };
    const products = {
      findById: vi.fn().mockResolvedValue({
        id: 'p1',
        verticalId: 'v1',
      }),
    };
    const uc = new CreateValuePropositionUseCase(
      commercial as never,
      products as never,
    );
    try {
      await uc.execute({
        code: 'VP1',
        name: 'Faster ops',
        productId: 'p1',
        verticalId: 'v1',
        expectedOutcome: 'Reduce manual work by 40%',
        evidence: [],
      });
      expect.fail('expected error');
    } catch (err) {
      expect((err as DomainError).code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(commercial.createValueProposition).not.toHaveBeenCalled();
    }
  });

  it('allows quantitative claims when evidence is provided', async () => {
    const commercial = {
      createValueProposition: vi.fn().mockResolvedValue({ id: 'vp1' }),
    };
    const products = {
      findById: vi.fn().mockResolvedValue({
        id: 'p1',
        verticalId: 'v1',
      }),
    };
    const uc = new CreateValuePropositionUseCase(
      commercial as never,
      products as never,
    );
    await uc.execute({
      code: 'VP1',
      name: 'Faster ops',
      productId: 'p1',
      verticalId: 'v1',
      expectedOutcome: 'Reduce manual work by 40%',
      evidence: [{ source: 'pilot-report', date: '2026-01-01' }],
    });
    expect(commercial.createValueProposition).toHaveBeenCalled();
  });
});

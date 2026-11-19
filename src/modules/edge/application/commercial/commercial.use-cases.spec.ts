import { describe, expect, it, vi } from 'vitest';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  AddPriceBookEntryUseCase,
  CreateValuePropositionUseCase,
  GetCommercialAddonUseCase,
  PublishPriceBookUseCase,
} from './commercial.use-cases.js';

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

// ---------------------------------------------------------------------------
// Gate G11#3 (doc 39) — un price book reste DRAFT tant que ses prix sont
// NEEDS_RESEARCH : publish fail-closed, jamais de prix inventé publié.
// ---------------------------------------------------------------------------
describe('PublishPriceBookUseCase (price book stays DRAFT until researched)', () => {
  const book = {
    id: 'pb-1',
    productId: 'prod-1',
    currency: 'XOF',
    status: 'DRAFT',
    version: 1,
    code: 'PB_CI',
    name: 'CI book',
  };

  function makeRepo(entries: unknown[]) {
    return {
      getPriceBook: vi.fn().mockResolvedValue(book),
      listPriceBookEntries: vi.fn().mockResolvedValue(entries),
      updatePriceBookStatus: vi.fn().mockResolvedValue({ ...book, status: 'PUBLISHED' }),
      createPublicationSnapshot: vi.fn().mockResolvedValue({ id: 'snap-1' }),
    };
  }

  it('blocks publish when an entry is NEEDS_RESEARCH (or missing priceSource)', async () => {
    const repo = makeRepo([
      { id: 'e1', conditions: { priceSource: 'NEEDS_RESEARCH' } },
      { id: 'e2', conditions: {} },
      { id: 'e3', conditions: null },
    ]);
    const uc = new PublishPriceBookUseCase(repo as never);
    await expect(uc.execute({ priceBookId: 'pb-1', actorId: 'adm-1' })).rejects.toThrow(
      /NEEDS_RESEARCH/,
    );
    expect(repo.updatePriceBookStatus).not.toHaveBeenCalled();
  });

  it('publishes only when every entry is MEASURED or ESTIMATED', async () => {
    const repo = makeRepo([
      { id: 'e1', conditions: { priceSource: 'MEASURED' } },
      { id: 'e2', conditions: { priceSource: 'ESTIMATED' } },
    ]);
    const uc = new PublishPriceBookUseCase(repo as never);
    const result = await uc.execute({ priceBookId: 'pb-1', actorId: 'adm-1' });
    expect(result).toBeDefined();
    expect(repo.updatePriceBookStatus).toHaveBeenCalledWith('pb-1', 'PUBLISHED');
  });

  it('still rejects an empty price book', async () => {
    const repo = makeRepo([]);
    const uc = new PublishPriceBookUseCase(repo as never);
    await expect(uc.execute({ priceBookId: 'pb-1', actorId: 'adm-1' })).rejects.toThrow(
      /without entries/,
    );
  });
});

// ---------------------------------------------------------------------------
// AddPriceBookEntryUseCase — défaut honnête NEEDS_RESEARCH (aucun prix inventé).
// ---------------------------------------------------------------------------
describe('AddPriceBookEntryUseCase (default priceSource)', () => {
  function makeRepo() {
    return {
      getPriceBook: vi.fn().mockResolvedValue({
        id: 'pb-1',
        productId: 'prod-1',
        currency: 'XOF',
        status: 'DRAFT',
        version: 1,
      }),
      getPlan: vi.fn().mockResolvedValue({ id: 'plan-1', productId: 'prod-1' }),
      addPriceBookEntry: vi.fn().mockResolvedValue({ id: 'e1' }),
    };
  }

  it('stores priceSource NEEDS_RESEARCH by default', async () => {
    const repo = makeRepo();
    const uc = new AddPriceBookEntryUseCase(repo as never);
    await uc.execute({
      priceBookId: 'pb-1',
      commercialItemType: 'PLAN',
      commercialItemId: 'plan-1',
      amount: '10000.00',
    });
    expect(repo.addPriceBookEntry).toHaveBeenCalledWith(
      expect.objectContaining({ conditions: { priceSource: 'NEEDS_RESEARCH' } }),
    );
  });

  it('persists an explicit MEASURED source', async () => {
    const repo = makeRepo();
    const uc = new AddPriceBookEntryUseCase(repo as never);
    await uc.execute({
      priceBookId: 'pb-1',
      commercialItemType: 'PLAN',
      commercialItemId: 'plan-1',
      amount: '10000.00',
      priceSource: 'MEASURED',
    });
    expect(repo.addPriceBookEntry).toHaveBeenCalledWith(
      expect.objectContaining({ conditions: { priceSource: 'MEASURED' } }),
    );
  });

  it('rejects an invalid priceSource', async () => {
    const repo = makeRepo();
    const uc = new AddPriceBookEntryUseCase(repo as never);
    await expect(
      uc.execute({
        priceBookId: 'pb-1',
        commercialItemType: 'PLAN',
        commercialItemId: 'plan-1',
        amount: '10000.00',
        priceSource: 'INVENTED' as unknown as 'MEASURED',
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

// ---------------------------------------------------------------------------
// GET addons/:id — détail add-on + capabilities enrichies (parity plan/package).
// ---------------------------------------------------------------------------
describe('GetCommercialAddonUseCase', () => {
  it('returns addon with linked capabilities (capabilityCode + restrictions)', async () => {
    const repo = {
      getAddon: vi.fn().mockResolvedValue({ id: 'a1', code: 'ADDON_X', status: 'PLANNED' }),
      listAddonCapabilities: vi.fn().mockResolvedValue([
        {
          capabilityId: 'c1',
          capabilityCode: 'BATCH',
          inclusionType: 'OPTIONAL',
          restrictions: { numericLimit: 25 },
        },
      ]),
    };
    const uc = new GetCommercialAddonUseCase(repo as never);
    const result = await uc.execute('a1');
    expect(result.capabilities).toHaveLength(1);
    const caps = result.capabilities as unknown as {
      restrictions?: { numericLimit?: number } | null;
    }[];
    expect(caps[0]?.restrictions?.numericLimit).toBe(25);
  });

  it('throws RESOURCE_NOT_FOUND for a missing add-on', async () => {
    const repo = {
      getAddon: vi.fn().mockResolvedValue(null),
      listAddonCapabilities: vi.fn(),
    };
    const uc = new GetCommercialAddonUseCase(repo as never);
    await expect(uc.execute('missing')).rejects.toMatchObject({
      code: ErrorCode.RESOURCE_NOT_FOUND,
    });
  });
});

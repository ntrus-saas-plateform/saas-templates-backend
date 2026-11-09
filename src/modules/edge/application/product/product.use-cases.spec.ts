import { describe, expect, it, vi } from 'vitest';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  CommercialAvailability,
  ProductLifecycleStatus,
} from '../../domain/product/product.entity.js';
import {
  CreateProductUseCase,
  GetProductUseCase,
  ListProductsUseCase,
  UpdateProductUseCase,
} from './product.use-cases.js';

const pharmacyProduct = {
  id: 'prod-pharmacy',
  code: 'PHARM_MGMT',
  slug: 'pharmacy-mgmt',
  name: 'Pharmacy Management',
  shortDescription: null,
  description: null,
  verticalId: 'vertical-pharmacy',
  productType: null,
  lifecycleStatus: ProductLifecycleStatus.CONFIGURING,
  technicalStatus: null,
  commercialAvailability: CommercialAvailability.UNAVAILABLE,
  defaultVersionId: null,
  iconRef: null,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'actor-1',
  updatedBy: null,
  rowVersion: 1,
};

describe('Product vertical isolation', () => {
  it('blocks restaurant workspace from updating a pharmacy product', async () => {
    const products = {
      findById: vi.fn().mockResolvedValue(pharmacyProduct),
      update: vi.fn(),
      updateLifecycle: vi.fn(),
    };
    const useCase = new UpdateProductUseCase(products as never);

    await expect(
      useCase.execute({
        id: pharmacyProduct.id,
        actorId: 'restaurant-admin',
        scopeVerticalId: 'vertical-restaurant',
        name: 'Hijacked',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
    expect(products.update).not.toHaveBeenCalled();
  });

  it('blocks restaurant workspace from reading a pharmacy product', async () => {
    const products = {
      findById: vi.fn().mockResolvedValue(pharmacyProduct),
    };
    const useCase = new GetProductUseCase(products as never);

    await expect(
      useCase.execute(pharmacyProduct.id, 'vertical-restaurant'),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('forces list filter to workspace vertical', async () => {
    const products = {
      list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const useCase = new ListProductsUseCase(products as never);

    await useCase.execute({
      page: 1,
      limit: 20,
      verticalId: 'vertical-restaurant',
      scopeVerticalId: 'vertical-pharmacy',
    }).catch(() => undefined);

    await expect(
      useCase.execute({
        page: 1,
        limit: 20,
        verticalId: 'vertical-restaurant',
        scopeVerticalId: 'vertical-pharmacy',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });

  it('allows global scope to create in any vertical', async () => {
    const verticals = {
      findById: vi.fn().mockResolvedValue({ id: 'vertical-pharmacy' }),
    };
    const products = {
      findByCode: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(pharmacyProduct),
    };
    const useCase = new CreateProductUseCase(products as never, verticals as never);

    await useCase.execute({
      actorId: 'global-admin',
      scopeVerticalId: null,
      code: 'PHARM_MGMT',
      slug: 'pharmacy-mgmt',
      name: 'Pharmacy Management',
      verticalId: 'vertical-pharmacy',
    });

    expect(products.create).toHaveBeenCalled();
  });

  it('blocks workspace create into a foreign vertical', async () => {
    const useCase = new CreateProductUseCase(
      { findByCode: vi.fn(), create: vi.fn() } as never,
      { findById: vi.fn() } as never,
    );

    await expect(
      useCase.execute({
        actorId: 'restaurant-admin',
        scopeVerticalId: 'vertical-restaurant',
        code: 'X',
        slug: 'x',
        name: 'X',
        verticalId: 'vertical-pharmacy',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });
});

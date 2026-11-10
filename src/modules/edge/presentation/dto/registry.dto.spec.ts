import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  PatchProductRegistryDto,
  RegisterProductDto,
} from './registry.dto.js';

describe('registry.dto validation', () => {
  it('rejects invalid UUID on RegisterProductDto', async () => {
    const dto = plainToInstance(RegisterProductDto, {
      productId: 'not-a-uuid',
      code: 'CRM',
      name: 'CRM',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'productId')).toBe(true);
  });

  it('rejects unknown properties when validated after plainToInstance (forbidNonWhitelisted path)', async () => {
    const dto = plainToInstance(RegisterProductDto, {
      productId: '11111111-1111-4111-8111-111111111111',
      code: 'CRM',
      name: 'CRM',
      registryStatus: 'CERTIFIED',
      createdBy: 'attacker',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(
      errors.some(
        (e) =>
          e.property === 'registryStatus' ||
          e.property === 'createdBy' ||
          Object.keys(e.constraints ?? {}).some((k) => k === 'whitelistValidation'),
      ),
    ).toBe(true);
  });

  it('rejects oversized strings', async () => {
    const dto = plainToInstance(RegisterProductDto, {
      productId: '11111111-1111-4111-8111-111111111111',
      code: 'X'.repeat(65),
      name: 'CRM',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('rejects missing expectedVersion on PatchProductRegistryDto', async () => {
    const dto = plainToInstance(PatchProductRegistryDto, {
      name: 'Updated',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'expectedVersion')).toBe(true);
  });

  it('accepts valid RegisterProductDto', async () => {
    const dto = plainToInstance(RegisterProductDto, {
      productId: '11111111-1111-4111-8111-111111111111',
      code: 'CRM',
      name: 'CRM Product',
      description: 'ok',
      verticalCategory: 'sales',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors).toHaveLength(0);
  });
});

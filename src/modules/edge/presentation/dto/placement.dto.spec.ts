import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreatePlacementRequestDto,
  PatchCapacityInventoryDto,
  PlacementPaginationQueryDto,
  UpsertCapacityInventoryDto,
} from './placement.dto.js';

describe('placement.dto validation', () => {
  it('rejects invalid UUID on CreatePlacementRequestDto', async () => {
    const dto = plainToInstance(CreatePlacementRequestDto, {
      provisioningRequestId: 'not-a-uuid',
      productRegistryId: '11111111-1111-4111-8111-111111111111',
      technicalVersionId: '11111111-1111-4111-8111-111111111112',
      contractId: '11111111-1111-4111-8111-111111111113',
      deploymentProfileId: '11111111-1111-4111-8111-111111111114',
      requestedEnvironmentType: 'PRODUCTION',
      requestedDeploymentModel: 'SHARED_SAAS',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'provisioningRequestId')).toBe(true);
  });

  it('rejects unknown properties (forbidNonWhitelisted path)', async () => {
    const dto = plainToInstance(CreatePlacementRequestDto, {
      provisioningRequestId: '11111111-1111-4111-8111-111111111111',
      productRegistryId: '11111111-1111-4111-8111-111111111112',
      technicalVersionId: '11111111-1111-4111-8111-111111111113',
      contractId: '11111111-1111-4111-8111-111111111114',
      deploymentProfileId: '11111111-1111-4111-8111-111111111115',
      requestedEnvironmentType: 'PRODUCTION',
      requestedDeploymentModel: 'SHARED_SAAS',
      accountId: 'attacker-forged',
      productId: 'attacker-forged',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts valid CreatePlacementRequestDto', async () => {
    const dto = plainToInstance(CreatePlacementRequestDto, {
      idempotencyKey: 'idem-1',
      provisioningRequestId: '11111111-1111-4111-8111-111111111111',
      productRegistryId: '11111111-1111-4111-8111-111111111112',
      technicalVersionId: '11111111-1111-4111-8111-111111111113',
      contractId: '11111111-1111-4111-8111-111111111114',
      deploymentProfileId: '11111111-1111-4111-8111-111111111115',
      requestedEnvironmentType: 'PRODUCTION',
      requestedDeploymentModel: 'SHARED_SAAS',
      capacityRequirements: { TENANT_SLOT: 1 },
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors).toHaveLength(0);
  });

  it('bounds pagination limit to max 100', async () => {
    const dto = plainToInstance(PlacementPaginationQueryDto, { limit: 500, offset: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects missing expectedVersion on PatchCapacityInventoryDto', async () => {
    const dto = plainToInstance(PatchCapacityInventoryDto, { totalCapacity: 10 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'expectedVersion')).toBe(true);
  });

  it('accepts valid UpsertCapacityInventoryDto', async () => {
    const dto = plainToInstance(UpsertCapacityInventoryDto, {
      platformId: '11111111-1111-4111-8111-111111111111',
      environmentId: '11111111-1111-4111-8111-111111111112',
      resourceType: 'TENANT_SLOT',
      unit: 'slot',
      totalCapacity: 10,
      validUntil: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors).toHaveLength(0);
  });
});

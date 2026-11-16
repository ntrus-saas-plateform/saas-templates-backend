import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import type { ServiceCatalogRepositoryPort } from '../../domain/platform-operations/service-catalog-repository.port.js';
import {
  RegisterPlatformServiceUseCase,
  UpdatePlatformServiceUseCase,
} from './service-catalog.use-cases.js';

function baseService() {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    serviceCode: 'edge-api',
    serviceSlug: 'edge-api',
    displayName: 'Edge API',
    description: null,
    category: 'CONTROL_PLANE',
    serviceType: 'INTERNAL',
    lifecycleStatus: 'CONFIGURED',
    observationStatus: 'CONFIGURED',
    businessCriticality: 'HIGH',
    technicalCriticality: 'HIGH',
    environment: 'PRODUCTION',
    region: null,
    deploymentProfile: null,
    runtimeTechnology: null,
    currentVersion: null,
    serviceOwnerId: null,
    technicalOwnerId: null,
    operationalTeam: null,
    supportGroup: null,
    escalationPolicyRef: null,
    healthCheckRef: null,
    monitoringConfigRef: null,
    sloRef: null,
    runbookRef: null,
    rpoMinutes: null,
    rtoMinutes: null,
    maintenancePolicyRef: null,
    dataClassification: null,
    securityClassification: null,
    supportHours: null,
    documentationUrl: null,
    p7ResourceRef: null,
    p8ProjectionNote: null,
    metadata: {},
    createdBy: 'actor',
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  };
}

describe('P9 service-catalog use-cases', () => {
  it('RegisterPlatformServiceUseCase creates audited service', async () => {
    const created = baseService();
    const repo = {
      getByCode: vi.fn().mockResolvedValue(null),
      createService: vi.fn().mockResolvedValue(created),
      appendActivity: vi.fn(),
    } as unknown as ServiceCatalogRepositoryPort;
    const outbox = {
      runWithOutbox: vi.fn(async (_t, fn) => fn({}, vi.fn())),
    };
    const audit = { create: vi.fn() };
    const uc = new RegisterPlatformServiceUseCase(repo, outbox as never, audit as never);
    const result = await uc.execute({
      actorId: '10000000-0000-4000-8000-000000000001',
      serviceCode: 'edge-api',
      displayName: 'Edge API',
    });
    expect(result.serviceCode).toBe('edge-api');
    expect(audit.create).toHaveBeenCalled();
  });

  it('UpdatePlatformServiceUseCase rejects VERIFIED without verificationSource', async () => {
    const existing = baseService();
    const repo = {
      getById: vi.fn().mockResolvedValue(existing),
      updateService: vi.fn(),
    } as unknown as ServiceCatalogRepositoryPort;
    const uc = new UpdatePlatformServiceUseCase(repo, {} as never, {} as never);
    await expect(
      uc.execute({
        actorId: 'admin',
        id: existing.id,
        expectedVersion: 1,
        observationStatus: 'VERIFIED',
        metadata: {},
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

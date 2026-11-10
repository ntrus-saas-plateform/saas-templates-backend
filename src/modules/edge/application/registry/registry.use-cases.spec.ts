import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  CreateTechnicalVersionUseCase,
  EvaluateCompatibilityUseCase,
  RegisterProductUseCase,
  TransitionDeploymentProfileUseCase,
  TransitionProductRegistryUseCase,
} from './registry.use-cases.js';
import {
  CertificationStatus,
  CompatibilityResult,
  ControlContractStatus,
  DeploymentProfileCode,
  EnvironmentStatus,
  PlatformOperationalStatus,
  PlatformType,
  ProfileStatus,
  RegistryLifecycleStatus,
  RuntimeEnvironmentType,
  TechnicalVersionStatus,
} from '../../domain/registry/registry.types.js';

const FAKE_CLIENT = { kind: 'tx-client' };

function outboxOk() {
  const enqueue = vi.fn(async () => 'outbox-id');
  return {
    enqueue,
    runWithOutbox: vi.fn(async (_t: string, fn: (c: unknown, enqueue: unknown) => Promise<unknown>) =>
      fn(FAKE_CLIENT, enqueue),
    ),
  };
}

function auditOk() {
  return { create: vi.fn(async () => undefined) };
}

describe('P7.2 registry use-cases', () => {
  it('refuses register when canonical P1 product is missing', async () => {
    const repo = {
      getProductRegistryByProductId: vi.fn(),
      createProductRegistry: vi.fn(),
    };
    const products = { findById: vi.fn(async () => null) };
    const uc = new RegisterProductUseCase(
      repo as never,
      products as never,
      outboxOk() as never,
      auditOk() as never,
    );
    await expect(
      uc.execute({
        actorId: 'a1',
        productId: 'missing',
        code: 'X',
        name: 'X',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    expect(repo.createProductRegistry).not.toHaveBeenCalled();
  });

  it('registers product atomically in a single runWithOutbox', async () => {
    const created = {
      id: 'reg-1',
      productId: 'prod-1',
      code: 'CRM',
      registryStatus: RegistryLifecycleStatus.DRAFT,
      certificationStatus: CertificationStatus.UNCERTIFIED,
      provisionable: false,
    };
    const repo = {
      getProductRegistryByProductId: vi.fn(async () => null),
      createProductRegistry: vi.fn(async () => created),
      appendHistory: vi.fn(async () => ({})),
    };
    const products = { findById: vi.fn(async () => ({ id: 'prod-1' })) };
    const outbox = outboxOk();
    const audit = auditOk();
    const uc = new RegisterProductUseCase(
      repo as never,
      products as never,
      outbox as never,
      audit as never,
    );
    const result = await uc.execute({
      actorId: 'a1',
      productId: 'prod-1',
      code: 'CRM',
      name: 'CRM',
    });
    expect(result.id).toBe('reg-1');
    expect(outbox.runWithOutbox).toHaveBeenCalledTimes(1);
    expect(repo.createProductRegistry).toHaveBeenCalledWith(expect.any(Object), FAKE_CLIENT);
    expect(repo.appendHistory).toHaveBeenCalledWith(expect.any(Object), FAKE_CLIENT);
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'registry.product.registered' }),
      FAKE_CLIENT,
    );
  });

  it('fails closed when audit is unavailable after register', async () => {
    const repo = {
      getProductRegistryByProductId: vi.fn(async () => null),
      createProductRegistry: vi.fn(async () => ({
        id: 'reg-1',
        productId: 'prod-1',
        code: 'CRM',
        registryStatus: RegistryLifecycleStatus.DRAFT,
      })),
      appendHistory: vi.fn(async () => ({})),
    };
    const products = { findById: vi.fn(async () => ({ id: 'prod-1' })) };
    const audit = {
      create: vi.fn(async () => {
        throw new Error('audit down');
      }),
    };
    const uc = new RegisterProductUseCase(
      repo as never,
      products as never,
      outboxOk() as never,
      audit as never,
    );
    await expect(
      uc.execute({ actorId: 'a1', productId: 'prod-1', code: 'CRM', name: 'CRM' }),
    ).rejects.toMatchObject({ code: ErrorCode.DEPENDENCY_UNAVAILABLE });
  });

  it('certifies product and sets provisionable=true', async () => {
    const current = {
      id: 'reg-1',
      version: 1,
      registryStatus: RegistryLifecycleStatus.VALIDATING,
      certificationStatus: CertificationStatus.PENDING,
      provisionable: false,
    };
    const repo = {
      getProductRegistry: vi.fn(async () => current),
      updateProductRegistry: vi.fn(async (_id, patch) => ({
        ...current,
        ...patch,
        version: 2,
      })),
      appendHistory: vi.fn(async () => ({})),
    };
    const outbox = outboxOk();
    const audit = auditOk();
    const uc = new TransitionProductRegistryUseCase(
      repo as never,
      outbox as never,
      audit as never,
    );
    const updated = await uc.execute({
      actorId: 'a1',
      id: 'reg-1',
      toStatus: RegistryLifecycleStatus.CERTIFIED,
    });
    expect(updated.provisionable).toBe(true);
    expect(outbox.runWithOutbox).toHaveBeenCalledTimes(1);
    expect(repo.updateProductRegistry).toHaveBeenCalledWith(
      'reg-1',
      expect.objectContaining({
        registryStatus: RegistryLifecycleStatus.CERTIFIED,
        certificationStatus: CertificationStatus.CERTIFIED,
        provisionable: true,
      }),
      1,
      FAKE_CLIENT,
    );
    expect(audit.create).toHaveBeenCalledWith(expect.any(Object), FAKE_CLIENT);
  });

  it('rejects uncertified product as provisionable via transition rules', async () => {
    const current = {
      id: 'reg-1',
      version: 1,
      registryStatus: RegistryLifecycleStatus.DRAFT,
      certificationStatus: CertificationStatus.UNCERTIFIED,
      provisionable: false,
    };
    const repo = {
      getProductRegistry: vi.fn(async () => current),
      updateProductRegistry: vi.fn(),
    };
    const uc = new TransitionProductRegistryUseCase(
      repo as never,
      outboxOk() as never,
      auditOk() as never,
    );
    await expect(
      uc.execute({
        actorId: 'a1',
        id: 'reg-1',
        toStatus: RegistryLifecycleStatus.DEPRECATED,
        reason: 'no',
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('normalizes release channel and emits outbox on technical version create', async () => {
    const repo = {
      getProductRegistry: vi.fn(async () => ({ id: 'reg-1' })),
      createTechnicalVersion: vi.fn(async (input) => ({
        id: 'ver-1',
        ...input,
        versionStatus: TechnicalVersionStatus.DRAFT,
      })),
      appendHistory: vi.fn(async () => ({})),
    };
    const outbox = outboxOk();
    const audit = auditOk();
    const uc = new CreateTechnicalVersionUseCase(
      repo as never,
      outbox as never,
      audit as never,
    );
    const version = await uc.execute({
      actorId: 'a1',
      productRegistryId: 'reg-1',
      technicalVersion: '1.0.0',
      releaseChannel: 'stable',
    });
    expect(version.releaseChannel).toBe('STABLE');
    expect(outbox.runWithOutbox).toHaveBeenCalledTimes(1);
    expect(repo.createTechnicalVersion).toHaveBeenCalledWith(expect.any(Object), FAKE_CLIENT);
    expect(audit.create).toHaveBeenCalledWith(expect.any(Object), FAKE_CLIENT);
  });

  it('evaluates compatibility and refuses retired contracts in result', async () => {
    const product = {
      id: 'pr-1',
      productId: 'prod-1',
      registryStatus: RegistryLifecycleStatus.CERTIFIED,
      certificationStatus: CertificationStatus.CERTIFIED,
      provisionable: true,
      compatiblePlatformIds: ['plat-1'],
      version: 1,
    };
    const version = {
      id: 'ver-1',
      versionStatus: TechnicalVersionStatus.PUBLISHED,
      compatibleContractVersions: [],
      compatibleProfileCodes: ['SHARED_SAAS'],
      supportEndsAt: null,
      technicalVersion: '1.0.0',
    };
    const platform = {
      id: 'plat-1',
      code: 'p',
      operationalStatus: PlatformOperationalStatus.ACTIVE,
      certificationStatus: CertificationStatus.CERTIFIED,
      allowedProductIds: ['prod-1'],
      supportedEnvironmentTypes: ['PRODUCTION'],
      supportedProfileCodes: ['SHARED_SAAS'],
      platformType: PlatformType.SHARED_SAAS_PLATFORM,
      version: 1,
    };
    const environment = {
      id: 'env-1',
      platformId: 'plat-1',
      environmentType: RuntimeEnvironmentType.PRODUCTION,
      environmentStatus: EnvironmentStatus.ACTIVE,
      allowedProfileCodes: ['SHARED_SAAS'],
      securityClassification: 'HIGH',
      dataResidencyConstraints: { region: 'EU' },
      code: 'prod',
      version: 1,
    };
    const profile = {
      id: 'prof-1',
      code: DeploymentProfileCode.SHARED_SAAS,
      profileStatus: ProfileStatus.ACTIVE,
      certificationStatus: CertificationStatus.CERTIFIED,
      compatibleEnvironmentTypes: ['PRODUCTION'],
      profileVersion: 1,
    };
    const contract = {
      id: 'ctr-1',
      productId: 'prod-1',
      platformId: 'plat-1',
      contractStatus: ControlContractStatus.RETIRED,
      contractCode: 'c',
      contractVersion: '1',
    };
    const repo = {
      getProductRegistry: vi.fn(async () => product),
      getTechnicalVersion: vi.fn(async () => version),
      getPlatform: vi.fn(async () => platform),
      getEnvironment: vi.fn(async () => environment),
      getProfile: vi.fn(async () => profile),
      getContract: vi.fn(async () => contract),
      saveCompatibilityEvaluation: vi.fn(async (e) => ({ id: 'eval-1', ...e })),
    };
    const outbox = outboxOk();
    const audit = auditOk();
    const uc = new EvaluateCompatibilityUseCase(
      repo as never,
      outbox as never,
      audit as never,
    );
    const result = await uc.execute({
      actorId: 'a1',
      productRegistryId: 'pr-1',
      technicalVersionId: 'ver-1',
      platformId: 'plat-1',
      environmentId: 'env-1',
      profileId: 'prof-1',
      contractId: 'ctr-1',
    });
    expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
    expect(outbox.runWithOutbox).toHaveBeenCalledTimes(1);
    expect(repo.saveCompatibilityEvaluation).toHaveBeenCalledWith(expect.any(Object), FAKE_CLIENT);
    expect(audit.create).toHaveBeenCalledWith(expect.any(Object), FAKE_CLIENT);
  });

  it('does not auto-certify deployment profile when transitioning to ACTIVE', async () => {
    const current = {
      id: 'prof-1',
      code: DeploymentProfileCode.SHARED_SAAS,
      profileStatus: ProfileStatus.VALIDATING,
      certificationStatus: CertificationStatus.UNCERTIFIED,
    };
    const repo = {
      getProfile: vi.fn(async () => current),
      updateProfile: vi.fn(async (_id, patch) => ({ ...current, ...patch })),
      appendHistory: vi.fn(async () => ({})),
    };
    const outbox = outboxOk();
    const audit = auditOk();
    const uc = new TransitionDeploymentProfileUseCase(
      repo as never,
      outbox as never,
      audit as never,
    );
    await uc.execute({
      actorId: 'a1',
      id: 'prof-1',
      toStatus: ProfileStatus.ACTIVE,
    });
    expect(repo.updateProfile).toHaveBeenCalledWith(
      'prof-1',
      expect.objectContaining({
        profileStatus: ProfileStatus.ACTIVE,
        updatedBy: 'a1',
      }),
      FAKE_CLIENT,
    );
    const patch = repo.updateProfile.mock.calls[0][1] as Record<string, unknown>;
    expect(patch).not.toHaveProperty('certificationStatus');
  });
});

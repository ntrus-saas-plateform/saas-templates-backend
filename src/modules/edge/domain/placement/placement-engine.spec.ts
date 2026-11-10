import { describe, expect, it } from 'vitest';
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
  type DeploymentProfile,
  type ProductControlContract,
  type ProductPlatform,
  type ProductRegistryRecord,
  type ProductTechnicalVersion,
  type RuntimeEnvironment,
} from '../registry/registry.types.js';
import { evaluatePlacement } from './placement-engine.js';
import {
  CapacityInventoryStatus,
  CapacityMeasurementSource,
  CapacityResourceType,
  PlacementDecisionStatus,
  PlacementPolicyStatus,
  PlacementRequestStatus,
  type CapacityInventoryRecord,
  type PlacementPolicyRecord,
  type PlacementRequestRecord,
} from './placement.types.js';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function baseProduct(over: Partial<ProductRegistryRecord> = {}): ProductRegistryRecord {
  return {
    id: 'pr-1',
    productId: 'prod-1',
    code: 'CRM',
    name: 'CRM',
    description: null,
    verticalCategory: null,
    registryStatus: RegistryLifecycleStatus.CERTIFIED,
    certificationStatus: CertificationStatus.CERTIFIED,
    provisionable: true,
    technicalConstraints: {},
    declaredCapabilities: [],
    compatiblePlatformIds: ['plat-1'],
    compatibleEnvironmentIds: ['env-1'],
    compatibleProfileIds: ['prof-1'],
    compatibleContractIds: ['ctr-1'],
    metadata: {},
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function baseVersion(
  over: Partial<ProductTechnicalVersion> = {},
): ProductTechnicalVersion {
  return {
    id: 'ver-1',
    productRegistryId: 'pr-1',
    technicalVersion: '1.0.0',
    releaseChannel: 'STABLE',
    versionStatus: TechnicalVersionStatus.PUBLISHED,
    compatibleContractVersions: ['1.0.0'],
    compatibleProfileCodes: ['SHARED_SAAS'],
    compatibleRuntimeTypes: ['PRODUCTION'],
    schemaCompatibility: {},
    apiCompatibility: {},
    availableFrom: NOW,
    supportEndsAt: null,
    certificationMetadata: {},
    changeSummary: null,
    immutableAfterPublish: true,
    metadata: {},
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function basePlatform(over: Partial<ProductPlatform> = {}): ProductPlatform {
  return {
    id: 'plat-1',
    code: 'shared-1',
    name: 'Shared',
    description: null,
    platformType: PlatformType.SHARED_SAAS_PLATFORM,
    businessBackendId: null,
    allowedProductIds: ['prod-1'],
    supportedEnvironmentTypes: ['PRODUCTION'],
    supportedProfileCodes: ['SHARED_SAAS'],
    connectivityReference: null,
    secureConfigRef: null,
    integrationProtocolVersion: null,
    controlContractVersion: null,
    certificationStatus: CertificationStatus.CERTIFIED,
    operationalStatus: PlatformOperationalStatus.ACTIVE,
    declaredCapabilities: [],
    constraints: {},
    metadata: {},
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function baseEnv(over: Partial<RuntimeEnvironment> = {}): RuntimeEnvironment {
  return {
    id: 'env-1',
    platformId: 'plat-1',
    code: 'prod-eu',
    name: 'Prod EU',
    environmentType: RuntimeEnvironmentType.PRODUCTION,
    region: 'eu-west-1',
    geoZone: 'EU',
    securityClassification: 'HIGH',
    dataClassification: 'PII',
    availableCapabilities: [],
    dataResidencyConstraints: { region: 'EU' },
    backupPolicy: {},
    availabilityPolicy: {},
    allowedProfileCodes: ['SHARED_SAAS'],
    environmentStatus: EnvironmentStatus.ACTIVE,
    governanceMetadata: {},
    metadata: {},
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function baseProfile(over: Partial<DeploymentProfile> = {}): DeploymentProfile {
  return {
    id: 'prof-1',
    code: DeploymentProfileCode.SHARED_SAAS,
    name: 'Shared SaaS',
    description: null,
    technicalRequirements: {},
    securityRequirements: {},
    isolationModel: 'LOGICAL',
    connectivityModel: 'EDGE',
    networkConstraints: {},
    dataResidencyConstraints: {},
    backupRequirements: {},
    availabilityRequirements: {},
    disasterRecoveryRequirements: {},
    compatibleProductIds: ['prod-1'],
    compatiblePlatformTypes: [PlatformType.SHARED_SAAS_PLATFORM],
    compatibleEnvironmentTypes: ['PRODUCTION'],
    certificationStatus: CertificationStatus.CERTIFIED,
    profileStatus: ProfileStatus.ACTIVE,
    profileVersion: 1,
    metadata: {},
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function baseContract(over: Partial<ProductControlContract> = {}): ProductControlContract {
  return {
    id: 'ctr-1',
    productId: 'prod-1',
    platformId: 'plat-1',
    contractCode: 'ctrl-v1',
    contractVersion: '1.0.0',
    schemaVersion: '1',
    supportedCapabilities: [],
    supportedControlOperations: [],
    connectivityModel: 'EDGE',
    s2sAuthPolicy: {},
    signatureRequirements: {},
    publishedEvents: [],
    consumedEvents: [],
    backwardCompatible: true,
    forwardCompatible: false,
    versioningPolicy: {},
    effectiveFrom: NOW,
    deprecatedAt: null,
    contractStatus: ControlContractStatus.PUBLISHED,
    certificationEvidence: {},
    immutable: true,
    metadata: {},
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function baseRequest(over: Partial<PlacementRequestRecord> = {}): PlacementRequestRecord {
  return {
    id: 'preq-1',
    idempotencyKey: 'idem-1',
    correlationId: 'corr-1',
    causationId: null,
    provisioningRequestId: 'prov-1',
    authorizationRowId: 'auth-row-1',
    authorizationId: 'auth-1',
    authorizationVersion: 1,
    accountId: 'acc-1',
    subscriptionId: 'sub-1',
    productId: 'prod-1',
    productTenantId: null,
    productRegistryId: 'pr-1',
    technicalVersionId: 'ver-1',
    platformId: null,
    contractId: 'ctr-1',
    deploymentProfileId: 'prof-1',
    requestedEnvironmentType: 'PRODUCTION',
    requestedDeploymentModel: 'SHARED_SAAS',
    requestedRegion: 'eu-west-1',
    dataResidencyConstraints: { region: 'EU' },
    securityClassification: 'HIGH',
    availabilityRequirements: {},
    recoveryRequirements: {},
    capacityRequirements: { [CapacityResourceType.TENANT_SLOT]: 1 },
    requestStatus: PlacementRequestStatus.PENDING,
    actorId: 'actor-1',
    createdBy: 'actor-1',
    updatedBy: 'actor-1',
    version: 1,
    metadata: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function basePolicy(over: Partial<PlacementPolicyRecord> = {}): PlacementPolicyRecord {
  return {
    id: 'pol-1',
    code: 'default',
    name: 'Default',
    description: null,
    policyVersion: 1,
    scope: { productIds: ['prod-1'] },
    hardConstraints: { requireCertifiedProfile: true },
    scoringWeights: {
      regionMatch: 10,
      capacityHeadroom: 5,
      preferredPlatform: 8,
      compatibilityBonus: 20,
    },
    algorithmVersion: '1.0.0',
    policyStatus: PlacementPolicyStatus.ACTIVE,
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function baseCapacity(
  over: Partial<CapacityInventoryRecord> = {},
): CapacityInventoryRecord {
  return {
    id: 'cap-1',
    platformId: 'plat-1',
    environmentId: 'env-1',
    resourceType: CapacityResourceType.TENANT_SLOT,
    unit: 'slot',
    totalCapacity: 10,
    unavailableCapacity: 0,
    reservedCapacity: 0,
    allocatedCapacity: 0,
    availableCapacity: 10,
    measurementSource: CapacityMeasurementSource.DECLARED,
    measuredAt: NOW,
    validUntil: new Date('2026-12-01T00:00:00.000Z'),
    capacityStatus: CapacityInventoryStatus.ACTIVE,
    version: 1,
    metadata: {},
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function run(over: {
  request?: Partial<PlacementRequestRecord>;
  product?: Partial<ProductRegistryRecord>;
  version?: Partial<ProductTechnicalVersion>;
  platforms?: ProductPlatform[];
  environments?: RuntimeEnvironment[];
  profiles?: DeploymentProfile[];
  contracts?: ProductControlContract[];
  capacityRows?: CapacityInventoryRecord[];
  policy?: PlacementPolicyRecord | null;
  compatibility?: CompatibilityResult;
}) {
  return evaluatePlacement({
    request: baseRequest(over.request),
    product: baseProduct(over.product),
    version: baseVersion(over.version),
    platforms: over.platforms ?? [basePlatform()],
    environments: over.environments ?? [baseEnv()],
    profiles: over.profiles ?? [baseProfile()],
    contracts: over.contracts ?? [baseContract()],
    capacityRows: over.capacityRows ?? [baseCapacity()],
    policy: over.policy === undefined ? basePolicy() : over.policy,
    now: NOW,
    compatibility: () => over.compatibility ?? CompatibilityResult.COMPATIBLE,
  });
}

describe('evaluatePlacement — happy path', () => {
  it('places when certified, compatible, and capacity is fresh+sufficient', () => {
    const result = run({});
    expect(result.decisionStatus).toBe(PlacementDecisionStatus.PLACED);
    expect(result.selected).toMatchObject({
      platformId: 'plat-1',
      environmentId: 'env-1',
      profileId: 'prof-1',
      contractId: 'ctr-1',
    });
    expect(result.candidates.some((c) => c.placeable)).toBe(true);
  });

  it('tie-breaks by environment.id ASC then platform.id ASC at equal score', () => {
    const envA = baseEnv({ id: 'env-a', code: 'a' });
    const envB = baseEnv({ id: 'env-b', code: 'b' });
    const product = baseProduct({
      compatibleEnvironmentIds: ['env-a', 'env-b'],
      compatiblePlatformIds: ['plat-1'],
    });
    const result = evaluatePlacement({
      request: baseRequest({
        platformId: null,
        requestedRegion: null,
        deploymentProfileId: 'prof-1',
        dataResidencyConstraints: {},
        securityClassification: null,
      }),
      product,
      version: baseVersion(),
      platforms: [basePlatform()],
      environments: [envB, envA],
      profiles: [baseProfile()],
      contracts: [baseContract()],
      capacityRows: [
        baseCapacity({ id: 'c-a', environmentId: 'env-a' }),
        baseCapacity({ id: 'c-b', environmentId: 'env-b' }),
      ],
      policy: basePolicy({
        scoringWeights: {
          regionMatch: 0,
          capacityHeadroom: 0,
          preferredPlatform: 0,
          compatibilityBonus: 0,
        },
      }),
      now: NOW,
      compatibility: () => CompatibilityResult.COMPATIBLE,
    });
    expect(result.decisionStatus).toBe(PlacementDecisionStatus.PLACED);
    expect(result.selected?.environmentId).toBe('env-a');
  });
});

describe('evaluatePlacement — negative / fail-closed', () => {
  it('REQUIRES_REVIEW when product allowlists are empty (never PLACED)', () => {
    const result = run({
      product: {
        compatiblePlatformIds: [],
        compatibleEnvironmentIds: [],
        compatibleProfileIds: [],
        compatibleContractIds: [],
      },
    });
    expect(result.decisionStatus).toBe(PlacementDecisionStatus.REQUIRES_REVIEW);
    expect(result.selected).toBeNull();
  });

  it('REQUIRES_REVIEW when policy productIds allowlist is empty', () => {
    const result = run({
      policy: basePolicy({ scope: { productIds: [] } }),
    });
    expect(result.decisionStatus).toBe(PlacementDecisionStatus.REQUIRES_REVIEW);
  });

  it('REQUIRES_REVIEW when compatibility is REQUIRES_REVIEW', () => {
    const result = run({ compatibility: CompatibilityResult.REQUIRES_REVIEW });
    expect(result.decisionStatus).toBe(PlacementDecisionStatus.REQUIRES_REVIEW);
    expect(result.selected).toBeNull();
  });

  it('NO_COMPATIBLE_TARGET when compatibility is INCOMPATIBLE', () => {
    const result = run({ compatibility: CompatibilityResult.INCOMPATIBLE });
    expect(result.decisionStatus).toBe(PlacementDecisionStatus.NO_COMPATIBLE_TARGET);
  });

  it('NO_CAPACITY when inventory row is missing (not unlimited)', () => {
    const result = run({ capacityRows: [] });
    expect(result.decisionStatus).toBe(PlacementDecisionStatus.NO_CAPACITY);
    expect(
      result.candidates.some((c) =>
        c.hardConstraintFailures.some((f) => f.startsWith('CAPACITY_MISSING')),
      ),
    ).toBe(true);
  });

  it('NO_CAPACITY when available is insufficient', () => {
    const result = run({
      capacityRows: [
        baseCapacity({
          totalCapacity: 1,
          reservedCapacity: 1,
          availableCapacity: 0,
        }),
      ],
      request: { capacityRequirements: { TENANT_SLOT: 1 } },
    });
    expect(result.decisionStatus).toBe(PlacementDecisionStatus.NO_CAPACITY);
  });

  it('NO_CAPACITY when capacity is stale', () => {
    const result = run({
      capacityRows: [
        baseCapacity({
          validUntil: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ],
    });
    expect(result.decisionStatus).toBe(PlacementDecisionStatus.NO_CAPACITY);
    expect(
      result.candidates.some((c) =>
        c.hardConstraintFailures.some((f) => f.startsWith('CAPACITY_STALE')),
      ),
    ).toBe(true);
  });

  it('rejects uncertified product', () => {
    const result = run({
      product: {
        registryStatus: RegistryLifecycleStatus.DRAFT,
        certificationStatus: CertificationStatus.UNCERTIFIED,
        provisionable: false,
      },
    });
    expect(result.decisionStatus).toBe(PlacementDecisionStatus.NO_COMPATIBLE_TARGET);
    expect(
      result.candidates.every((c) =>
        c.hardConstraintFailures.includes('PRODUCT_NOT_CERTIFIED_PROVISIONABLE'),
      ),
    ).toBe(true);
  });

  it('rejects non-PUBLISHED technical version', () => {
    const result = run({
      version: { versionStatus: TechnicalVersionStatus.DRAFT },
    });
    expect(result.decisionStatus).toBe(PlacementDecisionStatus.NO_COMPATIBLE_TARGET);
  });

  it('rejects inactive platform', () => {
    const result = run({
      platforms: [
        basePlatform({ operationalStatus: PlatformOperationalStatus.SUSPENDED }),
      ],
    });
    expect(result.decisionStatus).toBe(PlacementDecisionStatus.NO_COMPATIBLE_TARGET);
  });

  it('rejects inactive environment', () => {
    const result = run({
      environments: [baseEnv({ environmentStatus: EnvironmentStatus.DRAFT })],
    });
    expect(result.decisionStatus).toBe(PlacementDecisionStatus.NO_COMPATIBLE_TARGET);
  });

  it('rejects uncertified profile for PRODUCTION', () => {
    const result = run({
      profiles: [
        baseProfile({ certificationStatus: CertificationStatus.UNCERTIFIED }),
      ],
    });
    expect(result.decisionStatus).toBe(PlacementDecisionStatus.NO_COMPATIBLE_TARGET);
    expect(
      result.candidates.some((c) =>
        c.hardConstraintFailures.includes('PROFILE_UNCERTIFIED_PRODUCTION'),
      ),
    ).toBe(true);
  });

  it('fails residency mismatch', () => {
    const result = run({
      environments: [baseEnv({ dataResidencyConstraints: { region: 'US' }, region: 'us-east-1' })],
      request: { requestedRegion: null, dataResidencyConstraints: { region: 'EU' } },
    });
    expect(result.decisionStatus).toBe(PlacementDecisionStatus.NO_COMPATIBLE_TARGET);
    expect(
      result.candidates.some((c) =>
        c.hardConstraintFailures.includes('DATA_RESIDENCY_MISMATCH'),
      ),
    ).toBe(true);
  });

  it('fails security classification mismatch', () => {
    const result = run({
      environments: [baseEnv({ securityClassification: 'LOW' })],
      request: { securityClassification: 'HIGH' },
    });
    expect(result.decisionStatus).toBe(PlacementDecisionStatus.NO_COMPATIBLE_TARGET);
  });

  it('NO_COMPATIBLE_TARGET when no candidates match environment type', () => {
    const result = run({
      request: { requestedEnvironmentType: 'STAGING' },
    });
    expect(result.decisionStatus).toBe(PlacementDecisionStatus.NO_COMPATIBLE_TARGET);
    expect(result.candidates).toHaveLength(0);
  });

  it('policy product out of scope is hard reject', () => {
    const result = run({
      policy: basePolicy({ scope: { productIds: ['other-prod'] } }),
    });
    expect(result.decisionStatus).toBe(PlacementDecisionStatus.NO_COMPATIBLE_TARGET);
  });

  it('does not score excluded / failed candidates', () => {
    const result = run({ compatibility: CompatibilityResult.INCOMPATIBLE });
    for (const c of result.candidates) {
      expect(c.score).toBeNull();
      expect(c.rank).toBeNull();
    }
  });

  it('missing precomputed compatibility evidence is never COMPATIBLE', () => {
    const result = evaluatePlacement({
      request: baseRequest(),
      product: baseProduct(),
      version: baseVersion(),
      platforms: [basePlatform()],
      environments: [baseEnv()],
      profiles: [baseProfile()],
      contracts: [baseContract()],
      capacityRows: [baseCapacity()],
      policy: basePolicy(),
      now: NOW,
      compatibility: [],
    });
    expect(result.decisionStatus).toBe(PlacementDecisionStatus.REQUIRES_REVIEW);
  });
});

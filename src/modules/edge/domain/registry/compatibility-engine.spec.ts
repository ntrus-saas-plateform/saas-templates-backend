import { evaluateRegistryCompatibility } from './compatibility-engine.js';
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
} from './registry.types.js';

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
    compatibleEnvironmentIds: [],
    compatibleProfileIds: [],
    compatibleContractIds: [],
    metadata: {},
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
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
    compatibleRuntimeTypes: [],
    schemaCompatibility: {},
    apiCompatibility: {},
    availableFrom: new Date(),
    supportEndsAt: null,
    certificationMetadata: {},
    changeSummary: null,
    immutableAfterPublish: true,
    metadata: {},
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    compatibleProductIds: [],
    compatiblePlatformTypes: [],
    compatibleEnvironmentTypes: ['PRODUCTION'],
    certificationStatus: CertificationStatus.CERTIFIED,
    profileStatus: ProfileStatus.ACTIVE,
    profileVersion: 1,
    metadata: {},
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function baseContract(over: Partial<ProductControlContract> = {}): ProductControlContract {
  return {
    id: 'ctr-1',
    productId: 'prod-1',
    platformId: 'plat-1',
    contractCode: 'crm-ctrl',
    contractVersion: '1.0.0',
    schemaVersion: '1',
    supportedCapabilities: [],
    supportedControlOperations: [],
    connectivityModel: 'S2S',
    s2sAuthPolicy: {},
    signatureRequirements: {},
    publishedEvents: [],
    consumedEvents: [],
    backwardCompatible: true,
    forwardCompatible: false,
    versioningPolicy: {},
    effectiveFrom: new Date(),
    deprecatedAt: null,
    contractStatus: ControlContractStatus.PUBLISHED,
    certificationEvidence: {},
    immutable: true,
    metadata: {},
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

describe('evaluateRegistryCompatibility', () => {
  it('returns COMPATIBLE for fully certified stack', () => {
    const result = evaluateRegistryCompatibility({
      product: baseProduct(),
      technicalVersion: baseVersion(),
      platform: basePlatform(),
      environment: baseEnv(),
      profile: baseProfile(),
      contract: baseContract(),
    });
    expect(result.result).toBe(CompatibilityResult.COMPATIBLE);
    expect(result.reasons).toEqual([]);
  });

  it('rejects uncertified product', () => {
    const result = evaluateRegistryCompatibility({
      product: baseProduct({
        registryStatus: RegistryLifecycleStatus.DRAFT,
        certificationStatus: CertificationStatus.UNCERTIFIED,
        provisionable: false,
      }),
      technicalVersion: baseVersion(),
      platform: basePlatform(),
      environment: baseEnv(),
      profile: baseProfile(),
      contract: baseContract(),
    });
    expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
    expect(result.reasons.some((r) => r.includes('not certified'))).toBe(true);
  });

  it('rejects suspended platform', () => {
    const result = evaluateRegistryCompatibility({
      product: baseProduct(),
      technicalVersion: baseVersion(),
      platform: basePlatform({
        operationalStatus: PlatformOperationalStatus.SUSPENDED,
      }),
      environment: baseEnv(),
      profile: baseProfile(),
      contract: baseContract(),
    });
    expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
  });

  it('rejects retired contract', () => {
    const result = evaluateRegistryCompatibility({
      product: baseProduct(),
      technicalVersion: baseVersion(),
      platform: basePlatform(),
      environment: baseEnv(),
      profile: baseProfile(),
      contract: baseContract({ contractStatus: ControlContractStatus.RETIRED }),
    });
    expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
  });

  it('does not imply compatibility when product not allowlisted', () => {
    const result = evaluateRegistryCompatibility({
      product: baseProduct({ compatiblePlatformIds: [] }),
      technicalVersion: baseVersion(),
      platform: basePlatform({ allowedProductIds: [] }),
      environment: baseEnv(),
      profile: baseProfile(),
      contract: baseContract(),
    });
    expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
  });
});

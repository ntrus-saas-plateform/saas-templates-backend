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
    compatibleEnvironmentIds: ['env-1'],
    compatibleProfileIds: ['prof-1'],
    compatibleContractIds: ['ctr-1'],
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
    compatibleRuntimeTypes: ['PRODUCTION'],
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
    compatibleProductIds: ['prod-1'],
    compatiblePlatformTypes: [PlatformType.SHARED_SAAS_PLATFORM],
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

function evaluate(
  over: {
    product?: Partial<ProductRegistryRecord>;
    technicalVersion?: Partial<ProductTechnicalVersion>;
    platform?: Partial<ProductPlatform>;
    environment?: Partial<RuntimeEnvironment>;
    profile?: Partial<DeploymentProfile>;
    contract?: Partial<ProductControlContract>;
    now?: Date;
  } = {},
) {
  return evaluateRegistryCompatibility({
    product: baseProduct(over.product),
    technicalVersion: baseVersion(over.technicalVersion),
    platform: basePlatform(over.platform),
    environment: baseEnv(over.environment),
    profile: baseProfile(over.profile),
    contract: baseContract(over.contract),
    now: over.now,
  });
}

describe('evaluateRegistryCompatibility (fail-closed)', () => {
  it('returns COMPATIBLE for fully declared certified stack', () => {
    const result = evaluate();
    expect(result.result).toBe(CompatibilityResult.COMPATIBLE);
    expect(result.reasons).toEqual([]);
  });

  describe('blockers', () => {
    it('rejects uncertified / non-provisionable product', () => {
      const result = evaluate({
        product: {
          registryStatus: RegistryLifecycleStatus.DRAFT,
          certificationStatus: CertificationStatus.UNCERTIFIED,
          provisionable: false,
        },
      });
      expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
      expect(result.reasons.some((r) => r.includes('not certified'))).toBe(true);
    });

    it('rejects non-PUBLISHED technical version', () => {
      const result = evaluate({
        technicalVersion: { versionStatus: TechnicalVersionStatus.DRAFT },
      });
      expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('rejects ended support window', () => {
      const result = evaluate({
        technicalVersion: { supportEndsAt: new Date('2020-01-01') },
        now: new Date('2024-01-01'),
      });
      expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
      expect(result.reasons.some((r) => r.includes('support window'))).toBe(true);
    });

    it('rejects suspended platform', () => {
      const result = evaluate({
        platform: { operationalStatus: PlatformOperationalStatus.SUSPENDED },
      });
      expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('rejects inactive environment', () => {
      const result = evaluate({
        environment: { environmentStatus: EnvironmentStatus.SUSPENDED },
      });
      expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('rejects environment not belonging to platform', () => {
      const result = evaluate({
        environment: { platformId: 'other-plat' },
      });
      expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('rejects uncertified profile on PRODUCTION', () => {
      const result = evaluate({
        profile: { certificationStatus: CertificationStatus.UNCERTIFIED },
      });
      expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
      expect(result.reasons.some((r) => r.includes('PRODUCTION'))).toBe(true);
    });

    it('rejects inactive profile', () => {
      const result = evaluate({
        profile: { profileStatus: ProfileStatus.SUSPENDED },
      });
      expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('rejects contract product mismatch', () => {
      const result = evaluate({ contract: { productId: 'other' } });
      expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('rejects contract platform mismatch', () => {
      const result = evaluate({ contract: { platformId: 'other' } });
      expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('rejects retired contract', () => {
      const result = evaluate({
        contract: { contractStatus: ControlContractStatus.RETIRED },
      });
      expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('rejects deprecated contract', () => {
      const result = evaluate({
        contract: { contractStatus: ControlContractStatus.DEPRECATED },
      });
      expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('rejects mutual allowlist mismatch when both lists declared', () => {
      const result = evaluate({
        product: { compatiblePlatformIds: ['other-plat'] },
        platform: { allowedProductIds: ['other-prod'] },
      });
      expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('rejects platform allowlist without product when both declared', () => {
      const result = evaluate({
        platform: { allowedProductIds: ['other-prod'] },
      });
      expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('rejects product platform list without platform when both declared', () => {
      const result = evaluate({
        product: { compatiblePlatformIds: ['other-plat'] },
      });
      expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
    });
  });

  describe('empty allowlists → REQUIRES_REVIEW', () => {
    it('product↔platform when either allowlist empty', () => {
      expect(
        evaluate({
          product: { compatiblePlatformIds: [] },
          platform: { allowedProductIds: ['prod-1'] },
        }).result,
      ).toBe(CompatibilityResult.REQUIRES_REVIEW);

      expect(
        evaluate({
          product: { compatiblePlatformIds: ['plat-1'] },
          platform: { allowedProductIds: [] },
        }).result,
      ).toBe(CompatibilityResult.REQUIRES_REVIEW);

      expect(
        evaluate({
          product: { compatiblePlatformIds: [] },
          platform: { allowedProductIds: [] },
        }).result,
      ).toBe(CompatibilityResult.REQUIRES_REVIEW);
    });

    it('platform.supportedEnvironmentTypes empty', () => {
      expect(
        evaluate({ platform: { supportedEnvironmentTypes: [] } }).result,
      ).toBe(CompatibilityResult.REQUIRES_REVIEW);
    });

    it('product.compatibleProfileIds empty', () => {
      expect(evaluate({ product: { compatibleProfileIds: [] } }).result).toBe(
        CompatibilityResult.REQUIRES_REVIEW,
      );
    });

    it('product.compatibleEnvironmentIds empty', () => {
      expect(evaluate({ product: { compatibleEnvironmentIds: [] } }).result).toBe(
        CompatibilityResult.REQUIRES_REVIEW,
      );
    });

    it('product.compatibleContractIds empty', () => {
      expect(evaluate({ product: { compatibleContractIds: [] } }).result).toBe(
        CompatibilityResult.REQUIRES_REVIEW,
      );
    });

    it('platform.supportedProfileCodes empty', () => {
      expect(evaluate({ platform: { supportedProfileCodes: [] } }).result).toBe(
        CompatibilityResult.REQUIRES_REVIEW,
      );
    });

    it('environment.allowedProfileCodes empty', () => {
      expect(evaluate({ environment: { allowedProfileCodes: [] } }).result).toBe(
        CompatibilityResult.REQUIRES_REVIEW,
      );
    });

    it('version.compatibleProfileCodes empty', () => {
      expect(
        evaluate({ technicalVersion: { compatibleProfileCodes: [] } }).result,
      ).toBe(CompatibilityResult.REQUIRES_REVIEW);
    });

    it('version.compatibleRuntimeTypes empty', () => {
      expect(
        evaluate({ technicalVersion: { compatibleRuntimeTypes: [] } }).result,
      ).toBe(CompatibilityResult.REQUIRES_REVIEW);
    });

    it('version.compatibleContractVersions empty', () => {
      expect(
        evaluate({ technicalVersion: { compatibleContractVersions: [] } }).result,
      ).toBe(CompatibilityResult.REQUIRES_REVIEW);
    });

    it('profile.compatibleProductIds empty', () => {
      expect(evaluate({ profile: { compatibleProductIds: [] } }).result).toBe(
        CompatibilityResult.REQUIRES_REVIEW,
      );
    });

    it('profile.compatiblePlatformTypes empty', () => {
      expect(evaluate({ profile: { compatiblePlatformTypes: [] } }).result).toBe(
        CompatibilityResult.REQUIRES_REVIEW,
      );
    });

    it('profile.compatibleEnvironmentTypes empty', () => {
      expect(evaluate({ profile: { compatibleEnvironmentTypes: [] } }).result).toBe(
        CompatibilityResult.REQUIRES_REVIEW,
      );
    });
  });

  describe('non-empty allowlists without match → INCOMPATIBLE', () => {
    it('platform.supportedEnvironmentTypes mismatch', () => {
      expect(
        evaluate({ platform: { supportedEnvironmentTypes: ['STAGING'] } }).result,
      ).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('product.compatibleProfileIds mismatch', () => {
      expect(
        evaluate({ product: { compatibleProfileIds: ['other-prof'] } }).result,
      ).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('product.compatibleEnvironmentIds mismatch', () => {
      expect(
        evaluate({ product: { compatibleEnvironmentIds: ['other-env'] } }).result,
      ).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('product.compatibleContractIds mismatch', () => {
      expect(
        evaluate({ product: { compatibleContractIds: ['other-ctr'] } }).result,
      ).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('platform.supportedProfileCodes mismatch', () => {
      expect(
        evaluate({ platform: { supportedProfileCodes: ['ON_PREMISE'] } }).result,
      ).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('environment.allowedProfileCodes mismatch', () => {
      expect(
        evaluate({ environment: { allowedProfileCodes: ['ON_PREMISE'] } }).result,
      ).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('version.compatibleProfileCodes mismatch', () => {
      expect(
        evaluate({
          technicalVersion: { compatibleProfileCodes: ['ON_PREMISE'] },
        }).result,
      ).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('version.compatibleRuntimeTypes mismatch', () => {
      expect(
        evaluate({
          technicalVersion: { compatibleRuntimeTypes: ['STAGING'] },
        }).result,
      ).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('version.compatibleContractVersions mismatch', () => {
      expect(
        evaluate({
          technicalVersion: { compatibleContractVersions: ['9.9.9'] },
        }).result,
      ).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('profile.compatibleProductIds mismatch', () => {
      expect(
        evaluate({ profile: { compatibleProductIds: ['other-prod'] } }).result,
      ).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('profile.compatiblePlatformTypes mismatch', () => {
      expect(
        evaluate({
          profile: { compatiblePlatformTypes: [PlatformType.ON_PREMISE_PLATFORM] },
        }).result,
      ).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('profile.compatibleEnvironmentTypes mismatch', () => {
      expect(
        evaluate({
          profile: { compatibleEnvironmentTypes: ['STAGING'] },
        }).result,
      ).toBe(CompatibilityResult.INCOMPATIBLE);
    });
  });

  describe('contract status by environment', () => {
    it('PRODUCTION + CERTIFIED alone → REQUIRES_REVIEW', () => {
      const result = evaluate({
        contract: { contractStatus: ControlContractStatus.CERTIFIED },
      });
      expect(result.result).toBe(CompatibilityResult.REQUIRES_REVIEW);
    });

    it('PRODUCTION + PUBLISHED → COMPATIBLE', () => {
      expect(evaluate().result).toBe(CompatibilityResult.COMPATIBLE);
    });

    it('non-prod + CERTIFIED → COMPATIBLE', () => {
      const result = evaluate({
        environment: {
          environmentType: RuntimeEnvironmentType.STAGING,
          securityClassification: null,
          dataResidencyConstraints: {},
        },
        platform: { supportedEnvironmentTypes: ['STAGING'] },
        technicalVersion: { compatibleRuntimeTypes: ['STAGING'] },
        profile: { compatibleEnvironmentTypes: ['STAGING'] },
        contract: { contractStatus: ControlContractStatus.CERTIFIED },
      });
      expect(result.result).toBe(CompatibilityResult.COMPATIBLE);
    });
  });

  describe('capabilities', () => {
    it('product caps with empty platform/env lists → REQUIRES_REVIEW', () => {
      const result = evaluate({
        product: { declaredCapabilities: ['billing'] },
        platform: { declaredCapabilities: [] },
        environment: { availableCapabilities: [] },
      });
      expect(result.result).toBe(CompatibilityResult.REQUIRES_REVIEW);
    });

    it('product caps missing from platform/env → INCOMPATIBLE', () => {
      const result = evaluate({
        product: { declaredCapabilities: ['billing', 'sso'] },
        platform: { declaredCapabilities: ['billing'] },
        environment: { availableCapabilities: ['billing'] },
      });
      expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('product caps present on platform and env → COMPATIBLE', () => {
      const result = evaluate({
        product: { declaredCapabilities: ['billing'] },
        platform: { declaredCapabilities: ['billing', 'sso'] },
        environment: { availableCapabilities: ['billing'] },
      });
      expect(result.result).toBe(CompatibilityResult.COMPATIBLE);
    });
  });

  describe('PRODUCTION security declarations', () => {
    it('missing securityClassification → REQUIRES_REVIEW', () => {
      expect(
        evaluate({ environment: { securityClassification: null } }).result,
      ).toBe(CompatibilityResult.REQUIRES_REVIEW);
    });

    it('missing dataResidencyConstraints → REQUIRES_REVIEW', () => {
      expect(
        evaluate({ environment: { dataResidencyConstraints: {} } }).result,
      ).toBe(CompatibilityResult.REQUIRES_REVIEW);
    });
  });

  describe('profile policy requirements', () => {
    it('securityRequirements with empty env classification → REQUIRES_REVIEW', () => {
      const result = evaluate({
        profile: { securityRequirements: { classification: 'HIGH' } },
        environment: {
          // keep residency so PRODUCTION residency rule passes; drop classification
          securityClassification: null,
        },
      });
      expect(result.result).toBe(CompatibilityResult.REQUIRES_REVIEW);
    });

    it('securityRequirements mismatch → INCOMPATIBLE', () => {
      const result = evaluate({
        profile: { securityRequirements: { classification: 'TOP_SECRET' } },
        environment: { securityClassification: 'HIGH' },
      });
      expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('dataResidencyConstraints with empty env policy → REQUIRES_REVIEW', () => {
      // Use STAGING to avoid PRODUCTION residency declaration rule conflating
      const result = evaluate({
        environment: {
          environmentType: RuntimeEnvironmentType.STAGING,
          dataResidencyConstraints: {},
          securityClassification: null,
        },
        platform: { supportedEnvironmentTypes: ['STAGING'] },
        technicalVersion: { compatibleRuntimeTypes: ['STAGING'] },
        profile: {
          compatibleEnvironmentTypes: ['STAGING'],
          dataResidencyConstraints: { region: 'EU' },
        },
      });
      expect(result.result).toBe(CompatibilityResult.REQUIRES_REVIEW);
    });

    it('dataResidencyConstraints overlapping keys → COMPATIBLE', () => {
      const result = evaluate({
        profile: { dataResidencyConstraints: { region: 'EU' } },
        environment: { dataResidencyConstraints: { region: 'EU', zone: 'west' } },
      });
      expect(result.result).toBe(CompatibilityResult.COMPATIBLE);
    });

    it('dataResidencyConstraints no overlap → INCOMPATIBLE', () => {
      const result = evaluate({
        profile: { dataResidencyConstraints: { region: 'EU' } },
        environment: { dataResidencyConstraints: { country: 'US' } },
      });
      expect(result.result).toBe(CompatibilityResult.INCOMPATIBLE);
    });

    it('backupRequirements with empty backupPolicy → REQUIRES_REVIEW', () => {
      const result = evaluate({
        profile: { backupRequirements: { rpoHours: 24 } },
        environment: { backupPolicy: {} },
      });
      expect(result.result).toBe(CompatibilityResult.REQUIRES_REVIEW);
    });

    it('availabilityRequirements with empty availabilityPolicy → REQUIRES_REVIEW', () => {
      const result = evaluate({
        profile: { availabilityRequirements: { sla: '99.9' } },
        environment: { availabilityPolicy: {} },
      });
      expect(result.result).toBe(CompatibilityResult.REQUIRES_REVIEW);
    });

    it('disasterRecoveryRequirements with empty env policies → REQUIRES_REVIEW', () => {
      const result = evaluate({
        profile: { disasterRecoveryRequirements: { rtoHours: 4 } },
        environment: { backupPolicy: {}, availabilityPolicy: {} },
      });
      expect(result.result).toBe(CompatibilityResult.REQUIRES_REVIEW);
    });

    it('backup and availability requirements satisfied when policies non-empty', () => {
      const result = evaluate({
        profile: {
          backupRequirements: { rpoHours: 24 },
          availabilityRequirements: { sla: '99.9' },
          disasterRecoveryRequirements: { rtoHours: 4 },
        },
        environment: {
          backupPolicy: { rpoHours: 12 },
          availabilityPolicy: { sla: '99.95' },
        },
      });
      expect(result.result).toBe(CompatibilityResult.COMPATIBLE);
    });
  });
});

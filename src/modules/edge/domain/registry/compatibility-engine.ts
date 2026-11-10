import { randomUUID } from 'node:crypto';
import {
  CertificationStatus,
  CompatibilityResult,
  ControlContractStatus,
  EnvironmentStatus,
  PlatformOperationalStatus,
  ProfileStatus,
  RegistryLifecycleStatus,
  TechnicalVersionStatus,
  type CompatibilityEvaluation,
  type DeploymentProfile,
  type ProductControlContract,
  type ProductPlatform,
  type ProductRegistryRecord,
  type ProductTechnicalVersion,
  type RuntimeEnvironment,
} from './registry.types.js';

export type CompatibilityEvaluationInput = {
  product: ProductRegistryRecord;
  technicalVersion: ProductTechnicalVersion;
  platform: ProductPlatform;
  environment: RuntimeEnvironment;
  profile: DeploymentProfile;
  contract: ProductControlContract;
  evaluatedBy?: string | null;
  correlationId?: string;
  now?: Date;
};

/**
 * Deterministic P7.2 compatibility engine — no implicit matches.
 */
export function evaluateRegistryCompatibility(
  input: CompatibilityEvaluationInput,
): Omit<CompatibilityEvaluation, 'id' | 'createdAt'> {
  const now = input.now ?? new Date();
  const rulesApplied: string[] = [];
  const reasons: string[] = [];
  let blockers = 0;
  let reviews = 0;

  const rule = (name: string, ok: boolean, reason: string, reviewOnly = false) => {
    rulesApplied.push(name);
    if (ok) return;
    reasons.push(reason);
    if (reviewOnly) reviews += 1;
    else blockers += 1;
  };

  rule(
    'PRODUCT_CERTIFIED',
    input.product.registryStatus === RegistryLifecycleStatus.CERTIFIED &&
      input.product.certificationStatus === CertificationStatus.CERTIFIED &&
      input.product.provisionable,
    'Product is not certified/provisionable',
  );

  rule(
    'TECHNICAL_VERSION_SUPPORTED',
    input.technicalVersion.versionStatus === TechnicalVersionStatus.PUBLISHED,
    'Technical version is not PUBLISHED',
  );

  if (
    input.technicalVersion.supportEndsAt &&
    input.technicalVersion.supportEndsAt.getTime() < now.getTime()
  ) {
    rule('TECHNICAL_VERSION_SUPPORT_WINDOW', false, 'Technical version support window ended');
  } else {
    rulesApplied.push('TECHNICAL_VERSION_SUPPORT_WINDOW');
  }

  rule(
    'PLATFORM_ACTIVE_CERTIFIED',
    input.platform.operationalStatus === PlatformOperationalStatus.ACTIVE &&
      input.platform.certificationStatus === CertificationStatus.CERTIFIED,
    'Platform is not ACTIVE and CERTIFIED',
  );

  const productAllowedOnPlatform =
    input.platform.allowedProductIds.length === 0
      ? false
      : input.platform.allowedProductIds.includes(input.product.productId);
  rule(
    'PRODUCT_PLATFORM_ALLOWLIST',
    productAllowedOnPlatform ||
      input.product.compatiblePlatformIds.includes(input.platform.id),
    'Product is not explicitly allowed on platform (no implicit compatibility)',
  );

  rule(
    'ENVIRONMENT_ACTIVE',
    input.environment.environmentStatus === EnvironmentStatus.ACTIVE,
    'Runtime environment is not ACTIVE',
  );

  rule(
    'ENVIRONMENT_BELONGS_TO_PLATFORM',
    input.environment.platformId === input.platform.id,
    'Environment does not belong to the selected platform',
  );

  const envTypes = asStringArray(input.platform.supportedEnvironmentTypes);
  rule(
    'PLATFORM_SUPPORTS_ENVIRONMENT_TYPE',
    envTypes.includes(input.environment.environmentType),
    `Platform does not support environment type ${input.environment.environmentType}`,
  );

  rule(
    'PROFILE_ACTIVE_CERTIFIED',
    input.profile.profileStatus === ProfileStatus.ACTIVE &&
      input.profile.certificationStatus === CertificationStatus.CERTIFIED,
    'Deployment profile is not ACTIVE and CERTIFIED',
  );

  const profileCodes = asStringArray(input.platform.supportedProfileCodes);
  const envProfiles = asStringArray(input.environment.allowedProfileCodes);
  const versionProfiles = asStringArray(input.technicalVersion.compatibleProfileCodes);
  rule(
    'PROFILE_PLATFORM_COMPAT',
    profileCodes.includes(String(input.profile.code)),
    `Platform does not support profile ${input.profile.code}`,
  );
  rule(
    'PROFILE_ENVIRONMENT_COMPAT',
    envProfiles.length === 0 || envProfiles.includes(String(input.profile.code)),
    `Environment does not allow profile ${input.profile.code}`,
  );
  rule(
    'PROFILE_VERSION_COMPAT',
    versionProfiles.length === 0 || versionProfiles.includes(String(input.profile.code)),
    `Technical version is not compatible with profile ${input.profile.code}`,
  );

  const profileEnvTypes = asStringArray(input.profile.compatibleEnvironmentTypes);
  rule(
    'PROFILE_ENVIRONMENT_TYPE',
    profileEnvTypes.length === 0 ||
      profileEnvTypes.includes(input.environment.environmentType),
    `Profile ${input.profile.code} incompatible with environment type`,
  );

  rule(
    'CONTRACT_PUBLISHED_OR_CERTIFIED',
    input.contract.contractStatus === ControlContractStatus.PUBLISHED ||
      input.contract.contractStatus === ControlContractStatus.CERTIFIED,
    'Control contract is not CERTIFIED/PUBLISHED',
  );
  rule(
    'CONTRACT_NOT_RETIRED',
    input.contract.contractStatus !== ControlContractStatus.RETIRED &&
      input.contract.contractStatus !== ControlContractStatus.DEPRECATED,
    'Control contract is deprecated or retired',
  );
  rule(
    'CONTRACT_PRODUCT_MATCH',
    input.contract.productId === input.product.productId,
    'Control contract product mismatch',
  );
  rule(
    'CONTRACT_PLATFORM_MATCH',
    input.contract.platformId === input.platform.id,
    'Control contract platform mismatch',
  );

  const contractVersions = asStringArray(input.technicalVersion.compatibleContractVersions);
  rule(
    'CONTRACT_VERSION_COMPAT',
    contractVersions.length === 0 ||
      contractVersions.includes(input.contract.contractVersion),
    'Technical version does not list this contract version',
    true,
  );

  // Security / residency: require explicit declarations when PRODUCTION
  if (input.environment.environmentType === 'PRODUCTION') {
    const hasResidency =
      Object.keys(input.environment.dataResidencyConstraints ?? {}).length > 0;
    rule(
      'PRODUCTION_DATA_RESIDENCY_DECLARED',
      hasResidency,
      'PRODUCTION environment missing data residency constraints',
      true,
    );
    const hasSecurity = Boolean(input.environment.securityClassification);
    rule(
      'PRODUCTION_SECURITY_CLASSIFICATION',
      hasSecurity,
      'PRODUCTION environment missing security classification',
      true,
    );
  }

  let result: CompatibilityResult = CompatibilityResult.COMPATIBLE;
  if (blockers > 0) result = CompatibilityResult.INCOMPATIBLE;
  else if (reviews > 0) result = CompatibilityResult.REQUIRES_REVIEW;

  return {
    correlationId: input.correlationId ?? randomUUID(),
    productRegistryId: input.product.id,
    technicalVersionId: input.technicalVersion.id,
    platformId: input.platform.id,
    environmentId: input.environment.id,
    profileId: input.profile.id,
    contractId: input.contract.id,
    result,
    rulesApplied,
    reasons,
    examinedRefs: {
      productId: input.product.productId,
      productRegistryVersion: input.product.version,
      technicalVersion: input.technicalVersion.technicalVersion,
      platformCode: input.platform.code,
      platformVersion: input.platform.version,
      environmentCode: input.environment.code,
      profileCode: input.profile.code,
      profileVersion: input.profile.profileVersion,
      contractCode: input.contract.contractCode,
      contractVersion: input.contract.contractVersion,
    },
    evaluatedBy: input.evaluatedBy ?? null,
    evaluatedAt: now,
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v));
}

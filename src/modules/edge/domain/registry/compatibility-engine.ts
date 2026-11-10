import { randomUUID } from 'node:crypto';
import {
  CertificationStatus,
  CompatibilityResult,
  ControlContractStatus,
  EnvironmentStatus,
  PlatformOperationalStatus,
  ProfileStatus,
  RegistryLifecycleStatus,
  RuntimeEnvironmentType,
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
 * Deterministic P7.2 compatibility engine — strictly fail-closed.
 * Empty allowlists never authorize. Missing declarations → REQUIRES_REVIEW.
 * Explicit mismatches → INCOMPATIBLE.
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

  /** Empty list → REQUIRES_REVIEW; non-empty without value → INCOMPATIBLE. */
  const requireAllowlist = (
    name: string,
    list: readonly unknown[],
    value: string,
    missingReason: string,
    mismatchReason: string,
  ) => {
    const items = asStringArray(list);
    if (items.length === 0) {
      rule(name, false, missingReason, true);
      return;
    }
    rule(name, items.includes(value), mismatchReason);
  };

  // 1. PRODUCT_CERTIFIED / provisionable
  rule(
    'PRODUCT_CERTIFIED',
    input.product.registryStatus === RegistryLifecycleStatus.CERTIFIED &&
      input.product.certificationStatus === CertificationStatus.CERTIFIED &&
      input.product.provisionable,
    'Product is not certified/provisionable',
  );

  // 2. TECHNICAL_VERSION PUBLISHED
  rule(
    'TECHNICAL_VERSION_SUPPORTED',
    input.technicalVersion.versionStatus === TechnicalVersionStatus.PUBLISHED,
    'Technical version is not PUBLISHED',
  );

  // 3. support window
  if (
    input.technicalVersion.supportEndsAt &&
    input.technicalVersion.supportEndsAt.getTime() < now.getTime()
  ) {
    rule('TECHNICAL_VERSION_SUPPORT_WINDOW', false, 'Technical version support window ended');
  } else {
    rulesApplied.push('TECHNICAL_VERSION_SUPPORT_WINDOW');
  }

  // 4. PLATFORM ACTIVE+CERTIFIED
  rule(
    'PLATFORM_ACTIVE_CERTIFIED',
    input.platform.operationalStatus === PlatformOperationalStatus.ACTIVE &&
      input.platform.certificationStatus === CertificationStatus.CERTIFIED,
    'Platform is not ACTIVE and CERTIFIED',
  );

  // 5. PRODUCT↔PLATFORM mutual allowlists (both required; empty → review)
  {
    const platformAllows = asStringArray(input.platform.allowedProductIds);
    const productAllows = asStringArray(input.product.compatiblePlatformIds);
    if (platformAllows.length === 0 || productAllows.length === 0) {
      rule(
        'PRODUCT_PLATFORM_MUTUAL_ALLOWLIST',
        false,
        'Product↔platform allowlist declaration missing (empty list is not implicit authorization)',
        true,
      );
    } else {
      const mutual =
        platformAllows.includes(input.product.productId) &&
        productAllows.includes(input.platform.id);
      rule(
        'PRODUCT_PLATFORM_MUTUAL_ALLOWLIST',
        mutual,
        'Product and platform are not mutually allowlisted',
      );
    }
  }

  // 6. ENVIRONMENT ACTIVE
  rule(
    'ENVIRONMENT_ACTIVE',
    input.environment.environmentStatus === EnvironmentStatus.ACTIVE,
    'Runtime environment is not ACTIVE',
  );

  // 7. ENVIRONMENT belongs to platform
  rule(
    'ENVIRONMENT_BELONGS_TO_PLATFORM',
    input.environment.platformId === input.platform.id,
    'Environment does not belong to the selected platform',
  );

  // 8. platform.supportedEnvironmentTypes
  requireAllowlist(
    'PLATFORM_SUPPORTS_ENVIRONMENT_TYPE',
    input.platform.supportedEnvironmentTypes,
    input.environment.environmentType,
    'Platform supportedEnvironmentTypes is undeclared (empty)',
    `Platform does not support environment type ${input.environment.environmentType}`,
  );

  // 9. PROFILE ACTIVE+CERTIFIED (PRODUCTION forbids uncertified profiles)
  {
    const isProduction =
      input.environment.environmentType === RuntimeEnvironmentType.PRODUCTION;
    const profileActive = input.profile.profileStatus === ProfileStatus.ACTIVE;
    const profileCertified =
      input.profile.certificationStatus === CertificationStatus.CERTIFIED;

    if (isProduction && !profileCertified) {
      rule(
        'PROFILE_ACTIVE_CERTIFIED',
        false,
        'Uncertified profiles cannot be used for PRODUCTION',
      );
    } else {
      rule(
        'PROFILE_ACTIVE_CERTIFIED',
        profileActive && profileCertified,
        'Deployment profile is not ACTIVE and CERTIFIED',
      );
    }
  }

  // 10. product.compatibleProfileIds
  requireAllowlist(
    'PRODUCT_PROFILE_ALLOWLIST',
    input.product.compatibleProfileIds,
    input.profile.id,
    'Product compatibleProfileIds is undeclared (empty)',
    `Product does not list profile ${input.profile.id}`,
  );

  // 11. product.compatibleEnvironmentIds
  requireAllowlist(
    'PRODUCT_ENVIRONMENT_ALLOWLIST',
    input.product.compatibleEnvironmentIds,
    input.environment.id,
    'Product compatibleEnvironmentIds is undeclared (empty)',
    `Product does not list environment ${input.environment.id}`,
  );

  // 12. product.compatibleContractIds
  requireAllowlist(
    'PRODUCT_CONTRACT_ALLOWLIST',
    input.product.compatibleContractIds,
    input.contract.id,
    'Product compatibleContractIds is undeclared (empty)',
    `Product does not list contract ${input.contract.id}`,
  );

  // 13. platform.supportedProfileCodes
  requireAllowlist(
    'PROFILE_PLATFORM_COMPAT',
    input.platform.supportedProfileCodes,
    String(input.profile.code),
    'Platform supportedProfileCodes is undeclared (empty)',
    `Platform does not support profile ${input.profile.code}`,
  );

  // 14. environment.allowedProfileCodes
  requireAllowlist(
    'PROFILE_ENVIRONMENT_COMPAT',
    input.environment.allowedProfileCodes,
    String(input.profile.code),
    'Environment allowedProfileCodes is undeclared (empty)',
    `Environment does not allow profile ${input.profile.code}`,
  );

  // 15. version.compatibleProfileCodes
  requireAllowlist(
    'PROFILE_VERSION_COMPAT',
    input.technicalVersion.compatibleProfileCodes,
    String(input.profile.code),
    'Technical version compatibleProfileCodes is undeclared (empty)',
    `Technical version is not compatible with profile ${input.profile.code}`,
  );

  // 16. version.compatibleRuntimeTypes
  requireAllowlist(
    'VERSION_RUNTIME_TYPE_COMPAT',
    input.technicalVersion.compatibleRuntimeTypes,
    input.environment.environmentType,
    'Technical version compatibleRuntimeTypes is undeclared (empty)',
    `Technical version does not support runtime type ${input.environment.environmentType}`,
  );

  // 17. version.compatibleContractVersions
  requireAllowlist(
    'CONTRACT_VERSION_COMPAT',
    input.technicalVersion.compatibleContractVersions,
    input.contract.contractVersion,
    'Technical version compatibleContractVersions is undeclared (empty)',
    'Technical version does not list this contract version',
  );

  // 18. profile.compatibleProductIds
  requireAllowlist(
    'PROFILE_PRODUCT_ALLOWLIST',
    input.profile.compatibleProductIds,
    input.product.productId,
    'Profile compatibleProductIds is undeclared (empty)',
    `Profile does not list product ${input.product.productId}`,
  );

  // 19. profile.compatiblePlatformTypes
  requireAllowlist(
    'PROFILE_PLATFORM_TYPE_COMPAT',
    input.profile.compatiblePlatformTypes,
    input.platform.platformType,
    'Profile compatiblePlatformTypes is undeclared (empty)',
    `Profile incompatible with platform type ${input.platform.platformType}`,
  );

  // 20. profile.compatibleEnvironmentTypes
  requireAllowlist(
    'PROFILE_ENVIRONMENT_TYPE',
    input.profile.compatibleEnvironmentTypes,
    input.environment.environmentType,
    'Profile compatibleEnvironmentTypes is undeclared (empty)',
    `Profile ${input.profile.code} incompatible with environment type`,
  );

  // 21. contract product/platform match
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

  // 22. contract status for production vs non-prod
  {
    const isProduction =
      input.environment.environmentType === RuntimeEnvironmentType.PRODUCTION;
    const status = input.contract.contractStatus;
    const isPublished = status === ControlContractStatus.PUBLISHED;
    const isCertified = status === ControlContractStatus.CERTIFIED;

    if (isProduction) {
      if (isPublished) {
        rule('CONTRACT_STATUS_FOR_ENVIRONMENT', true, '');
      } else if (isCertified) {
        rule(
          'CONTRACT_STATUS_FOR_ENVIRONMENT',
          false,
          'PRODUCTION requires PUBLISHED control contract (CERTIFIED alone requires review)',
          true,
        );
      } else {
        rule(
          'CONTRACT_STATUS_FOR_ENVIRONMENT',
          false,
          'Control contract is not CERTIFIED/PUBLISHED',
        );
      }
    } else {
      rule(
        'CONTRACT_STATUS_FOR_ENVIRONMENT',
        isPublished || isCertified,
        'Control contract is not CERTIFIED/PUBLISHED',
      );
    }
  }

  // 23. contract not DEPRECATED/RETIRED
  rule(
    'CONTRACT_NOT_RETIRED',
    input.contract.contractStatus !== ControlContractStatus.RETIRED &&
      input.contract.contractStatus !== ControlContractStatus.DEPRECATED,
    'Control contract is deprecated or retired',
  );

  // 24. Required capabilities
  {
    const productCaps = asStringArray(input.product.declaredCapabilities);
    if (productCaps.length > 0) {
      const platformCaps = asStringArray(input.platform.declaredCapabilities);
      const envCaps = asStringArray(input.environment.availableCapabilities);
      if (platformCaps.length === 0 || envCaps.length === 0) {
        rule(
          'REQUIRED_CAPABILITIES',
          false,
          'Product declares capabilities but platform/environment capability lists are empty',
          true,
        );
      } else {
        const missing = productCaps.filter(
          (cap) => !platformCaps.includes(cap) || !envCaps.includes(cap),
        );
        rule(
          'REQUIRED_CAPABILITIES',
          missing.length === 0,
          `Missing required capabilities: ${missing.join(', ')}`,
        );
      }
    } else {
      rulesApplied.push('REQUIRED_CAPABILITIES');
    }
  }

  // 25. Security: PRODUCTION requires classification + residency
  if (input.environment.environmentType === RuntimeEnvironmentType.PRODUCTION) {
    rule(
      'PRODUCTION_SECURITY_CLASSIFICATION',
      Boolean(input.environment.securityClassification),
      'PRODUCTION environment missing security classification',
      true,
    );
    rule(
      'PRODUCTION_DATA_RESIDENCY_DECLARED',
      Object.keys(input.environment.dataResidencyConstraints ?? {}).length > 0,
      'PRODUCTION environment missing data residency constraints',
      true,
    );
  }

  // 26–27. Profile security / residency / backup / availability / DR requirements
  evaluateProfilePolicyRequirements(input.profile, input.environment, rule);

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

type RuleFn = (name: string, ok: boolean, reason: string, reviewOnly?: boolean) => void;

function evaluateProfilePolicyRequirements(
  profile: DeploymentProfile,
  environment: RuntimeEnvironment,
  rule: RuleFn,
): void {
  // securityRequirements → environment.securityClassification
  {
    const reqKeys = Object.keys(profile.securityRequirements ?? {});
    if (reqKeys.length > 0) {
      if (!environment.securityClassification) {
        rule(
          'PROFILE_SECURITY_REQUIREMENTS',
          false,
          'Profile declares securityRequirements but environment securityClassification is empty',
          true,
        );
      } else {
        const classification = environment.securityClassification;
        const explicit =
          profile.securityRequirements.classification ??
          profile.securityRequirements.securityClassification;
        if (explicit !== undefined && String(explicit) !== classification) {
          rule(
            'PROFILE_SECURITY_REQUIREMENTS',
            false,
            'Environment securityClassification does not satisfy profile securityRequirements',
          );
        } else {
          rule('PROFILE_SECURITY_REQUIREMENTS', true, '');
        }
      }
    }
  }

  // dataResidencyConstraints — overlapping keys or matching values
  {
    const required = profile.dataResidencyConstraints ?? {};
    const available = environment.dataResidencyConstraints ?? {};
    const reqKeys = Object.keys(required);
    if (reqKeys.length === 0) {
      // skip
    } else if (Object.keys(available).length === 0) {
      rule(
        'PROFILE_DATA_RESIDENCY',
        false,
        'Profile declares dataResidencyConstraints but environment residency policy is empty',
        true,
      );
    } else {
      rule(
        'PROFILE_DATA_RESIDENCY',
        residencySatisfied(required, available),
        'Environment data residency does not satisfy profile requirements',
      );
    }
  }

  // backupRequirements → backupPolicy must be non-empty
  requireNonEmptyPolicy(
    rule,
    'PROFILE_BACKUP_REQUIREMENTS',
    profile.backupRequirements,
    environment.backupPolicy,
    'Profile declares backupRequirements but environment backupPolicy is empty',
  );

  // availabilityRequirements → availabilityPolicy must be non-empty
  requireNonEmptyPolicy(
    rule,
    'PROFILE_AVAILABILITY_REQUIREMENTS',
    profile.availabilityRequirements,
    environment.availabilityPolicy,
    'Profile declares availabilityRequirements but environment availabilityPolicy is empty',
  );

  // disasterRecoveryRequirements → corresponding env policy (backup + availability surface)
  {
    const reqKeys = Object.keys(profile.disasterRecoveryRequirements ?? {});
    if (reqKeys.length > 0) {
      const available = {
        ...environment.backupPolicy,
        ...environment.availabilityPolicy,
      };
      if (Object.keys(available).length === 0) {
        rule(
          'PROFILE_DISASTER_RECOVERY_REQUIREMENTS',
          false,
          'Profile declares disasterRecoveryRequirements but environment DR-related policies are empty',
          true,
        );
      } else {
        rule('PROFILE_DISASTER_RECOVERY_REQUIREMENTS', true, '');
      }
    }
  }
}

function requireNonEmptyPolicy(
  rule: RuleFn,
  name: string,
  required: Record<string, unknown> | null | undefined,
  available: Record<string, unknown> | null | undefined,
  emptyReason: string,
): void {
  const reqKeys = Object.keys(required ?? {});
  if (reqKeys.length === 0) return;
  if (Object.keys(available ?? {}).length === 0) {
    rule(name, false, emptyReason, true);
    return;
  }
  rule(name, true, '');
}

function residencySatisfied(
  required: Record<string, unknown>,
  available: Record<string, unknown>,
): boolean {
  const reqKeys = Object.keys(required);
  const availKeys = Object.keys(available);
  const overlappingKeys = reqKeys.some((k) => availKeys.includes(k));
  if (overlappingKeys) return true;

  const reqValues = new Set(reqKeys.map((k) => String(required[k])));
  const availValues = new Set(availKeys.map((k) => String(available[k])));
  return [...reqValues].some((v) => availValues.has(v));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v));
}

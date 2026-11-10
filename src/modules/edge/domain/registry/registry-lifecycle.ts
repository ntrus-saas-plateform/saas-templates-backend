import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  CertificationStatus,
  ControlContractStatus,
  EnvironmentStatus,
  PlatformOperationalStatus,
  ProfileStatus,
  RegistryLifecycleStatus,
  TechnicalVersionStatus,
} from './registry.types.js';

const REGISTRY_TRANSITIONS: Record<RegistryLifecycleStatus, readonly RegistryLifecycleStatus[]> = {
  [RegistryLifecycleStatus.DRAFT]: [
    RegistryLifecycleStatus.VALIDATING,
    RegistryLifecycleStatus.RETIRED,
  ],
  [RegistryLifecycleStatus.VALIDATING]: [
    RegistryLifecycleStatus.CERTIFIED,
    RegistryLifecycleStatus.DRAFT,
    RegistryLifecycleStatus.SUSPENDED,
  ],
  [RegistryLifecycleStatus.CERTIFIED]: [
    RegistryLifecycleStatus.SUSPENDED,
    RegistryLifecycleStatus.DEPRECATED,
  ],
  [RegistryLifecycleStatus.SUSPENDED]: [
    RegistryLifecycleStatus.CERTIFIED,
    RegistryLifecycleStatus.DEPRECATED,
    RegistryLifecycleStatus.RETIRED,
  ],
  [RegistryLifecycleStatus.DEPRECATED]: [RegistryLifecycleStatus.RETIRED],
  [RegistryLifecycleStatus.RETIRED]: [],
};

const VERSION_TRANSITIONS: Record<TechnicalVersionStatus, readonly TechnicalVersionStatus[]> = {
  [TechnicalVersionStatus.DRAFT]: [
    TechnicalVersionStatus.VALIDATING,
    TechnicalVersionStatus.RETIRED,
  ],
  [TechnicalVersionStatus.VALIDATING]: [
    TechnicalVersionStatus.PUBLISHED,
    TechnicalVersionStatus.DRAFT,
  ],
  [TechnicalVersionStatus.PUBLISHED]: [
    TechnicalVersionStatus.DEPRECATED,
    TechnicalVersionStatus.RETIRED,
  ],
  [TechnicalVersionStatus.DEPRECATED]: [TechnicalVersionStatus.RETIRED],
  [TechnicalVersionStatus.RETIRED]: [],
};

const PLATFORM_TRANSITIONS: Record<
  PlatformOperationalStatus,
  readonly PlatformOperationalStatus[]
> = {
  [PlatformOperationalStatus.DRAFT]: [
    PlatformOperationalStatus.VALIDATING,
    PlatformOperationalStatus.RETIRED,
  ],
  [PlatformOperationalStatus.VALIDATING]: [
    PlatformOperationalStatus.ACTIVE,
    PlatformOperationalStatus.DRAFT,
    PlatformOperationalStatus.SUSPENDED,
  ],
  [PlatformOperationalStatus.ACTIVE]: [
    PlatformOperationalStatus.SUSPENDED,
    PlatformOperationalStatus.DEPRECATED,
  ],
  [PlatformOperationalStatus.SUSPENDED]: [
    PlatformOperationalStatus.ACTIVE,
    PlatformOperationalStatus.DEPRECATED,
    PlatformOperationalStatus.RETIRED,
  ],
  [PlatformOperationalStatus.DEPRECATED]: [PlatformOperationalStatus.RETIRED],
  [PlatformOperationalStatus.RETIRED]: [],
};

const ENV_TRANSITIONS: Record<EnvironmentStatus, readonly EnvironmentStatus[]> = {
  [EnvironmentStatus.DRAFT]: [EnvironmentStatus.VALIDATING, EnvironmentStatus.RETIRED],
  [EnvironmentStatus.VALIDATING]: [
    EnvironmentStatus.ACTIVE,
    EnvironmentStatus.DRAFT,
    EnvironmentStatus.SUSPENDED,
  ],
  [EnvironmentStatus.ACTIVE]: [EnvironmentStatus.SUSPENDED, EnvironmentStatus.DEPRECATED],
  [EnvironmentStatus.SUSPENDED]: [
    EnvironmentStatus.ACTIVE,
    EnvironmentStatus.DEPRECATED,
    EnvironmentStatus.RETIRED,
  ],
  [EnvironmentStatus.DEPRECATED]: [EnvironmentStatus.RETIRED],
  [EnvironmentStatus.RETIRED]: [],
};

const PROFILE_TRANSITIONS: Record<ProfileStatus, readonly ProfileStatus[]> = {
  [ProfileStatus.DRAFT]: [ProfileStatus.VALIDATING, ProfileStatus.RETIRED],
  [ProfileStatus.VALIDATING]: [ProfileStatus.ACTIVE, ProfileStatus.DRAFT, ProfileStatus.SUSPENDED],
  [ProfileStatus.ACTIVE]: [ProfileStatus.SUSPENDED, ProfileStatus.DEPRECATED],
  [ProfileStatus.SUSPENDED]: [
    ProfileStatus.ACTIVE,
    ProfileStatus.DEPRECATED,
    ProfileStatus.RETIRED,
  ],
  [ProfileStatus.DEPRECATED]: [ProfileStatus.RETIRED],
  [ProfileStatus.RETIRED]: [],
};

const CONTRACT_TRANSITIONS: Record<ControlContractStatus, readonly ControlContractStatus[]> = {
  [ControlContractStatus.DRAFT]: [
    ControlContractStatus.VALIDATING,
    ControlContractStatus.RETIRED,
  ],
  [ControlContractStatus.VALIDATING]: [
    ControlContractStatus.CERTIFIED,
    ControlContractStatus.DRAFT,
  ],
  [ControlContractStatus.CERTIFIED]: [ControlContractStatus.PUBLISHED],
  [ControlContractStatus.PUBLISHED]: [
    ControlContractStatus.DEPRECATED,
    ControlContractStatus.RETIRED,
  ],
  [ControlContractStatus.DEPRECATED]: [ControlContractStatus.RETIRED],
  [ControlContractStatus.RETIRED]: [],
};

function assertTransition<T extends string>(
  kind: string,
  from: T,
  to: T,
  allowed: Record<T, readonly T[]>,
  reason?: string,
): void {
  if (!(allowed[from] ?? []).includes(to)) {
    throw new DomainError(
      ErrorCode.INVALID_STATE_TRANSITION,
      `Invalid ${kind} transition ${from} → ${to}`,
      [{ from, to, reason: reason ?? null }],
    );
  }
}

export function assertProductRegistryTransition(
  from: RegistryLifecycleStatus,
  to: RegistryLifecycleStatus,
  reason?: string,
): void {
  assertTransition('product_registry', from, to, REGISTRY_TRANSITIONS, reason);
  if (
    (to === RegistryLifecycleStatus.SUSPENDED ||
      to === RegistryLifecycleStatus.DEPRECATED ||
      to === RegistryLifecycleStatus.RETIRED) &&
    !reason?.trim()
  ) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Reason is required for sensitive product registry transitions',
    );
  }
}

export function assertTechnicalVersionTransition(
  from: TechnicalVersionStatus,
  to: TechnicalVersionStatus,
): void {
  assertTransition('technical_version', from, to, VERSION_TRANSITIONS);
}

export function assertPlatformTransition(
  from: PlatformOperationalStatus,
  to: PlatformOperationalStatus,
  reason?: string,
): void {
  assertTransition('platform', from, to, PLATFORM_TRANSITIONS, reason);
  if (
    (to === PlatformOperationalStatus.SUSPENDED ||
      to === PlatformOperationalStatus.DEPRECATED ||
      to === PlatformOperationalStatus.RETIRED) &&
    !reason?.trim()
  ) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Reason is required for sensitive platform transitions',
    );
  }
}

export function assertEnvironmentTransition(
  from: EnvironmentStatus,
  to: EnvironmentStatus,
  reason?: string,
): void {
  assertTransition('environment', from, to, ENV_TRANSITIONS, reason);
}

export function assertProfileTransition(
  from: ProfileStatus,
  to: ProfileStatus,
  reason?: string,
): void {
  assertTransition('deployment_profile', from, to, PROFILE_TRANSITIONS, reason);
}

export function assertContractTransition(
  from: ControlContractStatus,
  to: ControlContractStatus,
  reason?: string,
): void {
  assertTransition('control_contract', from, to, CONTRACT_TRANSITIONS, reason);
  if (
    (to === ControlContractStatus.DEPRECATED || to === ControlContractStatus.RETIRED) &&
    !reason?.trim()
  ) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Reason is required for contract deprecation/retirement',
    );
  }
}

export function isProvisionable(
  registryStatus: RegistryLifecycleStatus,
  certificationStatus: CertificationStatus,
): boolean {
  return (
    registryStatus === RegistryLifecycleStatus.CERTIFIED &&
    certificationStatus === CertificationStatus.CERTIFIED
  );
}

export function assertMutableTechnicalVersion(status: TechnicalVersionStatus): void {
  if (status !== TechnicalVersionStatus.DRAFT && status !== TechnicalVersionStatus.VALIDATING) {
    throw new DomainError(
      ErrorCode.INVALID_STATE_TRANSITION,
      'Published technical versions are immutable; create a new version instead',
      [{ status }],
    );
  }
}

export function assertMutableContract(immutable: boolean, status: ControlContractStatus): void {
  if (immutable || status === ControlContractStatus.PUBLISHED) {
    throw new DomainError(
      ErrorCode.INVALID_STATE_TRANSITION,
      'Published control contracts are immutable; create a new major version',
      [{ status, immutable }],
    );
  }
}

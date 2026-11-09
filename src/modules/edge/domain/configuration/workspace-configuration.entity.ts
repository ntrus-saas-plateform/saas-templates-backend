import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export enum ConfigurationVersionStatus {
  DRAFT = 'DRAFT',
  VALIDATED = 'VALIDATED',
  ACTIVE = 'ACTIVE',
  ROLLED_BACK = 'ROLLED_BACK',
}

export interface WorkspaceConfigurationVersion {
  readonly id: string;
  readonly verticalId: string;
  readonly version: number;
  readonly config: Readonly<Record<string, unknown>>;
  readonly status: ConfigurationVersionStatus;
  readonly editorId: string | null;
  readonly changeReason: string | null;
  readonly activatedAt: Date | null;
  readonly createdAt: Date;
}

const ALLOWED: Readonly<
  Record<ConfigurationVersionStatus, readonly ConfigurationVersionStatus[]>
> = {
  [ConfigurationVersionStatus.DRAFT]: [
    ConfigurationVersionStatus.VALIDATED,
    ConfigurationVersionStatus.ROLLED_BACK,
  ],
  [ConfigurationVersionStatus.VALIDATED]: [
    ConfigurationVersionStatus.ACTIVE,
    ConfigurationVersionStatus.DRAFT,
    ConfigurationVersionStatus.ROLLED_BACK,
  ],
  [ConfigurationVersionStatus.ACTIVE]: [ConfigurationVersionStatus.ROLLED_BACK],
  [ConfigurationVersionStatus.ROLLED_BACK]: [],
};

export function assertConfigurationTransition(
  from: ConfigurationVersionStatus,
  to: ConfigurationVersionStatus,
): void {
  if (from === to) return;
  if (!ALLOWED[from].includes(to)) {
    throw new DomainError(
      ErrorCode.INVALID_STATE_TRANSITION,
      `Illegal configuration status transition: ${from} → ${to}`,
      [{ from, to }],
    );
  }
}

export function validateConfigurationPayload(
  config: Readonly<Record<string, unknown>>,
): { valid: boolean; errors: readonly string[] } {
  const errors: string[] = [];
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    errors.push('config must be an object');
  }
  return { valid: errors.length === 0, errors };
}

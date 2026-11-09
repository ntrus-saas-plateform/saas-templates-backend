import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export enum VerticalStatus {
  DRAFT = 'DRAFT',
  CONFIGURING = 'CONFIGURING',
  READY_FOR_ACTIVATION = 'READY_FOR_ACTIVATION',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATION_PENDING = 'DEACTIVATION_PENDING',
  DEACTIVATED = 'DEACTIVATED',
  DEPRECATED = 'DEPRECATED',
  RETIRED = 'RETIRED',
  ARCHIVED = 'ARCHIVED',
}

export interface Vertical {
  readonly id: string;
  readonly code: string;
  readonly slug: string;
  readonly displayName: string;
  readonly description: string | null;
  readonly status: VerticalStatus;
  readonly iconRef: string | null;
  readonly visualIdentityRef: string | null;
  readonly keycloakOrganizationId: string | null;
  readonly configurationVersion: number;
  readonly activatedAt: Date | null;
  readonly suspendedAt: Date | null;
  readonly deactivatedAt: Date | null;
  readonly suspensionReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
}

export interface VerticalLifecycleEvent {
  readonly id: string;
  readonly verticalId: string;
  readonly fromStatus: VerticalStatus;
  readonly toStatus: VerticalStatus;
  readonly reason: string | null;
  readonly actorId: string | null;
  readonly createdAt: Date;
}

const ALLOWED_TRANSITIONS: Readonly<Record<VerticalStatus, readonly VerticalStatus[]>> = {
  [VerticalStatus.DRAFT]: [VerticalStatus.CONFIGURING, VerticalStatus.DEACTIVATED],
  [VerticalStatus.CONFIGURING]: [
    VerticalStatus.DRAFT,
    VerticalStatus.READY_FOR_ACTIVATION,
    VerticalStatus.DEACTIVATED,
  ],
  [VerticalStatus.READY_FOR_ACTIVATION]: [
    VerticalStatus.CONFIGURING,
    VerticalStatus.ACTIVE,
    VerticalStatus.DEACTIVATED,
  ],
  [VerticalStatus.ACTIVE]: [
    VerticalStatus.SUSPENDED,
    VerticalStatus.DEACTIVATION_PENDING,
    VerticalStatus.DEPRECATED,
  ],
  [VerticalStatus.SUSPENDED]: [
    VerticalStatus.ACTIVE,
    VerticalStatus.DEACTIVATION_PENDING,
    VerticalStatus.DEPRECATED,
  ],
  [VerticalStatus.DEACTIVATION_PENDING]: [VerticalStatus.DEACTIVATED, VerticalStatus.ACTIVE],
  [VerticalStatus.DEACTIVATED]: [VerticalStatus.ARCHIVED],
  [VerticalStatus.DEPRECATED]: [VerticalStatus.RETIRED, VerticalStatus.ARCHIVED],
  [VerticalStatus.RETIRED]: [VerticalStatus.ARCHIVED],
  [VerticalStatus.ARCHIVED]: [],
};

export function canTransitionVerticalStatus(from: VerticalStatus, to: VerticalStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertVerticalTransition(from: VerticalStatus, to: VerticalStatus): void {
  if (!canTransitionVerticalStatus(from, to)) {
    throw new DomainError(
      ErrorCode.INVALID_STATE_TRANSITION,
      `Illegal vertical status transition: ${from} → ${to}`,
      [{ from, to }],
    );
  }
}

export function isVerticalOperational(status: VerticalStatus): boolean {
  return status === VerticalStatus.ACTIVE;
}

export interface VerticalReadiness {
  readonly ready: boolean;
  readonly missing: readonly string[];
}

export function evaluateVerticalReadiness(vertical: Vertical): VerticalReadiness {
  const missing: string[] = [];
  if (!vertical.code?.trim()) missing.push('code');
  if (!vertical.slug?.trim()) missing.push('slug');
  if (!vertical.displayName?.trim()) missing.push('displayName');
  if (!vertical.keycloakOrganizationId?.trim()) missing.push('keycloakOrganizationId');
  if (vertical.configurationVersion < 1) missing.push('configurationVersion');
  return { ready: missing.length === 0, missing };
}

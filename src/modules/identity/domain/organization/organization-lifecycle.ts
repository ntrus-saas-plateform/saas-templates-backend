import { OrganizationStatus } from './organization.entity.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

const ALLOWED_TRANSITIONS: Readonly<Record<OrganizationStatus, readonly OrganizationStatus[]>> = {
  [OrganizationStatus.ACTIVE]: [OrganizationStatus.SUSPENDED, OrganizationStatus.ARCHIVED],
  [OrganizationStatus.SUSPENDED]: [OrganizationStatus.ACTIVE, OrganizationStatus.ARCHIVED],
  [OrganizationStatus.ARCHIVED]: [],
};

export function canTransitionOrganizationStatus(
  from: OrganizationStatus,
  to: OrganizationStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertOrganizationTransition(from: OrganizationStatus, to: OrganizationStatus): void {
  if (!canTransitionOrganizationStatus(from, to)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Illegal organization status transition: ${from} → ${to}`,
      [{ from, to }],
    );
  }
}

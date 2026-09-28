import { TenantStatus } from './tenant.entity.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

const ALLOWED_TRANSITIONS: Readonly<Record<TenantStatus, readonly TenantStatus[]>> = {
  [TenantStatus.PROVISIONING]: [TenantStatus.ACTIVE, TenantStatus.FAILED],
  [TenantStatus.ACTIVE]: [
    TenantStatus.SUSPENDED,
    TenantStatus.READ_ONLY,
    TenantStatus.DEACTIVATING,
    TenantStatus.LOCKED,
  ],
  [TenantStatus.SUSPENDED]: [TenantStatus.ACTIVE, TenantStatus.LOCKED, TenantStatus.DEACTIVATING],
  [TenantStatus.READ_ONLY]: [TenantStatus.ACTIVE, TenantStatus.DEACTIVATING, TenantStatus.LOCKED],
  [TenantStatus.LOCKED]: [TenantStatus.ACTIVE, TenantStatus.SUSPENDED, TenantStatus.DEACTIVATING],
  [TenantStatus.FAILED]: [TenantStatus.PROVISIONING, TenantStatus.DEACTIVATING, TenantStatus.DELETED],
  [TenantStatus.DEACTIVATING]: [TenantStatus.ARCHIVED],
  [TenantStatus.ARCHIVED]: [TenantStatus.DELETED],
  [TenantStatus.DELETED]: [],
};

export function canTransitionTenantStatus(from: TenantStatus, to: TenantStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTenantTransition(from: TenantStatus, to: TenantStatus): void {
  if (!canTransitionTenantStatus(from, to)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Illegal tenant status transition: ${from} → ${to}`,
      [{ from, to }],
    );
  }
}

import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

/**
 * RGOM-E11 — Partner opportunity registration (beachhead).
 * Registration timestamp is SoT for conflict window; never invent exclusive territory.
 */

export type PartnerOpportunityStatus =
  | 'REGISTERED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CONVERTED'
  | 'WITHDRAWN';

export type PartnerOpportunityRegistration = {
  readonly id: string;
  readonly partnerCode: string;
  readonly accountName: string;
  readonly territoryCode: string | null;
  readonly productSegment: string | null;
  readonly estimatedMrr: number | null;
  readonly status: PartnerOpportunityStatus;
  readonly registeredAt: Date;
  readonly conflictWindowDays: number;
  readonly conflictExpiresAt: Date;
  readonly notes: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type RegisterPartnerOpportunityInput = {
  readonly partnerCode: string;
  readonly accountName: string;
  readonly territoryCode?: string | null;
  readonly productSegment?: string | null;
  readonly estimatedMrr?: number | null;
  readonly conflictWindowDays?: number;
  readonly notes?: string | null;
  readonly metadata?: Record<string, unknown>;
  readonly createdBy?: string | null;
  readonly registeredAt?: Date;
};

export function assertRegisterPartnerOpportunity(
  input: RegisterPartnerOpportunityInput,
): {
  partnerCode: string;
  accountName: string;
  conflictWindowDays: number;
  estimatedMrr: number | null;
} {
  const partnerCode = String(input.partnerCode ?? '').trim();
  const accountName = String(input.accountName ?? '').trim();
  if (!partnerCode) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'partnerCode is required');
  }
  if (!accountName) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'accountName is required');
  }
  const conflictWindowDays =
    input.conflictWindowDays != null && Number.isFinite(input.conflictWindowDays)
      ? Math.max(1, Math.floor(input.conflictWindowDays))
      : 30;
  let estimatedMrr: number | null = null;
  if (input.estimatedMrr != null) {
    if (!Number.isFinite(input.estimatedMrr) || input.estimatedMrr < 0) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'estimatedMrr must be >= 0 or null');
    }
    estimatedMrr = input.estimatedMrr;
  }
  return { partnerCode, accountName, conflictWindowDays, estimatedMrr };
}

export function computeConflictExpiresAt(
  registeredAt: Date,
  conflictWindowDays: number,
): Date {
  return new Date(registeredAt.getTime() + conflictWindowDays * 86_400_000);
}

export function isWithinConflictWindow(
  registration: Pick<PartnerOpportunityRegistration, 'conflictExpiresAt' | 'status'>,
  asOf: Date = new Date(),
): boolean {
  if (registration.status !== 'REGISTERED' && registration.status !== 'ACCEPTED') {
    return false;
  }
  return asOf.getTime() <= registration.conflictExpiresAt.getTime();
}

export const ALLOWED_PARTNER_OPP_TRANSITIONS: Record<
  PartnerOpportunityStatus,
  readonly PartnerOpportunityStatus[]
> = {
  REGISTERED: ['ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN'],
  ACCEPTED: ['CONVERTED', 'EXPIRED', 'WITHDRAWN'],
  REJECTED: [],
  EXPIRED: [],
  CONVERTED: [],
  WITHDRAWN: [],
};

export function assertPartnerOppTransition(
  from: PartnerOpportunityStatus,
  to: PartnerOpportunityStatus,
): void {
  const allowed = ALLOWED_PARTNER_OPP_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Partner opportunity transition ${from} → ${to} not allowed`,
    );
  }
}

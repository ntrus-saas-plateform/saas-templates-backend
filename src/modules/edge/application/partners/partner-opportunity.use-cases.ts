import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  assertPartnerOppTransition,
  assertRegisterPartnerOpportunity,
  computeConflictExpiresAt,
  isWithinConflictWindow,
  type PartnerOpportunityStatus,
  type RegisterPartnerOpportunityInput,
} from '../../domain/partners/opportunity-registration.js';
import type { PartnerOpportunityRepositoryPort } from '../../domain/ports/partner-opportunity-repository.port.js';

export class RegisterPartnerOpportunityUseCase {
  constructor(private readonly repo: PartnerOpportunityRepositoryPort) {}

  async execute(input: RegisterPartnerOpportunityInput) {
    const normalized = assertRegisterPartnerOpportunity(input);
    const registeredAt = input.registeredAt ?? new Date();
    const row = await this.repo.register({
      ...input,
      partnerCode: normalized.partnerCode,
      accountName: normalized.accountName,
      conflictWindowDays: normalized.conflictWindowDays,
      estimatedMrr: normalized.estimatedMrr,
      registeredAt,
      conflictExpiresAt: computeConflictExpiresAt(
        registeredAt,
        normalized.conflictWindowDays,
      ),
      status: 'REGISTERED',
    });
    return {
      data: {
        ...row,
        withinConflictWindow: isWithinConflictWindow(row),
      },
    };
  }
}

export class ListPartnerOpportunitiesUseCase {
  constructor(private readonly repo: PartnerOpportunityRepositoryPort) {}

  async execute(input?: {
    partnerCode?: string;
    status?: PartnerOpportunityStatus;
    limit?: number;
  }) {
    const items = await this.repo.list(input);
    return {
      data: {
        items: items.map((r) => ({
          ...r,
          withinConflictWindow: isWithinConflictWindow(r),
        })),
        total: items.length,
      },
    };
  }
}

export class TransitionPartnerOpportunityUseCase {
  constructor(private readonly repo: PartnerOpportunityRepositoryPort) {}

  async execute(input: { id: string; status: PartnerOpportunityStatus }) {
    const current = await this.repo.getById(input.id);
    if (!current) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Partner opportunity not found');
    }
    assertPartnerOppTransition(current.status, input.status);
    const updated = await this.repo.updateStatus({
      id: input.id,
      status: input.status,
    });
    return {
      data: {
        ...updated,
        withinConflictWindow: isWithinConflictWindow(updated),
      },
    };
  }
}

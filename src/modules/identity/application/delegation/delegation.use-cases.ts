import type { UseCase } from '../common/use-case.js';
import type { ExecutionContext } from '../common/execution-context.js';
import { requireSubject } from '../common/access-control.js';
import type { OrganizationRepositoryPort } from '../../domain/ports/organization-repository.port.js';
import type { MembershipRepositoryPort } from '../../domain/ports/membership-repository.port.js';
import type { RoleRepositoryPort } from '../../domain/ports/role-repository.port.js';
import type { DelegationRepositoryPort } from '../../domain/ports/delegation-repository.port.js';
import type { EmergencyAccessRepositoryPort } from '../../domain/ports/emergency-access-repository.port.js';
import type { Delegation } from '../../domain/delegation/delegation.entity.js';
import type { EmergencyAccessGrant } from '../../domain/delegation/emergency-access-grant.entity.js';
import { accessDeniedError } from '../../../../core/domain/errors/access-denied.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { resolveInviterPermissions } from '../common/resolve-inviter-permissions.js';
import type { PaginatedResult } from '../common/pagination.js';
import { buildPaginationMeta, normalizePageLimit } from '../common/pagination.js';

const MAX_DELEGATION_HOURS = 720;
const MAX_EMERGENCY_HOURS = 24;
const MIN_EMERGENCY_REASON_LENGTH = 10;

export class GrantDelegationUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        organizationId: string;
        granteeIdentityId: string;
        permissions: readonly string[];
        expiresInHours?: number;
      },
      Delegation
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly membershipRepository: MembershipRepositoryPort,
    private readonly roleRepository: RoleRepositoryPort,
    private readonly delegationRepository: DelegationRepositoryPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId: string;
    granteeIdentityId: string;
    permissions: readonly string[];
    expiresInHours?: number;
  }): Promise<Delegation> {
    const ctx = requireSubject(input.ctx);
    if (input.granteeIdentityId === ctx.subjectId) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'Cannot delegate to yourself');
    }

    const org = await this.organizationRepository.findById(ctx.tenantId, input.organizationId);
    if (!org) throw accessDeniedError();

    const effectivePermissions = await resolveInviterPermissions(
      ctx,
      this.membershipRepository,
      this.roleRepository,
    );
    if (input.permissions.some((p) => !effectivePermissions.includes(p))) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'Cannot delegate permissions exceeding your own');
    }

    const hours = Math.min(input.expiresInHours ?? 72, MAX_DELEGATION_HOURS);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    return this.delegationRepository.create({
      tenantId: ctx.tenantId,
      organizationId: input.organizationId,
      grantorIdentityId: ctx.subjectId,
      granteeIdentityId: input.granteeIdentityId,
      permissions: input.permissions,
      expiresAt,
    });
  }
}

export class ListDelegationsUseCase
  implements UseCase<{ ctx: ExecutionContext; page?: number; limit?: number }, PaginatedResult<Delegation>>
{
  constructor(private readonly delegationRepository: DelegationRepositoryPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<Delegation>> {
    const ctx = requireSubject(input.ctx);
    const { page, limit } = normalizePageLimit(input.page, input.limit);
    const result = await this.delegationRepository.findByTenantPage(ctx.tenantId, page, limit);
    return {
      data: result.items,
      pagination: buildPaginationMeta(page, limit, result.total),
    };
  }
}

export class RevokeDelegationUseCase
  implements UseCase<{ ctx: ExecutionContext; delegationId: string }, Delegation>
{
  constructor(private readonly delegationRepository: DelegationRepositoryPort) {}

  async execute(input: { ctx: ExecutionContext; delegationId: string }): Promise<Delegation> {
    const ctx = requireSubject(input.ctx);
    const delegations = await this.delegationRepository.findByTenant(ctx.tenantId);
    const target = delegations.find((d) => d.id === input.delegationId);
    if (!target) throw accessDeniedError();
    if (target.grantorIdentityId !== ctx.subjectId) {
      throw accessDeniedError();
    }
    return this.delegationRepository.revoke(ctx.tenantId, input.delegationId);
  }
}

export class GrantEmergencyAccessUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        operatorIdentityId: string;
        reason: string;
        organizationId?: string;
        scope?: Readonly<Record<string, unknown>>;
        expiresInHours?: number;
      },
      EmergencyAccessGrant
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly emergencyAccessRepository: EmergencyAccessRepositoryPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    operatorIdentityId: string;
    reason: string;
    organizationId?: string;
    scope?: Readonly<Record<string, unknown>>;
    expiresInHours?: number;
  }): Promise<EmergencyAccessGrant> {
    const ctx = requireSubject(input.ctx);
    if (input.reason.trim().length < MIN_EMERGENCY_REASON_LENGTH) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Reason must be at least 10 characters');
    }
    if (input.operatorIdentityId === ctx.subjectId) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'Operator must differ from approver');
    }

    if (input.organizationId) {
      const org = await this.organizationRepository.findById(ctx.tenantId, input.organizationId);
      if (!org) throw accessDeniedError();
    }

    const hours = Math.min(input.expiresInHours ?? 4, MAX_EMERGENCY_HOURS);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    return this.emergencyAccessRepository.create({
      tenantId: ctx.tenantId,
      organizationId: input.organizationId ?? null,
      operatorIdentityId: input.operatorIdentityId,
      approvedByIdentityId: ctx.subjectId,
      reason: input.reason.trim(),
      scope: input.scope ?? {},
      expiresAt,
    });
  }
}

export class ListEmergencyAccessGrantsUseCase
  implements
    UseCase<{ ctx: ExecutionContext; page?: number; limit?: number }, PaginatedResult<EmergencyAccessGrant>>
{
  constructor(private readonly emergencyAccessRepository: EmergencyAccessRepositoryPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<EmergencyAccessGrant>> {
    const ctx = requireSubject(input.ctx);
    const { page, limit } = normalizePageLimit(input.page, input.limit);
    const result = await this.emergencyAccessRepository.findByTenantPage(ctx.tenantId, page, limit);
    return {
      data: result.items,
      pagination: buildPaginationMeta(page, limit, result.total),
    };
  }
}

export class RevokeEmergencyAccessUseCase
  implements UseCase<{ ctx: ExecutionContext; grantId: string }, EmergencyAccessGrant>
{
  constructor(private readonly emergencyAccessRepository: EmergencyAccessRepositoryPort) {}

  async execute(input: { ctx: ExecutionContext; grantId: string }): Promise<EmergencyAccessGrant> {
    const ctx = requireSubject(input.ctx);
    const grants = await this.emergencyAccessRepository.findByTenant(ctx.tenantId);
    if (!grants.some((g) => g.id === input.grantId)) {
      throw accessDeniedError();
    }
    return this.emergencyAccessRepository.revoke(ctx.tenantId, input.grantId);
  }
}

import type { UseCase } from '../common/use-case.js';
import type { ExecutionContext } from '../common/execution-context.js';
import { requireSubject } from '../common/access-control.js';
import type { MembershipRepositoryPort } from '../../domain/ports/membership-repository.port.js';
import type { OrganizationRepositoryPort } from '../../domain/ports/organization-repository.port.js';
import { OrganizationAccessPolicyService } from '../services/organization-access-policy.service.js';
import type { UserTenantMembershipPort } from '../../domain/ports/user-tenant-membership.port.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { OrganizationMembership } from '../../domain/membership/organization-membership.entity.js';
import {
  hasTenantAdminRole,
  isMembershipActive,
} from '../../domain/membership/organization-membership.entity.js';
import { accessDeniedError } from '../../../../core/domain/errors/access-denied.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  createMembershipCreatedEvent,
  createMembershipRevokedEvent,
  createMembershipRolesUpdatedEvent,
} from '../../domain/events/membership.events.js';
import { KeycloakOrganizationSyncService } from '../services/keycloak-sync.service.js';
import type { RoleRepositoryPort } from '../../domain/ports/role-repository.port.js';
import type { PlanRepositoryPort } from '../../domain/ports/plan-repository.port.js';
import type { TenantRegistryPort } from '../../domain/ports/tenant-registry.port.js';
import { resolveInviterPermissions } from '../common/resolve-inviter-permissions.js';
import type { PaginatedResult } from '../common/pagination.js';
import { buildPaginationMeta, normalizePageLimit } from '../common/pagination.js';

export class ListMembershipsUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        organizationId?: string;
        page?: number;
        limit?: number;
        status?: import('../../domain/membership/organization-membership.entity.js').MembershipStatus;
        search?: string;
      },
      PaginatedResult<OrganizationMembership> & {
        stats?: import('../../domain/ports/membership-repository.port.js').MembershipStatusCounts;
      }
    >
{
  constructor(
    private readonly membershipRepository: MembershipRepositoryPort,
    private readonly organizationAccessPolicy: OrganizationAccessPolicyService,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId?: string;
    page?: number;
    limit?: number;
    status?: import('../../domain/membership/organization-membership.entity.js').MembershipStatus;
    search?: string;
  }): Promise<
    PaginatedResult<OrganizationMembership> & {
      stats?: import('../../domain/ports/membership-repository.port.js').MembershipStatusCounts;
    }
  > {
    const ctx = requireSubject(input.ctx);
    const { page, limit } = normalizePageLimit(input.page, input.limit);
    const filters = {
      status: input.status,
      search: input.search,
    };
    if (input.organizationId) {
      await this.organizationAccessPolicy.assertOrganizationDataAccess(
        ctx.tenantId,
        ctx.subjectId,
        input.organizationId,
      );
      const [result, stats] = await Promise.all([
        this.membershipRepository.findByOrganizationPage(
          ctx.tenantId,
          input.organizationId,
          page,
          limit,
          filters,
        ),
        this.membershipRepository.countByOrganizationStatus(
          ctx.tenantId,
          input.organizationId,
        ),
      ]);
      return {
        data: result.items,
        pagination: buildPaginationMeta(page, limit, result.total),
        stats,
      };
    }
    const result = await this.membershipRepository.findByUserPage(
      ctx.tenantId,
      ctx.subjectId,
      page,
      limit,
      filters,
    );
    return {
      data: result.items,
      pagination: buildPaginationMeta(page, limit, result.total),
    };
  }
}

export class GrantMembershipUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        userId: string;
        organizationId: string;
        roles?: readonly string[];
        permissions?: readonly string[];
      },
      OrganizationMembership
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly membershipRepository: MembershipRepositoryPort,
    private readonly roleRepository: RoleRepositoryPort,
    private readonly userTenantMembership: UserTenantMembershipPort,
    private readonly controlPlaneOutbox: ControlPlaneOutboxTransactionService,
    private readonly keycloakSync: KeycloakOrganizationSyncService,
    private readonly planRepository?: PlanRepositoryPort,
    private readonly tenantRegistry?: TenantRegistryPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    userId: string;
    organizationId: string;
    roles?: readonly string[];
    permissions?: readonly string[];
    status?: import('../../domain/membership/organization-membership.entity.js').MembershipStatus;
    department?: string;
    position?: string;
    managerUserId?: string;
    resourceScopes?: readonly import('../../domain/membership/organization-membership.entity.js').MembershipResourceScope[];
    expiresAt?: string;
  }): Promise<OrganizationMembership> {
    const ctx = requireSubject(input.ctx);
    const org = await this.organizationRepository.findById(ctx.tenantId, input.organizationId);
    if (!org) throw accessDeniedError();

    if (this.planRepository && this.tenantRegistry) {
      const existingMemberships = await this.membershipRepository.findByUser(
        ctx.tenantId,
        input.userId,
      );
      if (existingMemberships.length === 0) {
        const tenant = await this.tenantRegistry.findById(ctx.tenantId);
        if (tenant) {
          const quotas = await this.planRepository.getEffectiveQuotas(tenant);
          const currentUsers = await this.planRepository.countDistinctUsers(ctx.tenantId);
          if (currentUsers >= quotas.maxUsers) {
            throw new DomainError(
              ErrorCode.VALIDATION_ERROR,
              `User quota exceeded: limit is ${quotas.maxUsers}`,
            );
          }
        }
      }
    }

    const effectivePermissions = await resolveInviterPermissions(
      ctx,
      this.membershipRepository,
      this.roleRepository,
    );
    const requestedRoles = input.roles ?? ['viewer'];
    const requestedPermissions = input.permissions ?? [];
    const roleDerivedPermissions = await this.roleRepository.findPermissionsForRoles(
      requestedRoles,
      ctx.tenantId,
    );
    const allRequested = [...requestedPermissions, ...roleDerivedPermissions];
    if (allRequested.some((p) => !effectivePermissions.includes(p))) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'Cannot grant roles or permissions exceeding your own');
    }

    const membership = await this.controlPlaneOutbox.runWithOutbox(
      ctx.tenantId,
      async (client, enqueue) => {
        await this.userTenantMembership.ensureMember(input.userId, ctx.tenantId, client);
        const created = await this.membershipRepository.create(
          {
            userId: input.userId,
            tenantId: ctx.tenantId,
            organizationId: input.organizationId,
            roles: input.roles,
            permissions: input.permissions,
            status: input.status,
            department: input.department,
            position: input.position,
            managerUserId: input.managerUserId,
            resourceScopes: input.resourceScopes,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          },
          client,
        );
        await enqueue(
          createMembershipCreatedEvent({
            tenantId: ctx.tenantId,
            organizationId: input.organizationId,
            membershipId: created.id,
            userId: input.userId,
            actorId: ctx.subjectId,
            correlationId: ctx.correlationId,
            traceId: ctx.traceId,
          }),
        );
        return created;
      },
    );

    await this.keycloakSync.syncMembership(ctx, org, input.userId, 'add');

    return membership;
  }
}

export class RevokeMembershipUseCase
  implements UseCase<{ ctx: ExecutionContext; membershipId: string }, OrganizationMembership>
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly membershipRepository: MembershipRepositoryPort,
    private readonly controlPlaneOutbox: ControlPlaneOutboxTransactionService,
    private readonly keycloakSync: KeycloakOrganizationSyncService,
  ) {}

  async execute(input: { ctx: ExecutionContext; membershipId: string }): Promise<OrganizationMembership> {
    const ctx = requireSubject(input.ctx);
    const membership = await this.membershipRepository.findById(ctx.tenantId, input.membershipId);
    if (!membership) throw accessDeniedError();
    const org = await this.organizationRepository.findById(
      ctx.tenantId,
      membership.organizationId,
    );

    const revoked = await this.controlPlaneOutbox.runWithOutbox(
      ctx.tenantId,
      async (client, enqueue) => {
        if (hasTenantAdminRole(membership.roles)) {
          const adminCount = await this.membershipRepository.countTenantAdmins(ctx.tenantId, client);
          if (adminCount <= 1) {
            throw new DomainError(
              ErrorCode.FORBIDDEN,
              'Cannot revoke the last tenant administrator without ownership transfer',
            );
          }
        }

        const result = await this.membershipRepository.revoke(ctx.tenantId, input.membershipId, client);
        await enqueue(
          createMembershipRevokedEvent({
            tenantId: ctx.tenantId,
            organizationId: membership.organizationId,
            membershipId: input.membershipId,
            userId: membership.userId,
            actorId: ctx.subjectId,
            correlationId: ctx.correlationId,
            traceId: ctx.traceId,
          }),
        );
        return result;
      },
    );

    if (org) {
      await this.keycloakSync.syncMembership(ctx, org, membership.userId, 'remove');
    }

    return revoked;
  }
}

export class UpdateMembershipRolesUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        membershipId: string;
        roles?: readonly string[];
        permissions?: readonly string[];
        status?: import('../../domain/membership/organization-membership.entity.js').MembershipStatus;
        department?: string | null;
        position?: string | null;
        managerUserId?: string | null;
        resourceScopes?: readonly import('../../domain/membership/organization-membership.entity.js').MembershipResourceScope[];
        expiresAt?: string | null;
      },
      OrganizationMembership
    >
{
  constructor(
    private readonly membershipRepository: MembershipRepositoryPort,
    private readonly roleRepository: RoleRepositoryPort,
    private readonly controlPlaneOutbox: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    membershipId: string;
    roles?: readonly string[];
    permissions?: readonly string[];
    status?: import('../../domain/membership/organization-membership.entity.js').MembershipStatus;
    department?: string | null;
    position?: string | null;
    managerUserId?: string | null;
    resourceScopes?: readonly import('../../domain/membership/organization-membership.entity.js').MembershipResourceScope[];
    expiresAt?: string | null;
  }): Promise<OrganizationMembership> {
    const ctx = requireSubject(input.ctx);
    const membership = await this.membershipRepository.findById(ctx.tenantId, input.membershipId);
    if (!membership) throw accessDeniedError();

    const nextRoles = input.roles ?? membership.roles;
    const nextPermissions = input.permissions ?? membership.permissions;

    const effectivePermissions = await resolveInviterPermissions(
      ctx,
      this.membershipRepository,
      this.roleRepository,
    );
    const roleDerivedPermissions = await this.roleRepository.findPermissionsForRoles(
      nextRoles,
      ctx.tenantId,
    );
    const allRequested = [...nextPermissions, ...roleDerivedPermissions];
    if (allRequested.some((p) => !effectivePermissions.includes(p))) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'Cannot assign roles or permissions exceeding your own');
    }

    const updated = await this.controlPlaneOutbox.runWithOutbox(
      ctx.tenantId,
      async (client, enqueue) => {
        const result = await this.membershipRepository.update(
          ctx.tenantId,
          input.membershipId,
          {
            roles: input.roles,
            permissions: input.permissions,
            status: input.status,
            department: input.department,
            position: input.position,
            managerUserId: input.managerUserId,
            resourceScopes: input.resourceScopes,
            expiresAt:
              input.expiresAt === undefined
                ? undefined
                : input.expiresAt === null
                  ? null
                  : new Date(input.expiresAt),
          },
          client,
        );
        await enqueue(
          createMembershipRolesUpdatedEvent({
            tenantId: ctx.tenantId,
            organizationId: membership.organizationId,
            membershipId: input.membershipId,
            userId: membership.userId,
            actorId: ctx.subjectId,
            correlationId: ctx.correlationId,
            traceId: ctx.traceId,
          }),
        );
        return result;
      },
    );

    return updated;
  }
}

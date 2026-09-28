import type { UseCase } from '../common/use-case.js';
import type { ExecutionContext } from '../common/execution-context.js';
import { requireSubject } from '../common/access-control.js';
import type { ApplicationUserRepositoryPort } from '../../domain/ports/application-user-repository.port.js';
import type { MembershipRepositoryPort } from '../../domain/ports/membership-repository.port.js';
import type { OrganizationRepositoryPort } from '../../domain/ports/organization-repository.port.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import {
  ApplicationUserStatus,
  type ApplicationUser,
} from '../../domain/user/application-user.entity.js';
import { accessDeniedError } from '../../../../core/domain/errors/access-denied.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { UserKeycloakLifecycleService } from '../services/user-keycloak-lifecycle.service.js';
import type { PaginatedResult } from '../common/pagination.js';
import { buildPaginationMeta, normalizePageLimit } from '../common/pagination.js';
import {
  createUserSuspendedEvent,
  createUserDisabledEvent,
  createUserReactivatedEvent,
} from '../../domain/events/user-lifecycle.events.js';
import { attachUserOrganizations } from './attach-user-organizations.js';

export class ListUsersUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        page?: number;
        limit?: number;
        status?: ApplicationUserStatus;
        search?: string;
      },
      PaginatedResult<ApplicationUser>
    >
{
  constructor(
    private readonly applicationUserRepository: ApplicationUserRepositoryPort,
    private readonly membershipRepository: MembershipRepositoryPort,
    private readonly organizationRepository: OrganizationRepositoryPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    page?: number;
    limit?: number;
    status?: ApplicationUserStatus;
    search?: string;
  }): Promise<PaginatedResult<ApplicationUser>> {
    requireSubject(input.ctx);
    const { page, limit } = normalizePageLimit(input.page, input.limit);
    const result = await this.applicationUserRepository.listPage(
      input.ctx.tenantId,
      page,
      limit,
      input.status,
      input.search,
    );
    const data = await attachUserOrganizations(
      input.ctx.tenantId,
      result.items,
      this.membershipRepository,
      this.organizationRepository,
    );
    return {
      data,
      pagination: buildPaginationMeta(page, limit, result.total),
    };
  }
}

abstract class UserLifecycleTransitionUseCase {
  constructor(
    protected readonly applicationUserRepository: ApplicationUserRepositoryPort,
    protected readonly userKeycloakLifecycle: UserKeycloakLifecycleService,
    protected readonly controlPlaneOutbox: ControlPlaneOutboxTransactionService,
  ) {}

  protected async transition(
    ctx: ExecutionContext,
    identityId: string,
    status: ApplicationUserStatus,
    eventFactory: (params: {
      tenantId: string;
      identityId: string;
      actorId: string;
      correlationId: string;
      traceId: string | null;
    }) => import('../../../../core/domain/events/integration-event.js').IntegrationEvent<unknown>,
    keycloakAction?: (identityId: string) => Promise<void>,
  ): Promise<ApplicationUser> {
    const subject = requireSubject(ctx);
    const existing = await this.applicationUserRepository.findByIdentityOrId(
      ctx.tenantId,
      identityId,
    );
    if (!existing) throw accessDeniedError();
    if (existing.identityId === subject.subjectId) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'Cannot change your own account status');
    }

    const resolvedIdentityId = existing.identityId;

    const user = await this.controlPlaneOutbox.runWithOutbox(ctx.tenantId, async (client, enqueue) => {
      const updated = await this.applicationUserRepository.updateStatus(
        ctx.tenantId,
        resolvedIdentityId,
        status,
        client,
      );
      await enqueue(
        eventFactory({
          tenantId: ctx.tenantId,
          identityId: resolvedIdentityId,
          actorId: subject.subjectId,
          correlationId: ctx.correlationId,
          traceId: ctx.traceId,
        }),
      );
      return updated;
    });

    if (keycloakAction) {
      await keycloakAction(resolvedIdentityId);
    }
    return user;
  }
}

export class SuspendUserUseCase
  extends UserLifecycleTransitionUseCase
  implements UseCase<{ ctx: ExecutionContext; identityId: string }, ApplicationUser>
{
  async execute(input: { ctx: ExecutionContext; identityId: string }): Promise<ApplicationUser> {
    return this.transition(
      input.ctx,
      input.identityId,
      ApplicationUserStatus.SUSPENDED,
      createUserSuspendedEvent,
      (id) => this.userKeycloakLifecycle.disableUser(id),
    );
  }
}

export class DisableUserUseCase
  extends UserLifecycleTransitionUseCase
  implements UseCase<{ ctx: ExecutionContext; identityId: string }, ApplicationUser>
{
  async execute(input: { ctx: ExecutionContext; identityId: string }): Promise<ApplicationUser> {
    return this.transition(
      input.ctx,
      input.identityId,
      ApplicationUserStatus.DISABLED,
      createUserDisabledEvent,
      (id) => this.userKeycloakLifecycle.disableUser(id),
    );
  }
}

export class ReactivateUserUseCase
  extends UserLifecycleTransitionUseCase
  implements UseCase<{ ctx: ExecutionContext; identityId: string }, ApplicationUser>
{
  async execute(input: { ctx: ExecutionContext; identityId: string }): Promise<ApplicationUser> {
    return this.transition(
      input.ctx,
      input.identityId,
      ApplicationUserStatus.ACTIVE,
      createUserReactivatedEvent,
      (id) => this.userKeycloakLifecycle.enableUser(id),
    );
  }
}

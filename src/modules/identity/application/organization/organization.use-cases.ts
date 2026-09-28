import type { UseCase } from '../common/use-case.js';
import type { ExecutionContext } from '../common/execution-context.js';
import { requireSubject } from '../common/access-control.js';
import type { OrganizationRepositoryPort } from '../../domain/ports/organization-repository.port.js';
import type { OrganizationAdminPort } from '../../domain/ports/organization-admin.port.js';
import type { PlanRepositoryPort } from '../../domain/ports/plan-repository.port.js';
import type { TenantRegistryPort } from '../../domain/ports/tenant-registry.port.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type {
  OpeningHours,
  OperationalSettings,
  Organization,
  OrganizationAddress,
  OrganizationContact,
} from '../../domain/organization/organization.entity.js';
import {
  ORGANIZATION_MAX_DEPTH,
  OrganizationStatus,
  OrganizationType,
} from '../../domain/organization/organization.entity.js';
import { accessDeniedError } from '../../../../core/domain/errors/access-denied.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  createOrganizationCreatedEvent,
  createOrganizationUpdatedEvent,
  createOrganizationSuspendedEvent,
  createOrganizationActivatedEvent,
} from '../../domain/events/organization-lifecycle.events.js';
import { KeycloakOrganizationSyncService } from '../services/keycloak-sync.service.js';
import type { PaginatedResult } from '../common/pagination.js';
import { buildPaginationMeta, normalizePageLimit } from '../common/pagination.js';

export type OrganizationWriteFields = {
  name?: string;
  slug?: string;
  description?: string;
  timezone?: string;
  locale?: string;
  type?: OrganizationType;
  code?: string | null;
  parentId?: string | null;
  isPrimary?: boolean;
  address?: OrganizationAddress;
  contact?: OrganizationContact;
  openingHours?: OpeningHours;
  operationalSettings?: OperationalSettings;
  metadata?: Record<string, unknown>;
};

async function assertHierarchyAllowed(
  organizationAdmin: OrganizationAdminPort,
  tenantId: string,
  organizationId: string | null,
  parentId: string | null | undefined,
): Promise<void> {
  if (parentId === undefined) return;
  if (parentId === null) return;
  if (organizationId && parentId === organizationId) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Organization cannot be its own parent');
  }

  const ancestors = await organizationAdmin.getAncestorChain(tenantId, parentId);
  if (ancestors.length === 0) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Parent organization not found');
  }
  if (organizationId && ancestors.includes(organizationId)) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Hierarchy cycle detected');
  }
  // ancestors[0] is parent itself; depth of new node = ancestors.length
  if (ancestors.length > ORGANIZATION_MAX_DEPTH) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Organization hierarchy depth exceeds ${ORGANIZATION_MAX_DEPTH}`,
    );
  }
}

export class ListOrganizationsUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        page?: number;
        limit?: number;
        parentId?: string | null;
        scope?: 'membership' | 'tenant';
      },
      PaginatedResult<Organization>
    >
{
  constructor(private readonly organizationRepository: OrganizationRepositoryPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    page?: number;
    limit?: number;
    parentId?: string | null;
    scope?: 'membership' | 'tenant';
  }): Promise<PaginatedResult<Organization>> {
    const ctx = requireSubject(input.ctx);
    const { page, limit } = normalizePageLimit(input.page, input.limit);
    const opts = input.parentId !== undefined ? { parentId: input.parentId } : undefined;

    const result =
      input.scope === 'tenant'
        ? await this.organizationRepository.findAllByTenantPage(
            ctx.tenantId,
            page,
            limit,
            opts,
          )
        : await this.organizationRepository.findByUserMembershipPage(
            ctx.tenantId,
            ctx.subjectId,
            page,
            limit,
            opts,
          );

    return {
      data: result.items,
      pagination: buildPaginationMeta(page, limit, result.total),
    };
  }
}

export class ListOrganizationTreeUseCase
  implements UseCase<{ ctx: ExecutionContext; scope?: 'membership' | 'tenant' }, Organization[]>
{
  constructor(private readonly organizationRepository: OrganizationRepositoryPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    scope?: 'membership' | 'tenant';
  }): Promise<Organization[]> {
    const ctx = requireSubject(input.ctx);
    if (input.scope === 'tenant') {
      const items = await this.organizationRepository.findAllByTenant(ctx.tenantId);
      return [...items];
    }
    const items = await this.organizationRepository.findByUserMembership(
      ctx.tenantId,
      ctx.subjectId,
    );
    return [...items];
  }
}

export class GetOrganizationUseCase
  implements UseCase<{ ctx: ExecutionContext; organizationId: string }, Organization>
{
  constructor(private readonly organizationRepository: OrganizationRepositoryPort) {}

  async execute(input: { ctx: ExecutionContext; organizationId: string }): Promise<Organization> {
    const ctx = requireSubject(input.ctx);
    const org = await this.organizationRepository.findById(ctx.tenantId, input.organizationId);
    if (!org) throw accessDeniedError();
    return org;
  }
}

export class CreateOrganizationUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        name: string;
        slug: string;
        description?: string;
        timezone?: string;
        locale?: string;
        type?: OrganizationType;
        code?: string;
        parentId?: string | null;
        isPrimary?: boolean;
        address?: OrganizationAddress;
        contact?: OrganizationContact;
        openingHours?: OpeningHours;
        operationalSettings?: OperationalSettings;
        metadata?: Record<string, unknown>;
      },
      Organization
    >
{
  constructor(
    private readonly organizationAdmin: OrganizationAdminPort,
    private readonly controlPlaneOutbox: ControlPlaneOutboxTransactionService,
    private readonly keycloakSync: KeycloakOrganizationSyncService,
    private readonly planRepository: PlanRepositoryPort,
    private readonly tenantRegistry: TenantRegistryPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    name: string;
    slug: string;
    description?: string;
    timezone?: string;
    locale?: string;
    type?: OrganizationType;
    code?: string;
    parentId?: string | null;
    isPrimary?: boolean;
    address?: OrganizationAddress;
    contact?: OrganizationContact;
    openingHours?: OpeningHours;
    operationalSettings?: OperationalSettings;
    metadata?: Record<string, unknown>;
  }): Promise<Organization> {
    const ctx = requireSubject(input.ctx);

    const tenant = await this.tenantRegistry.findById(ctx.tenantId);
    if (tenant) {
      const quotas = await this.planRepository.getEffectiveQuotas(tenant);
      const currentCount = await this.planRepository.countOrganizations(ctx.tenantId);
      if (currentCount >= quotas.maxOrganizations) {
        throw new DomainError(
          ErrorCode.CONFLICT,
          `Organization quota exceeded: limit is ${quotas.maxOrganizations}`,
        );
      }
    }

    await assertHierarchyAllowed(
      this.organizationAdmin,
      ctx.tenantId,
      null,
      input.parentId,
    );

    const keycloakOrganizationId = await this.keycloakSync.resolveKeycloakOrganizationId(
      ctx,
      input.name,
      input.slug,
    );

    return this.controlPlaneOutbox.runWithOutbox(ctx.tenantId, async (client, enqueue) => {
      if (input.isPrimary) {
        await this.organizationAdmin.clearPrimary(ctx.tenantId, null, client);
      }

      const organization = await this.organizationAdmin.create(
        {
          tenantId: ctx.tenantId,
          name: input.name,
          slug: input.slug,
          description: input.description,
          timezone: input.timezone,
          locale: input.locale,
          type: input.type,
          code: input.code,
          parentId: input.parentId,
          isPrimary: input.isPrimary,
          address: input.address,
          contact: input.contact,
          openingHours: input.openingHours,
          operationalSettings: input.operationalSettings,
          metadata: input.metadata,
          keycloakOrganizationId,
        },
        client,
      );

      await enqueue(
        createOrganizationCreatedEvent({
          tenantId: ctx.tenantId,
          organizationId: organization.id,
          actorId: ctx.subjectId,
          correlationId: ctx.correlationId,
          traceId: ctx.traceId,
          name: organization.name,
        }),
      );

      return organization;
    });
  }
}

export class UpdateOrganizationUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        organizationId: string;
      } & OrganizationWriteFields,
      Organization
    >
{
  constructor(
    private readonly organizationAdmin: OrganizationAdminPort,
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly controlPlaneOutbox: ControlPlaneOutboxTransactionService,
    private readonly keycloakSync: KeycloakOrganizationSyncService,
  ) {}

  async execute(
    input: {
      ctx: ExecutionContext;
      organizationId: string;
    } & OrganizationWriteFields,
  ): Promise<Organization> {
    const ctx = requireSubject(input.ctx);
    const existing = await this.organizationRepository.findById(
      ctx.tenantId,
      input.organizationId,
    );
    if (!existing) throw accessDeniedError();

    await assertHierarchyAllowed(
      this.organizationAdmin,
      ctx.tenantId,
      input.organizationId,
      input.parentId,
    );

    const organization = await this.controlPlaneOutbox.runWithOutbox(
      ctx.tenantId,
      async (client, enqueue) => {
        if (input.isPrimary === true) {
          await this.organizationAdmin.clearPrimary(ctx.tenantId, input.organizationId, client);
        }

        const { ctx: _ctx, organizationId, ...params } = input;
        const updated = await this.organizationAdmin.update(
          ctx.tenantId,
          organizationId,
          params,
          client,
        );

        await enqueue(
          createOrganizationUpdatedEvent({
            tenantId: ctx.tenantId,
            organizationId: input.organizationId,
            actorId: ctx.subjectId,
            correlationId: ctx.correlationId,
            traceId: ctx.traceId,
          }),
        );

        return updated;
      },
    );

    await this.keycloakSync.syncOrganizationUpdate(
      ctx,
      organization,
      organization.name,
      organization.slug,
    );

    return organization;
  }
}

export class SuspendOrganizationUseCase
  implements UseCase<{ ctx: ExecutionContext; organizationId: string }, Organization>
{
  constructor(
    private readonly organizationAdmin: OrganizationAdminPort,
    private readonly controlPlaneOutbox: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: { ctx: ExecutionContext; organizationId: string }): Promise<Organization> {
    const ctx = requireSubject(input.ctx);

    return this.controlPlaneOutbox.runWithOutbox(ctx.tenantId, async (client, enqueue) => {
      const organization = await this.organizationAdmin.transitionStatus(
        ctx.tenantId,
        input.organizationId,
        OrganizationStatus.SUSPENDED,
        client,
      );

      await enqueue(
        createOrganizationSuspendedEvent({
          tenantId: ctx.tenantId,
          organizationId: input.organizationId,
          actorId: ctx.subjectId,
          correlationId: ctx.correlationId,
          traceId: ctx.traceId,
        }),
      );

      return organization;
    });
  }
}

export class ActivateOrganizationUseCase
  implements UseCase<{ ctx: ExecutionContext; organizationId: string }, Organization>
{
  constructor(
    private readonly organizationAdmin: OrganizationAdminPort,
    private readonly controlPlaneOutbox: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: { ctx: ExecutionContext; organizationId: string }): Promise<Organization> {
    const ctx = requireSubject(input.ctx);

    return this.controlPlaneOutbox.runWithOutbox(ctx.tenantId, async (client, enqueue) => {
      const organization = await this.organizationAdmin.transitionStatus(
        ctx.tenantId,
        input.organizationId,
        OrganizationStatus.ACTIVE,
        client,
      );

      await enqueue(
        createOrganizationActivatedEvent({
          tenantId: ctx.tenantId,
          organizationId: input.organizationId,
          actorId: ctx.subjectId,
          correlationId: ctx.correlationId,
          traceId: ctx.traceId,
        }),
      );

      return organization;
    });
  }
}

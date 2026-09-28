import type { TenantDatabaseProvisionerPort } from '../../../../core/domain/ports/tenant-provisioning.port.js';
import type { TenantAdminPort } from '../../../identity/domain/ports/tenant-admin.port.js';
import type { UserTenantMembershipPort } from '../../../identity/domain/ports/user-tenant-membership.port.js';
import type { OrganizationAdminPort } from '../../../identity/domain/ports/organization-admin.port.js';
import type { MembershipRepositoryPort } from '../../../identity/domain/ports/membership-repository.port.js';
import type { KeycloakAdminPort } from '../../../identity/domain/ports/keycloak-admin.port.js';
import type { OrganizationRepositoryPort } from '../../../identity/domain/ports/organization-repository.port.js';
import type { DomainRegistryPort } from '../../../identity/domain/ports/domain-registry.port.js';
import type { PlanRepositoryPort } from '../../../identity/domain/ports/plan-repository.port.js';
import type { ProvisionTenantDefaults } from './provision-tenant.defaults.js';
import type { UseCase } from '../../../identity/application/common/use-case.js';
import type { ExecutionContext } from '../../../identity/application/common/execution-context.js';
import { requireSubject } from '../../../identity/application/common/access-control.js';
import type { OrchestratorProvisionResult } from './tenant-provisioning.orchestrator.js';
import { TenantProvisioningOrchestrator } from './tenant-provisioning.orchestrator.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export class ProvisionTenantUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        idempotencyKey: string;
        slug: string;
        region?: string;
        environment?: string;
        databaseHost?: string;
        databasePort?: number;
        databaseName?: string;
        credentialsReference?: string;
        ownerIdentityId?: string;
        /** Bootstrap a default Keycloak Organization + CP org under this tenant (default true). */
        bootstrapOrganization?: boolean;
        defaultOrganizationName?: string;
        defaultOrganizationSlug?: string;
      },
      OrchestratorProvisionResult
    >
{
  private readonly orchestrator: TenantProvisioningOrchestrator;

  constructor(
    provisioner: TenantDatabaseProvisionerPort,
    tenantAdmin: TenantAdminPort,
    userTenantMembership: UserTenantMembershipPort,
    organizationAdmin: OrganizationAdminPort,
    membershipRepository: MembershipRepositoryPort,
    keycloakAdmin: KeycloakAdminPort,
    defaults: ProvisionTenantDefaults,
    outboxService: ControlPlaneOutboxTransactionService,
    domainRegistry?: DomainRegistryPort,
    tenantBaseDomain?: string,
    planRepository?: PlanRepositoryPort,
    organizationRepository?: OrganizationRepositoryPort,
  ) {
    this.orchestrator = new TenantProvisioningOrchestrator(
      provisioner,
      tenantAdmin,
      organizationAdmin,
      keycloakAdmin,
      userTenantMembership,
      membershipRepository,
      outboxService,
      defaults,
      domainRegistry,
      tenantBaseDomain,
      planRepository,
      organizationRepository,
    );
  }

  async execute(input: {
    ctx: ExecutionContext;
    idempotencyKey: string;
    slug: string;
    region?: string;
    environment?: string;
    databaseHost?: string;
    databasePort?: number;
    databaseName?: string;
    credentialsReference?: string;
    ownerIdentityId?: string;
    bootstrapOrganization?: boolean;
    defaultOrganizationName?: string;
    defaultOrganizationSlug?: string;
  }): Promise<OrchestratorProvisionResult> {
    requireSubject(input.ctx);
    if (!input.idempotencyKey?.trim()) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Idempotency-Key header is required for tenant provisioning',
      );
    }
    return this.orchestrator.provision(input);
  }
}

export class RetryTenantProvisioningUseCase
  implements UseCase<{ ctx: ExecutionContext; tenantId: string }, OrchestratorProvisionResult>
{
  private readonly orchestrator: TenantProvisioningOrchestrator;

  constructor(
    provisioner: TenantDatabaseProvisionerPort,
    tenantAdmin: TenantAdminPort,
    userTenantMembership: UserTenantMembershipPort,
    organizationAdmin: OrganizationAdminPort,
    membershipRepository: MembershipRepositoryPort,
    keycloakAdmin: KeycloakAdminPort,
    defaults: ProvisionTenantDefaults,
    outboxService: ControlPlaneOutboxTransactionService,
    domainRegistry?: DomainRegistryPort,
    tenantBaseDomain?: string,
    planRepository?: PlanRepositoryPort,
    organizationRepository?: OrganizationRepositoryPort,
  ) {
    this.orchestrator = new TenantProvisioningOrchestrator(
      provisioner,
      tenantAdmin,
      organizationAdmin,
      keycloakAdmin,
      userTenantMembership,
      membershipRepository,
      outboxService,
      defaults,
      domainRegistry,
      tenantBaseDomain,
      planRepository,
      organizationRepository,
    );
  }

  async execute(input: {
    ctx: ExecutionContext;
    tenantId: string;
  }): Promise<OrchestratorProvisionResult> {
    requireSubject(input.ctx);
    return this.orchestrator.retry(input.tenantId);
  }
}

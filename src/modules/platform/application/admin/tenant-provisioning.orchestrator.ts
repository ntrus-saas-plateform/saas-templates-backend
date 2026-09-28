import type { TenantDatabaseProvisionerPort } from '../../../../core/domain/ports/tenant-provisioning.port.js';
import type { TenantAdminPort } from '../../../identity/domain/ports/tenant-admin.port.js';
import type { OrganizationAdminPort } from '../../../identity/domain/ports/organization-admin.port.js';
import type { KeycloakAdminPort } from '../../../identity/domain/ports/keycloak-admin.port.js';
import type { UserTenantMembershipPort } from '../../../identity/domain/ports/user-tenant-membership.port.js';
import type { MembershipRepositoryPort } from '../../../identity/domain/ports/membership-repository.port.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { ProvisionTenantDefaults } from './provision-tenant.defaults.js';
import type { OrganizationRepositoryPort } from '../../../identity/domain/ports/organization-repository.port.js';
import type { DomainRegistryPort } from '../../../identity/domain/ports/domain-registry.port.js';
import type { PlanRepositoryPort } from '../../../identity/domain/ports/plan-repository.port.js';
import { TENANT_DATABASE_CREDENTIALS_REF } from '../../../../shared/database/database.constants.js';
import { TenantStatus, TenantProvisioningStep } from '../../../identity/domain/tenant/tenant.entity.js';
import { DomainType } from '../../../identity/domain/domain/tenant-domain.entity.js';
import { assertSubdomainAllowed } from '../../../../shared/tenancy/reserved-subdomains.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  createTenantProvisioningStartedEvent,
  createTenantProvisioningFailedEvent,
  createTenantProvisioningCompletedEvent,
} from '../../domain/events/tenant-provisioning.events.js';

export interface OrchestratorProvisionInput {
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
}

export interface OrchestratorProvisionResult {
  tenantId: string;
  slug: string;
  status: string;
  provisioningStep: string | null;
  defaultOrganizationId: string | null;
  databaseName: string;
  databaseUsername: string;
}

const STEP_ORDER: TenantProvisioningStep[] = [
  TenantProvisioningStep.REQUESTED,
  TenantProvisioningStep.DB_CREATED,
  TenantProvisioningStep.MIGRATED,
  TenantProvisioningStep.IDENTITY_CONFIGURED,
  TenantProvisioningStep.ORG_CONFIGURED,
  TenantProvisioningStep.ADMIN_CONFIGURED,
  TenantProvisioningStep.READY,
];

function stepIndex(step: TenantProvisioningStep | null): number {
  if (!step) return -1;
  return STEP_ORDER.indexOf(step);
}

function stepReached(current: TenantProvisioningStep | null, target: TenantProvisioningStep): boolean {
  return stepIndex(current) >= stepIndex(target);
}

export class TenantProvisioningOrchestrator {
  constructor(
    private readonly provisioner: TenantDatabaseProvisionerPort,
    private readonly tenantAdmin: TenantAdminPort,
    private readonly organizationAdmin: OrganizationAdminPort,
    private readonly keycloakAdmin: KeycloakAdminPort,
    private readonly userTenantMembership: UserTenantMembershipPort,
    private readonly membershipRepository: MembershipRepositoryPort,
    private readonly outboxService: ControlPlaneOutboxTransactionService,
    private readonly defaults: ProvisionTenantDefaults,
    private readonly domainRegistry?: DomainRegistryPort,
    private readonly tenantBaseDomain?: string,
    private readonly planRepository?: PlanRepositoryPort,
    private readonly organizationRepository?: OrganizationRepositoryPort,
  ) {}

  async provision(input: OrchestratorProvisionInput): Promise<OrchestratorProvisionResult> {
    const slug = input.slug.trim().toLowerCase();
    const databaseName =
      input.databaseName ?? `tenant_${slug.replace(/[^a-z0-9_]/g, '_')}`.slice(0, 63);

    // 1. Check idempotency key for existing tenant
    let tenant = await this.tenantAdmin.findByProvisionIdempotencyKey(input.idempotencyKey);

    // If found, check if already completed
    if (tenant) {
      if (
        tenant.status === TenantStatus.ACTIVE &&
        tenant.provisioningStep === TenantProvisioningStep.READY
      ) {
        return {
          tenantId: tenant.id,
          slug: tenant.slug,
          status: tenant.status,
          provisioningStep: tenant.provisioningStep,
          defaultOrganizationId: tenant.defaultOrganizationId,
          databaseName: tenant.database.name,
          databaseUsername: tenant.database.username ?? '',
        };
      }
      // If FAILED, allow retry from failure step
      // If PROVISIONING, continue from current step
    }

    // 2. Register tenant if not yet created
    if (!tenant) {
      const { tenantId } = await this.provisioner.registerTenant({
        slug,
        region: input.region ?? 'eu-west-1',
        environment: input.environment ?? this.defaults.environment,
        databaseHost: input.databaseHost ?? this.defaults.databaseHost,
        databasePort: input.databasePort ?? this.defaults.databasePort,
        databaseName,
        credentialsReference: input.credentialsReference ?? TENANT_DATABASE_CREDENTIALS_REF,
        provisionIdempotencyKey: input.idempotencyKey,
      });
      tenant = await this.tenantAdmin.findById(tenantId);
      if (!tenant) throw new Error(`Failed to load tenant after registration: ${tenantId}`);

      // Publish started event
      try {
        await this.outboxService.runWithOutbox(tenant.id, async (_client, enqueue) => {
          await enqueue(
            createTenantProvisioningStartedEvent({
              tenantId: tenant!.id,
              slug: tenant!.slug,
              idempotencyKey: input.idempotencyKey,
            }),
          );
        });
      } catch {
        // Non-blocking — event publishing should not abort provisioning
      }
    } else {
      // Resume: clear previous failure fields
      tenant = await this.tenantAdmin.updateProvisioningProgress(tenant.id, {
        status: TenantStatus.PROVISIONING,
        failureReason: null,
        failureStep: null,
        lastAttemptAt: new Date(),
      });
    }

    const tenantId = tenant.id;

    try {
      // Step: DB_CREATED
      if (!stepReached(tenant.provisioningStep, TenantProvisioningStep.DB_CREATED)) {
        await this.provisioner.createDatabaseInfrastructure(tenantId);
        tenant = await this.tenantAdmin.findById(tenantId) ?? tenant;
      }

      // Step: MIGRATED
      if (!stepReached(tenant.provisioningStep, TenantProvisioningStep.MIGRATED)) {
        await this.provisioner.migrateAndGrant(tenantId);
        tenant = await this.tenantAdmin.findById(tenantId) ?? tenant;
      }

      // Step: IDENTITY_CONFIGURED (shared realm + assign default plan when missing)
      if (!stepReached(tenant.provisioningStep, TenantProvisioningStep.IDENTITY_CONFIGURED)) {
        let planId = tenant.planId;
        if (!planId && this.planRepository) {
          const plan = await this.planRepository.findByCode('STANDARD');
          planId = plan?.id ?? null;
        }
        tenant = await this.tenantAdmin.updateProvisioningProgress(tenantId, {
          provisioningStep: TenantProvisioningStep.IDENTITY_CONFIGURED,
          ...(planId ? { planId } : {}),
        });
      }

      // Step: ORG_CONFIGURED
      let defaultOrganizationId = tenant.defaultOrganizationId;
      if (!stepReached(tenant.provisioningStep, TenantProvisioningStep.ORG_CONFIGURED)) {
        const shouldBootstrap = input.bootstrapOrganization !== false;
        if (shouldBootstrap) {
          const orgSlug = (input.defaultOrganizationSlug ?? slug).trim().toLowerCase();
          const orgName = input.defaultOrganizationName ?? slug;

          let keycloakOrganizationId: string | undefined;
          if (await this.keycloakAdmin.isAvailable()) {
            try {
              keycloakOrganizationId = await this.keycloakAdmin.createOrganization(orgName, orgSlug);
            } catch {
              // Non-blocking; reconciliation will repair later
            }
          }

          const organization = await this.organizationAdmin.create({
            tenantId,
            name: orgName,
            slug: orgSlug,
            keycloakOrganizationId,
          });
          defaultOrganizationId = organization.id;
        }

        tenant = await this.tenantAdmin.updateProvisioningProgress(tenantId, {
          provisioningStep: TenantProvisioningStep.ORG_CONFIGURED,
          defaultOrganizationId,
        });
      }

      // Step: ADMIN_CONFIGURED
      if (!stepReached(tenant.provisioningStep, TenantProvisioningStep.ADMIN_CONFIGURED)) {
        if (input.ownerIdentityId && defaultOrganizationId) {
          await this.userTenantMembership.ensureMember(input.ownerIdentityId, tenantId);
          await this.tenantAdmin.setOwner(tenantId, input.ownerIdentityId);
          await this.membershipRepository.create({
            userId: input.ownerIdentityId,
            tenantId,
            organizationId: defaultOrganizationId,
            roles: ['tenant-owner'],
            permissions: [],
          });

          const org =
            (await this.organizationRepository?.findById(tenantId, defaultOrganizationId)) ?? null;
          const kcOrgId = org?.keycloakOrganizationId;
          if (
            kcOrgId &&
            !kcOrgId.startsWith('kc-') &&
            (await this.keycloakAdmin.isAvailable())
          ) {
            try {
              await this.keycloakAdmin.addUserToOrganization(kcOrgId, input.ownerIdentityId);
              await this.keycloakAdmin.setUserActiveOrganization(input.ownerIdentityId, kcOrgId);
            } catch {
              // Non-blocking; reconciliation repairs later
            }
          }
        } else if (input.ownerIdentityId) {
          await this.userTenantMembership.ensureMember(input.ownerIdentityId, tenantId);
          await this.tenantAdmin.setOwner(tenantId, input.ownerIdentityId);
        }

        tenant = await this.tenantAdmin.updateProvisioningProgress(tenantId, {
          provisioningStep: TenantProvisioningStep.ADMIN_CONFIGURED,
        });
      }

      // Step: READY — mark ACTIVE
      tenant = await this.tenantAdmin.updateProvisioningProgress(tenantId, {
        status: TenantStatus.ACTIVE,
        provisioningStep: TenantProvisioningStep.READY,
        failureReason: null,
        failureStep: null,
      });

      // Reload to get fresh database fields
      const freshTenant = await this.tenantAdmin.findById(tenantId) ?? tenant;

      // Register primary subdomain when base domain is configured
      if (this.domainRegistry && this.tenantBaseDomain) {
        const subdomainLabel = freshTenant.slug;
        try {
          assertSubdomainAllowed(subdomainLabel);
          const hostname = `${subdomainLabel}.${this.tenantBaseDomain}`;
          // Check if already registered (idempotency)
          const existing = await this.domainRegistry.findByHostname(hostname);
          if (!existing) {
            await this.domainRegistry.create({
              tenantId,
              hostname,
              type: DomainType.SUBDOMAIN,
              isPrimary: true,
            });
          }
        } catch (error) {
          if (error instanceof DomainError && error.code === ErrorCode.CONFLICT) {
            // Hostname already registered — non-blocking, idempotent
          } else {
            // Re-throw VALIDATION_ERROR (reserved subdomain) and unexpected errors
            throw error;
          }
        }
      }

      // Publish completed event
      try {
        await this.outboxService.runWithOutbox(tenantId, async (_client, enqueue) => {
          await enqueue(
            createTenantProvisioningCompletedEvent({
              tenantId,
              slug: freshTenant.slug,
              defaultOrganizationId: freshTenant.defaultOrganizationId,
            }),
          );
        });
      } catch {
        // Non-blocking
      }

      return {
        tenantId,
        slug: freshTenant.slug,
        status: freshTenant.status,
        provisioningStep: freshTenant.provisioningStep,
        defaultOrganizationId: freshTenant.defaultOrganizationId,
        databaseName: freshTenant.database.name,
        databaseUsername: freshTenant.database.username ?? '',
      };
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : String(error);
      const currentStep = tenant.provisioningStep ?? TenantProvisioningStep.REQUESTED;

      const currentTenant = await this.tenantAdmin.findById(tenantId).catch(() => tenant);
      const retryCount = (currentTenant?.retryCount ?? 0) + 1;

      await this.tenantAdmin
        .updateProvisioningProgress(tenantId, {
          status: TenantStatus.FAILED,
          failureReason,
          failureStep: currentStep,
          lastAttemptAt: new Date(),
          retryCount,
        })
        .catch(() => {
          // Best-effort
        });

      // Publish failed event
      try {
        await this.outboxService.runWithOutbox(tenantId, async (_client, enqueue) => {
          await enqueue(
            createTenantProvisioningFailedEvent({
              tenantId,
              slug,
              failureStep: currentStep,
              failureReason,
              retryCount,
            }),
          );
        });
      } catch {
        // Non-blocking
      }

      throw error;
    }
  }

  async retry(tenantId: string): Promise<OrchestratorProvisionResult> {
    const tenant = await this.tenantAdmin.findById(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    if (
      tenant.status !== TenantStatus.FAILED &&
      tenant.status !== TenantStatus.PROVISIONING
    ) {
      throw new Error(
        `Cannot retry tenant in status '${tenant.status}'. Must be FAILED or PROVISIONING.`,
      );
    }

    const resumeStep =
      tenant.failureStep ?? tenant.provisioningStep ?? TenantProvisioningStep.REQUESTED;

    return this.provision({
      idempotencyKey: tenant.provisionIdempotencyKey ?? `retry-${tenantId}`,
      slug: tenant.slug,
      databaseHost: tenant.database.host,
      databasePort: tenant.database.port,
      databaseName: tenant.database.name,
      credentialsReference: tenant.database.credentialsReference,
    });
  }
}

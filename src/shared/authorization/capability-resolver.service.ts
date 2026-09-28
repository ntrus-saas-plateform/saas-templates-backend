import { Injectable, Inject } from '@nestjs/common';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { AuthorizationService } from './authorization.service.js';
import { PLAN_REPOSITORY_PORT } from '../../modules/identity/domain/ports/plan-repository.port.js';
import type { PlanRepositoryPort } from '../../modules/identity/domain/ports/plan-repository.port.js';
import { TENANT_REGISTRY_PORT } from '../../modules/identity/domain/ports/tenant-registry.port.js';
import type { TenantRegistryPort } from '../../modules/identity/domain/ports/tenant-registry.port.js';
import { ORGANIZATION_REPOSITORY_PORT } from '../../modules/identity/domain/ports/organization-repository.port.js';
import type { OrganizationRepositoryPort } from '../../modules/identity/domain/ports/organization-repository.port.js';
import { FEATURE_FLAG_SERVICE_PORT } from '../../modules/identity/domain/feature-flag/feature-flag.port.js';
import type { FeatureFlagServicePort } from '../../modules/identity/domain/feature-flag/feature-flag.port.js';
import { DomainError, ErrorCode } from '../../core/domain/errors/domain-error.js';

/**
 * Module → permission prefix mapping used to compute navigationHints.
 * A module is considered "relevant" to a user when they hold at least one permission
 * whose key starts with one of the module's prefixes.
 */
const MODULE_PERMISSION_PREFIXES: Record<string, readonly string[]> = {
  identity: ['organizations:', 'users:', 'memberships:', 'roles:', 'permissions:', 'settings:', 'security:', 'tenant:'],
  customer: ['customers:', 'customer:'],
  pharmacy: ['customers:set_patient'],
  platform: ['platform:'],
};

export interface CapabilitiesSnapshot {
  plan: {
    code: string;
    name: string;
    maxOrganizations: number;
    maxUsers: number;
  } | null;
  modules: Record<string, boolean>;
  permissions: string[];
  /** Flat map of effective permission → true for FE gating. */
  capabilityMap: Record<string, boolean>;
  features: Record<string, boolean>;
  organizations: {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: string;
  }[];
  defaultOrganizationId: string | null;
  navigationHints: string[];
  /** Multi-vertical business profile (null if not assigned). */
  businessProfile: string | null;
  /** ENABLED capability codes for the active organization. */
  enabledCapabilities: string[];
  businessConfigVersion: number;
}

@Injectable()
export class CapabilityResolverService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly authorizationService: AuthorizationService,
    @Inject(PLAN_REPOSITORY_PORT)
    private readonly planRepository: PlanRepositoryPort,
    @Inject(TENANT_REGISTRY_PORT)
    private readonly tenantRegistry: TenantRegistryPort,
    @Inject(ORGANIZATION_REPOSITORY_PORT)
    private readonly organizationRepository: OrganizationRepositoryPort,
    @Inject(FEATURE_FLAG_SERVICE_PORT)
    private readonly featureFlags: FeatureFlagServicePort,
  ) {}

  async resolveForCurrentUser(): Promise<CapabilitiesSnapshot> {
    const ctx = this.tenantContext.getOrThrow();
    const tenantId = ctx.tenantId;

    const [tenant, permissions, features] = await Promise.all([
      this.tenantRegistry.findById(tenantId),
      this.authorizationService.resolveEffectivePermissions(),
      this.featureFlags
        .listFlags({ tenantId, organizationId: ctx.organizationId, userId: ctx.userId })
        .catch(() => ({} as Record<string, boolean>)),
    ]);

    let planMeta: CapabilitiesSnapshot['plan'] = null;
    let modules: Record<string, boolean> = {};

    if (tenant?.planId) {
      const [plan, planModules] = await Promise.all([
        this.planRepository.findById(tenant.planId),
        this.planRepository.findModules(tenant.planId),
      ]);

      if (plan) {
        const quotas = await this.planRepository.getEffectiveQuotas(tenant);
        planMeta = {
          code: plan.code,
          name: plan.name,
          maxOrganizations: quotas.maxOrganizations,
          maxUsers: quotas.maxUsers,
        };

        for (const mod of planModules) {
          const featureFlagKey = `module.${mod.moduleKey}`;
          const flagEnabled = featureFlagKey in features ? features[featureFlagKey] : true;
          modules[mod.moduleKey] = mod.enabled && flagEnabled;
        }
      }
    }

    const organizations = ctx.subjectId
      ? await this.organizationRepository
          .findByUserMembership(tenantId, ctx.subjectId)
          .catch(() => [])
      : [];

    const navigationHints = this.computeNavigationHints(modules, permissions as string[]);
    const permList = permissions as string[];
    const capabilityMap: Record<string, boolean> = {};
    for (const p of permList) {
      capabilityMap[p] = true;
    }

    return {
      plan: planMeta,
      modules,
      permissions: permList,
      capabilityMap,
      features,
      organizations: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        type: org.type,
        status: org.status,
      })),
      defaultOrganizationId: tenant?.defaultOrganizationId ?? null,
      navigationHints,
      businessProfile: null,
      enabledCapabilities: [],
      businessConfigVersion: 0,
    };
  }

  async isModuleEnabled(tenantId: string, moduleKey: string): Promise<boolean> {
    const licensed = await this.getLicensedModules(tenantId);
    return licensed.has(moduleKey);
  }

  /**
   * Plan modules that are licensed AND not disabled by `module.*` feature flags.
   * Used as the hard gate for capability enable / pack install (`licensedModules`).
   */
  async getLicensedModules(tenantId: string): Promise<ReadonlySet<string>> {
    const tenant = await this.tenantRegistry.findById(tenantId);
    let planId = tenant?.planId ?? null;
    if (!planId) {
      const standard = await this.planRepository.findByCode('STANDARD');
      planId = standard?.id ?? null;
    }
    if (!planId) return new Set();

    const modules = await this.planRepository.findModules(planId);
    const licensed = new Set<string>();
    for (const mod of modules) {
      if (!mod.enabled) continue;
      const featureFlagKey = `module.${mod.moduleKey}`;
      const flagEnabled = await this.featureFlags
        .isEnabled(featureFlagKey, { tenantId })
        .catch(() => true);
      if (flagEnabled) licensed.add(mod.moduleKey);
    }
    return licensed;
  }

  async assertModuleEnabled(tenantId: string, moduleKey: string): Promise<void> {
    const enabled = await this.isModuleEnabled(tenantId, moduleKey);
    if (!enabled) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        `Module '${moduleKey}' is not enabled for this tenant`,
      );
    }
  }

  private computeNavigationHints(
    modules: Record<string, boolean>,
    permissions: string[],
  ): string[] {
    const hints: string[] = [];
    for (const [moduleKey, enabled] of Object.entries(modules)) {
      if (!enabled) continue;
      const prefixes = MODULE_PERMISSION_PREFIXES[moduleKey];
      if (!prefixes) {
        hints.push(moduleKey);
        continue;
      }
      const hasRelatedPermission = permissions.some((perm) =>
        prefixes.some((prefix) => perm.startsWith(prefix)),
      );
      if (hasRelatedPermission) {
        hints.push(moduleKey);
      }
    }
    return hints;
  }
}

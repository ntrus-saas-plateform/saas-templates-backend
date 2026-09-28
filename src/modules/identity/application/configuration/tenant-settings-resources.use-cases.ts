import type { UseCase } from '../common/use-case.js';
import type { ExecutionContext } from '../common/execution-context.js';
import type { TenantSettingsResourcesPort } from '../../domain/ports/tenant-settings-resources.port.js';
import type { PlanRepositoryPort } from '../../domain/ports/plan-repository.port.js';
import type { TenantRegistryPort } from '../../domain/ports/tenant-registry.port.js';
import type { ConfigurationResolverPort } from '../../domain/ports/configuration-resolver.port.js';
import type { SettingsRepositoryPort } from '../../domain/ports/settings-repository.port.js';
import { getSettingsCatalog } from '../../domain/configuration/setting-definition.js';
import { accessDeniedError } from '../../../../core/domain/errors/access-denied.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { PaginatedResult } from '../common/pagination.js';
import { buildPaginationMeta, normalizePageLimit } from '../common/pagination.js';

const RESOURCE_TABLE: Record<string, string> = {
  currencies: 'tenant_currencies',
  'fx-rates': 'tenant_fx_rates',
  'fiscal-years': 'tenant_fiscal_years',
  'fiscal-periods': 'tenant_fiscal_periods',
  'tax-categories': 'tenant_tax_categories',
  'tax-jurisdictions': 'tenant_tax_jurisdictions',
  'tax-rates': 'tenant_tax_rates',
  'tax-rules': 'tenant_tax_rules',
  'tax-exemptions': 'tenant_tax_exemptions',
  numbering: 'tenant_number_sequences',
  'document-templates': 'tenant_document_templates',
  integrations: 'tenant_integrations',
  'api-keys': 'tenant_api_keys',
  webhooks: 'tenant_webhooks',
  'oauth-apps': 'tenant_oauth_apps',
  'service-accounts': 'tenant_service_accounts',
  'billing-subscriptions': 'tenant_billing_subscriptions',
  'billing-invoices': 'tenant_billing_invoices',
  'data-jobs': 'tenant_data_jobs',
};

export function resolveResourceTable(resource: string): string {
  const table = RESOURCE_TABLE[resource];
  if (!table) throw new DomainError(ErrorCode.VALIDATION_ERROR, `Unknown resource: ${resource}`);
  return table;
}

export class GetSettingsCatalogUseCase {
  async execute(): Promise<ReturnType<typeof getSettingsCatalog>> {
    return getSettingsCatalog();
  }
}

export class ListTenantResourceUseCase
  implements UseCase<{ ctx: ExecutionContext; resource: string }, Record<string, unknown>[]>
{
  constructor(private readonly resources: TenantSettingsResourcesPort) {}

  async execute(input: { ctx: ExecutionContext; resource: string }) {
    return this.resources.list(input.ctx.tenantId, resolveResourceTable(input.resource));
  }
}

export class CreateTenantResourceUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; resource: string; body: Record<string, unknown> },
      Record<string, unknown>
    >
{
  constructor(private readonly resources: TenantSettingsResourcesPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    resource: string;
    body: Record<string, unknown>;
  }) {
    return this.resources.insert(
      input.ctx.tenantId,
      resolveResourceTable(input.resource),
      input.body,
    );
  }
}

export class UpdateTenantResourceUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; resource: string; id: string; body: Record<string, unknown> },
      Record<string, unknown>
    >
{
  constructor(private readonly resources: TenantSettingsResourcesPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    resource: string;
    id: string;
    body: Record<string, unknown>;
  }) {
    const updated = await this.resources.update(
      input.ctx.tenantId,
      resolveResourceTable(input.resource),
      input.id,
      input.body,
    );
    if (!updated) throw accessDeniedError();
    return updated;
  }
}

export class DeleteTenantResourceUseCase
  implements UseCase<{ ctx: ExecutionContext; resource: string; id: string }, { deleted: boolean }>
{
  constructor(private readonly resources: TenantSettingsResourcesPort) {}

  async execute(input: { ctx: ExecutionContext; resource: string; id: string }) {
    const deleted = await this.resources.remove(
      input.ctx.tenantId,
      resolveResourceTable(input.resource),
      input.id,
    );
    if (!deleted) throw accessDeniedError();
    return { deleted: true };
  }
}

export class PreviewNumberSequenceUseCase
  implements UseCase<{ ctx: ExecutionContext; id: string }, { preview: string; nextValue: number }>
{
  constructor(private readonly resources: TenantSettingsResourcesPort) {}

  async execute(input: { ctx: ExecutionContext; id: string }) {
    const result = await this.resources.previewNumber(input.ctx.tenantId, input.id);
    if (!result) throw accessDeniedError();
    return result;
  }
}

export class NextNumberSequenceUseCase
  implements UseCase<{ ctx: ExecutionContext; id: string }, { preview: string; nextValue: number }>
{
  constructor(private readonly resources: TenantSettingsResourcesPort) {}

  async execute(input: { ctx: ExecutionContext; id: string }) {
    const result = await this.resources.nextNumber(input.ctx.tenantId, input.id);
    if (!result) throw accessDeniedError();
    return result;
  }
}

export class ListAuditLogsUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        page?: number;
        limit?: number;
        action?: string;
        resource?: string;
        from?: string;
        to?: string;
      },
      PaginatedResult<Record<string, unknown>>
    >
{
  constructor(private readonly resources: TenantSettingsResourcesPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    page?: number;
    limit?: number;
    action?: string;
    resource?: string;
    from?: string;
    to?: string;
  }) {
    const { page, limit } = normalizePageLimit(input.page, input.limit);
    const result = await this.resources.listAuditLogs(input.ctx.tenantId, {
      page,
      limit,
      action: input.action,
      resource: input.resource,
      from: input.from,
      to: input.to,
    });
    return {
      data: result.items,
      pagination: buildPaginationMeta(page, limit, result.total),
    };
  }
}

export class GetTenantModulesUseCase
  implements
    UseCase<
      { ctx: ExecutionContext },
      { modules: Array<{ key: string; planEnabled: boolean; overlayEnabled: boolean; effective: boolean }> }
    >
{
  constructor(
    private readonly plans: PlanRepositoryPort,
    private readonly tenants: TenantRegistryPort,
    private readonly configurationResolver: ConfigurationResolverPort,
  ) {}

  async execute(input: { ctx: ExecutionContext }) {
    const tenant = await this.tenants.findById(input.ctx.tenantId);
    if (!tenant) throw accessDeniedError();
    const planModules = tenant.planId
      ? await this.plans.findModules(tenant.planId)
      : [];
    const overlay = await this.configurationResolver.resolveNamespace('modules', {
      tenantId: input.ctx.tenantId,
    });
    const keys = new Set([
      ...planModules.map((m) => m.moduleKey),
      ...Object.keys(overlay),
    ]);
    const modules = [...keys].sort().map((key) => {
      const planEnabled = planModules.find((m) => m.moduleKey === key)?.enabled ?? false;
      const overlayEnabled = overlay[key] !== false;
      return {
        key,
        planEnabled,
        overlayEnabled,
        effective: planEnabled && overlayEnabled,
      };
    });
    return { modules };
  }
}

export class PatchTenantModulesUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; overlays: Record<string, boolean> },
      { modules: Array<{ key: string; planEnabled: boolean; overlayEnabled: boolean; effective: boolean }> }
    >
{
  constructor(
    private readonly settings: SettingsRepositoryPort,
    private readonly getModules: GetTenantModulesUseCase,
  ) {}

  async execute(input: { ctx: ExecutionContext; overlays: Record<string, boolean> }) {
    for (const [key, value] of Object.entries(input.overlays)) {
      await this.settings.setTenantSetting(input.ctx.tenantId, 'modules', key, value);
    }
    return this.getModules.execute({ ctx: input.ctx });
  }
}

export class GetTenantBillingOverviewUseCase
  implements
    UseCase<
      { ctx: ExecutionContext },
      {
        plan: Record<string, unknown> | null;
        quotas: Record<string, unknown> | null;
        subscription: Record<string, unknown> | null;
        invoices: Record<string, unknown>[];
        billingSettings: Record<string, unknown>;
      }
    >
{
  constructor(
    private readonly tenants: TenantRegistryPort,
    private readonly plans: PlanRepositoryPort,
    private readonly resources: TenantSettingsResourcesPort,
    private readonly configurationResolver: ConfigurationResolverPort,
  ) {}

  async execute(input: { ctx: ExecutionContext }) {
    const tenant = await this.tenants.findById(input.ctx.tenantId);
    if (!tenant) throw accessDeniedError();
    const plan = tenant.planId ? await this.plans.findById(tenant.planId) : null;
    const quotas = await this.plans.getEffectiveQuotas(tenant);
    const subscriptions = await this.resources.list(
      input.ctx.tenantId,
      'tenant_billing_subscriptions',
    );
    const invoices = await this.resources.list(input.ctx.tenantId, 'tenant_billing_invoices');
    const billingSettings = await this.configurationResolver.resolveNamespace('billing', {
      tenantId: input.ctx.tenantId,
    });
    return {
      plan: plan
        ? {
            id: plan.id,
            code: plan.code,
            name: plan.name,
            maxOrganizations: plan.maxOrganizations,
            maxUsers: plan.maxUsers,
          }
        : null,
      quotas: quotas as unknown as Record<string, unknown>,
      subscription: subscriptions[0] ?? null,
      invoices,
      billingSettings,
    };
  }
}

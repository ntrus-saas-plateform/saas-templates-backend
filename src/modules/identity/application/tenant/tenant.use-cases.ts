import type { UseCase } from '../common/use-case.js';
import type { ExecutionContext } from '../common/execution-context.js';
import { assertTenantScope, requireSubject } from '../common/access-control.js';
import type { TenantRegistryPort } from '../../domain/ports/tenant-registry.port.js';
import type { TenantAdminPort } from '../../domain/ports/tenant-admin.port.js';
import type { UserTenantMembershipPort } from '../../domain/ports/user-tenant-membership.port.js';
import type { ControlPlaneTransactionPort } from '../../domain/ports/control-plane-transaction.port.js';
import type { SettingsRepositoryPort } from '../../domain/ports/settings-repository.port.js';
import type { TenantProfileUpdate } from '../../domain/tenant/tenant-profile.js';
import type { Tenant, TenantStatus } from '../../domain/tenant/tenant.entity.js';
import { accessDeniedError } from '../../../../core/domain/errors/access-denied.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { TenantKeycloakLifecycleService } from '../services/tenant-keycloak-lifecycle.service.js';

export class GetTenantUseCase implements UseCase<{ ctx: ExecutionContext; tenantId: string }, Tenant> {
  constructor(private readonly tenantRegistry: TenantRegistryPort) {}

  async execute(input: { ctx: ExecutionContext; tenantId: string }): Promise<Tenant> {
    assertTenantScope(input.ctx, input.tenantId);
    const tenant = await this.tenantRegistry.findById(input.tenantId);
    if (!tenant) throw accessDeniedError();
    return tenant;
  }
}

export class UpdateTenantUseCase
  implements UseCase<{ ctx: ExecutionContext; tenantId: string; update: TenantProfileUpdate }, Tenant>
{
  constructor(
    private readonly tenantAdmin: TenantAdminPort,
    private readonly settings?: SettingsRepositoryPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    tenantId: string;
    update: TenantProfileUpdate;
  }): Promise<Tenant> {
    assertTenantScope(input.ctx, input.tenantId);
    const tenant = await this.tenantAdmin.updateProfile(input.tenantId, input.update);

    if (this.settings) {
      const syncPairs: Array<[string, string, unknown]> = [];
      if (input.update.timezone !== undefined) {
        syncPairs.push(['localization', 'timezone', input.update.timezone]);
      }
      if (input.update.locale !== undefined) {
        syncPairs.push(['localization', 'locale', input.update.locale]);
      }
      if (input.update.defaultCurrency !== undefined) {
        syncPairs.push(['localization', 'currency', input.update.defaultCurrency]);
        syncPairs.push(['currency', 'primary', input.update.defaultCurrency]);
      }
      if (input.update.defaultLanguage !== undefined) {
        syncPairs.push(['localization', 'defaultLanguage', input.update.defaultLanguage]);
      }
      if (input.update.dateFormat !== undefined) {
        syncPairs.push(['localization', 'dateFormat', input.update.dateFormat]);
      }
      if (input.update.timeFormat !== undefined) {
        syncPairs.push(['localization', 'timeFormat', input.update.timeFormat]);
      }
      if (input.update.numberFormat !== undefined) {
        syncPairs.push(['localization', 'numberFormat', input.update.numberFormat]);
      }
      if (input.update.displayName !== undefined) {
        syncPairs.push(['branding', 'displayName', input.update.displayName ?? '']);
      }
      if (input.update.country !== undefined) {
        syncPairs.push(['regional', 'country', input.update.country]);
      }
      if (input.update.fiscalCalendar !== undefined) {
        syncPairs.push(['fiscal', 'calendar', input.update.fiscalCalendar]);
      }
      if (input.update.fiscalYearStartMonth !== undefined) {
        syncPairs.push(['fiscal', 'yearStartMonth', input.update.fiscalYearStartMonth]);
      }
      if (input.update.fiscalYearStartDay !== undefined) {
        syncPairs.push(['fiscal', 'yearStartDay', input.update.fiscalYearStartDay]);
      }
      for (const [ns, key, value] of syncPairs) {
        await this.settings.setTenantSetting(input.tenantId, ns, key, value);
      }
    }

    return tenant;
  }
}

export class TransitionTenantStatusUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; tenantId: string; status: TenantStatus; skipTenantScope?: boolean },
      Tenant
    >
{
  constructor(
    private readonly tenantAdmin: TenantAdminPort,
    private readonly keycloakLifecycle: TenantKeycloakLifecycleService,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    tenantId: string;
    status: TenantStatus;
    skipTenantScope?: boolean;
  }): Promise<Tenant> {
    if (!input.skipTenantScope) {
      assertTenantScope(input.ctx, input.tenantId);
    }
    const tenant = await this.tenantAdmin.transitionStatus(input.tenantId, input.status);
    await this.keycloakLifecycle.syncTenantStatus(input.tenantId, tenant.status);
    return tenant;
  }
}

export class TransferTenantOwnershipUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; tenantId: string; newOwnerIdentityId: string },
      { tenantId: string; ownerIdentityId: string }
    >
{
  constructor(
    private readonly tenantAdmin: TenantAdminPort,
    private readonly userTenantMembership: UserTenantMembershipPort,
    private readonly controlPlaneTransaction: ControlPlaneTransactionPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    tenantId: string;
    newOwnerIdentityId: string;
  }): Promise<{ tenantId: string; ownerIdentityId: string }> {
    const ctx = requireSubject(input.ctx);
    assertTenantScope(ctx, input.tenantId);

    await this.controlPlaneTransaction.runInTransaction(async (client) => {
      const currentOwner = await this.tenantAdmin.getOwnerIdentityId(input.tenantId, client);
      if (currentOwner && currentOwner !== ctx.subjectId) {
        throw accessDeniedError();
      }

      const transferred = await this.tenantAdmin.transferOwnership(
        input.tenantId,
        currentOwner,
        input.newOwnerIdentityId,
        client,
      );
      if (!transferred) {
        throw new DomainError(ErrorCode.CONFLICT, 'Tenant ownership was already transferred');
      }

      await this.userTenantMembership.ensureMember(
        input.newOwnerIdentityId,
        input.tenantId,
        client,
      );
    });

    return { tenantId: input.tenantId, ownerIdentityId: input.newOwnerIdentityId };
  }
}

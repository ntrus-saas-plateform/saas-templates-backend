import type { UseCase } from '../../../identity/application/common/use-case.js';
import type { ExecutionContext } from '../../../identity/application/common/execution-context.js';
import { requireSubject } from '../../../identity/application/common/access-control.js';
import type { TenantDatabaseProvisionerPort } from '../../../../core/domain/ports/tenant-provisioning.port.js';

/**
 * Soft or hard tenant teardown.
 * Soft: status → DELETED (data retained).
 * Hard: close pools, DROP DATABASE + DROP ROLE, then DELETED.
 *
 * Identity model reminder: Keycloak uses one shared realm; tenant isolation is JWT tenant_id
 * plus one or more Keycloak Organizations — deprovision does not delete a realm.
 */
export class DeprovisionTenantUseCase
  implements
    UseCase<{ ctx: ExecutionContext; tenantId: string; hard?: boolean }, { tenantId: string; hard: boolean }>
{
  constructor(private readonly provisioner: TenantDatabaseProvisionerPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    tenantId: string;
    hard?: boolean;
  }): Promise<{ tenantId: string; hard: boolean }> {
    requireSubject(input.ctx);
    const hard = input.hard === true;
    await this.provisioner.deprovision(input.tenantId, { hard });
    return { tenantId: input.tenantId, hard };
  }
}

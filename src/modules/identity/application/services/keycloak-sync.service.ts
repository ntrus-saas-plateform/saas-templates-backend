import type { KeycloakAdminPort } from '../../domain/ports/keycloak-admin.port.js';
import type { FeatureFlagServicePort } from '../../domain/feature-flag/feature-flag.port.js';
import type { Organization } from '../../domain/organization/organization.entity.js';
import type { ExecutionContext } from '../common/execution-context.js';

export class KeycloakOrganizationSyncService {
  constructor(
    private readonly keycloakAdmin: KeycloakAdminPort,
    private readonly featureFlags: FeatureFlagServicePort,
  ) {}

  async syncOrganizationUpdate(
    ctx: ExecutionContext,
    organization: Organization,
    name: string,
    slug: string,
  ): Promise<void> {
    if (!(await this.isSyncEnabled(ctx)) || !(await this.keycloakAdmin.isAvailable())) return;
    if (!this.isRealKeycloakOrgId(organization.keycloakOrganizationId)) return;
    try {
      await this.keycloakAdmin.updateOrganization(
        organization.keycloakOrganizationId,
        name,
        slug,
      );
    } catch {
      // Non-blocking Keycloak sync
    }
  }

  async syncMembership(
    ctx: ExecutionContext,
    organization: Organization,
    userId: string,
    action: 'add' | 'remove',
  ): Promise<void> {
    if (!(await this.isSyncEnabled(ctx)) || !(await this.keycloakAdmin.isAvailable())) return;
    if (!this.isRealKeycloakOrgId(organization.keycloakOrganizationId)) return;
    try {
      if (action === 'add') {
        await this.keycloakAdmin.addUserToOrganization(
          organization.keycloakOrganizationId,
          userId,
        );
      } else {
        await this.keycloakAdmin.removeUserFromOrganization(
          organization.keycloakOrganizationId,
          userId,
        );
      }
    } catch {
      // Non-blocking Keycloak sync
    }
  }

  async resolveKeycloakOrganizationId(
    ctx: ExecutionContext,
    name: string,
    slug: string,
  ): Promise<string | undefined> {
    if (!(await this.isSyncEnabled(ctx)) || !(await this.keycloakAdmin.isAvailable())) {
      return undefined;
    }
    try {
      return await this.keycloakAdmin.createOrganization(name, slug);
    } catch {
      return undefined;
    }
  }

  private async isSyncEnabled(ctx: ExecutionContext): Promise<boolean> {
    return this.featureFlags.isEnabled('keycloakSync', {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
    });
  }

  private isRealKeycloakOrgId(keycloakOrganizationId: string): boolean {
    return !keycloakOrganizationId.startsWith('kc-');
  }
}

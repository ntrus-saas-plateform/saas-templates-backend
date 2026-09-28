import { Injectable, Inject } from '@nestjs/common';
import { KEYCLOAK_ADMIN_PORT } from '../../domain/ports/keycloak-admin.port.js';
import type { KeycloakAdminPort } from '../../domain/ports/keycloak-admin.port.js';
import { USER_TENANT_MEMBERSHIP_PORT } from '../../domain/ports/user-tenant-membership.port.js';
import type { UserTenantMembershipPort } from '../../domain/ports/user-tenant-membership.port.js';
import { TenantStatus } from '../../domain/tenant/tenant.entity.js';
import { TOKEN_REVOCATION_PORT } from '../../../../core/domain/ports/token-revocation.port.js';
import type { TokenRevocationPort } from '../../../../core/domain/ports/token-revocation.port.js';

@Injectable()
export class TenantKeycloakLifecycleService {
  constructor(
    @Inject(KEYCLOAK_ADMIN_PORT) private readonly keycloakAdmin: KeycloakAdminPort,
    @Inject(USER_TENANT_MEMBERSHIP_PORT)
    private readonly userTenantMembership: UserTenantMembershipPort,
    @Inject(TOKEN_REVOCATION_PORT)
    private readonly tokenRevocation: TokenRevocationPort,
  ) {}

  async syncTenantStatus(tenantId: string, status: TenantStatus): Promise<void> {
    if (!(await this.keycloakAdmin.isAvailable())) return;

    const memberIds = await this.userTenantMembership.listActiveMemberIdentityIds(tenantId);
    if (memberIds.length === 0) return;

    const lockAccess =
      status === TenantStatus.SUSPENDED ||
      status === TenantStatus.DEACTIVATING ||
      status === TenantStatus.DELETED ||
      status === TenantStatus.ARCHIVED;

    for (const identityId of memberIds) {
      try {
        if (lockAccess) {
          await this.keycloakAdmin.revokeAllUserSessions(identityId);
          await this.keycloakAdmin.setUserEnabled(identityId, false);
          await this.tokenRevocation.revokeAllTokensForSubject(identityId);
        } else if (status === TenantStatus.ACTIVE) {
          await this.keycloakAdmin.setUserEnabled(identityId, true);
        }
      } catch {
        // Non-blocking: DB status is source of truth; KC sync is best-effort
      }
    }
  }
}

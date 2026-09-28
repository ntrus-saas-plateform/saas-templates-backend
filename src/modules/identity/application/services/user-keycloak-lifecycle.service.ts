import type { KeycloakAdminPort } from '../../domain/ports/keycloak-admin.port.js';
import type { TokenRevocationPort } from '../../../../core/domain/ports/token-revocation.port.js';

export class UserKeycloakLifecycleService {
  constructor(
    private readonly keycloakAdmin: KeycloakAdminPort,
    private readonly tokenRevocation: TokenRevocationPort,
  ) {}

  async disableUser(identityId: string): Promise<void> {
    if (await this.keycloakAdmin.isAvailable()) {
      await this.keycloakAdmin.revokeAllUserSessions(identityId);
      await this.keycloakAdmin.setUserEnabled(identityId, false);
    }
    await this.tokenRevocation.revokeAllTokensForSubject(identityId);
  }

  async enableUser(identityId: string): Promise<void> {
    if (await this.keycloakAdmin.isAvailable()) {
      await this.keycloakAdmin.setUserEnabled(identityId, true);
    }
  }
}

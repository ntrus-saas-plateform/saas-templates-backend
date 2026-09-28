import { Global, Module } from '@nestjs/common';
import { KEYCLOAK_ADMIN_PORT } from '../../modules/identity/domain/ports/keycloak-admin.port.js';
import { KeycloakAdminClient } from './keycloak-admin.client.js';
import { TokenIntrospectionService } from './token-introspection.service.js';
import { KeycloakRealmResolver } from './keycloak-realm.resolver.js';

@Global()
@Module({
  providers: [
    KeycloakRealmResolver,
    { provide: KEYCLOAK_ADMIN_PORT, useClass: KeycloakAdminClient },
    TokenIntrospectionService,
  ],
  exports: [KEYCLOAK_ADMIN_PORT, TokenIntrospectionService, KeycloakRealmResolver],
})
export class KeycloakModule {}

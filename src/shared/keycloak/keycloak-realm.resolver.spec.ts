import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeycloakRealmResolver } from './keycloak-realm.resolver.js';

describe('KeycloakRealmResolver', () => {
  it('always resolves the platform admin realm (single-realm deployment)', async () => {
    const config = { KEYCLOAK_ADMIN_REALM: 'platform' };
    const resolver = new KeycloakRealmResolver(config as never);

    await expect(resolver.resolveRealm()).resolves.toBe('platform');
    await expect(resolver.resolveRealm('any-tenant-id')).resolves.toBe('platform');
  });
});

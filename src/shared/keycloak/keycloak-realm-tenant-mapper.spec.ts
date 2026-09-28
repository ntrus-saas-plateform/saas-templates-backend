import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const realmPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'docker',
  'keycloak',
  'platform-realm.json',
);

interface RealmClient {
  clientId: string;
  protocolMappers?: Array<{
    name: string;
    config: Record<string, string>;
  }>;
}

describe('Keycloak platform realm tenant_id mapper', () => {
  const realm = JSON.parse(readFileSync(realmPath, 'utf-8')) as {
    realm: string;
    clients: RealmClient[];
  };

  it('uses single shared realm', () => {
    expect(realm.realm).toBe('platform');
  });

  for (const clientId of ['platform-api', 'platform-b2c'] as const) {
    it(`maps tenant_id claim on ${clientId} access tokens`, () => {
      const client = realm.clients.find((entry) => entry.clientId === clientId);
      expect(client).toBeDefined();

      const mapper = client?.protocolMappers?.find((entry) => entry.name === 'tenant-id-mapper');
      expect(mapper?.config['user.attribute']).toBe('tenant_id');
      expect(mapper?.config['claim.name']).toBe('tenant_id');
      expect(mapper?.config['access.token.claim']).toBe('true');
      expect(mapper?.config['jsonType.label']).toBe('String');
    });
  }
});

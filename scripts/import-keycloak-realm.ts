/**
 * Import or sync the `platform` realm into local Keycloak.
 * - Creates realm if missing
 * - Upserts clients (redirect URIs, PKCE, audience/tenant mappers)
 * - Ensures realm roles + seed users
 * - Creates Keycloak Organizations (org-a1/a2/b1), members, membership mapper
 * - Writes live `keycloak_organization_id` into control-plane
 *
 * Usage: pnpm keycloak:import
 * Env: KEYCLOAK_URL (default http://localhost:8181), KEYCLOAK_ADMIN, KEYCLOAK_ADMIN_PASSWORD
 * Prerequisite: control-plane seeded (`pnpm seed:dev`) so org rows exist to update.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from './load-env.js';

loadEnvFile();

const KEYCLOAK_URL = (
  process.env.KEYCLOAK_URL ??
  process.env.KEYCLOAK_ISSUER?.replace(/\/realms\/.*$/, '') ??
  'http://localhost:8181'
).replace(/\/$/, '');
const ADMIN_USER = process.env.KEYCLOAK_ADMIN ?? 'admin';
const ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD ?? 'admin';

type RealmExport = {
  realm: string;
  clients?: ClientDef[];
  roles?: { realm?: { name: string; description?: string }[] };
  users?: UserDef[];
  organizationsEnabled?: boolean;
  [key: string]: unknown;
};

type ClientDef = {
  clientId: string;
  protocolMappers?: MapperDef[];
  [key: string]: unknown;
};

type MapperDef = {
  name: string;
  protocol: string;
  protocolMapper: string;
  consentRequired?: boolean;
  config?: Record<string, string>;
};

type UserDef = {
  id?: string;
  username: string;
  email?: string;
  enabled?: boolean;
  emailVerified?: boolean;
  firstName?: string;
  lastName?: string;
  credentials?: { type: string; value: string; temporary: boolean }[];
  realmRoles?: string[];
  attributes?: Record<string, string[]>;
};

async function getAdminToken(): Promise<string> {
  const response = await fetch(
    `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'admin-cli',
        username: ADMIN_USER,
        password: ADMIN_PASSWORD,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to get admin token: ${response.status} ${await response.text()}`);
  }
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function realmExists(token: string, realm: string): Promise<boolean> {
  const res = await fetch(`${KEYCLOAK_URL}/admin/realms/${realm}`, {
    headers: authHeaders(token),
  });
  return res.ok;
}

async function createRealm(token: string, realmJson: string): Promise<void> {
  const response = await fetch(`${KEYCLOAK_URL}/admin/realms`, {
    method: 'POST',
    headers: authHeaders(token),
    body: realmJson,
  });
  if (response.status === 201) {
    console.log('Realm "platform" created');
    return;
  }
  throw new Error(`Realm create failed (${response.status}): ${await response.text()}`);
}

async function patchRealmFlags(token: string, realm: RealmExport): Promise<void> {
  const res = await fetch(`${KEYCLOAK_URL}/admin/realms/${realm.realm}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) return;
  const current = (await res.json()) as Record<string, unknown>;
  const realmAny = realm as RealmExport & { passwordPolicy?: string };
  const body = {
    ...current,
    organizationsEnabled: realm.organizationsEnabled ?? current.organizationsEnabled,
    loginWithEmailAllowed: true,
    resetPasswordAllowed: true,
    bruteForceProtected: true,
    sslRequired: 'external',
    ...(realmAny.passwordPolicy
      ? { passwordPolicy: realmAny.passwordPolicy }
      : {}),
  };
  const put = await fetch(`${KEYCLOAK_URL}/admin/realms/${realm.realm}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!put.ok) {
    console.warn(`Realm patch warning (${put.status}): ${await put.text()}`);
  } else {
    console.log('Realm flags updated (organizations, login, password policy)');
  }
}

async function ensureRealmRoles(
  token: string,
  realm: string,
  roles: { name: string; description?: string }[],
): Promise<void> {
  const existingRes = await fetch(`${KEYCLOAK_URL}/admin/realms/${realm}/roles`, {
    headers: authHeaders(token),
  });
  const existing = existingRes.ok
    ? ((await existingRes.json()) as { name: string }[])
    : [];
  const names = new Set(existing.map((r) => r.name));
  for (const role of roles) {
    if (names.has(role.name)) continue;
    const res = await fetch(`${KEYCLOAK_URL}/admin/realms/${realm}/roles`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ name: role.name, description: role.description ?? '' }),
    });
    if (res.status === 201 || res.status === 409) {
      console.log(`  role + ${role.name}`);
    } else {
      console.warn(`  role ${role.name} failed (${res.status})`);
    }
  }
}

async function findClientId(
  token: string,
  realm: string,
  clientId: string,
): Promise<string | null> {
  const res = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${realm}/clients?clientId=${encodeURIComponent(clientId)}`,
    { headers: authHeaders(token) },
  );
  if (!res.ok) return null;
  const list = (await res.json()) as { id: string; clientId: string }[];
  return list[0]?.id ?? null;
}

async function upsertMappers(
  token: string,
  realm: string,
  internalId: string,
  mappers: MapperDef[],
): Promise<void> {
  const listRes = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${realm}/clients/${internalId}/protocol-mappers/models`,
    { headers: authHeaders(token) },
  );
  const existing = listRes.ok
    ? ((await listRes.json()) as { id: string; name: string }[])
    : [];
  const byName = new Map(existing.map((m) => [m.name, m.id]));

  for (const mapper of mappers) {
    const body = {
      name: mapper.name,
      protocol: mapper.protocol,
      protocolMapper: mapper.protocolMapper,
      consentRequired: mapper.consentRequired ?? false,
      config: mapper.config ?? {},
    };
    const existingId = byName.get(mapper.name);
    if (existingId) {
      const put = await fetch(
        `${KEYCLOAK_URL}/admin/realms/${realm}/clients/${internalId}/protocol-mappers/models/${existingId}`,
        {
          method: 'PUT',
          headers: authHeaders(token),
          body: JSON.stringify({ ...body, id: existingId }),
        },
      );
      if (!put.ok) {
        console.warn(`    mapper update ${mapper.name}: ${put.status}`);
      }
    } else {
      const post = await fetch(
        `${KEYCLOAK_URL}/admin/realms/${realm}/clients/${internalId}/protocol-mappers/models`,
        {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify(body),
        },
      );
      if (!(post.status === 201 || post.ok)) {
        console.warn(`    mapper create ${mapper.name}: ${post.status} ${await post.text()}`);
      }
    }
  }
}

async function upsertClient(
  token: string,
  realm: string,
  client: ClientDef,
): Promise<void> {
  const { protocolMappers, ...clientBody } = client;
  const existingId = await findClientId(token, realm, client.clientId);

  if (!existingId) {
    const res = await fetch(`${KEYCLOAK_URL}/admin/realms/${realm}/clients`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(clientBody),
    });
    if (!(res.status === 201 || res.ok)) {
      throw new Error(
        `Create client ${client.clientId} failed (${res.status}): ${await res.text()}`,
      );
    }
    console.log(`  client created ${client.clientId}`);
  } else {
    const getRes = await fetch(
      `${KEYCLOAK_URL}/admin/realms/${realm}/clients/${existingId}`,
      { headers: authHeaders(token) },
    );
    const current = (await getRes.json()) as Record<string, unknown>;
    const merged = {
      ...current,
      ...clientBody,
      id: existingId,
      attributes: {
        ...((current.attributes as Record<string, string>) ?? {}),
        ...((clientBody.attributes as Record<string, string>) ?? {}),
      },
    };
    const put = await fetch(
      `${KEYCLOAK_URL}/admin/realms/${realm}/clients/${existingId}`,
      {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify(merged),
      },
    );
    if (!put.ok) {
      throw new Error(
        `Update client ${client.clientId} failed (${put.status}): ${await put.text()}`,
      );
    }
    console.log(`  client updated ${client.clientId}`);
  }

  const id = (await findClientId(token, realm, client.clientId))!;
  if (protocolMappers?.length) {
    await upsertMappers(token, realm, id, protocolMappers);
    console.log(`    mappers synced (${protocolMappers.length})`);
  }

  const defaultScopes = (client as { defaultClientScopes?: string[] }).defaultClientScopes;
  if (defaultScopes?.length) {
    await ensureDefaultClientScopes(token, realm, id, defaultScopes);
  }

  // Ensure platform-admin service account has realm-management roles for Admin API
  if (client.clientId === 'platform-admin') {
    await ensureAdminServiceAccountRoles(token, realm, id);
  }
}

async function ensureUnmanagedUserAttributes(token: string, realm: string): Promise<void> {
  const res = await fetch(`${KEYCLOAK_URL}/admin/realms/${realm}/users/profile`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    console.warn(`  user profile fetch: ${res.status}`);
    return;
  }
  const profile = (await res.json()) as {
    attributes?: Array<Record<string, unknown>>;
    unmanagedAttributePolicy?: string;
    [key: string]: unknown;
  };

  // KC 26 defaults to blocking custom attrs — without this, tenant_id/organization_id never persist.
  if (profile.unmanagedAttributePolicy !== 'ADMIN_EDIT' && profile.unmanagedAttributePolicy !== 'ENABLED') {
    profile.unmanagedAttributePolicy = 'ADMIN_EDIT';
    const put = await fetch(`${KEYCLOAK_URL}/admin/realms/${realm}/users/profile`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(profile),
    });
    if (put.ok) {
      console.log('  user profile unmanagedAttributePolicy=ADMIN_EDIT');
    } else {
      console.warn(`  user profile update: ${put.status} ${await put.text()}`);
    }
  }
}

async function ensureDefaultClientScopes(
  token: string,
  realm: string,
  clientUuid: string,
  scopeNames: string[],
): Promise<void> {
  const scopesRes = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${realm}/client-scopes`,
    { headers: authHeaders(token) },
  );
  if (!scopesRes.ok) return;
  const allScopes = (await scopesRes.json()) as { id: string; name: string }[];
  const byName = new Map(allScopes.map((s) => [s.name, s.id]));

  const assignedRes = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${realm}/clients/${clientUuid}/default-client-scopes`,
    { headers: authHeaders(token) },
  );
  const assigned = assignedRes.ok
    ? new Set(((await assignedRes.json()) as { name: string }[]).map((s) => s.name))
    : new Set<string>();

  const optionalRes = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${realm}/clients/${clientUuid}/optional-client-scopes`,
    { headers: authHeaders(token) },
  );
  const optional = optionalRes.ok
    ? new Map(
        ((await optionalRes.json()) as { id: string; name: string }[]).map((s) => [
          s.name,
          s.id,
        ]),
      )
    : new Map<string, string>();

  for (const name of scopeNames) {
    if (assigned.has(name)) continue;
    const scopeId = byName.get(name);
    if (!scopeId) {
      console.warn(`    scope missing in realm: ${name}`);
      continue;
    }

    // Move off optional first — KC won't promote optional→default otherwise.
    if (optional.has(name)) {
      await fetch(
        `${KEYCLOAK_URL}/admin/realms/${realm}/clients/${clientUuid}/optional-client-scopes/${scopeId}`,
        { method: 'DELETE', headers: authHeaders(token) },
      );
    }

    const put = await fetch(
      `${KEYCLOAK_URL}/admin/realms/${realm}/clients/${clientUuid}/default-client-scopes/${scopeId}`,
      { method: 'PUT', headers: authHeaders(token) },
    );
    if (put.ok || put.status === 204) {
      console.log(`    assigned default scope ${name}`);
    } else {
      console.warn(`    assign scope ${name}: ${put.status} ${await put.text()}`);
    }
  }
}

async function ensureAdminServiceAccountRoles(
  token: string,
  realm: string,
  clientUuid: string,
): Promise<void> {
  const saRes = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${realm}/clients/${clientUuid}/service-account-user`,
    { headers: authHeaders(token) },
  );
  if (!saRes.ok) {
    console.warn('  platform-admin service account user not found');
    return;
  }
  const saUser = (await saRes.json()) as { id: string };

  const clientsRes = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${realm}/clients?clientId=realm-management`,
    { headers: authHeaders(token) },
  );
  const rm = ((await clientsRes.json()) as { id: string }[])[0];
  if (!rm) return;

  const rolesRes = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${realm}/clients/${rm.id}/roles`,
    { headers: authHeaders(token) },
  );
  if (!rolesRes.ok) return;
  const roles = (await rolesRes.json()) as { id: string; name: string }[];
  const wanted = [
    'manage-users',
    'view-users',
    'query-users',
    'manage-clients',
    'view-clients',
    'manage-realm',
    'view-realm',
    'manage-events',
    'view-events',
    'query-groups',
    'manage-organizations',
    'view-organizations',
  ];
  const toAssign = roles.filter((r) => wanted.includes(r.name));
  if (!toAssign.length) return;

  const assign = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${realm}/users/${saUser.id}/role-mappings/clients/${rm.id}`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(toAssign),
    },
  );
  if (assign.ok || assign.status === 204) {
    console.log(`  platform-admin SA roles: ${toAssign.map((r) => r.name).join(', ')}`);
  } else {
    console.warn(`  SA role assign: ${assign.status} ${await assign.text()}`);
  }
}

async function resolveUserId(
  token: string,
  realm: string,
  username: string,
): Promise<string | undefined> {
  const res = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${realm}/users?username=${encodeURIComponent(username)}&exact=true`,
    { headers: authHeaders(token) },
  );
  if (!res.ok) return undefined;
  return ((await res.json()) as { id: string }[])[0]?.id;
}

async function upsertUser(
  token: string,
  realm: string,
  user: UserDef,
): Promise<string | undefined> {
  const foundId = await resolveUserId(token, realm, user.username);

  let mergedAttributes = user.attributes;
  if (foundId && user.attributes) {
    const getRes = await fetch(`${KEYCLOAK_URL}/admin/realms/${realm}/users/${foundId}`, {
      headers: authHeaders(token),
    });
    if (getRes.ok) {
      const current = (await getRes.json()) as { attributes?: Record<string, string[]> };
      mergedAttributes = {
        ...(current.attributes ?? {}),
        ...user.attributes,
      };
      // Seed JSON no longer carries organization_id; keep live KC org attr if present.
      if (
        !user.attributes.organization_id &&
        current.attributes?.organization_id
      ) {
        mergedAttributes.organization_id = current.attributes.organization_id;
      }
    }
  }

  const payload: Record<string, unknown> = {
    username: user.username,
    enabled: user.enabled ?? true,
    email: user.email,
    emailVerified: user.emailVerified ?? true,
    firstName: user.firstName,
    lastName: user.lastName,
    attributes: mergedAttributes,
  };

  let userId = foundId;

  if (!userId) {
    // Keycloak often ignores custom ids — create then resolve by username.
    const create = await fetch(`${KEYCLOAK_URL}/admin/realms/${realm}/users`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!(create.status === 201 || create.ok)) {
      console.warn(`  user create ${user.username}: ${create.status} ${await create.text()}`);
      return undefined;
    }
    userId = await resolveUserId(token, realm, user.username);
    console.log(`  user created ${user.username} (id=${userId ?? '?'})`);
  } else {
    const put = await fetch(`${KEYCLOAK_URL}/admin/realms/${realm}/users/${userId}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ ...payload, id: userId }),
    });
    if (!put.ok) {
      console.warn(`  user update ${user.username}: ${put.status}`);
    } else {
      console.log(`  user updated ${user.username} (id=${userId})`);
    }
  }

  if (!userId) return undefined;

  if (user.credentials?.[0]) {
    const reset = await fetch(
      `${KEYCLOAK_URL}/admin/realms/${realm}/users/${userId}/reset-password`,
      {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify(user.credentials[0]),
      },
    );
    if (!reset.ok) {
      console.warn(`  password ${user.username}: ${reset.status}`);
    }
  }

  if (user.realmRoles?.length) {
    const allRolesRes = await fetch(`${KEYCLOAK_URL}/admin/realms/${realm}/roles`, {
      headers: authHeaders(token),
    });
    const allRoles = (await allRolesRes.json()) as { id: string; name: string }[];
    const assign = allRoles.filter((r) => user.realmRoles!.includes(r.name));
    if (assign.length) {
      await fetch(
        `${KEYCLOAK_URL}/admin/realms/${realm}/users/${userId}/role-mappings/realm`,
        {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify(assign),
        },
      );
    }
  }

  if (user.id && user.id !== userId) {
    console.log(
      `  note: seed expected id=${user.id}, Keycloak id=${userId} — syncing control-plane memberships`,
    );
  }

  return userId;
}

/** Dev seed orgs — aliases must match control-plane `organizations.slug`. */
const SEED_KC_ORGS: {
  appId: string;
  slug: string;
  name: string;
  memberUsernames: string[];
  /** Default active org for these users (sets user attr organization_id). */
  activeForUsernames?: string[];
}[] = [
  {
    appId: '11111111-1111-4111-8111-111111111111',
    slug: 'org-a1',
    name: 'Organization A1',
    memberUsernames: ['user-a', 'admin-a'],
    activeForUsernames: ['user-a', 'admin-a'],
  },
  {
    appId: '22222222-2222-4222-8222-222222222222',
    slug: 'org-a2',
    name: 'Organization A2',
    memberUsernames: ['user-a', 'admin-a'],
  },
  {
    appId: '33333333-3333-4333-8333-333333333333',
    slug: 'org-b1',
    name: 'Organization B1',
    memberUsernames: [],
  },
];

function controlPlanePoolConfig() {
  return {
    host: process.env.CONTROL_PLANE_DB_HOST ?? '127.0.0.1',
    port: Number(process.env.CONTROL_PLANE_DB_PORT ?? 5432),
    database: process.env.CONTROL_PLANE_DB_NAME ?? 'platform_control',
    user: process.env.CONTROL_PLANE_DB_USER ?? 'postgres',
    password: process.env.CONTROL_PLANE_DB_PASSWORD ?? 'postgres',
  };
}

async function listKcOrganizations(
  token: string,
  realm: string,
): Promise<{ id: string; name: string; alias: string }[]> {
  const res = await fetch(`${KEYCLOAK_URL}/admin/realms/${realm}/organizations`, {
    headers: authHeaders(token),
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as Array<Record<string, unknown>>;
  return rows.map((o) => ({
    id: String(o.id),
    name: String(o.name ?? ''),
    alias: String(o.alias ?? o.name ?? ''),
  }));
}

async function ensureKcOrganization(
  token: string,
  realm: string,
  name: string,
  alias: string,
): Promise<string | undefined> {
  const existing = (await listKcOrganizations(token, realm)).find(
    (o) => o.alias === alias || o.name === name,
  );
  if (existing) return existing.id;

  const create = await fetch(`${KEYCLOAK_URL}/admin/realms/${realm}/organizations`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name, alias, enabled: true }),
  });
  if (!(create.status === 201 || create.ok)) {
    console.warn(`  create org ${alias}: ${create.status} ${await create.text()}`);
    return undefined;
  }

  const location = create.headers.get('Location') ?? create.headers.get('location');
  if (location) {
    const id = location.split('/').filter(Boolean).pop();
    if (id) return id;
  }

  const listed = await listKcOrganizations(token, realm);
  return listed.find((o) => o.alias === alias || o.name === name)?.id;
}

async function addKcOrgMember(
  token: string,
  realm: string,
  orgId: string,
  userId: string,
): Promise<boolean> {
  const url = `${KEYCLOAK_URL}/admin/realms/${realm}/organizations/${orgId}/members`;
  // Raw UUID body — see Keycloak Organizations API quirks (not a JSON object).
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: userId,
  });
  if (res.ok || res.status === 201 || res.status === 204 || res.status === 409) {
    return true;
  }
  console.warn(`  add member ${userId} → ${orgId}: ${res.status} ${await res.text()}`);
  return false;
}

async function setUserOrganizationAttribute(
  token: string,
  realm: string,
  userId: string,
  kcOrgId: string,
): Promise<boolean> {
  const getRes = await fetch(`${KEYCLOAK_URL}/admin/realms/${realm}/users/${userId}`, {
    headers: authHeaders(token),
  });
  if (!getRes.ok) {
    console.warn(`  fetch user ${userId}: ${getRes.status}`);
    return false;
  }
  const user = (await getRes.json()) as {
    id?: string;
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    enabled?: boolean;
    emailVerified?: boolean;
    attributes?: Record<string, string[]>;
  };
  const attributes = { ...(user.attributes ?? {}) };
  attributes.organization_id = [kcOrgId];

  const put = await fetch(`${KEYCLOAK_URL}/admin/realms/${realm}/users/${userId}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({
      id: user.id ?? userId,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      enabled: user.enabled ?? true,
      emailVerified: user.emailVerified ?? true,
      attributes,
    }),
  });
  if (!put.ok) {
    console.warn(`  set organization_id attr ${userId}: ${put.status} ${await put.text()}`);
    return false;
  }

  const check = await fetch(`${KEYCLOAK_URL}/admin/realms/${realm}/users/${userId}`, {
    headers: authHeaders(token),
  });
  if (check.ok) {
    const verified = (await check.json()) as { attributes?: Record<string, string[]> };
    const live = verified.attributes?.organization_id?.[0];
    if (live !== kcOrgId) {
      console.warn(`  organization_id attr verify failed: got ${live}`);
      return false;
    }
  }
  return true;
}

async function findUserIdByUsername(
  token: string,
  realm: string,
  username: string,
): Promise<string | undefined> {
  const res = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${realm}/users?username=${encodeURIComponent(username)}&exact=true`,
    { headers: authHeaders(token) },
  );
  if (!res.ok) return undefined;
  const users = (await res.json()) as { id: string; username: string }[];
  return users.find((u) => u.username === username)?.id;
}

/**
 * Ensure built-in `organization` client scope emits membership claim with org id.
 * Mapper protocol: oidc-organization-membership-mapper (KC 26+).
 */
async function ensureOrganizationMembershipMapper(
  token: string,
  realm: string,
): Promise<void> {
  const scopesRes = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${realm}/client-scopes`,
    { headers: authHeaders(token) },
  );
  if (!scopesRes.ok) return;
  const scopes = (await scopesRes.json()) as { id: string; name: string }[];
  const orgScope = scopes.find((s) => s.name === 'organization');
  if (!orgScope) {
    console.warn('  client scope "organization" missing — enable Organizations feature');
    return;
  }

  const mappersRes = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${realm}/client-scopes/${orgScope.id}/protocol-mappers/models`,
    { headers: authHeaders(token) },
  );
  if (!mappersRes.ok) return;
  const mappers = (await mappersRes.json()) as {
    id?: string;
    name: string;
    protocolMapper: string;
    config?: Record<string, string>;
  }[];

  const wantedConfig = {
    'claim.name': 'organization',
    'id.token.claim': 'true',
    'access.token.claim': 'true',
    'userinfo.token.claim': 'true',
    'introspection.token.claim': 'true',
    'addOrganizationId': 'true',
    'addOrganizationAttributes': 'false',
  };

  const existing =
    mappers.find((m) => m.protocolMapper === 'oidc-organization-membership-mapper') ??
    mappers.find((m) => /organization/i.test(m.name) && m.protocolMapper.includes('organization'));

  if (existing?.id) {
    const put = await fetch(
      `${KEYCLOAK_URL}/admin/realms/${realm}/client-scopes/${orgScope.id}/protocol-mappers/models/${existing.id}`,
      {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify({
          ...existing,
          id: existing.id,
          name: existing.name || 'organization',
          protocol: 'openid-connect',
          protocolMapper: 'oidc-organization-membership-mapper',
          config: { ...(existing.config ?? {}), ...wantedConfig },
        }),
      },
    );
    if (put.ok) {
      console.log('  organization membership mapper updated (addOrganizationId)');
    } else {
      console.warn(`  organization mapper update: ${put.status}`);
    }
    return;
  }

  const post = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${realm}/client-scopes/${orgScope.id}/protocol-mappers/models`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        name: 'organization',
        protocol: 'openid-connect',
        protocolMapper: 'oidc-organization-membership-mapper',
        consentRequired: false,
        config: wantedConfig,
      }),
    },
  );
  if (post.status === 201 || post.ok) {
    console.log('  organization membership mapper created');
  } else {
    console.warn(`  organization mapper create: ${post.status} ${await post.text()}`);
  }
}

/** Create real KC Organizations, attach seed users, write live ids to control-plane. */
async function syncKeycloakOrganizations(
  token: string,
  realm: string,
  liveUsers: { username: string; liveId: string }[],
): Promise<Map<string, string>> {
  console.log('Syncing Keycloak Organizations…');
  await ensureOrganizationMembershipMapper(token, realm);

  const byUsername = new Map(liveUsers.map((u) => [u.username, u.liveId]));
  const aliasToKcId = new Map<string, string>();

  for (const org of SEED_KC_ORGS) {
    const kcId = await ensureKcOrganization(token, realm, org.name, org.slug);
    if (!kcId) continue;
    aliasToKcId.set(org.slug, kcId);
    console.log(`  org ${org.slug} → ${kcId}`);

    for (const username of org.memberUsernames) {
      let userId = byUsername.get(username);
      if (!userId) {
        userId = await findUserIdByUsername(token, realm, username);
      }
      if (!userId) {
        console.warn(`  skip member ${username}: user not found`);
        continue;
      }
      const ok = await addKcOrgMember(token, realm, kcId, userId);
      if (ok) console.log(`    member ${username}`);
    }

    for (const username of org.activeForUsernames ?? []) {
      const userId =
        byUsername.get(username) ?? (await findUserIdByUsername(token, realm, username));
      if (!userId) continue;
      const ok = await setUserOrganizationAttribute(token, realm, userId, kcId);
      if (ok) {
        console.log(`    active organization_id for ${username} → ${kcId}`);
      }
    }
  }

  await writeControlPlaneKeycloakOrgIds(aliasToKcId);
  return aliasToKcId;
}

async function writeControlPlaneKeycloakOrgIds(
  aliasToKcId: Map<string, string>,
): Promise<void> {
  if (!aliasToKcId.size) return;

  const { default: pg } = await import('pg');
  const pool = new pg.Pool(controlPlanePoolConfig());
  try {
    for (const [slug, kcId] of aliasToKcId) {
      const def = SEED_KC_ORGS.find((o) => o.slug === slug);
      const result = await pool.query(
        `UPDATE organizations
         SET keycloak_organization_id = $1, updated_at = NOW()
         WHERE slug = $2
           AND ($3::uuid IS NULL OR id = $3::uuid)`,
        [kcId, slug, def?.appId ?? null],
      );
      if (result.rowCount && result.rowCount > 0) {
        console.log(`  control-plane ${slug}.keycloak_organization_id = ${kcId}`);
      } else {
        console.warn(
          `  control-plane org ${slug} not found — run pnpm seed:dev before keycloak:import`,
        );
      }
    }
  } catch (e) {
    console.warn(
      `  control-plane org id sync skipped: ${e instanceof Error ? e.message : e}`,
    );
  } finally {
    await pool.end();
  }
}

/** Remap control-plane rows from realm-json seed ids → live Keycloak `sub`. */
async function syncControlPlaneUserIds(
  mappings: { seedId: string; liveId: string; username: string }[],
): Promise<void> {
  const needs = mappings.filter((m) => m.seedId && m.liveId && m.seedId !== m.liveId);
  if (!needs.length) {
    console.log('Control-plane user ids already match Keycloak');
    return;
  }

  const { default: pg } = await import('pg');
  const { loadEnvFile } = await import('./load-env.js');
  loadEnvFile();

  const pool = new pg.Pool(controlPlanePoolConfig());

  try {
    for (const { seedId, liveId, username } of needs) {
      await pool.query('BEGIN');
      try {
        // Drop conflicting live rows then remap seed → live
        await pool.query(
          `DELETE FROM user_organization_memberships WHERE user_id = $1`,
          [liveId],
        );
        await pool.query(`DELETE FROM user_tenant_memberships WHERE user_id = $1`, [liveId]);
        await pool.query(
          `DELETE FROM application_users WHERE identity_id = $1`,
          [liveId],
        );

        await pool.query(
          `UPDATE user_organization_memberships SET user_id = $1 WHERE user_id = $2`,
          [liveId, seedId],
        );
        await pool.query(
          `UPDATE user_tenant_memberships SET user_id = $1 WHERE user_id = $2`,
          [liveId, seedId],
        );
        await pool.query(
          `UPDATE application_users SET identity_id = $1 WHERE identity_id = $2`,
          [liveId, seedId],
        );
        await pool.query(
          `UPDATE tenant_owners SET identity_id = $1 WHERE identity_id = $2`,
          [liveId, seedId],
        );
        await pool.query('COMMIT');
        console.log(`  remapped ${username}: ${seedId} → ${liveId}`);
      } catch (e) {
        await pool.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    await pool.end();
  }
}

async function verifyOidc(aliasToKcId?: Map<string, string>): Promise<void> {
  const wellKnown = await fetch(
    `${KEYCLOAK_URL}/realms/platform/.well-known/openid-configuration`,
  );
  if (!wellKnown.ok) {
    throw new Error(`OIDC discovery failed: ${wellKnown.status}`);
  }
  const doc = (await wellKnown.json()) as { issuer: string; token_endpoint: string };
  console.log(`OIDC issuer: ${doc.issuer}`);

  // Prefer org-scoped token so membership claim is selected for multi-org users
  const scopes = [
    'openid profile email organization',
    'openid profile email organization:org-a1',
  ];
  let payload: {
    aud?: string | string[];
    tenant_id?: string;
    organization_id?: string;
    organization?: unknown;
    azp?: string;
  } | null = null;

  type OidcTokenPayload = {
    aud?: string | string[];
    tenant_id?: string;
    organization_id?: string;
    organization?: unknown;
    azp?: string;
  };

  for (const scope of scopes) {
    const tokenRes = await fetch(doc.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'platform-api',
        client_secret: 'platform-api-secret',
        username: 'user-a',
        password: 'password',
        scope,
      }),
    });
    if (!tokenRes.ok) {
      console.warn(
        `Token smoke (${scope}) failed (${tokenRes.status}): ${await tokenRes.text()}`,
      );
      continue;
    }
    const tokens = (await tokenRes.json()) as { access_token: string };
    payload = JSON.parse(
      Buffer.from(tokens.access_token.split('.')[1]!, 'base64url').toString('utf8'),
    ) as OidcTokenPayload;
    console.log(`Token smoke OK (scope=${scope})`);
    break;
  }

  if (!payload) return;

  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  console.log(
    `  azp=${payload.azp} aud=${aud.join(',')} tenant_id=${payload.tenant_id} organization_id=${payload.organization_id}`,
  );
  if (payload.organization !== undefined) {
    console.log(`  organization claim: ${JSON.stringify(payload.organization)}`);
  }
  if (!aud.includes('platform-api')) {
    console.warn('WARNING: access token missing audience platform-api');
  }
  if (!payload.tenant_id) {
    console.warn('WARNING: access token missing tenant_id');
  }
  const expectedActive = aliasToKcId?.get('org-a1');
  if (expectedActive && payload.organization_id && payload.organization_id !== expectedActive) {
    console.warn(
      `WARNING: organization_id=${payload.organization_id} expected KC id ${expectedActive}`,
    );
  }
  if (expectedActive && !payload.organization_id) {
    console.warn('WARNING: access token missing organization_id (active org attr)');
  }
}

async function main(): Promise<void> {
  console.log(`Connecting to Keycloak at ${KEYCLOAK_URL}...`);
  const token = await getAdminToken();

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const realmPath = join(__dirname, '..', 'docker', 'keycloak', 'platform-realm.json');
  const realmJson = readFileSync(realmPath, 'utf-8');
  const realm = JSON.parse(realmJson) as RealmExport;

  if (!(await realmExists(token, realm.realm))) {
    await createRealm(token, realmJson);
  } else {
    console.log('Realm "platform" already exists — syncing clients/users');
    await patchRealmFlags(token, realm);
  }

  await ensureUnmanagedUserAttributes(token, realm.realm);

  if (realm.roles?.realm?.length) {
    console.log('Syncing realm roles...');
    await ensureRealmRoles(token, realm.realm, realm.roles.realm);
  }

  if (realm.clients?.length) {
    console.log('Syncing clients...');
    for (const client of realm.clients) {
      await upsertClient(token, realm.realm, client);
    }
  }

  const liveUsers: { username: string; liveId: string }[] = [];
  if (realm.users?.length) {
    console.log('Syncing users...');
    const idMaps: { seedId: string; liveId: string; username: string }[] = [];
    for (const user of realm.users) {
      const liveId = await upsertUser(token, realm.realm, user);
      if (user.id && liveId) {
        idMaps.push({ seedId: user.id, liveId, username: user.username });
        liveUsers.push({ username: user.username, liveId });
      } else if (liveId) {
        liveUsers.push({ username: user.username, liveId });
      }
    }
    console.log('Syncing control-plane memberships to Keycloak ids...');
    await syncControlPlaneUserIds(idMaps);
  }

  const aliasToKcId = await syncKeycloakOrganizations(token, realm.realm, liveUsers);

  // platform-api needs organization scope available for smoke / service tokens
  const apiClientId = await findClientId(token, realm.realm, 'platform-api');
  if (apiClientId) {
    await ensureDefaultClientScopes(token, realm.realm, apiClientId, [
      'basic',
      'profile',
      'email',
      'roles',
      'organization',
    ]);
  }

  console.log('Verifying OIDC...');
  await verifyOidc(aliasToKcId);
  console.log('Keycloak sync complete.');
}

main().catch((err) => {
  console.error('Keycloak import failed:', err);
  process.exit(1);
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActiveOrganizationResolver } from './active-organization.resolver.js';
import type { AuthenticatedUser } from './jwt-validation.service.js';

describe('ActiveOrganizationResolver', () => {
  const organizationRepository = {
    findById: vi.fn(),
    findByKeycloakId: vi.fn(),
    findByUserMembership: vi.fn(),
  };

  let resolver: ActiveOrganizationResolver;

  const baseUser: AuthenticatedUser = {
    subjectId: 'sub-1',
    userId: 'sub-1',
    username: 'user-a',
    email: 'user-a@tenant-a.example.com',
    tenantId: 't1',
    keycloakOrganizationIds: ['kc-org-1'],
    keycloakOrganizationAliases: ['org-a'],
    jwtActiveOrganizationRef: 'kc-org-1',
    roles: [],
    permissions: [],
    clientId: null,
    locale: 'en',
    timezone: 'UTC',
    authenticationAcr: null,
    authenticationMethods: [],
    tokenIssuedAt: 1_700_000_000,
    tokenId: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resolver = new ActiveOrganizationResolver(organizationRepository as never);
  });

  it('maps Keycloak organization id from JWT to application organization UUID', async () => {
    organizationRepository.findByKeycloakId.mockResolvedValue({
      id: 'org-1',
      tenantId: 't1',
    });
    organizationRepository.findByUserMembership.mockResolvedValue([{ id: 'org-1' }]);

    const result = await resolver.resolve(baseUser);
    expect(result).toBe('org-1');
  });

  it('resolves organization alias from JWT when Keycloak id lookup fails', async () => {
    organizationRepository.findByKeycloakId.mockResolvedValue(null);
    organizationRepository.findByUserMembership.mockResolvedValue([
      { id: 'org-2', slug: 'org-b' },
    ]);

    const result = await resolver.resolve({
      ...baseUser,
      jwtActiveOrganizationRef: 'org-b',
    });
    expect(result).toBe('org-2');
  });

  it('returns null when JWT has no active organization', async () => {
    const result = await resolver.resolve({
      ...baseUser,
      jwtActiveOrganizationRef: null,
    });
    expect(result).toBeNull();
  });

  it('returns null when user is not a member of the resolved organization', async () => {
    organizationRepository.findByKeycloakId.mockResolvedValue({
      id: 'org-3',
      tenantId: 't1',
    });
    organizationRepository.findByUserMembership.mockResolvedValue([{ id: 'org-1' }]);

    const result = await resolver.resolve(baseUser);
    expect(result).toBeNull();
  });
});

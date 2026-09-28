export interface TenantContextData {
  tenantId: string;
  organizationId: string | null;
  /** Stable identity key (Keycloak `sub`). */
  userId: string | null;
  subjectId: string;
  username: string | null;
  /** JWT `email` when present (preferred_username is often not an email). */
  email?: string | null;
  roles: readonly string[];
  permissions: readonly string[];
  clientId: string | null;
  correlationId: string;
  requestId: string;
  traceId: string | null;
  locale: string;
  timezone: string;
  authenticationAcr: string | null;
  authenticationMethods: readonly string[];
  tokenIssuedAt: number | null;
  tokenId: string | null;
  /** Distinguishes staff JWT, personal API tokens, and B2C customer JWT flows. */
  authKind: 'staff' | 'pat' | 'customer';
  globalCustomerId: string | null;
  tenantCustomerId: string | null;
}

export const EMPTY_TENANT_CONTEXT: TenantContextData = {
  tenantId: '',
  organizationId: null,
  userId: null,
  subjectId: '',
  username: null,
  email: null,
  roles: [],
  permissions: [],
  clientId: null,
  correlationId: '',
  requestId: '',
  traceId: null,
  locale: 'en',
  timezone: 'UTC',
  authenticationAcr: null,
  authenticationMethods: [],
  tokenIssuedAt: null,
  tokenId: null,
  authKind: 'staff',
  globalCustomerId: null,
  tenantCustomerId: null,
};

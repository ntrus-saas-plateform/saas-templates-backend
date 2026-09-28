import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── User ─────────────────────────────────────────────────────────────────────

export class ApplicationUserProfileResponseDto {
  @ApiPropertyOptional({ example: 'Jane' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  lastName?: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  displayName?: string;

  @ApiPropertyOptional({ example: 'Jane' })
  preferredName?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatar.png', nullable: true })
  avatarUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  gender?: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ nullable: true })
  biography?: string | null;

  @ApiPropertyOptional({ example: 'jane@example.com', nullable: true })
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  mobile?: string | null;

  @ApiPropertyOptional({ nullable: true })
  alternatePhone?: string | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  address?: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true })
  employeeNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  jobTitle?: string | null;
}

export class UserEmploymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiPropertyOptional({ nullable: true })
  organizationName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  department?: string | null;

  @ApiPropertyOptional({ nullable: true })
  position?: string | null;

  @ApiPropertyOptional({ nullable: true })
  managerUserId?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  joinedAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  status?: string | null;

  @ApiProperty({ type: [String] })
  roles!: string[];
}

export class UserOrganizationSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiPropertyOptional({ nullable: true })
  organizationName?: string | null;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiPropertyOptional({ nullable: true })
  department?: string | null;

  @ApiPropertyOptional({ nullable: true })
  position?: string | null;

  @ApiPropertyOptional({ nullable: true })
  status?: string | null;
}

export class ApplicationUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Keycloak subject ID' })
  identityId!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ example: 'ACTIVE', description: 'INVITED | PENDING_ACTIVATION | ACTIVE | SUSPENDED | LOCKED | DISABLED | DELETED' })
  status!: string;

  @ApiProperty({ type: ApplicationUserProfileResponseDto })
  profile!: ApplicationUserProfileResponseDto;

  @ApiPropertyOptional({ type: UserEmploymentResponseDto, nullable: true })
  employment?: UserEmploymentResponseDto | null;

  @ApiPropertyOptional({ type: [UserOrganizationSummaryResponseDto] })
  organizations?: UserOrganizationSummaryResponseDto[];

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  lastSeenAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

// ─── Organization ─────────────────────────────────────────────────────────────

export class OrganizationListItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Acme Corp' })
  name!: string;

  @ApiProperty({ example: 'acme-corp' })
  slug!: string;

  @ApiProperty({ example: 'ACTIVE', description: 'ACTIVE | SUSPENDED | ARCHIVED' })
  status!: string;

  @ApiPropertyOptional({ example: 'OFFICE' })
  type?: string;

  @ApiPropertyOptional({ nullable: true, example: 'HQ-01' })
  code?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  parentId?: string | null;

  @ApiPropertyOptional()
  isPrimary?: boolean;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  timezone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  locale?: string | null;

  @ApiPropertyOptional({ nullable: true })
  country?: string | null;

  @ApiPropertyOptional({ nullable: true })
  city?: string | null;

  @ApiPropertyOptional({ nullable: true })
  province?: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  defaultCurrency?: string | null;

  @ApiPropertyOptional({ description: 'Direct children count (tree responses)' })
  childCount?: number;
}

export class OrganizationResponseDto extends OrganizationListItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiPropertyOptional({ nullable: true })
  keycloakOrganizationId?: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  address!: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  contact!: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  openingHours!: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  operationalSettings!: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata!: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

// ─── Membership ───────────────────────────────────────────────────────────────

export class OrganizationMembershipResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({
    example: 'ACTIVE',
    description: 'INVITED | ACTIVE | SUSPENDED | REMOVED | EXPIRED',
  })
  status!: string;

  @ApiProperty({ type: [String], example: ['org-admin'] })
  roles!: string[];

  @ApiProperty({ type: [String], example: ['users:read'] })
  permissions!: string[];

  @ApiPropertyOptional({ nullable: true })
  department?: string | null;

  @ApiPropertyOptional({ nullable: true })
  position?: string | null;

  @ApiPropertyOptional({ nullable: true })
  managerUserId?: string | null;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  resourceScopes?: unknown[];

  @ApiProperty({ format: 'date-time' })
  joinedAt!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  expiresAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

// ─── Tenant ───────────────────────────────────────────────────────────────────

export class TenantDatabaseConfigResponseDto {
  @ApiProperty({ example: 'db.example.com' })
  host!: string;

  @ApiProperty({ example: 5432 })
  port!: number;

  @ApiProperty({ example: 'tenant_acme' })
  name!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 't_acme_app',
    description: 'Dedicated PostgreSQL LOGIN role for this tenant database',
  })
  username?: string | null;

  @ApiProperty({ example: 'TENANT_DB_PASSWORD' })
  credentialsReference!: string;
}

export class TenantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'acme' })
  slug!: string;

  @ApiProperty({
    example: 'ACTIVE',
    description:
      'PROVISIONING | ACTIVE | SUSPENDED | READ_ONLY | DEACTIVATING | ARCHIVED | DELETED | FAILED | LOCKED',
  })
  status!: string;

  @ApiProperty({ type: TenantDatabaseConfigResponseDto })
  database!: TenantDatabaseConfigResponseDto;

  @ApiProperty({ example: 'eu-west-1' })
  region!: string;

  @ApiProperty({ example: 'production' })
  environment!: string;

  @ApiPropertyOptional({ nullable: true })
  legalName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  displayName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  tradeName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  companyType?: string | null;

  @ApiPropertyOptional({ nullable: true })
  industry?: string | null;

  @ApiPropertyOptional({ nullable: true })
  registrationNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  taxId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  commerceRegister?: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  legalIdentifiers!: Record<string, unknown>;

  @ApiPropertyOptional({ nullable: true })
  logoUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  logoCompactUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  faviconUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  country?: string | null;

  @ApiPropertyOptional({ nullable: true })
  adminRegion?: string | null;

  @ApiPropertyOptional({ nullable: true })
  city?: string | null;

  @ApiPropertyOptional({ nullable: true })
  addressLine1?: string | null;

  @ApiPropertyOptional({ nullable: true })
  addressLine2?: string | null;

  @ApiPropertyOptional({ nullable: true })
  postalCode?: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  website?: string | null;

  @ApiProperty({ example: 'Africa/Bujumbura' })
  timezone!: string;

  @ApiProperty({ example: 'fr-BI' })
  locale!: string;

  @ApiProperty({ example: 'BIF' })
  defaultCurrency!: string;

  @ApiProperty({ example: 'fr' })
  defaultLanguage!: string;

  @ApiProperty({ example: 'DD/MM/YYYY' })
  dateFormat!: string;

  @ApiProperty({ example: '24h' })
  timeFormat!: string;

  @ApiProperty({ example: '1 234,56' })
  numberFormat!: string;

  @ApiProperty({ example: 'gregorian' })
  fiscalCalendar!: string;

  @ApiProperty({ example: 1 })
  fiscalYearStartMonth!: number;

  @ApiProperty({ example: 1 })
  fiscalYearStartDay!: number;

  @ApiPropertyOptional({ nullable: true })
  primaryContactName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  primaryContactEmail?: string | null;

  @ApiPropertyOptional({ nullable: true })
  primaryContactPhone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  planReference?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  planId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  maxOrganizationsOverride?: number | null;

  @ApiPropertyOptional({ nullable: true })
  maxUsersOverride?: number | null;

  @ApiPropertyOptional({ nullable: true })
  maxCustomersOverride?: number | null;

  @ApiPropertyOptional({ nullable: true })
  maxProductsOverride?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    deprecated: true,
    description:
      'DEPRECATED unused field. Platform uses one shared Keycloak realm; tenants have one or more Keycloak Organizations.',
  })
  keycloakRealm?: string | null;

  @ApiPropertyOptional({ nullable: true })
  provisioningStep?: string | null;

  @ApiPropertyOptional({ nullable: true })
  failureReason?: string | null;

  @ApiPropertyOptional({ nullable: true })
  failureStep?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  lastAttemptAt?: string | null;

  @ApiProperty({ example: 0 })
  retryCount!: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  defaultOrganizationId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  primaryEstablishmentId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  referenceOrganizationId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  provisionIdempotencyKey?: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class OwnershipTransferResponseDto {
  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ description: 'Keycloak subject of the new owner' })
  ownerIdentityId!: string;
}

// ─── Invitation ───────────────────────────────────────────────────────────────

export class InvitationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ example: 'jane@example.com' })
  email!: string;

  @ApiProperty({ description: 'Keycloak subject of the inviter' })
  invitedBy!: string;

  @ApiProperty({ type: [String], example: ['org-member'] })
  roles!: string[];

  @ApiProperty({ type: [String], example: [] })
  permissions!: string[];

  @ApiProperty({ example: 'PENDING', description: 'PENDING | ACCEPTED | EXPIRED | REVOKED' })
  status!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  acceptedAt?: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class InvitationCreatedResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'jane@example.com' })
  email!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ example: 'PENDING' })
  status!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ description: 'One-time plain-text token (not stored); always returned so it can be copied even if email send fails' })
  token!: string;

  @ApiProperty({ description: 'Whether the invitation email was sent (SMTP or Resend). Create still succeeds if send fails.' })
  emailSent!: boolean;

  @ApiProperty({ example: 'none', description: 'none | smtp | resend' })
  emailProvider!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Short send error when emailSent is false' })
  emailError?: string | null;
}

export class InvitationAcceptResponseDto {
  @ApiProperty({ format: 'uuid' })
  membershipId!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;
}

// ─── Role / Permission ────────────────────────────────────────────────────────

export class RoleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tenantId?: string | null;

  @ApiProperty({ example: 'tenant', description: 'platform | tenant | organization' })
  scope!: string;

  @ApiProperty({ example: 'org-admin' })
  name!: string;

  @ApiProperty()
  isSystem!: boolean;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['organizations:read', 'memberships:read'],
    description: 'Permission catalog keys (resource:action) attached to this role',
  })
  permissions?: string[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class PermissionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'users' })
  resource!: string;

  @ApiProperty({ example: 'read' })
  action!: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;
}

export class RoleDeletedResponseDto {
  @ApiProperty()
  deleted!: boolean;

  @ApiProperty({ format: 'uuid' })
  roleId!: string;
}

// ─── Delegation ───────────────────────────────────────────────────────────────

export class DelegationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ description: 'Keycloak subject of the grantor' })
  grantorIdentityId!: string;

  @ApiProperty({ description: 'Keycloak subject of the grantee' })
  granteeIdentityId!: string;

  @ApiProperty({ type: [String], example: ['orders:read'] })
  permissions!: string[];

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  revokedAt?: string | null;
}

export class EmergencyAccessGrantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  organizationId?: string | null;

  @ApiProperty({ description: 'Keycloak subject of the operator' })
  operatorIdentityId!: string;

  @ApiProperty({ description: 'Keycloak subject of the approver' })
  approvedByIdentityId!: string;

  @ApiProperty({ example: 'Investigating production incident' })
  reason!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  scope!: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  revokedAt?: string | null;
}

// ─── Security ─────────────────────────────────────────────────────────────────

export class SecurityPoliciesResponseDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Dynamic policy key/value pairs (mfaRequired, sessionLifetimeSeconds, etc.)',
  })
  policies!: Record<string, unknown>;

  @ApiProperty()
  keycloakAvailable!: boolean;
}

export class MfaStatusResponseDto {
  @ApiProperty()
  enabled!: boolean;

  @ApiProperty({ type: [String], example: ['totp', 'webauthn'] })
  methods!: string[];

  @ApiProperty()
  keycloakAvailable!: boolean;
}

export class SessionObjectDto {
  @ApiProperty({ description: 'Keycloak session ID' })
  id!: string;

  @ApiPropertyOptional()
  username?: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  createdAt?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  started?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  lastAccessedAt?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  lastAccess?: string | null;

  @ApiPropertyOptional({ nullable: true })
  ipAddress?: string | null;

  @ApiPropertyOptional({ nullable: true })
  userAgent?: string | null;

  @ApiPropertyOptional({ type: [String] })
  clients?: string[];

  @ApiPropertyOptional({ nullable: true })
  browser?: string | null;

  @ApiPropertyOptional({ nullable: true })
  os?: string | null;

  @ApiPropertyOptional({ nullable: true })
  device?: string | null;

  @ApiPropertyOptional()
  current?: boolean;
}

export class UserCredentialDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'otp' })
  type!: string;

  @ApiPropertyOptional({ nullable: true })
  userLabel?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  createdDate?: string | null;
}

export class LinkedIdentityDto {
  @ApiProperty({ example: 'google' })
  provider!: string;

  @ApiProperty()
  providerUserId!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ description: 'Primary sign-in method for this user' })
  primary!: boolean;
}

export class IdentityVerificationDto {
  @ApiProperty()
  emailVerified!: boolean;

  @ApiProperty()
  mfaEnrolled!: boolean;

  @ApiProperty({
    description:
      'True only after successful phone OTP KYC (POST /users/me/identity/phone/verify-otp)',
  })
  phoneVerified!: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: 'E.164 phone stored after OTP send/verify',
    example: '+243970000000',
  })
  phoneE164!: string | null;
}

export class IdentityMfaDto {
  @ApiProperty()
  enabled!: boolean;

  @ApiProperty({ type: [String], example: ['totp', 'webauthn'] })
  methods!: string[];
}

const KEYCLOAK_ACCOUNT_URLS_EXAMPLE = {
  accountConsoleUrl: 'http://localhost:8181/realms/platform/account',
  passwordUrl:
    'http://localhost:8181/realms/platform/protocol/openid-connect/auth?kc_action=UPDATE_PASSWORD',
  enrollTotpUrl: 'http://localhost:8181/realms/platform/account/#/security/signing-in',
  enrollWebauthnUrl: 'http://localhost:8181/realms/platform/account/#/security/signing-in',
  linkedAccountsUrl: 'http://localhost:8181/realms/platform/account/#/security/linked-accounts',
  recoveryCodesUrl: 'http://localhost:8181/realms/platform/account/#/security/signing-in',
};

export class MyIdentityOverviewDto {
  @ApiProperty({ description: 'Keycloak subject (sub)' })
  keycloakId!: string;

  @ApiProperty()
  enabled!: boolean;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  username!: string | null;

  @ApiProperty({ type: IdentityVerificationDto })
  verification!: IdentityVerificationDto;

  @ApiProperty({ type: IdentityMfaDto })
  mfa!: IdentityMfaDto;

  @ApiProperty({ type: [UserCredentialDto] })
  credentials!: UserCredentialDto[];

  @ApiProperty({ type: [LinkedIdentityDto] })
  linkedIdentities!: LinkedIdentityDto[];

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: KEYCLOAK_ACCOUNT_URLS_EXAMPLE,
  })
  urls!: Record<string, string>;

  @ApiProperty()
  keycloakAvailable!: boolean;
}

export class MySecurityOverviewDto {
  @ApiProperty()
  enabled!: boolean;

  @ApiProperty({ type: [String] })
  methods!: string[];

  @ApiProperty({ type: [UserCredentialDto] })
  credentials!: UserCredentialDto[];

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: KEYCLOAK_ACCOUNT_URLS_EXAMPLE,
  })
  urls!: Record<string, string>;

  @ApiProperty()
  keycloakAvailable!: boolean;
}

export class SessionsListDataResponseDto {
  @ApiProperty({ type: [SessionObjectDto] })
  sessions!: SessionObjectDto[];

  @ApiProperty()
  keycloakAvailable!: boolean;
}

export class SessionRevokeResponseDto {
  @ApiProperty()
  revoked!: boolean;

  @ApiPropertyOptional()
  sessionId?: string;
}

export class LogoutResponseDto {
  @ApiProperty()
  loggedOut!: boolean;
}

export class RevokeAllSessionsResponseDto {
  @ApiProperty()
  revoked!: boolean;

  @ApiPropertyOptional()
  count?: number;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export class SettingsNamespaceResponseDto {
  @ApiProperty({ example: 'localization' })
  namespace!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  values!: Record<string, unknown>;
}

export class OrganizationSettingsResponseDto {
  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ example: 'ui' })
  namespace!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  values!: Record<string, unknown>;
}

// ─── Feature flags ────────────────────────────────────────────────────────────

export class FeatureFlagEntryResponseDto {
  @ApiProperty({ example: 'enable_pharmacy' })
  key!: string;

  @ApiProperty()
  enabled!: boolean;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;
}

// ─── Reconciliation ───────────────────────────────────────────────────────────

export class ReconciliationDriftDto {
  @ApiProperty({ example: 'org_missing_in_keycloak' })
  type!: string;

  @ApiProperty()
  resourceId!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({ example: 'warning', description: 'info | warning | critical' })
  severity!: string;

  @ApiProperty()
  repairable!: boolean;
}

export class ReconciliationRepairDto {
  @ApiProperty()
  type!: string;

  @ApiProperty()
  resourceId!: string;

  @ApiProperty({ example: 'applied', description: 'applied | skipped | failed' })
  status!: string;
}

export class ReconciliationSummaryDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  critical!: number;

  @ApiProperty()
  warning!: number;

  @ApiProperty()
  repaired!: number;
}

export class ReconcileKeycloakResultResponseDto {
  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'date-time' })
  ranAt!: string;

  @ApiProperty()
  keycloakAvailable!: boolean;

  @ApiProperty({ type: [ReconciliationDriftDto] })
  drifts!: ReconciliationDriftDto[];

  @ApiProperty({ type: [ReconciliationRepairDto] })
  repairs!: ReconciliationRepairDto[];

  @ApiProperty({ type: ReconciliationSummaryDto })
  summary!: ReconciliationSummaryDto;
}

export class ReconciliationReportRecordResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'date-time' })
  ranAt!: string;

  @ApiProperty()
  keycloakAvailable!: boolean;

  @ApiProperty({ type: ReconciliationSummaryDto })
  summary!: ReconciliationSummaryDto;
}

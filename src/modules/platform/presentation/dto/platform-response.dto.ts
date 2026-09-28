import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationType } from '../../../identity/domain/organization/organization.entity.js';

export class PlatformContextResponseDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tenantId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  organizationId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  userId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  username?: string | null;

  @ApiProperty({ type: [String], example: ['org-admin'] })
  roles!: string[];

  @ApiProperty({ type: [String], example: ['users:read', 'orders:write'] })
  permissions!: string[];

  @ApiPropertyOptional({ nullable: true })
  locale?: string | null;

  @ApiPropertyOptional({ nullable: true })
  timezone?: string | null;
}

export class PlatformOrganizationListItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Acme Corp' })
  name!: string;

  @ApiProperty({ example: 'acme-corp' })
  slug!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Keycloak organization UUID' })
  keycloakOrganizationId?: string | null;
}

export class SwitchOrganizationResultResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Organization that is now active' })
  organizationId!: string;

  @ApiProperty({ description: 'Client must exchange this for a refreshed JWT' })
  refreshRequired!: boolean;
}

export class TenantProvisioningResultResponseDto {
  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ example: 'acme-corp' })
  slug!: string;

  @ApiProperty({ example: 'tenant_acme_prod' })
  databaseName!: string;

  @ApiProperty({ example: 't_acme_prod_app', description: 'Dedicated PostgreSQL LOGIN role' })
  databaseUsername!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiPropertyOptional({ example: 'READY', nullable: true })
  provisioningStep?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Default organization created in the shared Keycloak realm (when bootstrap enabled)',
    nullable: true,
  })
  defaultOrganizationId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  failureReason?: string | null;

  @ApiPropertyOptional({ nullable: true })
  failureStep?: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastAttemptAt?: Date | null;

  @ApiPropertyOptional({ example: 0 })
  retryCount?: number;
}

export class TenantDeprovisionResultResponseDto {
  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({
    description: 'true = DROP DATABASE/ROLE; false = soft DELETED status only',
  })
  hard!: boolean;
}

export class TenantHealthDatabaseDto {
  @ApiProperty()
  reachable!: boolean;

  @ApiPropertyOptional()
  latencyMs?: number;

  @ApiPropertyOptional({ type: [String] })
  schemaVersions?: string[];
}

export class TenantHealthKeycloakDto {
  @ApiProperty()
  organizationsExpected!: number;

  @ApiProperty()
  organizationsPresent!: number;

  @ApiProperty({ type: [String] })
  missing!: string[];
}

export class TenantHealthDomainsDto {
  @ApiPropertyOptional({ nullable: true })
  primary!: string | null;

  @ApiProperty()
  total!: number;
}

export class TenantHealthResponseDto {
  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiPropertyOptional({ nullable: true })
  provisioningStep!: string | null;

  @ApiProperty({ type: TenantHealthDatabaseDto })
  database!: TenantHealthDatabaseDto;

  @ApiProperty({ type: TenantHealthKeycloakDto })
  keycloak!: TenantHealthKeycloakDto;

  @ApiProperty({ type: TenantHealthDomainsDto })
  domains!: TenantHealthDomainsDto;

  @ApiProperty()
  healthy!: boolean;
}

export class CapabilitiesPlanDto {
  @ApiProperty({ example: 'STANDARD' })
  code!: string;

  @ApiProperty({ example: 'Standard' })
  name!: string;

  @ApiProperty({ example: 25 })
  maxOrganizations!: number;

  @ApiProperty({ example: 100 })
  maxUsers!: number;
}

export class CapabilitiesOrganizationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Acme HQ' })
  name!: string;

  @ApiProperty({ example: 'acme-hq' })
  slug!: string;

  @ApiProperty({ enum: OrganizationType, example: OrganizationType.STORE })
  type!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;
}

export class CapabilitiesSnapshotDto {
  @ApiPropertyOptional({ type: CapabilitiesPlanDto, nullable: true })
  plan!: CapabilitiesPlanDto | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'boolean' },
    example: { identity: true, commerce: false },
    description: 'Effective module enablement for the tenant plan (+ feature flags)',
  })
  modules!: Record<string, boolean>;

  @ApiProperty({ type: [String], example: ['users:read', 'orders:write'] })
  permissions!: string[];

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'boolean' },
    example: { 'users:read': true, 'orders:write': true },
    description: 'Flat map of effective permission codes for frontend gating',
  })
  capabilityMap!: Record<string, boolean>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'boolean' },
    example: { 'new-ui': true },
    description: 'All resolved feature flags for the current context',
  })
  features!: Record<string, boolean>;

  @ApiProperty({ type: [CapabilitiesOrganizationDto] })
  organizations!: CapabilitiesOrganizationDto[];

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  defaultOrganizationId!: string | null;

  @ApiProperty({
    type: [String],
    example: ['identity', 'commerce'],
    description: 'Module keys that are enabled AND the user has at least one related permission',
  })
  navigationHints!: string[];

  @ApiPropertyOptional({
    nullable: true,
    example: 'OFFICE',
    description: 'Assigned business profile code when Business Config is active',
  })
  businessProfile?: string | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['FEFO', 'LOT_TRACKING'],
    description: 'Enabled business capabilities from TenantBusinessConfiguration',
  })
  enabledCapabilities?: string[];

  @ApiPropertyOptional({
    example: 3,
    description: 'Optimistic version of tenant business configuration',
  })
  businessConfigVersion?: number;
}

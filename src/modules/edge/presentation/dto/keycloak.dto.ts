import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const TOPOLOGY_TYPES = ['DEDICATED_REALM', 'SHARED_REALM_ORGANIZATIONS', 'EXTERNAL_SPECIFIC'] as const;
const TLS_MODES = ['REQUIRED', 'OPTIONAL_INSECURE_LOCAL'] as const;
const ENVIRONMENTS = ['DEVELOPMENT', 'TEST', 'STAGING', 'PRODUCTION'] as const;
const CLIENT_KINDS = ['CONFIDENTIAL', 'PUBLIC', 'SERVICE_ACCOUNT'] as const;
const CODE_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

// ---------------------------------------------------------------------------
// Servers
// ---------------------------------------------------------------------------

export class RegisterKeycloakServerDto {
  @ApiProperty({ description: 'Registered provider id (edge_p7_keycloak_providers.id)' })
  @IsString()
  @IsNotEmpty()
  providerId!: string;

  @ApiProperty({ example: 'kc-lab-1', description: 'Unique operator code' })
  @IsString()
  @Matches(CODE_RE, { message: 'code must be lowercase alphanumeric with dashes' })
  code!: string;

  @ApiProperty({ example: 'Lab Keycloak 26' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'https://keycloak.lab.example.com' })
  @IsUrl({ require_tld: false })
  baseUrl!: string;

  @ApiPropertyOptional({ default: 'master' })
  @IsOptional()
  @IsString()
  adminRealm?: string;

  @ApiProperty({ example: 'edge-provisioner' })
  @IsString()
  @IsNotEmpty()
  adminClientId!: string;

  @ApiPropertyOptional({
    description:
      'Service-account client secret. Stored ONLY in the external vault; PostgreSQL keeps an opaque ref.',
    writeOnly: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  adminCredential?: string;

  @ApiPropertyOptional({ enum: TLS_MODES, default: 'REQUIRED' })
  @IsOptional()
  @IsIn(TLS_MODES)
  tlsMode?: string;

  @ApiPropertyOptional({
    description: 'Attestation allowing private/loopback targets (lab only, non-production).',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  allowPrivateNetwork?: boolean;

  @ApiPropertyOptional({ enum: ENVIRONMENTS, default: 'TEST' })
  @IsOptional()
  @IsIn(ENVIRONMENTS)
  environment?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class KeycloakServerActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

// ---------------------------------------------------------------------------
// Topologies / provisioning
// ---------------------------------------------------------------------------

export class CreateKeycloakTopologyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tenantId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @ApiPropertyOptional({
    description: 'P7.1 provisioning request id (REQUIRED — fail-closed).',
  })
  @IsString()
  @IsNotEmpty()
  provisioningRequestId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placementDecisionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deploymentProfileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  deploymentProfileVersion?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  runtimeProfileId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  providerId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  serverId!: string;

  @ApiProperty({ enum: TOPOLOGY_TYPES })
  @IsIn(TOPOLOGY_TYPES)
  topologyType!: string;

  @ApiPropertyOptional({
    description: 'Declarative profile options from P7.2 (clientSpecs, realmPrefix, …).',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  profileOptions?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Correlate with provisioning request', type: String })
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class KeycloakPaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn([
    'PLANNED',
    'PENDING',
    'PROVISIONING',
    'CONFIGURING',
    'VERIFYING',
    'READY',
    'DEGRADED',
    'FAILED',
    'RECONCILIATION_REQUIRED',
    'QUARANTINED',
    'DEPROVISIONING_PENDING',
    'DEPROVISIONED',
  ])
  status?: string;

  @ApiPropertyOptional({ enum: TOPOLOGY_TYPES })
  @IsOptional()
  @IsIn(TOPOLOGY_TYPES)
  topologyType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serverId?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

export class RequestKeycloakReconciliationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiPropertyOptional({ description: 'P7.1 provisioning request binding (fail-closed).' })
  @IsOptional()
  @IsString()
  provisioningRequestId?: string;

  @ApiPropertyOptional({ description: 'Idempotency key for the reconcile workflow instance.' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class DeprovisionKeycloakTopologyDto {
  @ApiProperty({ description: 'Explicit operator authorization (destructive op).' })
  @IsBoolean()
  authorized!: boolean;

  @ApiProperty({ description: 'Explicit confirmation flag (destructive op).' })
  @IsBoolean()
  confirmed!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

// ---------------------------------------------------------------------------
// Technical client registration (contract-declared, validated by policy)
// ---------------------------------------------------------------------------

export class DeclareKeycloakClientDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  topologyId!: string;

  @ApiProperty({ example: 'tenant-console' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  clientId!: string;

  @ApiProperty({ enum: CLIENT_KINDS })
  @IsIn(CLIENT_KINDS)
  clientKind!: string;

  @ApiProperty({ description: 'Functional owner (service/backend code — never an end-user).' })
  @IsString()
  @IsNotEmpty()
  ownerFunction!: string;

  @ApiProperty({ description: 'Documented usage of this technical client.' })
  @IsString()
  @IsNotEmpty()
  documentedUsage!: string;

  @ApiProperty({ type: [String], example: ['https://app.example.com/callback'] })
  @IsArray()
  @IsString({ each: true })
  redirectUris!: string[];

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  webOrigins?: string[];

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class KeycloakHistoryQueryDto {
  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
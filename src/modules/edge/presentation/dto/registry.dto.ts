/**
 * P7.2 Edge registry request DTOs.
 *
 * EFFECTIVE ValidationPipe protection (see main.ts global pipe):
 * - whitelist: true — undecorated properties are stripped before handlers run
 * - forbidNonWhitelisted: true — unknown properties cause 400 Bad Request
 * - transform: true (+ enableImplicitConversion) — query/body coercion via @Type
 *
 * Therefore: only fields with class-validator decorators are accepted; status /
 * identity / immutable fields omitted from PATCH DTOs cannot be injected via body.
 * Lifecycle / certification changes remain on dedicated transition endpoints.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ControlContractStatus,
  EnvironmentStatus,
  PlatformOperationalStatus,
  PlatformType,
  ProfileStatus,
  RegistryLifecycleStatus,
  RegistryResourceType,
  RuntimeEnvironmentType,
  TechnicalVersionStatus,
} from '../../domain/registry/registry.types.js';

export enum RegistryReleaseChannel {
  DEV = 'DEV',
  BETA = 'BETA',
  STABLE = 'STABLE',
  LTS = 'LTS',
  HOTFIX = 'HOTFIX',
}

// ---------------------------------------------------------------------------
// Pagination / list queries
// ---------------------------------------------------------------------------

export class RegistryPaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ description: 'Filter by lifecycle / operational status' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @ApiPropertyOptional({ description: 'Free-text search' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}

export class RegistryEnvironmentsQueryDto extends RegistryPaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  platformId?: string;
}

export class RegistryContractsQueryDto extends RegistryPaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  productId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  platformId?: string;
}

export class RegistryHistoryQueryDto extends RegistryPaginationQueryDto {
  @ApiPropertyOptional({ enum: RegistryResourceType })
  @IsOptional()
  @IsEnum(RegistryResourceType)
  resourceType?: RegistryResourceType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  resourceId?: string;
}

// ---------------------------------------------------------------------------
// Register / create
// ---------------------------------------------------------------------------

export class RegisterProductDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  verticalCategory?: string;
}

export class CreateTechnicalVersionDto {
  @ApiProperty({ example: '1.2.0' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  technicalVersion!: string;

  @ApiPropertyOptional({
    enum: RegistryReleaseChannel,
    default: RegistryReleaseChannel.STABLE,
  })
  @IsOptional()
  @IsEnum(RegistryReleaseChannel)
  releaseChannel?: RegistryReleaseChannel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  changeSummary?: string;
}

export class RegisterPlatformDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiProperty({ enum: PlatformType })
  @IsEnum(PlatformType)
  platformType!: PlatformType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  businessBackendId?: string;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  allowedProductIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedEnvironmentTypes?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedProfileCodes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  connectivityReference?: string;

  @ApiPropertyOptional({
    description: 'Opaque secure config handle — never a plaintext secret',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  secureConfigRef?: string;
}

export class RegisterEnvironmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  platformId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ enum: RuntimeEnvironmentType })
  @IsEnum(RuntimeEnvironmentType)
  environmentType!: RuntimeEnvironmentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  geoZone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  securityClassification?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  dataClassification?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedProfileCodes?: string[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  dataResidencyConstraints?: Record<string, unknown>;
}

export class CreateControlContractDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  platformId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  contractCode!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  contractVersion!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  schemaVersion!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  connectivityModel!: string;

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  @IsArray()
  supportedCapabilities?: unknown[];

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  @IsArray()
  supportedControlOperations?: unknown[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Secrets in this object are redacted server-side',
  })
  @IsOptional()
  @IsObject()
  s2sAuthPolicy?: Record<string, unknown>;
}

export class EvaluateCompatibilityDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  productRegistryId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  technicalVersionId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  platformId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  environmentId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  profileId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  contractId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  correlationId?: string;
}

// ---------------------------------------------------------------------------
// Dedicated PATCH DTOs (no nested Record patch; no status / immutable fields)
// ---------------------------------------------------------------------------

export class PatchProductRegistryDto {
  @ApiProperty({ description: 'Optimistic concurrency version' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  verticalCategory?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  technicalConstraints?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  @IsArray()
  declaredCapabilities?: unknown[];

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  compatiblePlatformIds?: string[];

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  compatibleEnvironmentIds?: string[];

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  compatibleProfileIds?: string[];

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  compatibleContractIds?: string[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class PatchPlatformDto {
  @ApiProperty({ description: 'Optimistic concurrency version' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  allowedProductIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedEnvironmentTypes?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedProfileCodes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  connectivityReference?: string;

  @ApiPropertyOptional({
    description: 'Opaque secure config handle — never a plaintext secret',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  secureConfigRef?: string;

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  @IsArray()
  declaredCapabilities?: unknown[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  constraints?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class PatchEnvironmentDto {
  @ApiProperty({ description: 'Optimistic concurrency version' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  geoZone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  securityClassification?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  dataClassification?: string;

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  @IsArray()
  availableCapabilities?: unknown[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  dataResidencyConstraints?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  backupPolicy?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  availabilityPolicy?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedProfileCodes?: string[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  governanceMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/** Draft-only patch — no versionStatus / certification fields. */
export class PatchTechnicalVersionDraftDto {
  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  @IsArray()
  compatibleContractVersions?: unknown[];

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  @IsArray()
  compatibleProfileCodes?: unknown[];

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  @IsArray()
  compatibleRuntimeTypes?: unknown[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  schemaCompatibility?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  apiCompatibility?: Record<string, unknown>;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  availableFrom?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  supportEndsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  changeSummary?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  certificationMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/** No code (immutable), no auto certification / profileStatus. */
export class PatchDeploymentProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  isolationModel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  connectivityModel?: string;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  compatibleProductIds?: string[];

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  @IsArray()
  compatiblePlatformTypes?: unknown[];

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  @IsArray()
  compatibleEnvironmentTypes?: unknown[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  securityRequirements?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  dataResidencyConstraints?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  backupRequirements?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  availabilityRequirements?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  disasterRecoveryRequirements?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/** Draft-only — no immutable / contractStatus / certificationEvidence. */
export class PatchControlContractDraftDto {
  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  @IsArray()
  supportedCapabilities?: unknown[];

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  @IsArray()
  supportedControlOperations?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  connectivityModel?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  s2sAuthPolicy?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  signatureRequirements?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  @IsArray()
  publishedEvents?: unknown[];

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  @IsArray()
  consumedEvents?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  backwardCompatible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  forwardCompatible?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  versioningPolicy?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Transitions (typed enums per resource)
// ---------------------------------------------------------------------------

class TransitionReasonMixin {
  @ApiPropertyOptional({
    description: 'Mandatory for suspend/deprecate/retire sensitive transitions',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class TransitionProductRegistryStatusDto extends TransitionReasonMixin {
  @ApiProperty({ enum: RegistryLifecycleStatus })
  @IsEnum(RegistryLifecycleStatus)
  toStatus!: RegistryLifecycleStatus;
}

export class TransitionTechnicalVersionStatusDto extends TransitionReasonMixin {
  @ApiProperty({ enum: TechnicalVersionStatus })
  @IsEnum(TechnicalVersionStatus)
  toStatus!: TechnicalVersionStatus;
}

export class TransitionPlatformStatusDto extends TransitionReasonMixin {
  @ApiProperty({ enum: PlatformOperationalStatus })
  @IsEnum(PlatformOperationalStatus)
  toStatus!: PlatformOperationalStatus;
}

export class TransitionEnvironmentStatusDto extends TransitionReasonMixin {
  @ApiProperty({ enum: EnvironmentStatus })
  @IsEnum(EnvironmentStatus)
  toStatus!: EnvironmentStatus;
}

export class TransitionDeploymentProfileStatusDto extends TransitionReasonMixin {
  @ApiProperty({ enum: ProfileStatus })
  @IsEnum(ProfileStatus)
  toStatus!: ProfileStatus;
}

export class TransitionControlContractStatusDto extends TransitionReasonMixin {
  @ApiProperty({ enum: ControlContractStatus })
  @IsEnum(ControlContractStatus)
  toStatus!: ControlContractStatus;
}

/** Generic fallback — prefer resource-specific transition DTOs. */
export class TransitionStatusDto extends TransitionReasonMixin {
  @ApiProperty({
    description: 'Target lifecycle / operational / contract status',
    example: 'CERTIFIED',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(64)
  toStatus!: string;
}

/** Build a use-case patch from a validated DTO, dropping undefined keys. */
export function pickDefinedPatch<T extends object>(
  body: T,
  omitKeys: readonly (keyof T)[] = [],
): Partial<T> {
  const omit = new Set(omitKeys);
  const out: Partial<T> = {};
  for (const key of Object.keys(body) as (keyof T)[]) {
    if (omit.has(key)) continue;
    const value = body[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

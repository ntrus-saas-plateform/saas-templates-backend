/**
 * P7.3 Edge placement / capacity request DTOs.
 *
 * EFFECTIVE ValidationPipe protection (see main.ts global pipe):
 * - whitelist: true — undecorated properties are stripped before handlers run
 * - forbidNonWhitelisted: true — unknown properties cause 400 Bad Request
 * - transform: true (+ enableImplicitConversion) — query/body coercion via @Type
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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
  ValidateIf,
} from 'class-validator';
import {
  CapacityInventoryStatus,
  CapacityMeasurementSource,
  CapacityResourceType,
  PlacementPolicyStatus,
  PlacementRequestStatus,
} from '../../domain/placement/placement.types.js';
import { RuntimeEnvironmentType } from '../../domain/registry/registry.types.js';

export function pickDefinedPatch<T extends Record<string, unknown>>(fields: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export class PlacementPaginationQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}

export class PlacementHistoryQueryDto extends PlacementPaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  resourceType?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  resourceId?: string;
}

export class CapacityInventoryQueryDto extends PlacementPaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  platformId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  environmentId?: string;

  @ApiPropertyOptional({ enum: CapacityResourceType })
  @IsOptional()
  @IsEnum(CapacityResourceType)
  resourceType?: CapacityResourceType;
}

export class CapacityReservationsQueryDto extends PlacementPaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  placementRequestId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  environmentId?: string;
}

// ---------------------------------------------------------------------------
// Create placement request
// ---------------------------------------------------------------------------

export class CreatePlacementRequestDto {
  @ApiProperty({
    description: 'Idempotency key (also accepted via Idempotency-Key header)',
  })
  @ValidateIf((o) => o.idempotencyKey !== undefined && o.idempotencyKey !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  idempotencyKey?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  provisioningRequestId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  productRegistryId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  technicalVersionId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  contractId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  deploymentProfileId!: string;

  @ApiProperty({ enum: RuntimeEnvironmentType })
  @IsEnum(RuntimeEnvironmentType)
  requestedEnvironmentType!: RuntimeEnvironmentType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  requestedDeploymentModel!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  platformId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  requestedRegion?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  dataResidencyConstraints?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  securityClassification?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  availabilityRequirements?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  recoveryRequirements?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Map resourceType → quantity',
  })
  @IsOptional()
  @IsObject()
  capacityRequirements?: Record<string, number>;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  causationId?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class EvaluatePlacementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  policyCode?: string;

  @ApiPropertyOptional({
    description: 'Idempotency key (also accepted via Idempotency-Key header)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;

  @ApiPropertyOptional({ minimum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  holdTtlMs?: number;
}

export class CancelPlacementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ConfirmPlacementDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  decisionId?: string;
}

export class ReEvaluatePlacementDto {
  @ApiProperty({
    description: 'Required idempotency key for re-evaluation',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  idempotencyKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  policyCode?: string;
}

export class ReleaseReservationDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ExpireReservationDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

// ---------------------------------------------------------------------------
// Capacity inventory
// ---------------------------------------------------------------------------

export class UpsertCapacityInventoryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  platformId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  environmentId!: string;

  @ApiProperty({ enum: CapacityResourceType })
  @IsEnum(CapacityResourceType)
  resourceType!: CapacityResourceType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  unit!: string;

  @ApiProperty()
  @Type(() => Number)
  @Min(0)
  totalCapacity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  unavailableCapacity?: number;

  @ApiPropertyOptional({ enum: CapacityMeasurementSource })
  @IsOptional()
  @IsEnum(CapacityMeasurementSource)
  measurementSource?: CapacityMeasurementSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  measuredAt?: string;

  @ApiProperty()
  @IsDateString()
  validUntil!: string;

  @ApiPropertyOptional({ enum: CapacityInventoryStatus })
  @IsOptional()
  @IsEnum(CapacityInventoryStatus)
  capacityStatus?: CapacityInventoryStatus;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class PatchCapacityInventoryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  totalCapacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  unavailableCapacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  measuredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ enum: CapacityInventoryStatus })
  @IsOptional()
  @IsEnum(CapacityInventoryStatus)
  capacityStatus?: CapacityInventoryStatus;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

export class CreatePlacementPolicyDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  policyVersion?: number;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  scope?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  hardConstraints?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  scoringWeights?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  algorithmVersion?: string;

  @ApiPropertyOptional({ enum: PlacementPolicyStatus })
  @IsOptional()
  @IsEnum(PlacementPolicyStatus)
  policyStatus?: PlacementPolicyStatus;
}

export class PatchPlacementPolicyDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  scope?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  hardConstraints?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  scoringWeights?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  algorithmVersion?: string;

  @ApiPropertyOptional({ enum: PlacementPolicyStatus })
  @IsOptional()
  @IsEnum(PlacementPolicyStatus)
  policyStatus?: PlacementPolicyStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  policyVersion?: number;
}

export { PlacementRequestStatus };

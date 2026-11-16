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
  Min,
} from 'class-validator';
import {
  EnvironmentClassification,
  ExceptionType,
  LifecycleRequestType,
  MigrationType,
  RecoveryPriority,
  RecoveryType,
  TenantClassification,
} from '../../domain/tenant-management/tenant-management.types.js';

export class TenantSearchQueryDto {
  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classification?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  administrativeStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  technicalStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  governanceStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  healthStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  riskLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tagKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tagValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortDir?: 'asc' | 'desc';
}

export class RegisterTenantDto {
  @ApiProperty()
  @IsUUID()
  productTenantId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tenantCode!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tenantSlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @ApiPropertyOptional({ enum: TenantClassification })
  @IsOptional()
  @IsEnum(TenantClassification)
  classification?: TenantClassification;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class UpdateTenantMetadataDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  displayName?: string;

  @ApiPropertyOptional({ enum: TenantClassification })
  @IsOptional()
  @IsEnum(TenantClassification)
  classification?: TenantClassification;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  segment?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locale?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultLanguage?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supportClassification?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deploymentProfile?: string | null;

  @ApiPropertyOptional({ enum: EnvironmentClassification })
  @IsOptional()
  @IsEnum(EnvironmentClassification)
  environmentClassification?: EnvironmentClassification;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class AssignTenantOwnerDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalOwnerId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operationalTeam?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class ManageTenantTagDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tagKey!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tagValue!: string;
}

export class RemoveTenantTagQueryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tagKey!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tagValue!: string;
}

export class AddTenantNoteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiPropertyOptional({ default: 'GENERAL' })
  @IsOptional()
  @IsString()
  noteType?: string;
}

export class RequestLifecycleActionDto {
  @ApiProperty({ enum: LifecycleRequestType })
  @IsEnum(LifecycleRequestType)
  requestType!: LifecycleRequestType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  justification!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  riskAssessment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class RejectLifecycleActionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  rejectedReason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class ApproveLifecycleActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class RequestExceptionDto {
  @ApiProperty()
  @IsUUID()
  tenantRegistryId!: string;

  @ApiPropertyOptional({ enum: ExceptionType })
  @IsOptional()
  @IsEnum(ExceptionType)
  exceptionType?: ExceptionType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  businessJustification!: string;

  @ApiProperty()
  @IsDateString()
  startsAt!: string;

  @ApiProperty()
  @IsDateString()
  expiresAt!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  riskAssessment?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  scope?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class RevokeExceptionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  revokeReason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class RequestMigrationDto {
  @ApiProperty()
  @IsUUID()
  tenantRegistryId!: string;

  @ApiProperty({ enum: MigrationType })
  @IsEnum(MigrationType)
  migrationType!: MigrationType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  justification!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  impactAssessment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  compatibilityAssessment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dataResidencyReview?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  downtimeAssessment?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  targetRef?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduleAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class RequestRecoveryDto {
  @ApiProperty()
  @IsUUID()
  tenantRegistryId!: string;

  @ApiProperty({ enum: RecoveryType })
  @IsEnum(RecoveryType)
  recoveryType!: RecoveryType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  justification!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @ApiPropertyOptional({ enum: RecoveryPriority, default: RecoveryPriority.MEDIUM })
  @IsOptional()
  @IsEnum(RecoveryPriority)
  priority?: RecoveryPriority;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  scope?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  backupRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  restorePointRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rpoAssessment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rtoMeasurement?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class RequestTerminationDto {
  @ApiProperty()
  @IsUUID()
  tenantRegistryId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  justification!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dataExportRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  graceUntil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class RejectGovernanceRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  rejectedReason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class RunReconciliationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  dryRun?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class TenantActivityQueryDto {
  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class GovernanceListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantRegistryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class ReconciliationFindingsQueryDto extends GovernanceListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  runId?: string;
}
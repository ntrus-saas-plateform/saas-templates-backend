import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LifecyclePaginationQueryDto {
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
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  activationRecordId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  provisioningRequestId?: string;
}

export class CreateLifecycleRecordDto {
  @ApiProperty({ description: 'P7.10 Activation Record id (must be ACTIVE)' })
  @IsUUID()
  activationRecordId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  retentionPolicyRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  exportEvidenceRef?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RequestLifecycleSuspendDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  provisioningRequestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RequestLifecycleResumeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  provisioningRequestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * Destructive deprovision — requires authorized===true && confirmed===true && reason.
 */
export class RequestLifecycleDeprovisionDto {
  @ApiProperty({ description: 'Must be true (destructive op)' })
  @IsBoolean()
  @Equals(true, { message: 'authorized must be true' })
  authorized!: boolean;

  @ApiProperty({ description: 'Must be true (destructive op)' })
  @IsBoolean()
  @Equals(true, { message: 'confirmed must be true' })
  confirmed!: boolean;

  @ApiProperty({ description: 'Required human reason for deprovision' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  provisioningRequestId?: string;

  @ApiPropertyOptional({ description: 'Export evidence ref (required if not already on record)' })
  @IsOptional()
  @IsString()
  @ValidateIf((_o, v) => v != null)
  exportEvidenceRef?: string;
}

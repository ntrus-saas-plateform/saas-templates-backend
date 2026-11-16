import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ActivationPaginationQueryDto {
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
  provisioningRequestId?: string;
}

export class CreateReadinessEvaluationDto {
  @ApiProperty()
  @IsUUID()
  tenantId!: string;

  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty({ description: 'P7.1 provisioning request id (binds authorization)' })
  @IsUUID()
  provisioningRequestId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateActivationRecordDto {
  @ApiProperty()
  @IsUUID()
  tenantId!: string;

  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty({ description: 'P7.1 provisioning request id (binds authorization)' })
  @IsUUID()
  provisioningRequestId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  readinessEvaluationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RequestReadinessEvaluateDto {
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

  @ApiPropertyOptional({ description: 'Optional activation record to mark EVALUATING' })
  @IsOptional()
  @IsUUID()
  activationRecordId?: string;
}

export class RequestTechnicalActivationDto {
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
}

/**
 * P7.4 Edge workflow DTOs.
 * Global ValidationPipe: whitelist + forbidNonWhitelisted + transform.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
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

export class WorkflowPaginationQueryDto {
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

export class WorkflowHistoryQueryDto extends WorkflowPaginationQueryDto {
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

export class CreateWorkflowDefinitionDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(128)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
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
  @MaxLength(64)
  domain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  securityClassification?: string;

  @ApiProperty({ description: 'Definition snapshot (steps/graph/policies)' })
  @IsObject()
  snapshot!: Record<string, unknown>;
}

export class DeprecateWorkflowDefinitionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class CreateWorkflowInstanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  definitionId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  workflowType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  inputSnapshot?: Record<string, unknown>;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  provisioningRequestId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  placementDecisionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  businessReference?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  causationId?: string;
}

export class WorkflowReasonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class RetryWorkflowDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  stepId?: string;
}

export class AssignWorkflowTaskDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  assignee!: string;
}

export class DecideWorkflowTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class RejectWorkflowTaskDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

export class ClaimStepDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  workerId!: string;

  @ApiPropertyOptional({ minimum: 1000, maximum: 600000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(600_000)
  leaseMs?: number;
}

export class RenewLeaseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  workerId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fencingToken!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(600_000)
  leaseMs?: number;
}

export class CompleteStepDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  workerId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fencingToken!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  outputSnapshot?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  checkpoint?: Record<string, unknown>;
}

export class FailStepDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  workerId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fencingToken!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  errorClass!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  diagnostics?: Record<string, unknown>;
}

export class WorkerHeartbeatDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  workerId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  identity!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  workerVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CompleteCompensationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  stepId!: string;

  @ApiProperty()
  @IsBoolean()
  success!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  result?: Record<string, unknown>;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true' || value === '1' || value === 1) return true;
  if (value === false || value === 'false' || value === '0' || value === 0) return false;
  return undefined;
}

export class OperationsListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({ description: 'Filter incidents by major flag (1/0/true/false)' })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  isMajor?: boolean;

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

export class RecordHealthSnapshotDto {
  @ApiProperty()
  @IsUUID()
  serviceId!: string;

  @ApiProperty()
  @IsString()
  overallStatus!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  sourceSystem!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  indicators?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  observedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class IngestAlertDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  fingerprint!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  sourceSystem!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  labels?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  annotations?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreateIncidentDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isMajor?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class TransitionIncidentDto {
  @ApiProperty()
  @IsString()
  toStatus!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolutionSummary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreateProblemDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class ConfirmRootCauseDto {
  @ApiProperty()
  @IsString()
  @MinLength(4)
  rootCauseSummary!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  evidence?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class LinkProblemIncidentDto {
  @ApiProperty()
  @IsUUID()
  incidentId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreateChangeDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  changeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  riskLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  implementationPlan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rollbackPlan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class RejectChangeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class ScheduleMaintenanceDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  reason!: string;

  @ApiProperty()
  @IsDateString()
  startsAt!: string;

  @ApiProperty()
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maintenanceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreateServiceRequestDto {
  @ApiProperty()
  @IsString()
  category!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreateTaskDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  relatedIncidentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreateOnCallRotationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamDisplayName?: string;

  @ApiProperty()
  @IsDateString()
  startsAt!: string;

  @ApiProperty()
  @IsDateString()
  endsAt!: string;

  @ApiProperty()
  @IsString()
  primaryResponderId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secondaryResponderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreateSloDto {
  @ApiProperty()
  @IsUUID()
  serviceId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty()
  @IsString()
  sliType!: string;

  @ApiProperty()
  @IsNumber()
  targetValue!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  windowDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class RecordSloMeasurementDto {
  @ApiProperty()
  @IsUUID()
  sloId!: string;

  @ApiProperty()
  @IsNumber()
  measuredValue!: number;

  @ApiProperty()
  @IsDateString()
  windowStart!: string;

  @ApiProperty()
  @IsDateString()
  windowEnd!: string;

  @ApiProperty()
  @IsString()
  sourceSystem!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  errorBudgetRemaining?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class RecordCapacityDto {
  @ApiProperty()
  @IsString()
  metricName!: string;

  @ApiProperty()
  @IsNumber()
  metricValue!: number;

  @ApiProperty()
  @IsString()
  sourceSystem!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class RequestRecoveryDto {
  @ApiProperty()
  @IsString()
  operationType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class VerifyRecoveryDto {
  @ApiProperty()
  @IsString()
  @MinLength(4)
  externalEvidenceRef!: string;

  @ApiProperty({
    enum: ['PROVIDER_TICKET', 'BACKUP_JOB_ID', 'DR_EXERCISE_REF', 'MANUAL_OVERRIDE'],
  })
  @IsString()
  evidenceKind!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evidenceJustification?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class RecordNotificationDeliveryDto {
  @ApiProperty()
  @IsString()
  eventType!: string;

  @ApiProperty()
  @IsString()
  channel!: string;

  @ApiProperty()
  @IsString()
  destination!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  relatedIncidentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  relatedRotationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class UpdateNotificationDeliveryStatusDto {
  @ApiProperty()
  @IsString()
  toStatus!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastError?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreateReleaseDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  version!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buildRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  artifactDigest?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalEvidenceRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  environment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  changeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class TransitionReleaseDto {
  @ApiProperty()
  @IsString()
  toStatus!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  artifactDigest?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalEvidenceRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  healthGateStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class ConnectMonitoringSourceDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  displayName!: string;

  @ApiProperty()
  @IsString()
  providerType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endpointRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class RecordMonitoringProbeDto {
  @ApiProperty()
  @IsUUID()
  sourceId!: string;

  @ApiProperty()
  @IsString()
  probeType!: string;

  @ApiProperty()
  @IsString()
  outcome!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latencyMs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  evidence?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreateRunbookDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class PublishStatusDto {
  @ApiProperty()
  @IsString()
  componentCode!: string;

  @ApiProperty()
  @IsString()
  componentDisplayName!: string;

  @ApiProperty()
  @IsString()
  publicStatus!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  message!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreateRiskDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty()
  @IsString()
  category!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreateExceptionDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty()
  @IsString()
  scope!: string;

  @ApiProperty()
  @IsString()
  justification!: string;

  @ApiProperty()
  @IsDateString()
  expiresAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  compensatingControls?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreateAutomationDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty()
  @IsString()
  triggerType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  definition?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  destructive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class RequestAutomationExecutionDto {
  @ApiProperty()
  @IsUUID()
  automationId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  idempotencyKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

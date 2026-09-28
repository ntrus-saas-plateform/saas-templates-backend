import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const OPS_STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
const HIERARCHY_LEVELS = ['AISLE', 'RACK', 'SHELF', 'BIN', 'OTHER'] as const;
const WORKFLOW_KINDS = [
  'PURCHASE_APPROVAL',
  'DISCOUNT_APPROVAL',
  'STOCK_ADJUSTMENT_APPROVAL',
  'REFUND_APPROVAL',
  'EXPENSE_APPROVAL',
  'LEAVE_APPROVAL',
  'CUSTOM',
] as const;

export class CreateFacilityDto {
  @ApiProperty({ example: 'FAC-MAIN' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  code!: string;

  @ApiProperty({ example: 'Main pharmacy' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: 'OFFICE' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  facilityType?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  address?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateFacilityDto {
  @ApiPropertyOptional({ example: 'FAC-MAIN' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'OFFICE' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  facilityType?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  address?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateWarehouseDto {
  @ApiProperty({ example: 'WH-MAIN' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'Main warehouse' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  facilityId?: string | null;

  @ApiPropertyOptional({ enum: OPS_STATUSES })
  @IsOptional()
  @IsEnum(OPS_STATUSES)
  status?: (typeof OPS_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  address?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateWarehouseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  facilityId?: string | null;

  @ApiPropertyOptional({ example: 'WH-MAIN' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ enum: OPS_STATUSES })
  @IsOptional()
  @IsEnum(OPS_STATUSES)
  status?: (typeof OPS_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  address?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateWarehouseZoneDto {
  @ApiProperty({ example: 'Z-RECV' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'Receiving' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: 'RECEIVING' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  kind?: string;

  @ApiPropertyOptional({ example: 'RECEIVING' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  locationType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  temperatureProfile?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minTemperature?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxTemperature?: number | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedProductTypes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateWarehouseZoneDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kind?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  temperatureProfile?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minTemperature?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxTemperature?: number | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedProductTypes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateWarehouseLocationDto {
  @ApiProperty({ example: 'A-01-01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'Bin A-01-01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({ enum: HIERARCHY_LEVELS })
  @IsOptional()
  @IsEnum(HIERARCHY_LEVELS)
  hierarchyLevel?: (typeof HIERARCHY_LEVELS)[number];

  @ApiPropertyOptional({ example: 'PICKING' })
  @IsOptional()
  @IsString()
  locationType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  capacity?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minTemperature?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxTemperature?: number | null;

  @ApiPropertyOptional({ example: 'STANDARD' })
  @IsOptional()
  @IsString()
  securityLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateWarehouseLocationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({ enum: HIERARCHY_LEVELS })
  @IsOptional()
  @IsEnum(HIERARCHY_LEVELS)
  hierarchyLevel?: (typeof HIERARCHY_LEVELS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  capacity?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minTemperature?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxTemperature?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  securityLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreatePosTerminalDto {
  @ApiProperty({ example: 'POS-01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'Front counter' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  warehouseId?: string | null;

  @ApiPropertyOptional({ enum: OPS_STATUSES })
  @IsOptional()
  @IsEnum(OPS_STATUSES)
  status?: (typeof OPS_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  offlineEnabled?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  receiptTemplate?: string | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdatePosTerminalDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  warehouseId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ enum: OPS_STATUSES })
  @IsOptional()
  @IsEnum(OPS_STATUSES)
  status?: (typeof OPS_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  offlineEnabled?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  receiptTemplate?: string | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateCashRegisterDto {
  @ApiProperty({ example: 'CR-01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'Register 1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  posTerminalId?: string | null;

  @ApiPropertyOptional({ enum: OPS_STATUSES })
  @IsOptional()
  @IsEnum(OPS_STATUSES)
  status?: (typeof OPS_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  openingBalance?: number;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateCashRegisterDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  posTerminalId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ enum: OPS_STATUSES })
  @IsOptional()
  @IsEnum(OPS_STATUSES)
  status?: (typeof OPS_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  openingBalance?: number;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class WorkflowStepDto {
  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  stepIndex!: number;

  @ApiProperty({ example: 'Manager approval' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ type: [String], example: ['org_admin'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  approverRoles?: string[];

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  approverUserIds?: string[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  threshold?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  escalation?: Record<string, unknown>;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  slaHours?: number | null;
}

export class CreateWorkflowDto {
  @ApiProperty({ example: 'PO-APPROVAL' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'Purchase order approval' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ enum: WORKFLOW_KINDS })
  @IsEnum(WORKFLOW_KINDS)
  kind!: (typeof WORKFLOW_KINDS)[number];

  @ApiPropertyOptional({ enum: OPS_STATUSES })
  @IsOptional()
  @IsEnum(OPS_STATUSES)
  status?: (typeof OPS_STATUSES)[number];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [WorkflowStepDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDto)
  steps?: WorkflowStepDto[];
}

export class UpdateWorkflowDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ enum: WORKFLOW_KINDS })
  @IsOptional()
  @IsEnum(WORKFLOW_KINDS)
  kind?: (typeof WORKFLOW_KINDS)[number];

  @ApiPropertyOptional({ enum: OPS_STATUSES })
  @IsOptional()
  @IsEnum(OPS_STATUSES)
  status?: (typeof OPS_STATUSES)[number];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [WorkflowStepDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDto)
  steps?: WorkflowStepDto[];
}

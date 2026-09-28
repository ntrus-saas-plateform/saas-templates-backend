import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrganizationType } from '../../domain/organization/organization.entity.js';

export class OrganizationAddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  line1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  line2?: string;

  @ApiPropertyOptional({ example: 'BI' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  commune?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quartier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;
}

export class OrganizationContactDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;
}

export class DayHoursDto {
  @ApiProperty({ example: '08:00' })
  @IsString()
  open!: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  close!: string;
}

export class OpeningHoursDto {
  @ApiPropertyOptional({ type: DayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursDto)
  monday?: DayHoursDto | null;

  @ApiPropertyOptional({ type: DayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursDto)
  tuesday?: DayHoursDto | null;

  @ApiPropertyOptional({ type: DayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursDto)
  wednesday?: DayHoursDto | null;

  @ApiPropertyOptional({ type: DayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursDto)
  thursday?: DayHoursDto | null;

  @ApiPropertyOptional({ type: DayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursDto)
  friday?: DayHoursDto | null;

  @ApiPropertyOptional({ type: DayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursDto)
  saturday?: DayHoursDto | null;

  @ApiPropertyOptional({ type: DayHoursDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursDto)
  sunday?: DayHoursDto | null;
}

export class OperationalSettingsDto {
  @ApiPropertyOptional({ example: 'BIF' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  defaultCurrency?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  defaultTaxCategoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  defaultPriceListId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  defaultWarehouseId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  defaultPosId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  defaultCashRegisterId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultPaymentMethods?: string[];

  @ApiPropertyOptional({ type: [Number], example: [1, 2, 3, 4, 5] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  businessDays?: number[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  holidayCalendarId?: string;
}

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Branch Paris' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'branch-paris', description: 'URL-safe slug' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @ApiPropertyOptional({ example: 'PAR-01' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ enum: OrganizationType })
  @IsOptional()
  @IsEnum(OrganizationType)
  type?: OrganizationType;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Europe/Paris' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'fr' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ type: OrganizationAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrganizationAddressDto)
  address?: OrganizationAddressDto;

  @ApiPropertyOptional({ type: OrganizationContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrganizationContactDto)
  contact?: OrganizationContactDto;

  @ApiPropertyOptional({ type: OpeningHoursDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OpeningHoursDto)
  openingHours?: OpeningHoursDto;

  @ApiPropertyOptional({ type: OperationalSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperationalSettingsDto)
  operationalSettings?: OperationalSettingsDto;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @ApiPropertyOptional({ example: 'PAR-01', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string | null;

  @ApiPropertyOptional({ enum: OrganizationType })
  @IsOptional()
  @IsEnum(OrganizationType)
  type?: OrganizationType;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ type: OrganizationAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrganizationAddressDto)
  address?: OrganizationAddressDto;

  @ApiPropertyOptional({ type: OrganizationContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrganizationContactDto)
  contact?: OrganizationContactDto;

  @ApiPropertyOptional({ type: OpeningHoursDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OpeningHoursDto)
  openingHours?: OpeningHoursDto;

  @ApiPropertyOptional({ type: OperationalSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperationalSettingsDto)
  operationalSettings?: OperationalSettingsDto;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ListOrganizationsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by parent. Pass empty string for roots only.',
  })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ enum: ['membership', 'tenant'], default: 'membership' })
  @IsOptional()
  @IsString()
  scope?: 'membership' | 'tenant';

  @ApiPropertyOptional({ description: 'When true, returns flat tree list (all matching orgs)' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  tree?: boolean;
}

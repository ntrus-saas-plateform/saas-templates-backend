import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MembershipStatus } from '../../domain/membership/organization-membership.entity.js';

export class MembershipResourceScopeDto {
  @ApiProperty({ example: 'inventory:read', description: 'Catalog key resource:action' })
  @IsString()
  permission!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ example: 'warehouse' })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  resourceId?: string;
}

export class GrantMembershipDto {
  @ApiProperty({ description: 'Stable identity key (Keycloak sub)' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  organizationId!: string;

  @ApiPropertyOptional({ example: ['viewer'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @ApiPropertyOptional({ example: ['organizations:read'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({ enum: MembershipStatus })
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  position?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerUserId?: string;

  @ApiPropertyOptional({ type: [MembershipResourceScopeDto] })
  @IsOptional()
  @IsArray()
  @Type(() => MembershipResourceScopeDto)
  resourceScopes?: MembershipResourceScopeDto[];

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class UpdateMembershipDto {
  @ApiPropertyOptional({ example: ['manager'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @ApiPropertyOptional({ example: ['organizations:read', 'memberships:read'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({ enum: MembershipStatus })
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  department?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  position?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  managerUserId?: string | null;

  @ApiPropertyOptional({ type: [MembershipResourceScopeDto] })
  @IsOptional()
  @IsArray()
  @Type(() => MembershipResourceScopeDto)
  resourceScopes?: MembershipResourceScopeDto[];

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsString()
  expiresAt?: string | null;
}

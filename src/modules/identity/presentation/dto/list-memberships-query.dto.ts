import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../../shared/validation/query.dto.js';
import { MembershipStatus } from '../../domain/membership/organization-membership.entity.js';

export class ListMembershipsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ enum: MembershipStatus })
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;

  @ApiPropertyOptional({ description: 'Search userId, department, position, or roles' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

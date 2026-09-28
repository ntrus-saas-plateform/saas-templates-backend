import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../../shared/validation/query.dto.js';
import { InvitationStatus } from '../../domain/invitation/invitation.entity.js';

export class ListInvitationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ enum: InvitationStatus })
  @IsOptional()
  @IsEnum(InvitationStatus)
  status?: InvitationStatus;

  @ApiPropertyOptional({ description: 'Search invitation email' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

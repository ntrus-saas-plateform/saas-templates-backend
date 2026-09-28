import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../../shared/validation/query.dto.js';
import { ApplicationUserStatus } from '../../domain/user/application-user.entity.js';

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ApplicationUserStatus })
  @IsOptional()
  @IsEnum(ApplicationUserStatus)
  status?: ApplicationUserStatus;

  @ApiPropertyOptional({ description: 'Search name, email, job title, or employee number' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

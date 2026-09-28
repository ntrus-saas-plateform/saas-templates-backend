import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Cursor for cursor-based pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class SortQueryDto {
  @ApiPropertyOptional({ example: 'createdAt:desc' })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc';
}

export class SearchQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  filter?: string;
}

export function parseSortParam(
  sort: string | undefined,
  allowedFields: readonly string[],
): { field: string; order: 'ASC' | 'DESC' } | null {
  if (!sort) return null;
  const [field, order = 'asc'] = sort.split(':');
  if (!allowedFields.includes(field)) return null;
  return { field, order: order.toLowerCase() === 'desc' ? 'DESC' : 'ASC' };
}

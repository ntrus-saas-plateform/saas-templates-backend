import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorBodyDto {
  @ApiProperty({ example: 'FORBIDDEN' })
  code!: string;

  @ApiProperty({ example: 'Access denied' })
  message!: string;

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  details!: Record<string, unknown>[];

  @ApiProperty({ example: 'req-abc123' })
  requestId!: string;

  @ApiProperty({ example: 'corr-abc123' })
  correlationId!: string;
}

export class ApiErrorResponseDto {
  @ApiProperty({ type: ApiErrorBodyDto })
  error!: ApiErrorBodyDto;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;

  @ApiProperty({ example: true })
  hasNext!: boolean;

  @ApiProperty({ example: false })
  hasPrevious!: boolean;

  @ApiPropertyOptional({ nullable: true, example: null })
  nextCursor!: string | null;
}

export class ApiDataWrapperDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Response payload',
  })
  data!: Record<string, unknown>;
}

import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RunReconciliationDto {
  @ApiPropertyOptional({
    description: 'Apply automatic repairs for safe drift types (KC org create, membership sync)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  repair?: boolean;
}

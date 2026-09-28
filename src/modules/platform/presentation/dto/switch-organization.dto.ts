import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class SwitchOrganizationDto {
  @ApiProperty({ format: 'uuid', description: 'Target organization ID (application UUID)' })
  @IsUUID()
  @IsNotEmpty()
  organizationId!: string;
}

import { IsObject, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSettingsNamespaceDto {
  @ApiProperty({
    description: 'Key-value settings within the namespace',
    example: { timezone: 'Europe/Paris', locale: 'fr' },
  })
  @IsObject()
  values!: Record<string, unknown>;
}

export class SettingsNamespaceParamDto {
  @ApiProperty({ example: 'localization' })
  @IsString()
  @MinLength(1)
  namespace!: string;
}

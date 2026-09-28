import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateUserProfileDto {
  @ApiProperty({
    description:
      'User profile fields (personal, contact, professional). Partial merge.',
    example: {
      displayName: 'User A',
      firstName: 'User',
      lastName: 'TenantA',
      preferredName: 'A',
      phone: '+257...',
    },
  })
  @IsOptional()
  @IsObject()
  profile!: Record<string, unknown>;
}

export class UpdateUserPreferencesDto {
  @ApiProperty({
    description: 'Flat dotted preference keys (localization.locale, ui.theme, …)',
    example: {
      'localization.locale': 'fr',
      'ui.theme': 'system',
      'ui.density': 'comfortable',
    },
  })
  @IsObject()
  settings!: Record<string, unknown>;
}

export class MySecurityQueryDto {
  @ApiPropertyOptional({ description: 'Redirect URI after Keycloak required action' })
  @IsOptional()
  @IsString()
  redirectUri?: string;
}

export class UpdatePersonalizationDto {
  @ApiProperty({
    description:
      'Partial personalization (favorites, pinnedPages, widgets, savedFilters, …)',
    example: {
      favorites: [{ id: 'apps.identity', label: 'Identity', href: '/identity/users' }],
    },
  })
  @IsObject()
  personalization!: Record<string, unknown>;
}

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Only unread notifications' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  unreadOnly?: boolean;
}

export class CreateNotificationDto {
  @ApiProperty({ example: 'Welcome' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;

  @ApiPropertyOptional({ example: 'system' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @ApiPropertyOptional({ example: 'normal' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class ListDevicesQueryDto {
  @ApiPropertyOptional({
    description: 'Sync soft device list from Keycloak sessions (default true)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return value === true || value === 'true' || value === '1';
  })
  @IsBoolean()
  syncSessions?: boolean;
}

export class TrustDeviceDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  trusted!: boolean;
}

export class EnrollPushDeviceDto {
  @ApiProperty({ example: 'Pixel 8' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  deviceName!: string;

  @ApiProperty({ example: 'fcm_token_...' })
  @IsString()
  @MinLength(8)
  @MaxLength(2048)
  pushToken!: string;

  @ApiProperty({ example: 'fcm', description: 'fcm | apns | webpush' })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  pushPlatform!: string;

  @ApiPropertyOptional({ example: 'android' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  platform?: string;
}

export class CreateApiTokenDto {
  @ApiProperty({ example: 'CI bot' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ type: [String], example: ['users:read'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @ApiPropertyOptional({ description: 'ISO datetime' })
  @IsOptional()
  @IsString()
  expiresAt?: string | null;
}

export class CreateActivityDto {
  @ApiProperty({ example: 'Switched organization' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  detail?: string;

  @ApiPropertyOptional({ example: 'navigation' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  href?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class RecordLoginDto {
  @ApiPropertyOptional({ example: 'login' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  eventType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  success?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SendPhoneVerificationDto {
  @ApiProperty({ example: '+243970000000' })
  @IsString()
  @MaxLength(32)
  phoneE164!: string;
}

export class VerifyPhoneVerificationDto {
  @ApiProperty({ example: '+243970000000' })
  @IsString()
  @MaxLength(32)
  phoneE164!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MaxLength(8)
  code!: string;
}

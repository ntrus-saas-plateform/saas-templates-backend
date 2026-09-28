import {
  Controller,
  Get,
  Res,
  HttpStatus,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../../../shared/auth/decorators.js';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import { CacheService } from '../../../../shared/database/cache.service.js';
import { RabbitMqService } from '../../../../shared/messaging/rabbitmq.service.js';
import { SwaggerTags } from '../../../../shared/swagger/swagger.constants.js';

class LivenessResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;
}

class ReadinessChecksDto {
  @ApiProperty()
  controlPlaneDb!: boolean;

  @ApiProperty()
  redis!: boolean;

  @ApiProperty()
  rabbitmq!: boolean;
}

class ReadinessResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'degraded'] })
  status!: string;

  @ApiProperty({ type: ReadinessChecksDto })
  checks!: ReadinessChecksDto;
}

class HealthSummaryResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'degraded'] })
  status!: string;

  @ApiProperty({ example: 'platform-core' })
  service!: string;

  @ApiProperty({ example: '0.0.1' })
  version!: string;
}

@ApiTags(SwaggerTags.HEALTH)
@Controller()
export class HealthController {
  constructor(
    private readonly dbManager: TenantDatabaseManager,
    private readonly cache: CacheService,
    private readonly rabbitMq: RabbitMqService,
  ) {}

  @Public()
  @Version(VERSION_NEUTRAL)
  @Get('liveness')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, type: LivenessResponseDto })
  liveness(): LivenessResponseDto {
    return { status: 'ok' };
  }

  @Public()
  @Version(VERSION_NEUTRAL)
  @Get('readiness')
  @ApiOperation({ summary: 'Readiness probe (DB, Redis, RabbitMQ)' })
  @ApiResponse({ status: 200, type: ReadinessResponseDto })
  @ApiResponse({ status: 503, type: ReadinessResponseDto })
  async readiness(@Res() res: Response): Promise<void> {
    const dbHealth = await this.dbManager.healthCheck();
    const redisHealth = await this.cache.ping();
    const rabbitHealth = this.rabbitMq.isConnected();

    const checks = {
      controlPlaneDb: dbHealth.controlPlane,
      redis: redisHealth,
      rabbitmq: rabbitHealth,
    };

    const allHealthy = Object.values(checks).every(Boolean);
    const body: ReadinessResponseDto = {
      status: allHealthy ? 'ok' : 'degraded',
      checks,
    };

    res.status(allHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json(body);
  }

  @Public()
  @Version(VERSION_NEUTRAL)
  @Get('health')
  @ApiOperation({ summary: 'Service health summary' })
  @ApiResponse({ status: 200, type: HealthSummaryResponseDto })
  @ApiResponse({ status: 503, type: HealthSummaryResponseDto })
  async health(@Res() res: Response): Promise<void> {
    const dbHealth = await this.dbManager.healthCheck();
    const redisHealth = await this.cache.ping();
    const rabbitHealth = this.rabbitMq.isConnected();
    const allHealthy = dbHealth.controlPlane && redisHealth && rabbitHealth;

    const body: HealthSummaryResponseDto = {
      status: allHealthy ? 'ok' : 'degraded',
      service: 'platform-core',
      version: '0.0.1',
    };

    res.status(allHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json(body);
  }
}

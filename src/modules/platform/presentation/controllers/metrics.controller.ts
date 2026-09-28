import {
  Controller,
  Get,
  Res,
  Req,
  UnauthorizedException,
  Inject,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../../../shared/auth/decorators.js';
import { MetricsService } from '../../../../shared/observability/metrics.service.js';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import { SwaggerTags } from '../../../../shared/swagger/swagger.constants.js';

@ApiTags(SwaggerTags.HEALTH)
@Controller()
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
  ) {}

  @Public()
  @Version(VERSION_NEUTRAL)
  @Get('metrics')
  @ApiOperation({
    summary: 'Prometheus metrics',
    description:
      'Returns Prometheus text exposition. When `METRICS_AUTH_TOKEN` is set, send `Authorization: Bearer <token>` (security scheme `metrics`).',
  })
  @ApiSecurity('metrics')
  @ApiResponse({
    status: 200,
    description: 'Prometheus text exposition format',
    content: {
      'text/plain': {
        schema: { type: 'string', example: '# HELP …\n# TYPE …\n' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid metrics token' })
  async getMetrics(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (this.config.METRICS_AUTH_TOKEN) {
      const auth = req.headers.authorization;
      if (auth !== `Bearer ${this.config.METRICS_AUTH_TOKEN}`) {
        throw new UnauthorizedException('Metrics access denied');
      }
    }

    res.set('Content-Type', this.metrics.registry.contentType);
    res.end(await this.metrics.getMetrics());
  }
}

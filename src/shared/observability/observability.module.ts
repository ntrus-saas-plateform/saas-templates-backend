import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsService } from './metrics.service.js';
import { IdentityMetricsService } from './identity-metrics.service.js';
import { MetricsInterceptor } from './metrics.interceptor.js';
import { TracingModule } from './tracing.module.js';

@Global()
@Module({
  imports: [TracingModule],
  providers: [
    MetricsService,
    IdentityMetricsService,
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
  exports: [MetricsService, IdentityMetricsService, TracingModule],
})
export class ObservabilityModule {}

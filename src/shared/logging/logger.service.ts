import { Injectable, Inject } from '@nestjs/common';
import pino from 'pino';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';

@Injectable()
export class LoggerService {
  private readonly logger: pino.Logger;

  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly tenantContext: TenantContextService,
  ) {
    this.logger = pino({
      level: this.config.LOG_LEVEL,
      base: {
        service: this.config.SERVICE_NAME,
        environment: this.config.NODE_ENV,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  private enrich(bindings: Record<string, unknown> = {}): Record<string, unknown> {
    const ctx = this.tenantContext.get();
    return {
      ...bindings,
      tenantId: ctx.tenantId || undefined,
      organizationId: ctx.organizationId || undefined,
      userId: ctx.userId || undefined,
      requestId: ctx.requestId || undefined,
      correlationId: ctx.correlationId || undefined,
      traceId: ctx.traceId || undefined,
    };
  }

  info(message: string, bindings?: Record<string, unknown>): void {
    this.logger.info(this.enrich(bindings), message);
  }

  warn(message: string, bindings?: Record<string, unknown>): void {
    this.logger.warn(this.enrich(bindings), message);
  }

  error(message: string, error?: Error, bindings?: Record<string, unknown>): void {
    this.logger.error({ ...this.enrich(bindings), err: error }, message);
  }

  debug(message: string, bindings?: Record<string, unknown>): void {
    this.logger.debug(this.enrich(bindings), message);
  }
}

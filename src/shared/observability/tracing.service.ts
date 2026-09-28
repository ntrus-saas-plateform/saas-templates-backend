import { Injectable } from '@nestjs/common';
import { trace, context, SpanStatusCode, type Span } from '@opentelemetry/api';
import { TenantContextService } from '../tenancy/tenant-context.service.js';

@Injectable()
export class TracingService {
  private readonly tracer = trace.getTracer('platform-core');

  constructor(private readonly tenantContext: TenantContextService) {}

  startSpan(name: string): Span {
    const ctx = this.tenantContext.get();
    return this.tracer.startSpan(name, {
      attributes: {
        'tenant.id': ctx.tenantId || undefined,
        'organization.id': ctx.organizationId || undefined,
        'user.id': ctx.userId || undefined,
        'correlation.id': ctx.correlationId || undefined,
        'request.id': ctx.requestId || undefined,
      },
    });
  }

  async runInSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
    const span = this.startSpan(name);
    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}

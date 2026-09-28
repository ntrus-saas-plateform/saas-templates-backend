import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
import type { Request } from 'express';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const start = Date.now();
    const method = request.method;
    const route = request.route?.path ?? request.path;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = (Date.now() - start) / 1000;
          this.metrics.httpRequestCount.inc({ method, route, status: '2xx' });
          this.metrics.httpRequestDuration.observe({ method, route }, duration);
        },
        error: () => {
          const duration = (Date.now() - start) / 1000;
          this.metrics.httpRequestCount.inc({ method, route, status: '5xx' });
          this.metrics.httpRequestDuration.observe({ method, route }, duration);
        },
      }),
      finalize(() => {}),
    );
  }
}

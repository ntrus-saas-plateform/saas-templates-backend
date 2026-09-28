import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable, of, from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { IDEMPOTENCY_STORE_PORT } from '../../core/domain/ports/idempotency.port.js';
import type { IdempotencyStorePort } from '../../core/domain/ports/idempotency.port.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { hashRequestBody } from '../security/sanitize.js';
import { DomainError, ErrorCode } from '../../core/domain/errors/domain-error.js';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @Inject(IDEMPOTENCY_STORE_PORT) private readonly store: IdempotencyStorePort,
    private readonly tenantContext: TenantContextService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
      return next.handle();
    }

    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;
    if (!idempotencyKey) {
      return next.handle();
    }

    const ctx = this.tenantContext.get();
    if (!ctx.tenantId) {
      return next.handle();
    }

    const requestHash = hashRequestBody(request.body);
    const result = await this.store.acquire(idempotencyKey, ctx.tenantId, requestHash);

    if (result.type === 'conflict') {
      throw new DomainError(
        ErrorCode.IDEMPOTENCY_CONFLICT,
        'Idempotency key reused with different payload',
      );
    }

    if (result.type === 'replay') {
      response.status(result.record.statusCode);
      return of(JSON.parse(result.record.responseBody));
    }

    return next.handle().pipe(
      mergeMap((body) =>
        from(
          this.store
            .complete(idempotencyKey, ctx.tenantId, response.statusCode, JSON.stringify(body))
            .then(() => body),
        ),
      ),
    );
  }
}

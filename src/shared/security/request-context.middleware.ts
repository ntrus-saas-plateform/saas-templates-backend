import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { EMPTY_TENANT_CONTEXT } from '../../core/domain/context/tenant-context.js';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) ?? randomUUID();
    const correlationId = (req.headers['x-correlation-id'] as string) ?? requestId;
    const traceId = (req.headers['x-trace-id'] as string) ?? null;

    res.setHeader('x-request-id', requestId);
    res.setHeader('x-correlation-id', correlationId);

    const context = {
      ...EMPTY_TENANT_CONTEXT,
      requestId,
      correlationId,
      traceId,
    };

    this.tenantContext.run(context, () => next());
  }
}

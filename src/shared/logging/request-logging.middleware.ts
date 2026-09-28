import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { LoggerService } from '../logging/logger.service.js';

const SKIP =
  /^(?:\/(?:liveness|readiness|health|metrics)|\/api\/v1\/health)(?:\?|$)/;

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (SKIP.test(req.originalUrl ?? req.url ?? '')) {
      next();
      return;
    }

    const started = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - started;
      const status = res.statusCode;
      const line = `${req.method} ${req.originalUrl ?? req.url} ${status} ${ms}ms`;
      const bindings = {
        method: req.method,
        path: req.originalUrl ?? req.url,
        status,
        durationMs: ms,
      };
      if (status >= 500) {
        this.logger.error(line, undefined, bindings);
      } else if (status >= 400) {
        this.logger.warn(line, bindings);
      } else {
        this.logger.info(line, bindings);
      }
    });

    next();
  }
}

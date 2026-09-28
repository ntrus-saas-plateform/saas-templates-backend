import { Injectable, NestMiddleware, ForbiddenException, Inject } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';

const CSRF_COOKIE = 'csrf-token';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(@Inject(APP_CONFIG) private readonly config: EnvironmentConfig) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (!this.config.CSRF_ENABLED) {
      next();
      return;
    }

    if (SAFE_METHODS.has(req.method)) {
      this.ensureCsrfCookie(req, res);
      next();
      return;
    }

    const cookieToken = req.cookies?.[CSRF_COOKIE] as string | undefined;
    const headerToken = req.headers[CSRF_HEADER] as string | undefined;

    if (!cookieToken || !headerToken || !this.tokensMatch(cookieToken, headerToken)) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    next();
  }

  private ensureCsrfCookie(req: Request, res: Response): void {
    if (!req.cookies?.[CSRF_COOKIE]) {
      const token = randomBytes(32).toString('hex');
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: false,
        secure: this.config.NODE_ENV === 'production',
        sameSite: 'strict',
      });
    }
  }

  private tokensMatch(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}

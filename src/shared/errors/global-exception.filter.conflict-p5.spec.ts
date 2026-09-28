import { describe, expect, it } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { DomainError, ErrorCode } from '../../core/domain/errors/domain-error.js';
import { GlobalExceptionFilter } from './global-exception.filter.js';

describe('GlobalExceptionFilter CONFLICT → 409 (P5)', () => {
  it('maps Configuration version conflict to HTTP 409', () => {
    const filter = new GlobalExceptionFilter({
      get: () => ({ requestId: 'r1', correlationId: 'c1' }),
    } as never);
    let status = 0;
    let body: unknown;
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({
          status: (code: number) => {
            status = code;
            return {
              json: (payload: unknown) => {
                body = payload;
              },
            };
          },
        }),
        getRequest: () => ({
          url: '/api/v1/business-config/capabilities/FEFO/enable',
          method: 'POST',
        }),
      }),
    };

    filter.catch(
      new DomainError(ErrorCode.CONFLICT, 'Configuration version conflict'),
      host as never,
    );

    expect(status).toBe(HttpStatus.CONFLICT);
    expect(body).toMatchObject({
      error: expect.objectContaining({ code: ErrorCode.CONFLICT }),
    });
  });
});

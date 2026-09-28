import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainError, ErrorCode } from '../../core/domain/errors/domain-error.js';
import { ACCESS_DENIED_MESSAGE } from '../../core/domain/errors/access-denied.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details: readonly Record<string, unknown>[];
    requestId: string;
    correlationId: string;
  };
}

const ENUMERATION_SAFE_CODES: ReadonlySet<ErrorCode> = new Set([
  ErrorCode.TENANT_NOT_FOUND,
  ErrorCode.ORGANIZATION_NOT_FOUND,
]);

const ERROR_CODE_TO_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_ERROR]: HttpStatus.BAD_REQUEST,
  [ErrorCode.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [ErrorCode.TENANT_NOT_FOUND]: HttpStatus.FORBIDDEN,
  [ErrorCode.ORGANIZATION_NOT_FOUND]: HttpStatus.FORBIDDEN,
  [ErrorCode.RESOURCE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.CONFLICT]: HttpStatus.CONFLICT,
  [ErrorCode.IDEMPOTENCY_CONFLICT]: HttpStatus.CONFLICT,
  [ErrorCode.RATE_LIMITED]: HttpStatus.TOO_MANY_REQUESTS,
  [ErrorCode.DEPENDENCY_UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [ErrorCode.INTERNAL_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.INSUFFICIENT_STOCK]: HttpStatus.CONFLICT,
  [ErrorCode.ATP_WAIT]: HttpStatus.CONFLICT,
  [ErrorCode.ATP_ALTERNATIVE_WAREHOUSE]: HttpStatus.CONFLICT,
  [ErrorCode.PRODUCT_NOT_SELLABLE]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.PRODUCT_BLOCKED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.PRICE_NOT_FOUND]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.CUSTOMER_CREDIT_EXCEEDED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.ORDER_ALREADY_CONFIRMED]: HttpStatus.CONFLICT,
  [ErrorCode.INVALID_STATE_TRANSITION]: HttpStatus.CONFLICT,
  [ErrorCode.INVALID_STOCK_TRANSITION]: HttpStatus.CONFLICT,
  [ErrorCode.RESERVATION_EXPIRED]: HttpStatus.CONFLICT,
  [ErrorCode.RESERVATION_EXCEEDS_AVAILABLE]: HttpStatus.CONFLICT,
  [ErrorCode.ALLOCATION_CONFLICT]: HttpStatus.CONFLICT,
  [ErrorCode.LOT_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.LOT_EXPIRED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.LOT_RECALLED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.PRODUCT_QUARANTINED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.LOCATION_INCOMPATIBLE]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.TRANSFER_ALREADY_COMPLETED]: HttpStatus.CONFLICT,
  [ErrorCode.COUNT_ALREADY_CLOSED]: HttpStatus.CONFLICT,
  [ErrorCode.QUARANTINE_REQUIRED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.PAYMENT_FAILED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.DUPLICATE_OPERATION]: HttpStatus.CONFLICT,
  [ErrorCode.TENANT_ACCESS_DENIED]: HttpStatus.FORBIDDEN,
  [ErrorCode.APPROVAL_REQUIRED]: HttpStatus.UNPROCESSABLE_ENTITY,
};

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly tenantContext: TenantContextService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const context = this.tenantContext.get();
    const isProduction = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = ErrorCode.INTERNAL_ERROR;
    let message = 'Internal server error';
    let details: readonly Record<string, unknown>[] = [];

    if (exception instanceof DomainError) {
      status = ERROR_CODE_TO_STATUS[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
      code = ENUMERATION_SAFE_CODES.has(exception.code)
        ? ErrorCode.FORBIDDEN
        : exception.code;
      message = ENUMERATION_SAFE_CODES.has(exception.code)
        ? ACCESS_DENIED_MESSAGE
        : exception.message;
      details = ENUMERATION_SAFE_CODES.has(exception.code) ? [] : exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null) {
        const obj = body as Record<string, unknown>;
        message = (obj.message as string) ?? exception.message;
        if (Array.isArray(obj.message)) {
          message = 'Validation failed';
          details = obj.message.map((m) => ({ message: String(m) }));
        }
      } else {
        message = String(body);
      }
      code = this.mapHttpStatusToCode(status);
    } else if (!isProduction && exception instanceof Error) {
      message = exception.message;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      Logger.error(
        exception instanceof Error ? exception.stack ?? exception.message : exception,
        GlobalExceptionFilter.name,
      );
    }

    const body: ErrorResponse = {
      error: {
        code,
        message,
        details,
        requestId: context.requestId,
        correlationId: context.correlationId,
      },
    };

    response.status(status).json(body);
  }

  private mapHttpStatusToCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.RESOURCE_NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMITED;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ErrorCode.DEPENDENCY_UNAVAILABLE;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}

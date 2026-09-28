import { Global, Module } from '@nestjs/common';
import { LoggerService } from './logger.service.js';
import { RequestLoggingMiddleware } from './request-logging.middleware.js';

@Global()
@Module({
  providers: [LoggerService, RequestLoggingMiddleware],
  exports: [LoggerService, RequestLoggingMiddleware],
})
export class LoggingModule {}

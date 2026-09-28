import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PgAuditWriter } from './pg-audit.writer.js';
import { AuditInterceptor } from './audit.interceptor.js';
import { AUDIT_WRITER_PORT } from '../../core/domain/ports/audit.port.js';

@Global()
@Module({
  providers: [
    { provide: AUDIT_WRITER_PORT, useClass: PgAuditWriter },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AUDIT_WRITER_PORT],
})
export class AuditModule {}

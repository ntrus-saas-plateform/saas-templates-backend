import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { AUDIT_WRITER_PORT } from '../../core/domain/ports/audit.port.js';
import type { AuditWriterPort } from '../../core/domain/ports/audit.port.js';
import { AUDIT_ACTION_KEY } from '../auth/decorators.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { sanitizeForAudit } from '../security/sanitize.js';
import { getAuditBefore } from './audit-before.js';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @Inject(AUDIT_WRITER_PORT) private readonly auditWriter: AuditWriterPort,
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditMeta = this.reflector.getAllAndOverride<{ action: string; resource: string }>(
      AUDIT_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!auditMeta) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const ctx = this.tenantContext.get();

    return next.handle().pipe(
      tap(async (body) => {
        await this.writeAudit(auditMeta, ctx, request, 'success', body);
      }),
      catchError((error: Error) => {
        void this.writeAudit(auditMeta, ctx, request, 'failure', null, error.message);
        return throwError(() => error);
      }),
    );
  }

  private async writeAudit(
    meta: { action: string; resource: string },
    ctx: ReturnType<TenantContextService['get']>,
    request: Request,
    status: 'success' | 'failure',
    responseBody: unknown,
    errorMessage?: string,
  ): Promise<void> {
    if (!ctx.tenantId) return;

    const body =
      request.body && typeof request.body === 'object'
        ? (request.body as Record<string, unknown>)
        : {};
    const params = request.params ?? {};
    const pharmacyLocationId =
      (typeof params.locationId === 'string' && params.locationId) ||
      (typeof body.locationId === 'string' && body.locationId) ||
      null;
    const reason =
      (typeof body.reason === 'string' && body.reason) ||
      (typeof body.overrideReason === 'string' && body.overrideReason) ||
      (typeof body.fefoOverrideReason === 'string' && body.fefoOverrideReason) ||
      null;

    await this.auditWriter.write({
      id: randomUUID(),
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
      actorId: ctx.userId ?? ctx.subjectId ?? 'unknown',
      actorType: 'user',
      action: meta.action,
      resource: meta.resource,
      resourceId: this.extractResourceId(request, responseBody),
      status,
      timestamp: new Date(),
      correlationId: ctx.correlationId,
      requestId: ctx.requestId,
      ip: request.ip ?? null,
      userAgent: (request.headers['user-agent'] as string) ?? null,
      before: getAuditBefore(request) ?? this.inferBeforeFromMutation(request),
      after: sanitizeForAudit(
        responseBody && typeof responseBody === 'object'
          ? (responseBody as Record<string, unknown>)
          : null,
      ),
      metadata: {
        ...(errorMessage ? { error: errorMessage } : {}),
        ...(reason ? { reason } : {}),
        ...(pharmacyLocationId ? { pharmacyLocationId } : {}),
        source: (request.headers['x-client-source'] as string) ?? 'http',
        // Control-plane audit_logs ≠ tenant outbox TX (DB-per-tenant). Link via correlationId.
        auditOutboxSameTx: false,
      },
    });
  }

  /**
   * Fallback when handlers did not call setAuditBefore: capture id + expectedVersion
   * for PATCH/PUT/DELETE mutations (not a full entity snapshot).
   */
  private inferBeforeFromMutation(request: Request): Record<string, unknown> | null {
    const method = (request.method ?? '').toUpperCase();
    if (!['PATCH', 'PUT', 'DELETE', 'POST'].includes(method)) return null;
    const resourceId = this.extractResourceId(request, null);
    const body =
      request.body && typeof request.body === 'object'
        ? (request.body as Record<string, unknown>)
        : {};
    const expectedVersion =
      typeof body.expectedVersion === 'number' ? body.expectedVersion : null;
    const status = typeof body.status === 'string' ? body.status : null;
    if (!resourceId && expectedVersion == null && !status) return null;
    return sanitizeForAudit({
      resourceId,
      expectedVersion,
      ...(status ? { fromStatusHint: status } : {}),
      snapshotKind: 'mutation_hint',
    });
  }

  private extractResourceId(request: Request, responseBody: unknown): string | null {
    const params = request.params ?? {};
    const paramId =
      params.id ??
      params.checkId ??
      params.prescriptionId ??
      params.dispensingId ??
      params.recallId ??
      params.registerId ??
      params.membershipId ??
      params.invitationId ??
      params.delegationId ??
      params.grantId ??
      params.organizationId ??
      params.tenantId ??
      params.identityId;

    if (typeof paramId === 'string' && paramId.length > 0) {
      return paramId;
    }

    if (responseBody && typeof responseBody === 'object') {
      const data = (responseBody as { data?: Record<string, unknown> }).data;
      if (data && typeof data.id === 'string') {
        return data.id;
      }
    }

    return null;
  }
}

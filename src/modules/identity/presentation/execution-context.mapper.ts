import type { TenantContextData } from '../../../core/domain/context/tenant-context.js';
import type { ExecutionContext } from '../application/common/execution-context.js';

export function toExecutionContext(data: TenantContextData): ExecutionContext {
  return {
    tenantId: data.tenantId,
    subjectId: data.subjectId,
    username: data.username,
    email: data.email ?? null,
    organizationId: data.organizationId,
    correlationId: data.correlationId,
    traceId: data.traceId,
    permissions: data.permissions,
    tokenId: data.tokenId,
    tokenIssuedAt: data.tokenIssuedAt,
  };
}
